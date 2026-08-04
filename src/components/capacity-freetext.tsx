"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { importCapacityFromText } from "@/app/(app)/kapazitaet/actions";

/**
 * Freitext-Eingabe für Kapazitäten: einfach hinschreiben, welcher Standort
 * wie viele Plätze hat — Claude ordnet die Angaben zu und füllt die
 * Wochen-Tabelle.
 */
export function CapacityFreetext() {
  const [text, setText] = useState("");
  const [result, setResult] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function run() {
    if (pending || !text.trim()) return;
    startTransition(async () => {
      const r = await importCapacityFromText({ text });
      setResult(r.message);
      if (r.ok) {
        toast.success("Kapazitäten eingetragen");
        setText("");
      } else {
        toast.error(r.message);
      }
    });
  }

  return (
    <section className="flex flex-col gap-2 rounded-xl border border-primary/25 bg-primary/[0.04] p-4">
      <p className="flex items-center gap-1.5 text-sm font-semibold">
        <Sparkles className="size-4 text-primary" />
        Schnell-Eintrag per Freitext (KI)
      </p>
      <p className="text-sm text-muted-foreground">
        Einfach hinschreiben, was gemeldet wurde — Claude ordnet die Zahlen den
        Standorten zu und trägt sie für die aktuelle Woche in die Tabelle ein.
      </p>
      <Textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={3}
        maxLength={4000}
        disabled={pending}
        placeholder={
          "z. B.: Dorsten hat 5 freie Plätze, 2 davon Beatmung, Aufnahme ab Montag.\nVelbert 3 Plätze, keine Beatmung, Kinder möglich. Iserlohn aktuell voll (0 Plätze)."
        }
        className="bg-background"
      />
      <div className="flex flex-wrap items-center gap-2">
        <Button
          type="button"
          size="sm"
          disabled={pending || !text.trim()}
          onClick={run}
        >
          <Sparkles className="size-4" />
          {pending ? "Werte aus…" : "Auslesen & eintragen"}
        </Button>
        {result && (
          <span className="text-xs break-words text-muted-foreground">
            {result}
          </span>
        )}
      </div>
    </section>
  );
}
