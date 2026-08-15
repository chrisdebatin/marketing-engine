"use client";

import { useState } from "react";
import { MButton } from "@/components/m/m-button";
import { MField } from "@/components/m/m-field";
import { MError } from "@/components/m/m-states";
import { MFormHeader, MSuccess } from "@/components/m/m-referral-shell";

/**
 * M&A-Empfehlung.
 *
 * Bewusst nur EIN Pflichtfeld (Name des Pflegedienstes). Die Hemmschwelle
 * muss so niedrig wie moeglich sein — der Mitarbeiter muss nicht wissen, ob
 * jemand verkaufen will. Die Texte sagen das ausdruecklich.
 */
export function MaReferralForm({ vorname }: { vorname: string }) {
  const [done, setDone] = useState(false);
  const [loading, setLoading] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const [form, setForm] = useState({
    firma_name: "",
    inhaber_name: "",
    telefon: "",
    email: "",
    ort: "",
    beziehung: "",
    notiz: "",
  });

  const set = (k: keyof typeof form) => (e: { target: { value: string } }) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setFormError(null);

    if (form.firma_name.trim().length < 2) {
      setErrors({ firma_name: "Bitte gib den Namen des Pflegedienstes ein." });
      return;
    }
    setErrors({});

    setLoading(true);
    try {
      const res = await fetch("/api/employee/referrals/ma", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(form),
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
        text="Danke fuer den Hinweis. Wir schauen uns das an und melden uns, wenn sich daraus etwas entwickelt."
        againHref="/mitarbeiter/empfehlen/pflegedienst"
        againLabel="Noch einen empfehlen"
      />
    );
  }

  return (
    <>
      <MFormHeader title="Pflegedienst empfehlen" />

      <form onSubmit={submit} noValidate className="px-5 pb-32 pt-6">
        <div className="rounded-xl bg-primary/[0.07] p-4">
          <p className="text-[15px] leading-relaxed text-foreground">
            Du musst nicht alles wissen. Schon ein Name reicht – wir kuemmern
            uns um den Rest. Auch unvollstaendige Hinweise sind fuer uns
            wertvoll.
          </p>
        </div>

        <div className="mt-6 flex flex-col gap-5">
          <MField
            label="Name des Pflegedienstes"
            value={form.firma_name}
            onChange={set("firma_name")}
            error={errors.firma_name}
            autoComplete="off"
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
            label="Ansprechpartnerin oder Ansprechpartner"
            optional
            value={form.inhaber_name}
            onChange={set("inhaber_name")}
            autoComplete="off"
            enterKeyHint="next"
          />

          <MField
            label="Telefonnummer"
            optional
            type="tel"
            inputMode="tel"
            value={form.telefon}
            onChange={set("telefon")}
            enterKeyHint="next"
          />

          <MField
            label="E-Mail"
            optional
            type="email"
            inputMode="email"
            value={form.email}
            onChange={set("email")}
            enterKeyHint="next"
          />

          <MField
            label="Woher kennst du den Kontakt?"
            optional
            textarea
            value={form.beziehung}
            onChange={set("beziehung")}
            hint="Zum Beispiel: frühere Arbeitsstelle, Ausbildung, Bekannte."
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

          {formError && <MError message={formError} />}

          <p className="text-[15px] leading-relaxed text-muted-foreground">
            Lieber jetzt abschicken als vergessen – fehlende Angaben klaeren
            wir spaeter.
          </p>
        </div>
      </form>

      <div className="m-sticky-bottom fixed inset-x-0 bottom-0 z-40 border-t border-border bg-card px-5 pt-3">
        <MButton onClick={submit} loading={loading}>
          {loading ? "Wird gesendet …" : "Empfehlung absenden"}
        </MButton>
      </div>
    </>
  );
}
