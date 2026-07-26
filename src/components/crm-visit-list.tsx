"use client";

import { useState } from "react";
import { toast } from "sonner";
import { CalendarClock, Check, MapPin } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { placeKindLabel } from "@/lib/places";
import { crmStatus, formatIsoDate, todayIso } from "@/lib/crm";

export interface VisitTarget {
  id: string;
  name: string;
  kategorie: string | null;
  adresse: string | null;
  ort: string | null;
  intervall_wochen: number;
  letzter_besuch: string | null;
  naechster_besuch: string | null;
  besuchs_notiz: string | null;
}

/**
 * Besuchs-Liste für die PDL: Wohin soll die Box gebracht werden?
 * Fällige/neue Ziele zuerst; "Besucht"-Klick terminiert automatisch das
 * Follow-up (heute + Intervall).
 */
export function CrmVisitList({
  token,
  initial,
}: {
  token: string;
  initial: VisitTarget[];
}) {
  const [targets, setTargets] = useState<VisitTarget[]>(initial);
  const [noteFor, setNoteFor] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);

  const today = todayIso();
  const rank = (t: VisitTarget) => {
    const s = crmStatus(t, today);
    return s === "faellig" ? 0 : s === "erstbesuch" ? 1 : 2;
  };
  const sorted = [...targets].sort(
    (a, b) => rank(a) - rank(b) || a.name.localeCompare(b.name, "de"),
  );
  const openCount = sorted.filter((t) => rank(t) < 2).length;

  async function markVisited(t: VisitTarget) {
    if (saving) return;
    setSaving(true);
    try {
      const res = await fetch("/api/public/crm-visit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, id: t.id, note }),
      });
      const body = (await res.json().catch(() => ({}))) as {
        error?: string;
        target?: VisitTarget;
      };
      if (!res.ok || !body.target) {
        toast.error(body.error ?? "Speichern fehlgeschlagen.");
        return;
      }
      setTargets((prev) =>
        prev.map((x) => (x.id === t.id ? body.target! : x)),
      );
      setNoteFor(null);
      setNote("");
      toast.success(
        `Besuch gespeichert — nächstes Mal ab ${formatIsoDate(body.target.naechster_besuch)}`,
      );
    } catch {
      toast.error("Netzwerkfehler. Bitte erneut versuchen.");
    } finally {
      setSaving(false);
    }
  }

  if (targets.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        Aktuell sind Ihnen keine Ziel-Orte zugeteilt.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <p className="text-sm text-muted-foreground">
        {openCount > 0
          ? `${openCount} ${openCount === 1 ? "Besuch steht" : "Besuche stehen"} an — bitte Box vorbeibringen und danach abhaken.`
          : "Alles erledigt — die nächsten Termine stehen unten."}
      </p>
      <ul className="flex flex-col gap-2">
        {sorted.map((t) => {
          const status = crmStatus(t, today);
          const done = status === "geplant";
          const noteOpen = noteFor === t.id;
          return (
            <li
              key={t.id}
              className={cn(
                "flex flex-col gap-2 rounded-xl border bg-background px-3.5 py-3",
                status === "faellig" &&
                  "border-amber-500/50 bg-amber-500/[0.05]",
                status === "erstbesuch" && "border-primary/40 bg-primary/[0.03]",
                done && "opacity-70",
              )}
            >
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="font-medium">{t.name}</p>
                  <p className="flex items-center gap-1 text-xs text-muted-foreground">
                    <MapPin className="size-3 shrink-0" />
                    {[
                      t.kategorie ? placeKindLabel(t.kategorie) : null,
                      t.adresse,
                      t.ort,
                    ]
                      .filter(Boolean)
                      .join(" · ") || "—"}
                  </p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {status === "erstbesuch" && (
                      <span className="font-medium text-primary">
                        Erstbesuch — bitte Box vorbeibringen
                      </span>
                    )}
                    {status === "faellig" && (
                      <span className="font-medium text-amber-700 dark:text-amber-400">
                        Follow-up fällig (zuletzt{" "}
                        {formatIsoDate(t.letzter_besuch)})
                      </span>
                    )}
                    {done && (
                      <>
                        <CalendarClock className="mr-1 inline size-3" />
                        Erledigt am {formatIsoDate(t.letzter_besuch)} — wieder
                        ab {formatIsoDate(t.naechster_besuch)}
                      </>
                    )}
                  </p>
                </div>
                {!done && (
                  <Button
                    type="button"
                    size="sm"
                    className="shrink-0"
                    disabled={saving}
                    onClick={() => {
                      setNoteFor(noteOpen ? null : t.id);
                      setNote("");
                    }}
                  >
                    <Check className="size-4" />
                    Besucht
                  </Button>
                )}
              </div>

              {noteOpen && (
                <div className="flex flex-col gap-2 border-t pt-2 sm:flex-row sm:items-center">
                  <Input
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    placeholder="Kurze Notiz (optional), z. B. Box abgegeben bei Frau Weber"
                    autoComplete="off"
                    maxLength={500}
                    className="sm:flex-1"
                  />
                  <Button
                    type="button"
                    size="sm"
                    className="shrink-0"
                    disabled={saving}
                    onClick={() => void markVisited(t)}
                  >
                    {saving ? "Speichere…" : "Besuch bestätigen"}
                  </Button>
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
