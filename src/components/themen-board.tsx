"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import {
  BookOpen,
  Check,
  Circle,
  Pencil,
  Plus,
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
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { mdColor } from "@/lib/hub-coords";
import {
  createHubNote,
  createNoteTopic,
  deleteHubNote,
  deleteNoteTopic,
  renameNoteTopic,
  updateHubNote,
} from "@/app/(app)/hubs/note-actions";

export interface TopicRow {
  id: string;
  title: string;
}

export interface NoteRow {
  id: string;
  hub_id: string;
  text: string;
  is_todo: boolean;
  done_at: string | null;
  topic_id?: string | null;
  created_at: string | null;
}

export interface HubRow {
  id: string;
  name: string;
  responsible_md: string | null;
}

function formatDate(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString("de-DE");
}

/**
 * Interaktives Themen-Board: Themen anlegen/umbenennen/löschen, je Thema
 * direkt Notizen/To-dos für einen Standort eintragen, To-dos abhaken —
 * mit Fortschritt (Standorte mit Stand, offene To-dos) pro Thema.
 */
export function ThemenBoard({
  topics,
  notes,
  hubs,
}: {
  topics: TopicRow[];
  notes: NoteRow[];
  hubs: HubRow[];
}) {
  const [pending, startTransition] = useTransition();
  const [newTopic, setNewTopic] = useState("");
  const [nurOffene, setNurOffene] = useState(false);
  // Umbenennen
  const [renameId, setRenameId] = useState<string | null>(null);
  const [renameTitle, setRenameTitle] = useState("");
  // Schnell-Eintrag je Thema
  const [addHub, setAddHub] = useState<Record<string, string>>({});
  const [addText, setAddText] = useState<Record<string, string>>({});
  const [addTodo, setAddTodo] = useState<Record<string, boolean>>({});

  const hubsSorted = [...hubs].sort((a, b) =>
    a.name.localeCompare(b.name, "de"),
  );
  const hubItems = Object.fromEntries(hubsSorted.map((h) => [h.id, h.name]));

  function run(fn: () => Promise<{ ok: boolean; error?: string }>, okMsg: string) {
    startTransition(async () => {
      const r = await fn();
      if (r.ok) toast.success(okMsg);
      else toast.error(r.error ?? "Fehler");
    });
  }

  function addNote(topic: TopicRow) {
    const hubId = addHub[topic.id] ?? "";
    const text = (addText[topic.id] ?? "").trim();
    if (!hubId) {
      toast.error("Standort wählen.");
      return;
    }
    if (!text) {
      toast.error("Text eingeben.");
      return;
    }
    startTransition(async () => {
      const r = await createHubNote({
        hub_id: hubId,
        text,
        is_todo: addTodo[topic.id] ?? false,
        topic_title: topic.title,
      });
      if (r.ok) {
        toast.success("Eintrag gespeichert");
        setAddText((prev) => ({ ...prev, [topic.id]: "" }));
      } else {
        toast.error(r.error ?? "Fehler");
      }
    });
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Neues Thema + Filter */}
      <div className="flex flex-wrap items-center gap-2 rounded-xl border bg-card p-4 shadow-sm">
        <Input
          value={newTopic}
          onChange={(e) => setNewTopic(e.target.value)}
          placeholder="Neues Thema, z. B. Recare, Weihnachtskarten, Messe…"
          maxLength={120}
          className="min-w-56 flex-1"
          onKeyDown={(e) => {
            if (e.key === "Enter" && newTopic.trim()) {
              run(() => createNoteTopic(newTopic), "Thema angelegt");
              setNewTopic("");
            }
          }}
        />
        <Button
          type="button"
          size="sm"
          disabled={pending || !newTopic.trim()}
          onClick={() => {
            run(() => createNoteTopic(newTopic), "Thema angelegt");
            setNewTopic("");
          }}
        >
          <Plus className="size-4" />
          Thema anlegen
        </Button>
        <label className="ml-auto flex cursor-pointer items-center gap-1.5 text-sm select-none">
          <input
            type="checkbox"
            checked={nurOffene}
            onChange={(e) => setNurOffene(e.target.checked)}
            className="size-4 accent-primary"
          />
          nur offene To-dos
        </label>
      </div>

      {topics.length === 0 && (
        <p className="rounded-xl border bg-card p-5 text-sm text-muted-foreground shadow-sm">
          Noch keine Themen — oben das erste anlegen (z. B. „Recare&rdquo;).
        </p>
      )}

      {topics.map((topic) => {
        const topicNotes = notes
          .filter((n) => n.topic_id === topic.id)
          .filter((n) => !nurOffene || (n.is_todo && !n.done_at));
        const byHub = new Map<string, NoteRow[]>();
        for (const n of topicNotes) {
          const arr = byHub.get(n.hub_id) ?? [];
          arr.push(n);
          byHub.set(n.hub_id, arr);
        }
        const allTopicNotes = notes.filter((n) => n.topic_id === topic.id);
        const openTodos = allTopicNotes.filter(
          (n) => n.is_todo && !n.done_at,
        ).length;
        const doneTodos = allTopicNotes.filter(
          (n) => n.is_todo && n.done_at,
        ).length;
        const hubsWithNotes = hubsSorted.filter((h) => byHub.has(h.id));
        const hubsWithout = hubsSorted.filter(
          (h) => !allTopicNotes.some((n) => n.hub_id === h.id),
        );
        const coverage = Math.round(
          ((hubsSorted.length - hubsWithout.length) / Math.max(1, hubsSorted.length)) * 100,
        );

        return (
          <details key={topic.id} open className="group rounded-xl border bg-card shadow-sm">
            <summary className="flex cursor-pointer list-none flex-wrap items-center gap-2 px-4 py-3 select-none">
              <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <BookOpen className="size-4" />
              </span>
              {renameId === topic.id ? (
                <span
                  className="flex items-center gap-1.5"
                  onClick={(e) => e.preventDefault()}
                >
                  <Input
                    value={renameTitle}
                    onChange={(e) => setRenameTitle(e.target.value)}
                    maxLength={120}
                    className="h-8 w-56"
                    autoFocus
                  />
                  <Button
                    type="button"
                    size="sm"
                    disabled={pending || !renameTitle.trim()}
                    onClick={() => {
                      run(
                        () => renameNoteTopic(topic.id, renameTitle),
                        "Thema umbenannt",
                      );
                      setRenameId(null);
                    }}
                  >
                    OK
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    onClick={() => setRenameId(null)}
                  >
                    Abbrechen
                  </Button>
                </span>
              ) : (
                <h2 className="text-lg font-semibold">{topic.title}</h2>
              )}
              {openTodos > 0 && (
                <Badge variant="secondary" className="tabular-nums">
                  {openTodos} offen
                </Badge>
              )}
              {doneTodos > 0 && (
                <Badge variant="outline" className="tabular-nums">
                  ✓ {doneTodos} erledigt
                </Badge>
              )}
              {/* Fortschritt: Standorte mit Stand */}
              <span className="flex items-center gap-2 text-xs text-muted-foreground">
                <span className="h-1.5 w-24 overflow-hidden rounded-full bg-muted">
                  <span
                    className="block h-full rounded-full bg-primary"
                    style={{ width: `${coverage}%` }}
                  />
                </span>
                {hubsSorted.length - hubsWithout.length}/{hubsSorted.length}{" "}
                Standorte
              </span>
              <span
                className="ml-auto flex items-center"
                onClick={(e) => e.preventDefault()}
              >
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="size-8 text-muted-foreground"
                  disabled={pending}
                  onClick={() => {
                    setRenameId(topic.id);
                    setRenameTitle(topic.title);
                  }}
                  aria-label="Thema umbenennen"
                  title="Umbenennen"
                >
                  <Pencil className="size-3.5" />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="size-8 text-muted-foreground hover:text-destructive"
                  disabled={pending}
                  onClick={() => {
                    if (
                      window.confirm(
                        `Thema „${topic.title}“ löschen? Die Notizen bleiben als allgemeine Standort-Notizen erhalten.`,
                      )
                    ) {
                      run(() => deleteNoteTopic(topic.id), "Thema gelöscht");
                    }
                  }}
                  aria-label="Thema löschen"
                  title="Löschen"
                >
                  <Trash2 className="size-3.5" />
                </Button>
              </span>
            </summary>

            <div className="flex flex-col gap-3 border-t px-4 py-3">
              {/* Schnell-Eintrag */}
              <div className="flex flex-wrap items-center gap-2">
                <Select
                  items={hubItems}
                  value={addHub[topic.id] ?? ""}
                  onValueChange={(v) =>
                    setAddHub((prev) => ({ ...prev, [topic.id]: v ?? "" }))
                  }
                >
                  <SelectTrigger className="w-48">
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
                  value={addText[topic.id] ?? ""}
                  onChange={(e) =>
                    setAddText((prev) => ({
                      ...prev,
                      [topic.id]: e.target.value,
                    }))
                  }
                  placeholder="Notiz oder To-do zu diesem Thema…"
                  maxLength={2000}
                  className="min-w-56 flex-1"
                  onKeyDown={(e) => {
                    if (e.key === "Enter") addNote(topic);
                  }}
                />
                <label className="flex cursor-pointer items-center gap-1.5 text-sm select-none">
                  <input
                    type="checkbox"
                    checked={addTodo[topic.id] ?? false}
                    onChange={(e) =>
                      setAddTodo((prev) => ({
                        ...prev,
                        [topic.id]: e.target.checked,
                      }))
                    }
                    className="size-4 accent-primary"
                  />
                  To-do
                </label>
                <Button
                  type="button"
                  size="sm"
                  disabled={pending}
                  onClick={() => addNote(topic)}
                >
                  <Plus className="size-4" />
                  Eintragen
                </Button>
              </div>

              {/* Stand je Standort */}
              <div className="grid gap-3 lg:grid-cols-2 2xl:grid-cols-3">
                {hubsWithNotes.map((h) => (
                  <div
                    key={h.id}
                    className="flex flex-col gap-1.5 rounded-lg border p-3"
                  >
                    <Link
                      href={`/hubs/${h.id}`}
                      className="flex items-center gap-2 text-sm hover:text-primary"
                    >
                      <span
                        aria-hidden
                        className="size-2.5 rounded-full"
                        style={{ backgroundColor: mdColor(h.responsible_md) }}
                      />
                      <span className="font-semibold">{h.name}</span>
                    </Link>
                    <ul className="flex flex-col gap-1">
                      {(byHub.get(h.id) ?? []).map((n) => (
                        <li
                          key={n.id}
                          className="group/note flex items-start gap-1.5 text-sm"
                        >
                          {n.is_todo ? (
                            <button
                              type="button"
                              disabled={pending}
                              onClick={() =>
                                run(
                                  () =>
                                    updateHubNote(n.id, { done: !n.done_at }),
                                  n.done_at
                                    ? "Wieder offen"
                                    : "To-do erledigt ✓",
                                )
                              }
                              className="mt-0.5 shrink-0"
                              aria-label={
                                n.done_at
                                  ? "Als offen markieren"
                                  : "Als erledigt abhaken"
                              }
                            >
                              {n.done_at ? (
                                <Check className="size-4 text-chart-4" />
                              ) : (
                                <Circle className="size-4 text-muted-foreground hover:text-primary" />
                              )}
                            </button>
                          ) : (
                            <StickyNote className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                          )}
                          <span
                            className={cn(
                              "min-w-0 flex-1",
                              n.done_at && "text-muted-foreground line-through",
                            )}
                          >
                            {n.text}
                            <span className="ml-1.5 text-xs text-muted-foreground no-underline">
                              {formatDate(n.created_at)}
                            </span>
                          </span>
                          <button
                            type="button"
                            disabled={pending}
                            onClick={() => {
                              if (window.confirm("Eintrag löschen?")) {
                                run(
                                  () => deleteHubNote(n.id),
                                  "Eintrag gelöscht",
                                );
                              }
                            }}
                            className="shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover/note:opacity-100 hover:text-destructive"
                            aria-label="Eintrag löschen"
                          >
                            <Trash2 className="size-3.5" />
                          </button>
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>

              {/* Standorte ohne Stand — Klick füllt den Schnell-Eintrag vor */}
              {hubsWithout.length > 0 && (
                <div className="flex flex-wrap items-center gap-1.5 text-xs">
                  <span className="text-muted-foreground">
                    Noch kein Stand ({hubsWithout.length}):
                  </span>
                  {hubsWithout.map((h) => (
                    <button
                      key={h.id}
                      type="button"
                      onClick={() =>
                        setAddHub((prev) => ({ ...prev, [topic.id]: h.id }))
                      }
                      className={cn(
                        "cursor-pointer rounded-full border px-2 py-0.5 transition-colors select-none",
                        (addHub[topic.id] ?? "") === h.id
                          ? "border-primary bg-primary/10 text-primary"
                          : "text-muted-foreground hover:text-foreground",
                      )}
                      title={`${h.name} im Schnell-Eintrag auswählen`}
                    >
                      {h.name}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </details>
        );
      })}
    </div>
  );
}
