"use client";

import { useRef, useState, useTransition } from "react";
import { toast } from "sonner";
import {
  ArrowRight,
  Check,
  Inbox,
  Paperclip,
  Pencil,
  Plus,
  RotateCcw,
  StickyNote,
  Trash2,
} from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { ANFRAGE_TAGS, anfrageTagsOf, hubChip } from "@/lib/anfrage-tags";
import {
  NOTE_FILE_ACCEPT,
  NOTE_IMAGE_MAX,
  noteImages,
  uploadNoteImage,
} from "@/lib/note-images";
import {
  ImageAttachRow,
  NoteImageStrip,
  useImageAttach,
} from "@/components/image-attach";
import {
  createHubNote,
  deleteHubNote,
  updateHubNote,
} from "@/app/(app)/hubs/note-actions";

export const KAMPAGNEN_TOPIC = "Kampagnen-Anfragen";

export interface AnfrageRow {
  id: string;
  hub_id: string;
  text: string;
  done_at: string | null;
  status?: string | null;
  tag?: string | null;
  images?: unknown;
  notiz?: string | null;
  created_at: string | null;
}

type Spalte = "offen" | "in_arbeit" | "erledigt";

function spalteOf(a: AnfrageRow): Spalte {
  if (a.done_at) return "erledigt";
  return a.status === "in_arbeit" ? "in_arbeit" : "offen";
}

const SPALTEN: { key: Spalte; title: string; accent: string }[] = [
  { key: "offen", title: "Offen", accent: "border-t-amber-500" },
  { key: "in_arbeit", title: "In Arbeit", accent: "border-t-primary" },
  { key: "erledigt", title: "Erledigt", accent: "border-t-chart-4" },
];

/**
 * Kampagnen-Anfragen als Kanban: Offen → In Arbeit → Erledigt. Einträge
 * kommen aus dem Schnell-Formular oder der KI-Erfassung des
 * "Was soll laufen?"-Freitexts; sie sind To-dos (Thema "Kampagnen-Anfragen")
 * und erscheinen daher auch auf den Hub-Karten und im Themen-Board.
 */
