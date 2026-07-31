"use client";

import { useState } from "react";
import { Kanban, List } from "lucide-react";
import { cn } from "@/lib/utils";
import { CrmKanban } from "@/components/crm-kanban";
import {
  CrmTargetsManager,
  type CrmPersonRow,
  type CrmTargetRow,
} from "@/components/crm-targets-manager";

/**
 * Umschalter für das zentrale CRM: Kanban-Pipeline (Standard) oder die
 * Listen-Ansicht mit Anlegen/Import/Bearbeiten.
 */
export function ZieleView({
  targets,
  hubs,
  persons = [],
}: {
  targets: CrmTargetRow[];
  hubs: { id: string; name: string }[];
  persons?: CrmPersonRow[];
}) {
  const [view, setView] = useState<"kanban" | "liste">("kanban");

  return (
    <div className="flex flex-col gap-4">
      <div className="flex w-fit items-center gap-1 rounded-lg bg-muted p-1">
        {(
          [
            ["kanban", "Kanban", Kanban],
            ["liste", "Liste & Bearbeiten", List],
          ] as const
        ).map(([value, label, Icon]) => (
          <button
            key={value}
            type="button"
            onClick={() => setView(value)}
            className={cn(
              "flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
              view === value
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            <Icon className="size-4" />
            {label}
          </button>
        ))}
      </div>

      {view === "kanban" ? (
        <CrmKanban targets={targets} hubs={hubs} />
      ) : (
        <CrmTargetsManager targets={targets} hubs={hubs} persons={persons} />
      )}
    </div>
  );
}
