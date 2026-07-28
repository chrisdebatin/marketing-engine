"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Headset, Plus, Trash2 } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { LEAD_QUELLEN, leadQuelleLabel } from "@/lib/leads";
import { formatIsoDate, todayIso } from "@/lib/crm";
import { createLeadCall, deleteLeadCall } from "@/app/(app)/frontoffice/actions";

export interface LeadRow {
  id: string;
  call_date: string;
  quelle: string;
  hub_id: string | null;
  notiz: string | null;
}

/**
 * Frontoffice-Erfassung: jeder Interessenten-Anruf wird mit Quelle und
 * weitergeleitetem Standort geloggt — drei Klicks pro Lead.
 */
export function LeadBoard({
  hubs,
  recent,
}: {
  hubs: { id: string; name: string }[];
  recent: LeadRow[];
}) {
  const [pending, startTransition] = useTransition();
  const [quelle, setQuelle] = useState("");
  const [hubId, setHubId] = useState("");
  const [date, setDate] = useState(todayIso());
  const [notiz, setNotiz] = useState("");

  const hubItems = Object.fromEntries(hubs.map((h) => [h.id, h.name]));
  const hubName = (id: string | null) =>
    hubs.find((h) => h.id === id)?.name ?? "—";

  function save() {
    if (pending) return;
    if (!quelle) {
      toast.error("Bitte Quelle auswählen.");
      return;
    }
    startTransition(async () => {
      const r = await createLeadCall({
        quelle,
        hub_id: hubId,
        call_date: date,
        notiz,
      });
      if (r.ok) {
        toast.success("Lead geloggt");
        setNotiz("");
        // Quelle/Standort bewusst stehen lassen — oft mehrere Anrufe in Folge.
      } else {
        toast.error(r.error);
      }
    });
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Erfassung */}
      <div className="flex flex-col gap-3 rounded-xl border border-primary/25 bg-primary/[0.04] p-4">
        <p className="flex items-center gap-1.5 text-sm font-semibold">
          <Headset className="size-4 text-primary" />
          Anruf loggen — Interessent/Lead
        </p>
        <div className="flex flex-col gap-1.5">
          <span className="text-xs font-medium text-muted-foreground">
            Woher aufmerksam geworden? (Pflicht)
          </span>
          <div className="flex flex-wrap gap-1.5">
            {LEAD_QUELLEN.map((q) => (
              <button
                key={q.key}
                type="button"
                onClick={() => setQuelle(q.key)}
                className={cn(
                  "cursor-pointer rounded-full border px-2.5 py-1 text-sm font-medium transition-colors select-none",
                  quelle === q.key
                    ? "border-primary bg-primary text-primary-foreground"
                    : "bg-background text-muted-foreground hover:text-foreground",
                )}
              >
                {q.label}
              </button>
            ))}
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Select
            items={hubItems}
            value={hubId}
            onValueChange={(v) => setHubId(v ?? "")}
          >
            <SelectTrigger className="w-56">
              <SelectValue placeholder="Weitergeleitet an Standort…" />
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
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="w-40 bg-background"
          />
          <Input
            value={notiz}
            onChange={(e) => setNotiz(e.target.value)}
            placeholder="Notiz (optional), z. B. Leistung, PLZ…"
            maxLength={500}
            className="min-w-48 flex-1 bg-background"
          />
          <Button type="button" disabled={pending} onClick={save}>
            <Plus className="size-4" />
            {pending ? "Speichere…" : "Lead loggen"}
          </Button>
        </div>
      </div>

      {/* Letzte Einträge */}
      <section className="flex flex-col gap-2 rounded-xl border bg-card p-4 shadow-sm">
        <p className="text-sm font-semibold">
          Letzte Anrufe ({recent.length})
        </p>
        {recent.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Noch keine Leads geloggt.
          </p>
        ) : (
          <ul className="flex flex-col gap-1">
            {recent.map((l) => (
              <li
                key={l.id}
                className="group/lead flex flex-wrap items-baseline gap-x-2 gap-y-0.5 rounded-lg bg-muted/50 px-3 py-1.5 text-sm"
              >
                <span className="shrink-0 text-xs text-muted-foreground tabular-nums">
                  {formatIsoDate(l.call_date)}
                </span>
                <span className="font-medium">{leadQuelleLabel(l.quelle)}</span>
                <span className="text-muted-foreground">
                  → {hubName(l.hub_id)}
                </span>
                {l.notiz && (
                  <span className="text-xs text-muted-foreground">
                    · {l.notiz}
                  </span>
                )}
                <button
                  type="button"
                  disabled={pending}
                  onClick={() => {
                    if (window.confirm("Lead-Eintrag löschen?")) {
                      startTransition(async () => {
                        const r = await deleteLeadCall(l.id);
                        if (r.ok) toast.success("Eintrag gelöscht");
                        else toast.error(r.error);
                      });
                    }
                  }}
                  className="ml-auto shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover/lead:opacity-100 hover:text-destructive"
                  aria-label="Eintrag löschen"
                >
                  <Trash2 className="size-3.5" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
