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
export function MetaCreatives({ initial }: { initial: CreativeRow[] }) {
  const [items, setItems] = useState<CreativeRow[]>(initial);
  const [notiz, setNotiz] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  async function upload(files: FileList | null) {
    if (!files || files.length === 0) return;
    setBusy(true);
    setError(null);
    try {
      for (const file of Array.from(files)) {
        const form = new FormData();
        form.set("file", file);
        if (notiz.trim()) form.set("notiz", notiz.trim());
        const res = await fetch("/api/meta-ads/creative", {
          method: "POST",
          body: form,
        });
        const data = await res.json();
        if (!res.ok) {
          setError(data.error ?? "Upload fehlgeschlagen.");
          break;
        }
        setItems((cur) => [data.creative as CreativeRow, ...cur]);
      }
      setNotiz("");
    } catch {
      setError("Netzwerkfehler beim Upload.");
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = "";
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
          Creative hochladen
        </Button>
        <Input
          value={notiz}
          onChange={(e) => setNotiz(e.target.value)}
          placeholder="Notiz für den Agenten (optional), z. B. „Recruiting-Motiv Pflegekraft“"
          className="max-w-md"
        />
      </div>
      {error && <p className="text-sm text-destructive">{error}</p>}

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
