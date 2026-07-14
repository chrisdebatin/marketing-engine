"use client";

import Link from "next/link";
import { useLiveQuery } from "dexie-react-hooks";
import { toast } from "sonner";
import { getDB } from "@/lib/offline/db";
import { enqueueDelete } from "@/lib/offline/queue";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { MoreVertical, FileText, Package } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Activity, ActivityType } from "@/lib/types";

interface Row {
  id: string;
  hub_id: string;
  standort_name: string;
  type: ActivityType;
  occurred_on: string;
  note: string | null;
  details: Record<string, unknown>;
  pending: boolean;
}

function formatDate(iso: string): string {
  const [y, m, d] = iso.split("-");
  return `${d}.${m}.${y}`;
}

export function ActivityList({
  initial,
  hubNames,
  materialNames,
}: {
  initial: Activity[];
  hubNames: Record<string, string>;
  materialNames: Record<string, string>;
}) {
  const queued = useLiveQuery(() => getDB().queue.toArray(), [], []);

  // merge server rows with the local offline queue
  const map = new Map<string, Row>();
  for (const a of initial) {
    map.set(a.id, {
      id: a.id,
      hub_id: a.hub_id,
      standort_name: a.standort_name,
      type: a.type,
      occurred_on: a.occurred_on,
      note: a.note,
      details: (a.details ?? {}) as Record<string, unknown>,
      pending: false,
    });
  }
  for (const q of queued) {
    if (q.op === "delete") {
      map.delete(q.id);
      continue;
    }
    if (!q.payload) continue;
    const p = q.payload;
    map.set(q.id, {
      id: q.id,
      hub_id: p.hub_id,
      standort_name: p.standort_name,
      type: p.type,
      occurred_on: p.occurred_on,
      note: p.note?.trim() ? p.note : null,
      details: p.details as Record<string, unknown>,
      pending: true,
    });
  }

  const rows = Array.from(map.values()).sort((a, b) =>
    a.occurred_on === b.occurred_on
      ? a.standort_name.localeCompare(b.standort_name)
      : b.occurred_on.localeCompare(a.occurred_on),
  );

  function detailText(r: Row): string {
    if (r.type === "flyer") {
      const material =
        materialNames[String(r.details.material_type_id)] ?? "Material";
      return `${material} · ${r.details.menge} Stück`;
    }
    return `${r.details.anzahl_boxen} Boxen`;
  }

  async function onDelete(id: string) {
    if (!confirm("Diesen Eintrag löschen?")) return;
    await enqueueDelete(id);
    toast.success("Eintrag gelöscht");
  }

  if (rows.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        Noch keine Einträge erfasst.
      </p>
    );
  }

  return (
    <ul className="flex flex-col gap-3">
      {rows.map((r) => (
        <li
          key={r.id}
          className="flex items-start justify-between gap-3 rounded-xl border bg-card p-3.5 transition-colors hover:border-primary/30"
        >
          <div className="flex min-w-0 gap-3">
            <span
              className={cn(
                "mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-lg",
                r.type === "flyer"
                  ? "bg-primary/10 text-primary"
                  : "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-400",
              )}
            >
              {r.type === "flyer" ? (
                <FileText className="size-4" />
              ) : (
                <Package className="size-4" />
              )}
            </span>
            <div className="flex min-w-0 flex-col gap-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-medium">{r.standort_name}</span>
                {r.pending && (
                  <Badge variant="secondary">nicht synchronisiert</Badge>
                )}
              </div>
              <span className="text-sm text-muted-foreground">
                {detailText(r)}
              </span>
              <span className="text-xs text-muted-foreground">
                {formatDate(r.occurred_on)}
                {hubNames[r.hub_id] ? ` · ${hubNames[r.hub_id]}` : ""}
              </span>
              {r.note && <span className="text-sm">{r.note}</span>}
            </div>
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger
              render={<Button variant="ghost" size="icon" aria-label="Aktionen" />}
            >
              <MoreVertical className="size-4" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {!r.pending && (
                <DropdownMenuItem
                  render={<Link href={`/eintraege/${r.id}/bearbeiten`} />}
                >
                  Bearbeiten
                </DropdownMenuItem>
              )}
              <DropdownMenuItem
                variant="destructive"
                onClick={() => onDelete(r.id)}
              >
                Löschen
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </li>
      ))}
    </ul>
  );
}
