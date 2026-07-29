/**
 * Bilder an Anfragen-To-dos: Upload läuft über /api/note-image (Supabase
 * Storage, Bucket "note-images"); an der Notiz hängt nur ein Array
 * öffentlicher URLs (Spalte hub_notes.images, jsonb).
 */

export const NOTE_IMAGE_MAX = 6;

/** jsonb-Wert defensiv in eine URL-Liste umwandeln. */
export function noteImages(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((v): v is string => typeof v === "string" && v.startsWith("http"))
    .slice(0, NOTE_IMAGE_MAX);
}

/** Bild hochladen (Client) → öffentliche URL. */
export async function uploadNoteImage(
  file: File,
): Promise<{ ok: true; url: string } | { ok: false; error: string }> {
  if (!file.type.startsWith("image/")) {
    return { ok: false, error: "Nur Bilder sind möglich." };
  }
  if (file.size > 8 * 1024 * 1024) {
    return { ok: false, error: "Bild zu groß (max. 8 MB)." };
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
