"use client";

import { useState } from "react";
import { HelpCircle, Send, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

interface Nachricht {
  rolle: "user" | "assistant";
  text: string;
}

/** Häufige Fragen als Ein-Klick-Einstieg — senkt die Hemmschwelle. */
const BEISPIELE = [
  "Was mache ich, wenn niemand ans Telefon geht?",
  "Wie übergebe ich einen Lead an die PDL?",
  "Ich habe aus Versehen „Übergeben“ geklickt — was jetzt?",
  "Wann ist ein Anruf ein Neuinteressent und wann nicht?",
  "Wie trage ich eine fehlende Adresse nach?",
  "Was bedeutet der Timer oben rechts auf der Lead-Karte?",
];

/**
 * Fragen-Seite zum CRM: Claude beantwortet Bedienungs-Fragen aus der
 * hinterlegten Anleitung (lib/crm-wissen.ts). Kein Datenbank-Zugriff —
 * für Zahlen gibt es den Auswertungs-Assistenten.
 */
export function CrmHilfe() {
  const [frage, setFrage] = useState("");
  const [verlauf, setVerlauf] = useState<Nachricht[]>([]);
  const [busy, setBusy] = useState(false);
  const [fehler, setFehler] = useState<string | null>(null);

  async function fragen(text: string) {
    const f = text.trim();
    if (!f || busy) return;
    setBusy(true);
    setFehler(null);
    const bisher = verlauf;
    setVerlauf([...bisher, { rolle: "user", text: f }]);
    setFrage("");
    try {
      const res = await fetch("/api/crm-hilfe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          frage: f,
          verlauf: bisher.map((m) => ({ rolle: m.rolle, text: m.text })),
        }),
      });
      const j = (await res.json().catch(() => ({}))) as {
        antwort?: string;
        error?: string;
      };
      if (!res.ok || !j.antwort) throw new Error(j.error ?? "Keine Antwort erhalten.");
      setVerlauf((v) => [...v, { rolle: "assistant", text: j.antwort! }]);
    } catch (e) {
      setFehler(e instanceof Error ? e.message : "Fehler");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Verlauf */}
      {verlauf.length > 0 && (
        <div className="flex flex-col gap-3">
          {verlauf.map((m, i) => (
            <div
              key={i}
              className={cn(
                "max-w-[46rem] rounded-xl border p-3.5 text-sm whitespace-pre-line",
                m.rolle === "user"
                  ? "ml-auto bg-primary text-primary-foreground"
                  : "bg-card shadow-sm",
              )}
            >
              {m.rolle === "assistant" && (
                <p className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold text-primary">
                  <Sparkles className="size-3.5" />
                  Antwort
                </p>
              )}
              {m.text}
            </div>
          ))}
          {busy && (
            <p className="flex items-center gap-2 text-sm text-muted-foreground">
              <Sparkles className="size-4 animate-pulse text-primary" />
              Einen Moment…
            </p>
          )}
        </div>
      )}

      {fehler && (
        <p className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
          {fehler}
        </p>
      )}

      {/* Eingabe */}
      <div className="flex flex-col gap-2 rounded-xl border bg-card p-4 shadow-sm">
        <label className="flex items-center gap-1.5 text-sm font-semibold">
          <HelpCircle className="size-4 text-primary" />
          Deine Frage zum CRM
        </label>
        <Textarea
          value={frage}
          onChange={(e) => setFrage(e.target.value)}
          onKeyDown={(e) => {
            // Enter sendet, Shift+Enter macht einen Zeilenumbruch.
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              void fragen(frage);
            }
          }}
          rows={2}
          placeholder="z. B. Wie logge ich einen Anruf, bei dem niemand rangegangen ist?"
          className="bg-background"
        />
        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            disabled={busy || !frage.trim()}
            onClick={() => void fragen(frage)}
          >
            <Send className="size-4" />
            {busy ? "Fragt…" : "Fragen"}
          </Button>
          {verlauf.length > 0 && (
            <Button
              type="button"
              variant="ghost"
              className="text-muted-foreground"
              onClick={() => {
                setVerlauf([]);
                setFehler(null);
              }}
            >
              Verlauf leeren
            </Button>
          )}
          <span className="text-xs text-muted-foreground">
            Enter sendet · Shift+Enter für eine neue Zeile
          </span>
        </div>
      </div>

      {/* Beispiel-Fragen */}
      {verlauf.length === 0 && (
        <div className="flex flex-col gap-2">
          <p className="text-sm font-medium text-muted-foreground">
            Häufige Fragen — einfach anklicken:
          </p>
          <div className="flex flex-wrap gap-2">
            {BEISPIELE.map((b) => (
              <button
                key={b}
                type="button"
                onClick={() => void fragen(b)}
                className="rounded-full border bg-card px-3 py-1.5 text-sm text-muted-foreground shadow-sm transition-colors hover:border-primary/40 hover:text-foreground"
              >
                {b}
              </button>
            ))}
          </div>
        </div>
      )}

      <p className="text-xs text-muted-foreground">
        Die Hilfe kennt die Bedienung des CRM, aber keine Zahlen. Für
        Auswertungen (&bdquo;wie viele Leads hatten wir letzte Woche?&ldquo;)
        gibt es den
        Assistenten bzw. den CRM-Admin-Bereich.
      </p>
    </div>
  );
}
