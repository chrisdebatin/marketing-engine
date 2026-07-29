"use client";

import { useRef, useState, type ClipboardEvent } from "react";
import { toast } from "sonner";
import { Loader2, Paperclip, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  NOTE_IMAGE_MAX,
  imagesFromClipboard,
  uploadNoteImage,
} from "@/lib/note-images";

/**
 * Screenshots an ein Formular hängen: per Strg/Cmd+V direkt ins Textfeld
 * (onPaste durchreichen) oder über den Büroklammer-Button. Bilder werden
 * sofort hochgeladen; der Aufrufer bekommt nur die fertigen URLs.
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
          toast.error(`Max. ${NOTE_IMAGE_MAX} Bilder pro Eintrag.`);
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

/** Thumbnails der angehängten Bilder + Büroklammer zum Datei-Auswählen. */
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
        accept="image/*"
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
        {attach.uploading ? "Lädt hoch…" : "Screenshot anhängen"}
      </Button>
      {attach.images.length === 0 && !attach.uploading && (
        <span className="text-xs text-muted-foreground">
          oder einfach mit Strg/Cmd+V ins Textfeld einfügen
        </span>
      )}
      {attach.images.map((url) => (
        <span key={url} className="relative inline-block">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={url}
            alt="Angehängter Screenshot"
            className="h-14 w-auto rounded-md border object-cover"
          />
          <button
            type="button"
            aria-label="Bild entfernen"
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

/** Bild-Reihe auf einer Kanban-Karte: kleine Thumbnails, Klick öffnet groß. */
export function NoteImageStrip({ urls }: { urls: string[] }) {
  if (urls.length === 0) return null;
  return (
    <span className="flex flex-wrap gap-1.5">
      {urls.map((url) => (
        <a key={url} href={url} target="_blank" rel="noreferrer">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={url}
            alt="Screenshot zur Anfrage"
            className="h-16 w-auto rounded-md border object-cover transition-opacity hover:opacity-80"
          />
        </a>
      ))}
    </span>
  );
}
