"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { MButton } from "@/components/m/m-button";
import { MField } from "@/components/m/m-field";

/**
 * Eingabe des Aktivierungscodes.
 *
 * Ein einzelnes Feld statt Segment-Boxen: der Code kommt oft per Zettel oder
 * Nachricht, Einfuegen muss zuverlaessig funktionieren. Formatierung
 * (Grossschreibung, Vierergruppen) passiert waehrend der Eingabe.
 */
export function ActivationForm() {
  const router = useRouter();
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  function format(raw: string) {
    const clean = raw.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 10);
    return (clean.match(/.{1,4}/g) ?? []).join("-");
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/employee/activate", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ code }),
      });
      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        setError(data.error ?? "Das hat nicht geklappt.");
        return;
      }
      router.replace("/mitarbeiter/pin/neu");
    } catch {
      setError("Keine Verbindung. Bitte pruefe dein Internet.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-6" noValidate>
      <MField
        label="Aktivierungscode"
        value={code}
        onChange={(e) => setCode(format(e.target.value))}
        error={error ?? undefined}
        placeholder="ABCD-EFGH-JK"
        autoCapitalize="characters"
        autoComplete="one-time-code"
        autoCorrect="off"
        spellCheck={false}
        inputMode="text"
        enterKeyHint="go"
        className="text-center font-mono tracking-[0.12em]"
        autoFocus
      />

      <MButton type="submit" loading={loading}>
        Weiter
      </MButton>
    </form>
  );
}
