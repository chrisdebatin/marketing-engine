"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { MPinInput } from "@/components/m/m-pin-input";

/** PIN-Eingabe zum Entsperren, inkl. Sperr-Countdown. */
export function UnlockForm() {
  const router = useRouter();
  const [pin, setPin] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [shake, setShake] = useState(false);
  const [loading, setLoading] = useState(false);
  const [lockedFor, setLockedFor] = useState(0);

  // Countdown der Sperre.
  useEffect(() => {
    if (lockedFor <= 0) return;
    const t = setInterval(() => setLockedFor((s) => Math.max(0, s - 1)), 1000);
    return () => clearInterval(t);
  }, [lockedFor]);

  const submit = useCallback(
    async (value: string) => {
      setLoading(true);
      try {
        const res = await fetch("/api/employee/login", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ pin: value }),
        });
        const data = await res.json().catch(() => ({}));

        if (res.ok) {
          router.replace("/mitarbeiter/start");
          return;
        }

        setPin("");
        setShake(true);
        setTimeout(() => setShake(false), 320);

        if (data.code === "locked") {
          setLockedFor(data.retry_after ?? 300);
          setError(null);
        } else if (data.code === "no_device") {
          router.replace("/mitarbeiter");
        } else if (typeof data.attempts_left === "number") {
          setError(
            data.attempts_left === 1
              ? "Falsche PIN. Noch 1 Versuch."
              : `Falsche PIN. Noch ${data.attempts_left} Versuche.`,
          );
        } else {
          setError("Falsche PIN.");
        }
      } catch {
        setPin("");
        setError("Keine Verbindung. Bitte pruefe dein Internet.");
      } finally {
        setLoading(false);
      }
    },
    [router],
  );

  const locked = lockedFor > 0;
  const mins = Math.floor(lockedFor / 60);
  const secs = String(lockedFor % 60).padStart(2, "0");

  return (
    <div>
      <h1 className="text-[26px] font-bold leading-tight text-foreground">
        PIN eingeben
      </h1>

      <div className="mt-12">
        <MPinInput
          mode="current"
          label="PIN, 6 Ziffern"
          value={pin}
          onChange={setPin}
          onComplete={submit}
          autoFocus={!locked}
          disabled={loading || locked}
          shake={shake}
        />

        {locked ? (
          <p
            role="alert"
            aria-live="polite"
            className="mt-6 text-center text-[15px] font-medium text-foreground"
          >
            Zu viele Versuche. Bitte in {mins}:{secs} erneut probieren.
          </p>
        ) : error ? (
          <p
            role="alert"
            aria-live="assertive"
            className="mt-6 text-center text-[15px] font-medium text-destructive"
          >
            {error}
          </p>
        ) : null}

        <details className="mt-10 text-center">
          <summary className="m-tap inline-flex cursor-pointer items-center justify-center text-[15px] font-semibold text-primary">
            PIN vergessen?
          </summary>
          <p className="mx-auto mt-3 max-w-[34ch] text-[15px] leading-relaxed text-muted-foreground">
            Bitte wende dich an deine Hubleitung. Sie kann dir einen neuen
            Aktivierungscode geben.
          </p>
        </details>
      </div>
    </div>
  );
}
