"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import { Check, Circle } from "lucide-react";
import { cn } from "@/lib/utils";
import { setHubTaskDone } from "@/app/(app)/admin/task-actions";

export interface HubTaskChip {
  taskId: string;
  title: string;
  done: boolean;
}

/**
 * Kleine, klickbare Status-Chips pro Hub — einer je Hub-Aufgabe
 * (grün = erledigt, grau = offen). Klick schaltet den Status um.
 */
export function HubTaskChips({
  hubId,
  chips,
}: {
  hubId: string;
  chips: HubTaskChip[];
}) {
  const [pending, startTransition] = useTransition();

  if (chips.length === 0) return null;

  function toggle(c: HubTaskChip) {
    startTransition(async () => {
      const res = await setHubTaskDone(c.taskId, hubId, !c.done);
      if (!res.ok) toast.error(res.error);
    });
  }

  return (
    <div className="flex flex-wrap gap-1.5">
      {chips.map((c) => (
        <button
          key={c.taskId}
          type="button"
          disabled={pending}
          onClick={() => toggle(c)}
          title={
            c.done
              ? `${c.title} — erledigt (Klick zum Zurücksetzen)`
              : `${c.title} — offen (Klick zum Abhaken)`
          }
          className={cn(
            "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium transition-colors disabled:opacity-60",
            c.done
              ? "border-chart-4/40 bg-chart-4/10 text-chart-4 hover:bg-chart-4/20"
              : "border-border bg-muted text-muted-foreground hover:text-foreground",
          )}
        >
          {c.done ? (
            <Check className="size-3" />
          ) : (
            <Circle className="size-3 opacity-50" />
          )}
          <span className="max-w-40 truncate">{c.title}</span>
        </button>
      ))}
    </div>
  );
}
