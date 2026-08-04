"use client";

import { useState } from "react";
import { Rocket, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

interface Turn {
  role: "user" | "assistant";
  text: string;
}

const EXAMPLES = [
  "Ich brauche neue Mitarbeiter in Essen — 20 €/Tag",
  "Ich brauche Kunden in Velbert",
  "Wie laufen die aktuellen Kampagnen? Gib mir einen Report.",
  "Was würdest du am Konto als Erstes optimieren?",
];

/**
 * Chat mit dem Meta-Ads-Agenten: Freitext rein ("Mitarbeiter in Essen"),
 * der Agent baut die Kampagne über die Meta-API — immer PAUSED, Aktivierung
 * nur nach ausdrücklicher Freigabe im Chat.
 */
export function MetaAdsAgent() {
  const [input, setInput] = useState("");
  const [turns, setTurns] = useState<Turn[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function send(text: string) {
    const query = text.trim();
    if (!query || loading) return;
    setError(null);
    const next = [...turns, { role: "user" as const, text: query }];
    setTurns(next);
    setInput("");
    setLoading(true);
    try {
      const res = await fetch("/api/meta-ads/agent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: next }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Fehler bei der Anfrage.");
      } else {
        setTurns((t) => [...t, { role: "assistant", text: data.answer }]);
      }
    } catch {
      setError("Netzwerkfehler. Bist du online?");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      {turns.length === 0 && (
        <div className="flex flex-wrap gap-2">
          {EXAMPLES.map((ex) => (
            <button
              key={ex}
              type="button"
              onClick={() => send(ex)}
              disabled={loading}
              className="rounded-full border bg-card px-3.5 py-1.5 text-sm text-muted-foreground transition-colors hover:border-primary/40 hover:text-foreground disabled:opacity-50"
            >
              {ex}
            </button>
          ))}
        </div>
      )}

      {turns.length > 0 && (
        <div className="flex flex-col gap-3">
          {turns.map((t, i) => (
            <div
              key={i}
              className={cn(
                "flex",
                t.role === "user" ? "justify-end" : "justify-start",
              )}
            >
              <div
                className={cn(
                  "max-w-[90%] rounded-2xl px-4 py-2.5 text-sm whitespace-pre-wrap",
                  t.role === "user"
                    ? "bg-primary text-primary-foreground"
                    : "border bg-card",
                )}
              >
                {t.text}
              </div>
            </div>
          ))}
          {loading && (
            <div className="flex justify-start">
              <div className="flex items-center gap-2 rounded-2xl border bg-card px-4 py-3">
                <Rocket className="size-3.5 animate-pulse text-primary" />
                <span className="text-xs text-muted-foreground">
                  Agent arbeitet (Meta-API)…
                </span>
              </div>
            </div>
          )}
        </div>
      )}
      {error && <p className="text-sm text-destructive">{error}</p>}

      <form
        onSubmit={(e) => {
          e.preventDefault();
          send(input);
        }}
        className="sticky bottom-4 flex items-end gap-2 rounded-2xl border bg-card/80 p-2 shadow-sm backdrop-blur"
      >
        <Textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="z. B. „Ich brauche Mitarbeiter in Essen, 25 €/Tag“…"
          rows={1}
          className="min-h-10 resize-none border-0 bg-transparent shadow-none focus-visible:ring-0"
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              send(input);
            }
          }}
        />
        <Button
          type="submit"
          size="icon"
          disabled={loading || !input.trim()}
          aria-label="Senden"
        >
          <Send className="size-4" />
        </Button>
      </form>
    </div>
  );
}
