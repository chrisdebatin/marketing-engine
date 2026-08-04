import { requireSession } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";

const BUCKET = "meta-creatives";
const MAX_BYTES = 8 * 1024 * 1024;
const ALLOWED = new Set(["image/jpeg", "image/png"]);

/**
 * Werbemittel-Upload für den Meta-Ads-Agenten: Bild in den öffentlichen
 * Bucket "meta-creatives" (wird beim ersten Upload angelegt) + Katalog-Zeile
 * in meta_creatives. Nur JPG/PNG — genau das akzeptiert Metas adimages-API.
 */
export async function POST(req: Request) {
  const session = await requireSession();
  if (!session.isAdmin) {
    return Response.json({ error: "Nur für Admins." }, { status: 403 });
  }

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return Response.json({ error: "Keine Datei empfangen." }, { status: 400 });
  }
  const file = form.get("file");
  if (!(file instanceof File)) {
    return Response.json({ error: "Keine Datei empfangen." }, { status: 400 });
  }
  if (!ALLOWED.has(file.type)) {
    return Response.json(
      { error: "Nur JPG- oder PNG-Bilder (das erwartet die Meta-API)." },
      { status: 400 },
    );
  }
  if (file.size > MAX_BYTES) {
    return Response.json({ error: "Datei zu groß (max. 8 MB)." }, { status: 400 });
  }
  const notiz = String(form.get("notiz") ?? "").trim().slice(0, 500) || null;

  const safeName =
    file.name
      .normalize("NFKD")
      .replace(/[^\w.-]+/g, "_")
      .replace(/_{2,}/g, "_")
      .slice(0, 80) || "creative";
  const path = `${crypto.randomUUID()}-${safeName}`;
  const bytes = Buffer.from(await file.arrayBuffer());

  const admin = createAdminClient();
  let { error } = await admin.storage
    .from(BUCKET)
    .upload(path, bytes, { contentType: file.type });
  if (error && /bucket/i.test(error.message)) {
    await admin.storage.createBucket(BUCKET, { public: true });
    ({ error } = await admin.storage
      .from(BUCKET)
      .upload(path, bytes, { contentType: file.type }));
  }
  if (error) {
    console.error("meta-creative upload:", error.message);
    return Response.json({ error: "Upload fehlgeschlagen." }, { status: 500 });
  }

  const { data: pub } = admin.storage.from(BUCKET).getPublicUrl(path);
  const { data: row, error: dbErr } = await admin
    .from("meta_creatives")
    .insert({
      name: file.name.slice(0, 200),
      path,
      url: pub.publicUrl,
      mime: file.type,
      size_bytes: file.size,
      notiz,
    })
    .select("*")
    .single();
  if (dbErr) {
    const missing = dbErr.code === "PGRST205" || dbErr.code === "42P01";
    return Response.json(
      {
        error: missing
          ? "Tabelle meta_creatives fehlt — bitte supabase/apply_all_pending.sql im Supabase SQL-Editor ausführen."
          : "Speichern fehlgeschlagen.",
      },
      { status: 500 },
    );
  }
  return Response.json({ creative: row });
}

/** Werbemittel entfernen (Katalog-Zeile + Datei im Bucket). */
export async function DELETE(req: Request) {
  const session = await requireSession();
  if (!session.isAdmin) {
    return Response.json({ error: "Nur für Admins." }, { status: 403 });
  }
  const { id } = (await req.json().catch(() => ({}))) as { id?: string };
  if (!id) return Response.json({ error: "ID fehlt." }, { status: 400 });

  const admin = createAdminClient();
  const { data: row } = await admin
    .from("meta_creatives")
    .select("path")
    .eq("id", id)
    .maybeSingle();
  if (row?.path) await admin.storage.from(BUCKET).remove([row.path]);
  const { error } = await admin.from("meta_creatives").delete().eq("id", id);
  if (error) return Response.json({ error: "Löschen fehlgeschlagen." }, { status: 500 });
  return Response.json({ ok: true });
}
