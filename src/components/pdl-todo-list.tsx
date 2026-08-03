"use client";

import { useState } from "react";
import { toast } from "sonner";
import {
  Building2,
  Check,
  ClipboardList,
  MessageSquareText,
  Sparkles,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatIsoDate } from "@/lib/crm";

export interface PdlTodo {
  id: string;
  art: string;
  aufgabe: string;
  besprochen: string | null;
  created_at: string | null;
  target_name: string;
  target_ort: string | null;
}

const ART_LABEL: Record<string, string> = {
  besuch: "Vorbeigehen",
  box: "Box vorbeibringen",
  flyer: "Flyer auslegen",
  anruf: "Anrufen",
  sonstiges: "Aufgabe",
};

const ART_CHIP: Record<string, string> = {
  besuch: "bg-primary/10 text-primary",
  box: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400",
  flyer: "bg-sky-500/15 text-sky-700 dark:text-sky-400",
  anruf: "bg-amber-500/15 text-amber-700 dark:text-amber-400",
  sonstiges: "bg-muted text-muted-foreground",
};

/**
 * Aufträge vom Call-Center für die PDL: aus den Gesprächsnotizen per KI
 * erkannte Aufgaben ("PDL vorbeischicken" …) mit Kontext, was am Telefon
 * besprochen wurde. Abhaken, wenn erledigt.
 */
export function PdlTodoList({
  token,
  initial,
}: {
  token: string;
  initial: PdlTodo[];
}) {
  const [todos, setTodos] = useState(initial);
  const [pendingId, setPendingId] = useState<string | null>(null);

  async function done(id: string) {
    if (pendingId) return;
    setPendingId(id);
    try {
      const res = await fetch("/api/public/crm-todo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, id, erledigt: true }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(data.error ?? "Speichern fehlgeschlagen.");
        return;
      }
      setTodos((prev) => prev.filter((t) => t.id !== id));
      toast.success("Erledigt — gut gemacht!");
    } catch {
      toast.error("Keine Verbindung — später erneut versuchen.");
    } finally {
      setPendingId(null);
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <div>
        <h2 className="text-xl font-semibold">Aufträge vom Call-Center</h2>
        <p className="mt-1 flex items-center gap-1.5 text-sm text-muted-foreground">
          <Sparkles className="size-3.5 text-primary" />
          Unser Call-Center telefoniert die Kliniken ab — wenn dort etwas für
          Ihren Standort vereinbart wurde, erscheint es hier als Aufgabe,
          inklusive dem, was besprochen wurde.
        </p>
      </div>

      {todos.length === 0 ? (
        <p className="rounded-xl border bg-card p-5 text-sm text-muted-foreground shadow-sm">
          Aktuell keine offenen Aufträge — sobald das Call-Center etwas für
          Ihren Standort vereinbart, taucht es hier auf.
        </p>
      ) : (
        <ul className="flex flex-col gap-2">
          {todos.map((t) => (
            <li
              key={t.id}
              className="flex flex-col gap-2 rounded-xl border bg-card px-4 py-3 shadow-sm"
            >
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="flex flex-wrap items-center gap-1.5">
                    <span
                      className={`rounded-full px-2 py-0.5 text-[0.65rem] font-semibold ${ART_CHIP[t.art] ?? ART_CHIP.sonstiges}`}
                    >
                      {ART_LABEL[t.art] ?? t.art}
                    </span>
                    <span className="font-medium">{t.aufgabe}</span>
                  </p>
                  <p className="mt-0.5 flex items-center gap-1 text-xs text-muted-foreground">
                    <Building2 className="size-3" />
                    {t.target_name}
                    {t.target_ort ? ` · ${t.target_ort}` : ""}
                    {t.created_at
                      ? ` · vom ${formatIsoDate(t.created_at.slice(0, 10))}`
                      : ""}
                  </p>
                  {t.besprochen && (
                    <p className="mt-1.5 flex items-start gap-1.5 rounded-lg bg-muted/50 px-2.5 py-1.5 text-sm text-muted-foreground">
                      <MessageSquareText className="mt-0.5 size-3.5 shrink-0" />
                      <span>
                        <span className="font-medium text-foreground">
                          Besprochen:
                        </span>{" "}
                        {t.besprochen}
                      </span>
                    </p>
                  )}
                </div>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="shrink-0"
                  disabled={pendingId === t.id}
                  onClick={() => done(t.id)}
                >
                  <Check className="size-4" />
                  {pendingId === t.id ? "Speichere…" : "Erledigt"}
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}

      <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <ClipboardList className="size-3.5" />
        Erledigtes bitte zusätzlich im Schnell-Log unter „Meine Orte“ loggen —
        das zählt für Karte, Statistik und das Standort-Ranking.
      </p>
    </div>
  );
}