export function KampagnenAnfragen({
  hubs,
  anfragen,
}: {
  hubs: { id: string; name: string }[];
  anfragen: AnfrageRow[];
}) {
  const [pending, startTransition] = useTransition();
  const [hubId, setHubId] = useState("");
  const [text, setText] = useState("");
  const [tag, setTag] = useState("");
  const attach = useImageAttach();

  const tagItems = {
    "": "Tag (optional)",
    ...Object.fromEntries(ANFRAGE_TAGS.map((t) => [t.key, t.label])),
  };

  const hubItems = Object.fromEntries(hubs.map((h) => [h.id, h.name]));
  const hubName = (id: string) => hubs.find((h) => h.id === id)?.name ?? "—";

  function add() {
    if (pending) return;
    if (!hubId) {
      toast.error("Standort wählen.");
      return;
    }
    if (!text.trim()) {
      toast.error("Anfrage eintragen.");
      return;
    }
    startTransition(async () => {
      const r = await createHubNote({
        hub_id: hubId,
        text: text.trim(),
        is_todo: true,
        topic_title: KAMPAGNEN_TOPIC,
        tag: tag || undefined,
        images: attach.images,
      });
      if (r.ok) {
        toast.success("Anfrage als To-do geloggt");
        setText("");
        attach.reset();
      } else {
        toast.error(r.error);
      }
    });
  }

  // Karten-Editing: Titel-Text und Notiz (je eine Karte gleichzeitig).
  const [editId, setEditId] = useState<string | null>(null);
  const [editText, setEditText] = useState("");
  const [notizId, setNotizId] = useState<string | null>(null);
  const [notizText, setNotizText] = useState("");

  function saveText(a: AnfrageRow) {
    if (pending) return;
    if (!editText.trim()) {
      toast.error("Text eingeben.");
      return;
    }
    startTransition(async () => {
      const r = await updateHubNote(a.id, { text: editText });
      if (r.ok) {
        toast.success("Gespeichert");
        setEditId(null);
      } else {
        toast.error(r.error);
      }
    });
  }

  function saveNotiz(a: AnfrageRow) {
    if (pending) return;
    startTransition(async () => {
      const r = await updateHubNote(a.id, { notiz: notizText });
      if (r.ok) {
        toast.success(notizText.trim() ? "Notiz gespeichert" : "Notiz entfernt");
        setNotizId(null);
      } else {
        toast.error(r.error);
      }
    });
  }

  // Dateien direkt an bestehende Karten hängen (ein Input für alle Karten).
  const cardFileRef = useRef<HTMLInputElement>(null);
  const attachTarget = useRef<AnfrageRow | null>(null);

  function attachToCard(a: AnfrageRow) {
    attachTarget.current = a;
    cardFileRef.current?.click();
  }

  async function onCardFiles(files: File[]) {
    const a = attachTarget.current;
    if (!a || files.length === 0) return;
    const existing = noteImages(a.images);
    const frei = NOTE_IMAGE_MAX - existing.length;
    if (frei <= 0) {
      toast.error(`Max. ${NOTE_IMAGE_MAX} Dateien pro Karte.`);
      return;
    }
    const urls: string[] = [];
    for (const f of files.slice(0, frei)) {
      const r = await uploadNoteImage(f);
      if (r.ok) urls.push(r.url);
      else toast.error(r.error);
    }
    if (urls.length === 0) return;
    startTransition(async () => {
      const r = await updateHubNote(a.id, { images: [...existing, ...urls] });
      if (r.ok) {
        toast.success(
          urls.length === 1 ? "Datei angehängt" : `${urls.length} Dateien angehängt`,
        );
      } else {
        toast.error(r.error);
      }
    });
  }

  function removeFile(a: AnfrageRow, url: string) {
    startTransition(async () => {
      const r = await updateHubNote(a.id, {
        images: noteImages(a.images).filter((u) => u !== url),
      });
      if (r.ok) toast.success("Anhang entfernt");
      else toast.error(r.error);
    });
  }

  function move(a: AnfrageRow, ziel: Spalte) {
    startTransition(async () => {
      const r = await updateHubNote(a.id, {
        done: ziel === "erledigt",
        status: ziel === "in_arbeit" ? "in_arbeit" : null,
      });
      if (r.ok) {
        toast.success(
          ziel === "erledigt"
            ? "Erledigt ✓"
            : ziel === "in_arbeit"
              ? "In Arbeit"
              : "Wieder offen",
        );
      } else {
        toast.error(r.error);
      }
    });
  }

  return (
    <section className="flex flex-col gap-3 rounded-xl border bg-card p-5 shadow-sm">
      <div className="flex flex-wrap items-baseline gap-2">
        <p className="flex items-center gap-1.5 font-semibold">
          <Inbox className="size-4 text-primary" />
          Kampagnen-Anfragen
        </p>
        <span className="text-xs text-muted-foreground">
          per Formular oder KI-Erfassung aus „Was soll laufen?&rdquo; — jede
          Anfrage erscheint auch als To-do auf der Hub-Karte.
        </span>
      </div>

      {/* Eintragen */}
      <div className="flex flex-wrap items-center gap-2">
        <Select
          items={hubItems}
          value={hubId}
          onValueChange={(v) => setHubId(v ?? "")}
        >
          <SelectTrigger className="w-56">
            <SelectValue placeholder="Standort wählen" />
          </SelectTrigger>
          <SelectContent>
            {Object.entries(hubItems).map(([value, label]) => (
              <SelectItem key={value} value={value}>
                {label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Input
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Was wird gewünscht? z. B. Stellenanzeige Pflegefachkraft auf Join"
          maxLength={2000}
          className="min-w-64 flex-1"
          onKeyDown={(e) => {
            if (e.key === "Enter") add();
          }}
          onPaste={attach.onPaste}
        />
        <Select
          items={tagItems}
          value={tag}
          onValueChange={(v) => setTag(v ?? "")}
        >
          <SelectTrigger className="w-44">
            <SelectValue placeholder="Tag (optional)" />
          </SelectTrigger>
          <SelectContent>
            {Object.entries(tagItems).map(([value, label]) => (
              <SelectItem key={value} value={value}>
                {label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button type="button" disabled={pending} onClick={add}>
          <Plus className="size-4" />
          {pending ? "Speichere…" : "Anfrage loggen"}
        </Button>
      </div>
      <ImageAttachRow attach={attach} disabled={pending} />

      {/* Datei-Input für die Karten-Anhänge (Ziel-Karte via attachTarget) */}
      <input
        ref={cardFileRef}
        type="file"
        accept={NOTE_FILE_ACCEPT}
        multiple
        className="hidden"
        onChange={(e) => {
          void onCardFiles(Array.from(e.target.files ?? []));
          e.target.value = "";
        }}
      />

      {/* Kanban */}
      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
        {SPALTEN.map((sp) => {
          const list = anfragen
            .filter((a) => spalteOf(a) === sp.key)
            .slice(0, sp.key === "erledigt" ? 10 : 50);
          return (
            <div
              key={sp.key}
              className={cn(
                "flex min-w-0 flex-col rounded-xl border border-t-4 bg-muted/30",
                sp.accent,
              )}
            >
              <p className="flex items-baseline gap-1.5 px-3 pt-2.5 pb-1.5 text-sm font-semibold">
                {sp.title}
                <span className="font-normal text-muted-foreground tabular-nums">
                  {list.length}
                </span>
              </p>
              <div className="flex flex-col gap-1.5 p-2">
                {list.length === 0 && (
                  <p className="px-1 py-2 text-center text-xs text-muted-foreground">
                    {sp.key === "offen" ? "Keine offenen Anfragen 🎉" : "—"}
                  </p>
                )}
                {list.map((a) => {
                  const kategorien = anfrageTagsOf(a.tag, a.text);
                  return (
                  <div
                    key={a.id}
                    className={cn(
                      "flex flex-col gap-1 rounded-lg border bg-card p-2.5 text-sm shadow-sm",
                      sp.key === "erledigt" && "opacity-70",
                    )}
                  >
                    <span className="flex flex-wrap items-center gap-1.5">
                      <span
                        className={cn(
                          "rounded-full px-2 py-0.5 text-[0.65rem] font-semibold whitespace-nowrap",
                          hubChip(a.hub_id),
                        )}
                      >
                        {hubName(a.hub_id)}
                      </span>
                      {kategorien.map((k) => (
                        <span
                          key={k.key}
                          className={cn(
                            "rounded-full px-2 py-0.5 text-[0.65rem] font-semibold whitespace-nowrap",
                            k.chip,
                          )}
                        >
                          {k.label}
                        </span>
                      ))}
                    </span>
                    {editId === a.id ? (
                      <span className="flex flex-col gap-1">
                        <Textarea
                          value={editText}
                          onChange={(e) => setEditText(e.target.value)}
                          rows={2}
                          maxLength={2000}
                          className="bg-background text-sm"
                          disabled={pending}
                          autoFocus
                        />
                        <span className="flex gap-1">
                          <Button
                            type="button"
                            size="sm"
                            className="h-7 px-2 text-xs"
                            disabled={pending}
                            onClick={() => saveText(a)}
                          >
                            Speichern
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            variant="ghost"
                            className="h-7 px-2 text-xs"
                            onClick={() => setEditId(null)}
                          >
                            Abbrechen
                          </Button>
                        </span>
                      </span>
                    ) : (
                      <span
                        className={cn(
                          "min-w-0",
                          sp.key === "erledigt" &&
                            "text-muted-foreground line-through",
                        )}
                      >
                        {a.text}
                      </span>
                    )}
                    <NoteImageStrip
                      urls={noteImages(a.images)}
                      onRemove={(url) => removeFile(a, url)}
                    />

                    {/* Notiz unten an der Karte */}
                    {notizId === a.id ? (
                      <span className="flex flex-col gap-1">
                        <Textarea
                          value={notizText}
                          onChange={(e) => setNotizText(e.target.value)}
                          rows={2}
                          maxLength={2000}
                          placeholder="Notiz, z. B. „Warten auf Freigabe“, Budget, Rückfragen…"
                          className="bg-background text-xs"
                          disabled={pending}
                          autoFocus
                        />
                        <span className="flex gap-1">
                          <Button
                            type="button"
                            size="sm"
                            className="h-7 px-2 text-xs"
                            disabled={pending}
                            onClick={() => saveNotiz(a)}
                          >
                            Speichern
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            variant="ghost"
                            className="h-7 px-2 text-xs"
                            onClick={() => setNotizId(null)}
                          >
                            Abbrechen
                          </Button>
                        </span>
                      </span>
                    ) : a.notiz ? (
                      <button
                        type="button"
                        title="Notiz bearbeiten"
                        onClick={() => {
                          setNotizId(a.id);
                          setNotizText(a.notiz ?? "");
                          setEditId(null);
                        }}
                        className="flex items-start gap-1 rounded-md bg-muted/60 px-2 py-1 text-left text-xs text-muted-foreground hover:bg-muted"
                      >
                        <StickyNote className="mt-0.5 size-3 shrink-0" />
                        <span className="whitespace-pre-wrap">{a.notiz}</span>
                      </button>
                    ) : null}
                    <span className="flex items-center gap-0.5">
                      {sp.key === "offen" && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="h-7 gap-1 px-2 text-xs text-muted-foreground"
                          disabled={pending}
                          onClick={() => move(a, "in_arbeit")}
                        >
                          <ArrowRight className="size-3.5" />
                          In Arbeit
                        </Button>
                      )}
                      {sp.key !== "erledigt" && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="h-7 gap-1 px-2 text-xs text-muted-foreground"
                          disabled={pending}
                          onClick={() => move(a, "erledigt")}
                        >
                          <Check className="size-3.5" />
                          Erledigt
                        </Button>
                      )}
                      {sp.key !== "offen" && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="h-7 gap-1 px-2 text-xs text-muted-foreground"
                          disabled={pending}
                          onClick={() => move(a, "offen")}
                        >
                          <RotateCcw className="size-3.5" />
                          Zurück
                        </Button>
                      )}
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="size-7 text-muted-foreground"
                        disabled={pending}
                        aria-label="Text bearbeiten"
                        title="Text bearbeiten"
                        onClick={() => {
                          setEditId(a.id);
                          setEditText(a.text);
                          setNotizId(null);
                        }}
                      >
                        <Pencil className="size-3.5" />
                      </Button>
                      {!a.notiz && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="size-7 text-muted-foreground"
                          disabled={pending}
                          aria-label="Notiz hinzufügen"
                          title="Notiz hinzufügen"
                          onClick={() => {
                            setNotizId(a.id);
                            setNotizText("");
                            setEditId(null);
                          }}
                        >
                          <StickyNote className="size-3.5" />
                        </Button>
                      )}
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="size-7 text-muted-foreground"
                        disabled={pending}
                        aria-label="Datei anhängen"
                        title="Datei anhängen (PDF, Office, Bilder)"
                        onClick={() => attachToCard(a)}
                      >
                        <Paperclip className="size-3.5" />
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="ml-auto size-7 text-muted-foreground hover:text-destructive"
                        disabled={pending}
                        aria-label="Anfrage löschen"
                        onClick={() => {
                          if (window.confirm("Anfrage löschen?")) {
                            startTransition(async () => {
                              const r = await deleteHubNote(a.id);
                              if (r.ok) toast.success("Anfrage gelöscht");
                              else toast.error(r.error);
                            });
                          }
                        }}
                      >
                        <Trash2 className="size-3.5" />
                      </Button>
                    </span>
                  </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
