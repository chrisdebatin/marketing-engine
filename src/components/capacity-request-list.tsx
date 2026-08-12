"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { BedDouble, Check, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { triggerCapacityReminderFor } from "@/app/(app)/admin/actions";

export interface CapacityRequestRow {
  hubId: string;
  name: string;
  pdl: string | null;
  hasEmail: boolean;
  reported: boolean;
  freiePlaetze: number | null;
}

/**
 * Kapazitäts-Abfrage je Standort (Kommunikations-Tab): wer hat diese Woche
 * gemeldet, wem fehlt es — mit Einzel-Aufforderung per Klick. Die Mail
 * enthält den Standort-Link direkt zum Kapazitäts-Reiter.
 */
export function CapacityRequestList({
  rows,
  weekLabel,
  canSend,
}: {
  rows: CapacityRequestRow[];
  weekLabel: string;
  canSend: boolean;
}) {
  const [pending, startTransition] = useTransition();
  const [sentTo, setSentTo] = useState<Set<string>>(new Set());
  const missing = rows.filter((r) => !r.reported);

  function send(row: CapacityRequestRow) {
    if (pending) return;
    startTransition(async () => {
      const r = await triggerCapacityReminderFor(row.hubId);
      if (r.ok) {
        toast.success(r.message);
        setSentTo((cur) => new Set(cur).add(row.hubId));
      } else {
        toast.error(r.message);
      }
    });
  }

  return (
    <section className="flex flex-col gap-2 rounded-xl border bg-card p-5 shadow-sm">
      <p className="flex items-center gap-1.5 font-semibold">
        <BedDouble className="size-4 text-primary" />
        Kapazitäts-Abfrage (Woche ab {weekLabel})
      </p>
      <p className="-mt-1 text-sm text-muted-foreground">
        {missing.length === 0
          ? "Alle Standorte haben diese Woche gemeldet. 🎉"
          : `${missing.length} von ${rows.length} Standorten haben noch nicht gemeldet — Aufforderung einzeln senden (Mail mit direktem Link zum Kapazitäts-Reiter der Standort-Seite).`}
      </p>
      <ul className="flex flex-col">
        {rows.map((r) => (
          <li
            key={r.hubId}
            className="flex flex-wrap items-center gap-x-3 gap-y-1 border-t py-2 text-sm first:border-t-0"
          >
            <span className="min-w-0 flex-1 font-medium">
              {r.name}
              {r.pdl && (
                <span className="font-normal text-muted-foreground">
                  {" "}
                  · {r.pdl}
                </span>
              )}
            </span>
            {r.reported ? (
              <span className="flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-semibold text-emerald-800">
                <Check className="size-3" />
                gemeldet
                {r.freiePlaetze != null && ` · ${r.freiePlaetze} freie Plätze`}
              </span>
            ) : (
              <>
                <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-800">
                  fehlt
                </span>
                {sentTo.has(r.hubId) ? (
                  <span className="text-xs text-muted-foreground">
                    Aufforderung gesendet ✓
                  </span>
                ) : (
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    disabled={pending || !canSend || !r.hasEmail}
                    title={
                      !r.hasEmail
                        ? "Keine PDL-E-Mail hinterlegt (Admin → Hub bearbeiten)"
                        : undefined
                    }
                    onClick={() => send(r)}
                    className={cn(!r.hasEmail && "opacity-50")}
                  >
                    <Send className="size-3.5" />
                    {r.hasEmail ? "Aufforderung senden" : "keine PDL-Mail"}
                  </Button>
                )}
              </>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}
