"use client";

import { useState } from "react";
import { Sparkles, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

interface Turn {
  role: "user" | "assistant";
  text: string;
}

const EXAMPLES = [
  "Wie viele Flyer wurden diesen Monat ausgelegt?",
  "Boxen pro Hub im letzten Quartal",
  "Zeig die letzten 10 Einträge",
];

export default function AssistantPage() {
  const [question, setQuestion] = useState("");
  const [turns, setTurns] = useState<Turn[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function ask(q: string) {
    const query = q.trim();
    if (!query || loading) return;
    setError(null);
    setTurns((t) => [...t, { role: "user", text: query }]);
    setQuestion("");
    setLoading(true);
    try {
      const res = await fetch("/api/assistant", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: query }),
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
    <div className="flex flex-col gap-6">
      <div className="flex items-center gap-3">
        <span className="flex size-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
          <Sparkles className="size-5" />
        </span>
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Assistant</h1>
          <p className="text-sm text-muted-foreground">
            Stell Fragen zu deinen Marketing-Zahlen. (Benötigt Internet.)
          </p>
        </div>
      </div>

      {turns.length === 0 && (
        <div className="flex flex-wrap gap-2">
          {EXAMPLES.map((ex) => (
            <button
              key={ex}
              type="button"
              onClick={() => ask(ex)}
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
                  "max-w-[85%] rounded-2xl px-4 py-2.5 text-sm whitespace-pre-wrap",
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
              <div className="flex items-center gap-1 rounded-2xl border bg-card px-4 py-3.5">
                <span className="size-1.5 animate-bounce rounded-full bg-muted-foreground [animation-delay:-0.3s]" />
                <span className="size-1.5 animate-bounce rounded-full bg-muted-foreground [animation-delay:-0.15s]" />
                <span className="size-1.5 animate-bounce rounded-full bg-muted-foreground" />
              </div>
            </div>
          )}
          {error && <p className="text-sm text-destructive">{error}</p>}
        </div>
      )}

      {turns.length === 0 && error && (
        <p className="text-sm text-destructive">{error}</p>
      )}

      <form
        onSubmit={(e) => {
          e.preventDefault();
          ask(question);
        }}
        className="sticky bottom-4 flex items-end gap-2 rounded-2xl border bg-card/80 p-2 shadow-sm backdrop-blur"
      >
        <Textarea
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          placeholder="Deine Frage…"
          rows={1}
          className="min-h-10 resize-none border-0 bg-transparent shadow-none focus-visible:ring-0"
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              ask(question);
            }
          }}
        />
        <Button
          type="submit"
          size="icon"
          disabled={loading || !question.trim()}
          aria-label="Fragen"
        >
          <Send className="size-4" />
        </Button>
      </form>
    </div>
  );
}
