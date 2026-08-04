import { requireSession } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { noteFileAllowed } from "@/lib/note-images";

const BUCKET = "note-images";
const MAX_BYTES = 8 * 1024 * 1024;

/**
 * Datei-Upload für Anfragen-To-dos (Bilder, PDF, Office, CSV/TXT): legt die
 * Datei im öffentlichen Storage-Bucket "note-images" ab (Bucket wird beim
 * ersten Upload automatisch angelegt) und gibt die öffentliche URL zurück.
 * Der Original-Dateiname bleibt im Pfad erhalten, damit die Karten ihn
 * anzeigen können.
 */
export async function POST(req: Request) {
  await requireSession();

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
  if (!noteFileAllowed(file.type)) {
    return Response.json(
      { error: "Dateityp nicht unterstützt (Bilder, PDF, Office, CSV/TXT)." },
      { status: 400 },
    );
  }
  if (file.size > MAX_BYTES) {
    return Response.json({ error: "Datei zu groß (max. 8 MB)." }, { status: 400 });
  }

  const safeName =
    file.name
      .normalize("NFKD")
      .replace(/[^\w.-]+/g, "_")
      .replace(/_{2,}/g, "_")
      .slice(0, 80) || "datei";
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
    console.error("note-image upload:", error.message);
    return Response.json({ error: "Upload fehlgeschlagen." }, { status: 500 });
  }

  const { data } = admin.storage.from(BUCKET).getPublicUrl(path);
  return Response.json({ url: data.publicUrl });
}
