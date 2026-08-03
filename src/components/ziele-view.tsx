"use client";

import { useState } from "react";
import { Kanban, List, PhoneOutgoing } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  CrmKanban,
  type KanbanLastContact,
  type KanbanTodo,
} from "@/components/crm-kanban";
import {
  CrmTargetsManager,
  type CrmPersonRow,
  type CrmTargetRow,
} from "@/components/crm-targets-manager";

type View = "kanban" | "liste" | "anrufe";

/**
 * Umschalter für das zentrale CRM: Kanban-Pipeline (Standard), die
 * Listen-Ansicht mit Anlegen/Import/Bearbeiten und die Call-Center-
 * Anrufliste — alles auf denselben Daten, eine Seite statt zwei Tabs.
 */
export function ZieleView({
  targets,
  hubs,
  persons = [],
  todosByTarget = {},
  lastByTarget = {},
  callcenter,
}: {
  targets: CrmTargetRow[];
  hubs: { id: string; name: string }[];
  persons?: CrmPersonRow[];
  todosByTarget?: Record<string, KanbanTodo[]>;
  lastByTarget?: Record<string, KanbanLastContact>;
  callcenter?: React.ReactNode;
}) {
  const [view, setView] = useState<View>("kanban");

  const tabs: [View, string, typeof Kanban][] = [
    ["kanban", "Kanban", Kanban],
    ["liste", "Liste & Bearbeiten", List],
  ];
  if (callcenter) tabs.push(["anrufe", "Anrufliste (Call-Center)", PhoneOutgoing]);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex w-fit items-center gap-1 rounded-lg bg-muted p-1">
        {tabs.map(([value, label, Icon]) => (
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
        <CrmKanban
          targets={targets}
          hubs={hubs}
          todosByTarget={todosByTarget}
          lastByTarget={lastByTarget}
        />
      ) : view === "liste" ? (
        <CrmTargetsManager targets={targets} hubs={hubs} persons={persons} />
      ) : (
        callcenter
      )}
    </div>
  );
}
