"use client";

import { useRef, useState } from "react";
import Image from "next/image";
import { ImagePlus, Loader2, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export interface CreativeRow {
  id: string;
  name: string;
  url: string;
  mime: string;
  notiz: string | null;
  created_at: string | null;
}

/**
 * Werbemittel-Galerie: JPG/PNG hochladen (optional mit Notiz, z. B.
 * "Recruiting-Motiv"), der Agent wählt daraus beim Anzeigen-Erstellen.
 */
// Vercel lehnt Request-Bodies > 4,5 MB ab und Meta braucht keine Druckqualität:
// große Bilder vor dem Upload im Browser auf max. 2000 px als JPEG verkleinern.
const DIRECT_UPLOAD_MAX = 1_500_000;
const MAX_DIMENSION = 2000;

async function shrinkForUpload(file: File): Promise<File> {
  if (file.size <= DIRECT_UPLOAD_MAX) return file;
  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, MAX_DIMENSION / Math.max(bitmap.width, bitmap.height));
    const w = Math.max(1, Math.round(bitmap.width * scale));
    const h = Math.max(1, Math.round(bitmap.height * scale));
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    canvas.getContext("2d")?.drawImage(bitmap, 0, 0, w, h);
    bitmap.close();
    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, "image/jpeg", 0.85),
    );
    if (!blob) return file;
    return new File([blob], file.name.replace(/\.(png|jpe?g)$/i, "") + ".jpg", {
      type: "image/jpeg",
    });
  } catch {
    return file;
  }
}

export function MetaCreatives({ initial }: { initial: CreativeRow[] }) {
  const [items, setItems] = useState<CreativeRow[]>(initial);
  const [notiz, setNotiz] = useState("");
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  async function upload(files: FileList | null) {
    if (!files || files.length === 0) return;
    const list = Array.from(files);
    const note = notiz.trim();
    setBusy(true);
    setError(null);
    const failed: string[] = [];
    let done = 0;
    const queue = [...list];

    async function worker() {
      for (;;) {
        const file = queue.shift();
        if (!file) return;
        try {
          const prepped = await shrinkForUpload(file);
          const form = new FormData();
          form.set("file", prepped);
          if (note) form.set("notiz", note);
          const res = await fetch("/api/meta-ads/creative", {
            method: "POST",
            body: form,
          });
          const data = await res.json();
          if (!res.ok) failed.push(`${file.name}: ${data.error ?? "Fehler"}`);
          else setItems((cur) => [data.creative as CreativeRow, ...cur]);
        } catch {
          failed.push(`${file.name}: Netzwerkfehler`);
        }
        done++;
        setProgress(`${done}/${list.length} hochgeladen…`);
      }
    }

    await Promise.all(Array.from({ length: 3 }, worker));
    setNotiz("");
    setBusy(false);
    setProgress(null);
    if (fileRef.current) fileRef.current.value = "";
    if (failed.length > 0) {
      setError(
        `${failed.length} von ${list.length} Dateien fehlgeschlagen:\n${failed.join("\n")}`,
      );
    }
  }

  async function remove(id: string) {
    setError(null);
    const res = await fetch("/api/meta-ads/creative", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    if (res.ok) setItems((cur) => cur.filter((c) => c.id !== id));
    else setError("Löschen fehlgeschlagen.");
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <input
          ref={fileRef}
          type="file"
          accept="image/jpeg,image/png"
          multiple
          hidden
          onChange={(e) => upload(e.target.files)}
        />
        <Button
          type="button"
          variant="outline"
          disabled={busy}
          onClick={() => fileRef.current?.click()}
        >
          {busy ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <ImagePlus className="size-4" />
          )}
          {busy && progress ? progress : "Creative hochladen"}
        </Button>
        <Input
          value={notiz}
          onChange={(e) => setNotiz(e.target.value)}
          placeholder="Notiz für den Agenten (optional), z. B. „Recruiting-Motiv Pflegekraft“"
          className="max-w-md"
        />
      </div>
      {error && (
        <p className="text-sm whitespace-pre-wrap text-destructive">{error}</p>
      )}

      {items.length === 0 ? (
        <p className="rounded-xl border bg-card p-5 text-sm text-muted-foreground shadow-sm">
          Noch keine Werbemittel hochgeladen. Lade JPG/PNG-Motive hoch — der
          Agent nutzt sie automatisch beim Erstellen von Anzeigen.
        </p>
      ) : (
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          {items.map((c) => (
            <li
              key={c.id}
              className="group relative overflow-hidden rounded-xl border bg-card shadow-sm"
            >
              <Image
                src={c.url}
                alt={c.name}
                width={320}
                height={320}
                unoptimized
                className="aspect-square w-full object-cover"
              />
              <div className="flex flex-col gap-0.5 p-2">
                <span className="truncate text-xs font-medium" title={c.name}>
                  {c.name}
                </span>
                {c.notiz && (
                  <span className="truncate text-xs text-muted-foreground" title={c.notiz}>
                    {c.notiz}
                  </span>
                )}
              </div>
              <button
                type="button"
                onClick={() => remove(c.id)}
                aria-label="Creative entfernen"
                className="absolute top-1.5 right-1.5 rounded-md bg-background/80 p-1.5 text-muted-foreground opacity-0 shadow-sm transition-opacity group-hover:opacity-100 hover:text-destructive"
              >
                <Trash2 className="size-3.5" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
