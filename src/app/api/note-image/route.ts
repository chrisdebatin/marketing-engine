import { requireSession } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";

const BUCKET = "note-images";
const MAX_BYTES = 8 * 1024 * 1024;

/**
 * Screenshot-Upload für Anfragen-To-dos: legt das Bild im öffentlichen
 * Storage-Bucket "note-images" ab (Bucket wird beim ersten Upload
 * automatisch angelegt) und gibt die öffentliche URL zurück.
 */
export async function POST(req: Request) {
  await requireSession();

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return Response.json({ error: "Kein Bild empfangen." }, { status: 400 });
  }
  const file = form.get("file");
  if (!(file instanceof File)) {
    return Response.json({ error: "Kein Bild empfangen." }, { status: 400 });
  }
  if (!file.type.startsWith("image/")) {
    return Response.json({ error: "Nur Bilder sind möglich." }, { status: 400 });
  }
  if (file.size > MAX_BYTES) {
    return Response.json({ error: "Bild zu groß (max. 8 MB)." }, { status: 400 });
  }

  const ext = (file.type.split("/")[1] ?? "png").replace(/[^a-z0-9]/gi, "") || "png";
  const path = `${crypto.randomUUID()}.${ext}`;
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
