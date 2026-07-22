"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import {
  Check,
  Circle,
  ListTodo,
  Pencil,
  Plus,
  StickyNote,
  Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import {
  createHubNote,
  deleteHubNote,
  updateHubNote,
} from "@/app/(app)/hubs/note-actions";

export interface HubNoteRow {
  id: string;
  text: string;
  is_todo: boolean;
  done_at: string | null;
  created_at: string | null;
}

function formatDate(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString("de-DE");
}

/**
 * Notizen & To-dos je Hub: Notiz anlegen (optional direkt als offenes To-do),
 * To-dos abhaken, Text bearbeiten, löschen.
 */
export function HubNotes({
  hubId,
  initial,
}: {
  hubId: string;
  initial: HubNoteRow[];
}) {
  const [pending, startTransition] = useTransition();
  const [text, setText] = useState("");
  const [asTodo, setAsTodo] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [editText, setEditText] = useState("");
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  // Offene To-dos zuerst, dann normale Notizen, erledigte zuletzt.
  const sorted = [...initial].sort((a, b) => {
    const rank = (n: HubNoteRow) =>
      n.is_todo && !n.done_at ? 0 : !n.is_todo ? 1 : 2;
    return rank(a) - rank(b);
  });
  const openCount = initial.filter((n) => n.is_todo && !n.done_at).length;

  function create() {
    startTransition(async () => {
      const res = await createHubNote({ hub_id: hubId, text, is_todo: asTodo });
      if (res.ok) {
        toast.success(asTodo ? "To-do angelegt" : "Notiz gespeichert");
        setText("");
        setAsTodo(false);
      } else {
        toast.error(res.error);
      }
    });
  }

  function patch(
    id: string,
    input: { text?: string; is_todo?: boolean; done?: boolean },
    okMessage: string,
  ) {
    startTransition(async () => {
      const res = await updateHubNote(id, input);
      if (res.ok) {
        toast.success(okMessage);
        setEditId(null);
      } else {
        toast.error(res.error);
      }
    });
  }

  function remove(id: string) {
    startTransition(async () => {
      const res = await deleteHubNote(id);
      if (res.ok) {
        toast.success("Notiz gelöscht");
        setConfirmDeleteId(null);
      } else {
        toast.error(res.error);
      }
    });
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <p className="font-medium">Notizen &amp; To-dos</p>
        {openCount > 0 && (
          <Badge variant="secondary" className="tabular-nums">
            {openCount} offen
          </Badge>
        )}
      </div>

      {/* Neue Notiz */}
      <div className="flex flex-col gap-2 rounded-lg border bg-background p-3">
        <Textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Notiz zu diesem Standort — z. B. „PDL anrufen wegen Nachschub“"
          rows={2}
          maxLength={2000}
        />
        <div className="flex flex-wrap items-center gap-3">
          <label className="flex cursor-pointer items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={asTodo}
              onChange={(e) => setAsTodo(e.target.checked)}
              className="size-4 accent-primary"
            />
            Als offenes To-do markieren
          </label>
          <Button
            type="button"
            size="sm"
            className="ml-auto"
            disabled={pending || !text.trim()}
            onClick={create}
          >
            <Plus className="size-4" />
            {pending ? "Speichere…" : "Hinzufügen"}
          </Button>
        </div>
      </div>

      {/* Liste */}
      {sorted.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Noch keine Notizen für diesen Standort.
        </p>
      ) : (
        <ul className="flex flex-col gap-2">
          {sorted.map((n) => {
            const done = Boolean(n.done_at);
            const editing = editId === n.id;
            return (
              <li
                key={n.id}
                className={cn(
                  "flex flex-col gap-2 rounded-lg border bg-background px-3 py-2.5",
                  n.is_todo && !done && "border-primary/40 bg-primary/[0.03]",
                  done && "opacity-60",
                )}
              >
                <div className="flex items-start gap-2.5">
                  {n.is_todo ? (
                    <button
                      type="button"
                      disabled={pending}
                      onClick={() =>
                        patch(
                          n.id,
                          { done: !done },
                          done ? "Wieder offen" : "To-do erledigt",
                        )
                      }
                      className={cn(
                        "mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full border transition-colors",
                        done
                          ? "border-chart-4 bg-chart-4 text-white"
                          : "border-primary/50 text-transparent hover:border-primary",
                      )}
                      title={done ? "Wieder öffnen" : "Als erledigt abhaken"}
                    >
                      <Check className="size-3.5" />
                    </button>
                  ) : (
                    <StickyNote className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                  )}

                  <div className="min-w-0 flex-1">
                    {editing ? (
                      <div className="flex flex-col gap-2">
                        <Textarea
                          value={editText}
                          onChange={(e) => setEditText(e.target.value)}
                          rows={2}
                          maxLength={2000}
                        />
                        <div className="flex items-center gap-2">
                          <Button
                            type="button"
                            size="sm"
                            disabled={pending || !editText.trim()}
                            onClick={() =>
                              patch(n.id, { text: editText }, "Notiz aktualisiert")
                            }
                          >
                            Speichern
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            variant="ghost"
                            disabled={pending}
                            onClick={() => setEditId(null)}
                          >
                            Abbrechen
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <>
                        <p
                          className={cn(
                            "text-sm whitespace-pre-wrap",
                            done && "line-through",
                          )}
                        >
                          {n.text}
                        </p>
                        <p className="mt-0.5 flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
                          {formatDate(n.created_at)}
                          {n.is_todo && !done && (
                            <Badge
                              variant="outline"
                              className="border-primary/40 text-primary"
                            >
                              <Circle className="size-2 fill-current" />
                              offenes To-do
                            </Badge>
                          )}
                          {done && <span>erledigt {formatDate(n.done_at)}</span>}
                        </p>
                      </>
                    )}
                  </div>

                  {!editing && (
                    <div className="flex shrink-0 items-center gap-0.5">
                      {!n.is_todo && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="size-7 text-muted-foreground"
                          disabled={pending}
                          onClick={() =>
                            patch(n.id, { is_todo: true }, "Als To-do markiert")
                          }
                          title="Als offenes To-do markieren"
                          aria-label="Als offenes To-do markieren"
                        >
                          <ListTodo className="size-4" />
                        </Button>
                      )}
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="size-7 text-muted-foreground"
                        disabled={pending}
                        onClick={() => {
                          setEditId(n.id);
                          setEditText(n.text);
                          setConfirmDeleteId(null);
                        }}
                        aria-label="Notiz bearbeiten"
                      >
                        <Pencil className="size-3.5" />
                      </Button>
                      {confirmDeleteId === n.id ? (
                        <Button
                          type="button"
                          variant="destructive"
                          size="sm"
                          disabled={pending}
                          onClick={() => remove(n.id)}
                        >
                          Wirklich?
                        </Button>
                      ) : (
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="size-7 text-muted-foreground hover:text-destructive"
                          disabled={pending}
                          onClick={() => setConfirmDeleteId(n.id)}
                          aria-label="Notiz löschen"
                        >
                          <Trash2 className="size-3.5" />
                        </Button>
                      )}
                    </div>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
