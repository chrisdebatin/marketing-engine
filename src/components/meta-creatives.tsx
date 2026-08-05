"use client";

import { useRef, useState } from "react";
import Image from "next/image";
import { ImagePlus, Loader2, Pencil, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

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
        <ul className="flex flex-col gap-4">
          {items.map((c) => (
            <CreativeCard
              key={c.id}
              creative={c}
              onRemove={() => remove(c.id)}
              onNotiz={(notiz) =>
                setItems((cur) =>
                  cur.map((x) => (x.id === c.id ? { ...x, notiz } : x)),
                )
              }
            />
          ))}
        </ul>
      )}
    </div>
  );
}

/** Tag ("kunden"/"mitarbeiter") aus dem Notiz-Anfang ziehen. */
function splitNotiz(notiz: string | null): { tag: string | null; rest: string } {
  const m = /^(kunden|mitarbeiter)\s*[—–-]?\s*/i.exec(notiz ?? "");
  if (!m) return { tag: null, rest: notiz ?? "" };
  return { tag: m[1].toLowerCase(), rest: (notiz ?? "").slice(m[0].length) };
}

function CreativeCard({
  creative,
  onRemove,
  onNotiz,
}: {
  creative: CreativeRow;
  onRemove: () => void;
  onNotiz: (notiz: string | null) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(creative.notiz ?? "");
  const [saving, setSaving] = useState(false);
  const { tag, rest } = splitNotiz(creative.notiz);

  async function save() {
    setSaving(true);
    const res = await fetch("/api/meta-ads/creative", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: creative.id, notiz: draft }),
    });
    setSaving(false);
    if (res.ok) {
      onNotiz(draft.trim() || null);
      setEditing(false);
    }
  }

  return (
    <li className="flex flex-col gap-3 rounded-xl border bg-card p-4 shadow-sm sm:flex-row">
      <Image
        src={creative.url}
        alt={creative.name}
        width={1080}
        height={1080}
        unoptimized
        className="h-auto w-full max-w-xs shrink-0 self-start rounded-lg border"
      />
      <div className="flex min-w-0 flex-1 flex-col gap-2">
        <div className="flex items-start justify-between gap-2">
          <div className="flex min-w-0 flex-wrap items-center gap-2">
            {tag && (
              <span
                className={cn(
                  "rounded-full px-2.5 py-0.5 text-xs font-semibold",
                  tag === "kunden"
                    ? "bg-emerald-100 text-emerald-800"
                    : "bg-sky-100 text-sky-800",
                )}
              >
                {tag}
              </span>
            )}
            <span className="truncate text-xs text-muted-foreground" title={creative.name}>
              {creative.name}
            </span>
          </div>
          <div className="flex shrink-0 gap-1">
            <button
              type="button"
              onClick={() => {
                setDraft(creative.notiz ?? "");
                setEditing((e) => !e);
              }}
              aria-label="Notiz bearbeiten"
              className="rounded-md p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground"
            >
              <Pencil className="size-3.5" />
            </button>
            <button
              type="button"
              onClick={onRemove}
              aria-label="Creative entfernen"
              className="rounded-md p-1.5 text-muted-foreground hover:bg-accent hover:text-destructive"
            >
              <Trash2 className="size-3.5" />
            </button>
          </div>
        </div>

        {editing ? (
          <div className="flex flex-col gap-2">
            <Textarea
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              rows={3}
              placeholder='z. B. „kunden — Quadrat 1:1 (Feed), Motiv 3: …“'
            />
            <div className="flex gap-2">
              <Button type="button" size="sm" onClick={save} disabled={saving}>
                {saving ? <Loader2 className="size-3.5 animate-spin" /> : "Speichern"}
              </Button>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                onClick={() => setEditing(false)}
              >
                Abbrechen
              </Button>
            </div>
          </div>
        ) : (
          <p className="text-sm whitespace-pre-wrap">
            {rest || (
              <span className="text-muted-foreground">
                Keine Beschreibung — Stift anklicken und Tag
                („kunden“/„mitarbeiter“) + Beschreibung ergänzen.
              </span>
            )}
          </p>
        )}
      </div>
    </li>
  );
}
