import { requireSession } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";

const BUCKET = "meta-creatives";
const ALLOWED = new Set(["video/mp4", "video/quicktime", "image/jpeg", "image/png"]);
const MAX_BYTES = 200 * 1024 * 1024;

/**
 * Signierte Upload-URL für große Dateien (v. a. Videos): Der Browser lädt
 * damit direkt zu Supabase Storage hoch und umgeht Vercels 4,5-MB-Limit.
 * Danach registriert er die Datei per JSON-POST auf /api/meta-ads/creative.
 */
export async function POST(req: Request) {
  const session = await requireSession();
  if (!session.isAdmin) {
    return Response.json({ error: "Nur für Admins." }, { status: 403 });
  }

  const { name, mime, size } = (await req.json().catch(() => ({}))) as {
    name?: string;
    mime?: string;
    size?: number;
  };
  if (!name || !mime) {
    return Response.json({ error: "Name/Typ fehlen." }, { status: 400 });
  }
  if (!ALLOWED.has(mime)) {
    return Response.json(
      { error: "Nur MP4/MOV-Videos oder JPG/PNG-Bilder." },
      { status: 400 },
    );
  }
  if ((size ?? 0) > MAX_BYTES) {
    return Response.json({ error: "Datei zu groß (max. 200 MB)." }, { status: 400 });
  }

  const safeName =
    name
      .normalize("NFKD")
      .replace(/[^\w.-]+/g, "_")
      .replace(/_{2,}/g, "_")
      .slice(0, 80) || "datei";
  const path = `${crypto.randomUUID()}-${safeName}`;

  const admin = createAdminClient();
  let { data, error } = await admin.storage.from(BUCKET).createSignedUploadUrl(path);
  if (error && /bucket/i.test(error.message)) {
    await admin.storage.createBucket(BUCKET, { public: true });
    ({ data, error } = await admin.storage.from(BUCKET).createSignedUploadUrl(path));
  }
  if (error || !data) {
    console.error("meta-creative sign:", error?.message);
    return Response.json({ error: "Signierte URL fehlgeschlagen." }, { status: 500 });
  }
  return Response.json({ path: data.path, token: data.token });
}
