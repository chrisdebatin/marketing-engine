"use client";

import { useState } from "react";
import { MButton } from "@/components/m/m-button";
import { MField } from "@/components/m/m-field";
import { MError } from "@/components/m/m-states";
import { MFormHeader, MSuccess } from "@/components/m/m-referral-shell";

/**
 * Kunden-Empfehlung.
 *
 * Bewusst kurz gehalten: das Formular muss im Stehen, einhaendig, in einer
 * Pause ausfuellbar sein. Pflicht sind nur Name und Telefonnummer plus die
 * Einwilligungs-Bestaetigung (DSGVO — es geht um Daten einer dritten Person).
 */
export function CustomerReferralForm({ vorname }: { vorname: string }) {
  const [done, setDone] = useState(false);
  const [loading, setLoading] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const [form, setForm] = useState({
    kunde_name: "",
    telefon: "",
    email: "",
    ort: "",
    beziehung: "",
    notiz: "",
  });
  const [consent, setConsent] = useState(false);

  const set = (k: keyof typeof form) => (e: { target: { value: string } }) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setFormError(null);

    // Clientseitige Vorpruefung ist reine Freundlichkeit — die verbindliche
    // Validierung passiert serverseitig im Zod-Schema.
    const next: Record<string, string> = {};
    if (form.kunde_name.trim().length < 2) {
      next.kunde_name = "Bitte gib den Namen der Person ein.";
    }
    if (form.telefon.trim().length < 5) {
      next.telefon = "Bitte gib eine Telefonnummer ein.";
    }
    if (!consent) {
      next.consent = "Bitte bestaetige, dass die Person Bescheid weiss.";
    }
    setErrors(next);
    if (Object.keys(next).length > 0) return;

    setLoading(true);
    try {
      const res = await fetch("/api/employee/referrals/customer", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          kunde_name: form.kunde_name,
          telefon: form.telefon,
          email: form.email,
          ort: form.ort,
          beziehung: form.beziehung,
          notiz: form.notiz,
          consent: true,
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setFormError(data.error ?? "Das hat nicht geklappt.");
        return;
      }
      setDone(true);
    } catch {
      setFormError("Keine Verbindung. Bitte pruefe dein Internet.");
    } finally {
      setLoading(false);
    }
  }

  if (done) {
    return (
      <MSuccess
        vorname={vorname}
        text="Wir haben deine Empfehlung erhalten und kuemmern uns darum."
        againHref="/mitarbeiter/empfehlen/kunde"
        againLabel="Noch jemanden empfehlen"
      />
    );
  }

  return (
    <>
      <MFormHeader title="Kundin oder Kunden empfehlen" />

      <form onSubmit={submit} noValidate className="px-5 pb-32 pt-6">
        <div className="flex flex-col gap-5">
          <MField
            label="Name der Person"
            value={form.kunde_name}
            onChange={set("kunde_name")}
            error={errors.kunde_name}
            autoComplete="off"
            enterKeyHint="next"
          />

          <MField
            label="Telefonnummer"
            type="tel"
            inputMode="tel"
            autoComplete="tel"
            value={form.telefon}
            onChange={set("telefon")}
            error={errors.telefon}
            enterKeyHint="next"
          />

          <MField
            label="E-Mail"
            optional
            type="email"
            inputMode="email"
            autoComplete="email"
            value={form.email}
            onChange={set("email")}
            enterKeyHint="next"
          />

          <MField
            label="Ort"
            optional
            value={form.ort}
            onChange={set("ort")}
            enterKeyHint="next"
          />

          <MField
            label="Woher kennst du die Person?"
            optional
            value={form.beziehung}
            onChange={set("beziehung")}
            enterKeyHint="next"
          />

          <MField
            label="Anmerkung"
            optional
            textarea
            value={form.notiz}
            onChange={set("notiz")}
            enterKeyHint="done"
          />

          <label className="flex items-start gap-3 rounded-xl border border-border bg-card p-4">
            <input
              type="checkbox"
              checked={consent}
              onChange={(e) => setConsent(e.target.checked)}
              className="mt-0.5 size-6 shrink-0 accent-[var(--primary)]"
              aria-describedby="consent-error"
            />
            <span className="text-[15px] leading-relaxed text-foreground">
              Die Person weiss Bescheid, dass ich sie empfehle.
            </span>
          </label>
          {errors.consent && (
            <p
              id="consent-error"
              className="-mt-3 text-[15px] font-medium text-destructive"
            >
              {errors.consent}
            </p>
          )}

          {formError && <MError message={formError} />}
        </div>
      </form>

      {/* Absenden bleibt immer erreichbar, auch bei offener Tastatur. */}
      <div className="m-sticky-bottom fixed inset-x-0 bottom-0 z-40 border-t border-border bg-card px-5 pt-3">
        <MButton onClick={submit} loading={loading}>
          {loading ? "Wird gesendet …" : "Empfehlung absenden"}
        </MButton>
      </div>
    </>
  );
}
