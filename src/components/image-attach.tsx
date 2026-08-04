"use client";

import { useRef, useState, type ClipboardEvent } from "react";
import { toast } from "sonner";
import { FileText, Loader2, Paperclip, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  NOTE_FILE_ACCEPT,
  NOTE_IMAGE_MAX,
  imagesFromClipboard,
  isImageUrl,
  noteFileName,
  uploadNoteImage,
} from "@/lib/note-images";

/**
 * Dateien an ein Formular hängen: Screenshots per Strg/Cmd+V direkt ins
 * Textfeld (onPaste durchreichen) oder beliebige Dateien (PDF, Office …)
 * über den Büroklammer-Button. Uploads laufen sofort; der Aufrufer bekommt
 * nur die fertigen URLs.
 */
export function useImageAttach() {
  const [images, setImages] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);

  async function addFiles(files: File[]) {
    if (files.length === 0) return;
    setUploading(true);
    try {
      let count = images.length;
      for (const file of files) {
        if (count >= NOTE_IMAGE_MAX) {
          toast.error(`Max. ${NOTE_IMAGE_MAX} Dateien pro Eintrag.`);
          break;
        }
        const r = await uploadNoteImage(file);
        if (r.ok) {
          count++;
          setImages((prev) =>
            prev.includes(r.url) || prev.length >= NOTE_IMAGE_MAX
              ? prev
              : [...prev, r.url],
          );
        } else {
          toast.error(r.error);
        }
      }
    } finally {
      setUploading(false);
    }
  }

  function onPaste(e: ClipboardEvent) {
    const files = imagesFromClipboard(e.clipboardData.items);
    if (files.length > 0) {
      e.preventDefault();
      void addFiles(files);
    }
  }

  return {
    images,
    uploading,
    onPaste,
    addFiles,
    remove: (url: string) => setImages((prev) => prev.filter((u) => u !== url)),
    reset: () => setImages([]),
  };
}

/** Vorschau eines Anhangs: Bild-Thumbnail oder Datei-Chip mit Namen. */
function AttachmentPreview({ url }: { url: string }) {
  if (isImageUrl(url)) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={url}
        alt="Angehängte Datei"
        className="h-14 w-auto rounded-md border object-cover"
      />
    );
  }
  return (
    <span className="flex h-14 max-w-40 items-center gap-1.5 rounded-md border bg-muted/50 px-2.5 text-xs text-muted-foreground">
      <FileText className="size-4 shrink-0 text-primary" />
      <span className="truncate">{noteFileName(url)}</span>
    </span>
  );
}

/** Vorschau der angehängten Dateien + Büroklammer zum Datei-Auswählen. */
export function ImageAttachRow({
  attach,
  disabled,
}: {
  attach: ReturnType<typeof useImageAttach>;
  disabled?: boolean;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  return (
    <div className="flex flex-wrap items-center gap-2">
      <input
        ref={fileRef}
        type="file"
        accept={NOTE_FILE_ACCEPT}
        multiple
        className="hidden"
        onChange={(e) => {
          void attach.addFiles(Array.from(e.target.files ?? []));
          e.target.value = "";
        }}
      />
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="h-8 gap-1.5 text-xs text-muted-foreground"
        disabled={disabled || attach.uploading}
        onClick={() => fileRef.current?.click()}
      >
        {attach.uploading ? (
          <Loader2 className="size-3.5 animate-spin" />
        ) : (
          <Paperclip className="size-3.5" />
        )}
        {attach.uploading ? "Lädt hoch…" : "Datei anhängen"}
      </Button>
      {attach.images.length === 0 && !attach.uploading && (
        <span className="text-xs text-muted-foreground">
          PDF, Office, Bilder — Screenshots auch mit Strg/Cmd+V ins Textfeld
        </span>
      )}
      {attach.images.map((url) => (
        <span key={url} className="relative inline-block">
          <AttachmentPreview url={url} />
          <button
            type="button"
            aria-label="Datei entfernen"
            className="absolute -top-1.5 -right-1.5 rounded-full border bg-background p-0.5 text-muted-foreground shadow-sm hover:text-destructive"
            onClick={() => attach.remove(url)}
          >
            <X className="size-3" />
          </button>
        </span>
      ))}
    </div>
  );
}

/**
 * Datei-Reihe auf einer Kanban-Karte: Bild-Thumbnails (Klick öffnet groß)
 * und Datei-Chips (Klick öffnet/lädt). Mit onRemove erscheint ein X zum
 * Entfernen einzelner Anhänge.
 */
export function NoteImageStrip({
  urls,
  onRemove,
}: {
  urls: string[];
  onRemove?: (url: string) => void;
}) {
  if (urls.length === 0) return null;
  return (
    <span className="flex flex-wrap gap-1.5">
      {urls.map((url) => (
        <span key={url} className="relative inline-block">
          <a href={url} target="_blank" rel="noreferrer">
            {isImageUrl(url) ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={url}
                alt="Anhang zur Anfrage"
                className="h-16 w-auto rounded-md border object-cover transition-opacity hover:opacity-80"
              />
            ) : (
              <span className="flex h-9 max-w-44 items-center gap-1.5 rounded-md border bg-muted/50 px-2.5 text-xs text-muted-foreground transition-colors hover:bg-muted">
                <FileText className="size-3.5 shrink-0 text-primary" />
                <span className="truncate">{noteFileName(url)}</span>
              </span>
            )}
          </a>
          {onRemove && (
            <button
              type="button"
              aria-label="Anhang entfernen"
              className="absolute -top-1.5 -right-1.5 rounded-full border bg-background p-0.5 text-muted-foreground shadow-sm hover:text-destructive"
              onClick={() => onRemove(url)}
            >
              <X className="size-3" />
            </button>
          )}
        </span>
      ))}
    </span>
  );
}
