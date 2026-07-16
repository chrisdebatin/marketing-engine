"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Check, Plus, Trash2, Circle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import {
  createHubTask,
  deleteHubTask,
  setHubTaskDone,
} from "@/app/(app)/admin/task-actions";

export interface TaskHub {
  id: string;
  name: string;
}

export interface TaskWithChecks {
  id: string;
  title: string;
  description: string | null;
  /** hub_ids, für die die Aufgabe erledigt ist */
  doneHubIds: string[];
}

/**
 * Hub-Aufgaben: frei definierbare, pro Hub abhakbare Aufgaben
 * (z. B. „E-Mail mit PDL-Link verschickt") mit Fortschritt über alle Hubs.
 */
export function HubTaskManager({
  tasks,
  hubs,
}: {
  tasks: TaskWithChecks[];
  hubs: TaskHub[];
}) {
  const [pending, startTransition] = useTransition();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");

  function onCreate(e: React.FormEvent) {
    e.preventDefault();
    if (pending || !title.trim()) return;
    startTransition(async () => {
      const res = await createHubTask({ title, description });
      if (res.ok) {
        toast.success("Aufgabe angelegt");
        setTitle("");
        setDescription("");
      } else {
        toast.error(res.error);
      }
    });
  }

  function toggle(taskId: string, hubId: string, done: boolean) {
    startTransition(async () => {
      const res = await setHubTaskDone(taskId, hubId, done);
      if (!res.ok) toast.error(res.error);
    });
  }

  function remove(taskId: string, taskTitle: string) {
    startTransition(async () => {
      const res = await deleteHubTask(taskId);
      if (res.ok) toast.success(`Aufgabe „${taskTitle}" gelöscht`);
      else toast.error(res.error);
    });
  }

  return (
    <div className="flex flex-col gap-4">
      <form onSubmit={onCreate} className="flex flex-col gap-3">
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="flex flex-col gap-2">
            <Label htmlFor="task_title">Neue Aufgabe</Label>
            <Input
              id="task_title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="z. B. Aufsteller-Foto erhalten"
              maxLength={120}
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="task_desc">Beschreibung (optional)</Label>
            <Input
              id="task_desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Worum geht es?"
            />
          </div>
        </div>
        <Button
          type="submit"
          className="self-start"
          disabled={pending || !title.trim()}
        >
          <Plus className="size-4" />
          Aufgabe anlegen
        </Button>
      </form>

      {tasks.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Noch keine Aufgaben. Lege oben die erste an — sie erscheint dann als
          abhakbarer Status an jedem Hub.
        </p>
      ) : (
        <ul className="flex flex-col gap-3">
          {tasks.map((t) => {
            const done = new Set(t.doneHubIds);
            const pct =
              hubs.length > 0
                ? Math.round((done.size / hubs.length) * 100)
                : 0;
            const complete = hubs.length > 0 && done.size === hubs.length;
            return (
              <li key={t.id} className="rounded-lg border bg-card">
                <details className="group">
                  <summary className="flex cursor-pointer list-none flex-col gap-2 p-4 select-none">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="flex min-w-0 items-center gap-2">
                        <span
                          className={cn(
                            "flex size-6 shrink-0 items-center justify-center rounded-md",
                            complete
                              ? "bg-chart-4/15 text-chart-4"
                              : "bg-primary/10 text-primary",
                          )}
                        >
                          <Check className="size-3.5" />
                        </span>
                        <span className="truncate font-medium">{t.title}</span>
                      </span>
                      <span className="flex items-center gap-2">
                        <Badge variant={complete ? "secondary" : "outline"}>
                          {done.size} / {hubs.length} Hubs
                        </Badge>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="size-7 text-muted-foreground hover:text-destructive"
                          disabled={pending}
                          onClick={(e) => {
                            e.preventDefault();
                            if (
                              window.confirm(
                                `Aufgabe „${t.title}" samt aller Häkchen löschen?`,
                              )
                            ) {
                              remove(t.id, t.title);
                            }
                          }}
                          aria-label="Aufgabe löschen"
                        >
                          <Trash2 className="size-4" />
                        </Button>
                      </span>
                    </div>
                    <div
                      className="h-1.5 w-full overflow-hidden rounded-full bg-muted"
                      role="progressbar"
                      aria-valuenow={pct}
                      aria-valuemin={0}
                      aria-valuemax={100}
                      aria-label={t.title}
                    >
                      <div
                        className={cn(
                          "h-full rounded-full transition-all",
                          complete ? "bg-chart-4" : "bg-primary",
                        )}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    {t.description && (
                      <p className="text-xs text-muted-foreground">
                        {t.description}
                      </p>
                    )}
                  </summary>
                  <ul className="grid gap-1 border-t p-3 sm:grid-cols-2 lg:grid-cols-3">
                    {hubs.map((h) => {
                      const isDone = done.has(h.id);
                      return (
                        <li key={h.id}>
                          <button
                            type="button"
                            disabled={pending}
                            onClick={() => toggle(t.id, h.id, !isDone)}
                            className={cn(
                              "flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm transition-colors",
                              isDone
                                ? "text-foreground hover:bg-muted"
                                : "text-muted-foreground hover:bg-muted hover:text-foreground",
                            )}
                          >
                            {isDone ? (
                              <Check className="size-4 shrink-0 text-chart-4" />
                            ) : (
                              <Circle className="size-4 shrink-0 opacity-40" />
                            )}
                            <span className="truncate">{h.name}</span>
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                </details>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
