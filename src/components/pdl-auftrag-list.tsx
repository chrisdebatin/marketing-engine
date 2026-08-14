"use client";

import { useState } from "react";
import { Check, PhoneCall, Send } from "lucide-react";
import { Button } from "@/components/ui/button";

export interface PdlAuftragRow {
  id: string;
  text: string;
  institution: string;
  anruf_datum: string;
  anruf_von: string | null;
  ansprechpartner: string | null;
  anruf_notiz: string | null;
}

function datum(iso: string): string {
  return new Date(`${iso}T00:00:00`).toLocaleDateString("de-DE", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

/**
 * Vor-Ort-Aufträge, die das Call-Center im Telefonat zugesagt hat
 * ("Flyer vorbeibringen"). Jede Karte zeigt das Anrufprotokoll, damit die
 * PDL weiß, wer wann mit wem gesprochen und was genau zugesagt hat.
 */
export function PdlAuftragList({
  token,
  initial,
}: {
  token: string;
  initial: PdlAuftragRow[];
}) {
  const [rows, setRows] = useState(initial);
  const [busy, setBusy] = useState<string | null>(null);
  const [fehler, setFehler] = useState<string | null>(null);

  async function erledigt(id: string) {
    setBusy(id);
    setFehler(null);
    try {
      const res = await fetch("/api/public/hub-auftrag", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, id }),
      });
      if (!res.ok) {
        const j = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(j.error ?? "Fehler beim Speichern.");
      }
      setRows((cur) => cur.filter((r) => r.id !== id));
    } catch (e) {
      setFehler(e instanceof Error ? e.message : "Fehler");
    } finally {
      setBusy(null);
    }
  }

  if (rows.length === 0) return null;

  return (
    <section className="flex flex-col gap-2">
      <div>
        <h3 className="flex items-center gap-2 text-base font-semibold">
          <Send className="size-4 text-primary" />
          Aufträge aus Telefonaten des Call-Centers
        </h3>
        <p className="text-xs text-muted-foreground">
          Das Call-Center hat im Gespräch etwas zugesagt — bitte vor Ort
          erledigen und hier abhaken.
        </p>
      </div>
      {fehler && <p className="text-sm text-destructive">{fehler}</p>}
      <ul className="flex flex-col gap-2">
        {rows.map((r) => (
          <li
            key={r.id}
            className="flex flex-col gap-2 rounded-xl border border-primary/30 bg-primary/[0.03] p-4 shadow-sm"
          >
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="font-semibold">{r.text}</p>
                <p className="text-sm text-muted-foreground">
                  bei <span className="font-medium">{r.institution}</span>
                </p>
              </div>
              <Button
                type="button"
                size="sm"
                disabled={busy === r.id}
                className="shrink-0 bg-emerald-600 hover:bg-emerald-700"
                onClick={() => erledigt(r.id)}
              >
                <Check className="size-3.5" />
                {busy === r.id ? "Speichert…" : "Erledigt"}
              </Button>
            </div>

            {/* Anrufprotokoll — Kontext für das Gespräch vor Ort */}
            <div className="rounded-lg border bg-card p-3 text-xs">
              <p className="flex items-center gap-1.5 font-medium">
                <PhoneCall className="size-3.5 text-primary" />
                Was besprochen wurde
              </p>
              <p className="mt-1 text-muted-foreground">
                Am {datum(r.anruf_datum)} hat{" "}
                <span className="font-medium text-foreground">
                  {r.anruf_von ?? "das Call-Center"}
                </span>{" "}
                bei {r.institution} angerufen
                {r.ansprechpartner ? (
                  <>
                    {" "}
                    und mit{" "}
                    <span className="font-medium text-foreground">
                      {r.ansprechpartner}
                    </span>{" "}
                    gesprochen
                  </>
                ) : null}
                .
              </p>
              {r.anruf_notiz && (
                <p className="mt-1 border-l-2 border-primary/30 pl-2 text-foreground/80 italic">
                  „{r.anruf_notiz}“
                </p>
              )}
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
