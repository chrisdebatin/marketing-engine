/**
 * Dateien an Anfragen-To-dos: Upload läuft über /api/note-image (Supabase
 * Storage, Bucket "note-images"); an der Notiz hängt nur ein Array
 * öffentlicher URLs (Spalte hub_notes.images, jsonb). Neben Bildern sind
 * auch PDF/Office/CSV erlaubt — Bilder werden als Thumbnail angezeigt,
 * andere Dateien als Datei-Chip mit Namen.
 */

export const NOTE_IMAGE_MAX = 6;

/** Für <input accept=…>: Bilder plus gängige Dokument-Formate. */
export const NOTE_FILE_ACCEPT =
  "image/*,.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.csv,.txt";

const ALLOWED_DOC_TYPES = new Set([
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-powerpoint",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "text/csv",
  "text/plain",
]);

export function noteFileAllowed(type: string): boolean {
  return type.startsWith("image/") || ALLOWED_DOC_TYPES.has(type);
}

/** jsonb-Wert defensiv in eine URL-Liste umwandeln. */
export function noteImages(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((v): v is string => typeof v === "string" && v.startsWith("http"))
    .slice(0, NOTE_IMAGE_MAX);
}

/** Ist die URL ein Bild (fürs Thumbnail)? */
export function isImageUrl(url: string): boolean {
  return /\.(png|jpe?g|gif|webp|avif|svg)(\?|$)/i.test(url);
}

/** Anzeigename einer Datei-URL (Upload-Pfad: <uuid>-<name>). */
export function noteFileName(url: string): string {
  const last = decodeURIComponent(url.split("/").pop() ?? "Datei").split("?")[0];
  return last.replace(/^[0-9a-f-]{36}-/i, "") || "Datei";
}

/** Datei hochladen (Client) → öffentliche URL. */
export async function uploadNoteImage(
  file: File,
): Promise<{ ok: true; url: string } | { ok: false; error: string }> {
  if (!noteFileAllowed(file.type)) {
    return {
      ok: false,
      error: "Dateityp nicht unterstützt (Bilder, PDF, Office, CSV/TXT).",
    };
  }
  if (file.size > 8 * 1024 * 1024) {
    return { ok: false, error: "Datei zu groß (max. 8 MB)." };
  }
  const body = new FormData();
  body.append("file", file);
  try {
    const res = await fetch("/api/note-image", { method: "POST", body });
    const json = (await res.json()) as { url?: string; error?: string };
    if (!res.ok || !json.url) {
      return { ok: false, error: json.error ?? "Upload fehlgeschlagen." };
    }
    return { ok: true, url: json.url };
  } catch {
    return { ok: false, error: "Upload fehlgeschlagen (offline?)." };
  }
}

/** Bild-Dateien aus einem Paste-Event ziehen (Screenshots aus der Zwischenablage). */
export function imagesFromClipboard(items: DataTransferItemList): File[] {
  const files: File[] = [];
  for (const item of Array.from(items)) {
    if (item.kind === "file" && item.type.startsWith("image/")) {
      const f = item.getAsFile();
      if (f) files.push(f);
    }
  }
  return files;
}
