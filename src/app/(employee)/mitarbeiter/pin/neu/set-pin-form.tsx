"use client";

import { useRouter } from "next/navigation";
import { useCallback, useState } from "react";
import { Check } from "lucide-react";
import { MButton } from "@/components/m/m-button";
import { MPinInput } from "@/components/m/m-pin-input";

type Step = "set" | "confirm" | "done";

/** PIN festlegen: eingeben, wiederholen, fertig. */
export function SetPinForm() {
  const router = useRouter();
  const [step, setStep] = useState<Step>("set");
  const [first, setFirst] = useState("");
  const [second, setSecond] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [shake, setShake] = useState(false);
  const [loading, setLoading] = useState(false);

  const onFirstComplete = useCallback((value: string) => {
    setFirst(value);
    setError(null);
    setStep("confirm");
  }, []);

  const onSecondComplete = useCallback(
    async (value: string) => {
      if (value !== first) {
        setSecond("");
        setError("Die PINs stimmen nicht ueberein. Bitte noch einmal.");
        setShake(true);
        setTimeout(() => setShake(false), 320);
        setStep("set");
        setFirst("");
        return;
      }

      setLoading(true);
      try {
        const res = await fetch("/api/employee/pin", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ pin: value }),
        });
        const data = await res.json().catch(() => ({}));

        if (!res.ok) {
          setSecond("");
          setFirst("");
          setStep("set");
          setError(data.error ?? "Das hat nicht geklappt.");
          setShake(true);
          setTimeout(() => setShake(false), 320);
          return;
        }
        setStep("done");
      } catch {
        setSecond("");
        setError("Keine Verbindung. Bitte pruefe dein Internet.");
      } finally {
        setLoading(false);
      }
    },
    [first],
  );

  if (step === "done") {
    return (
      <div className="flex min-h-[70dvh] flex-col justify-between">
        <div className="flex flex-1 flex-col items-center justify-center text-center">
          <div
            className="flex size-16 items-center justify-center rounded-full"
            style={{ background: "var(--m-success)" }}
          >
            <Check size={34} color="white" strokeWidth={3} aria-hidden />
          </div>
          <h1 className="mt-5 text-[26px] font-bold text-foreground">Fertig!</h1>
          <p className="mt-2 text-[17px] text-muted-foreground">
            Deine App ist eingerichtet.
          </p>
        </div>
        <MButton onClick={() => router.replace("/mitarbeiter/start")}>
          Jetzt starten
        </MButton>
      </div>
    );
  }

  const setting = step === "set";

  return (
    <div>
      <h1 className="text-[26px] font-bold leading-tight text-foreground">
        {setting ? "PIN festlegen" : "PIN wiederholen"}
      </h1>
      <p className="mt-3 max-w-[34ch] text-[17px] leading-relaxed text-muted-foreground">
        {setting
          ? "Waehle 6 Ziffern. Damit oeffnest du die App kuenftig."
          : "Zur Sicherheit noch einmal."}
      </p>

      <div className="mt-10">
        <MPinInput
          key={step}
          mode="new"
          label={setting ? "Neue PIN, 6 Ziffern" : "PIN wiederholen"}
          value={setting ? first : second}
          onChange={setting ? setFirst : setSecond}
          onComplete={setting ? onFirstComplete : onSecondComplete}
          autoFocus
          disabled={loading}
          shake={shake}
        />

        {error && (
          <p
            role="alert"
            aria-live="assertive"
            className="mt-5 text-center text-[15px] font-medium text-destructive"
          >
            {error}
          </p>
        )}

        {setting && !error && (
          <p className="mt-5 text-center text-[15px] text-muted-foreground">
            Bitte nicht dein Geburtsdatum verwenden.
          </p>
        )}
      </div>
    </div>
  );
}
