"use client";

import { useState } from "react";
import { Check, Mail, Phone, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { leadShortId } from "@/lib/leads";

export interface PdlPatientRow {
  kind: "meta" | "call";
  id: string;
  name: string;
  telefon: string | null;
  email: string | null;
  kontext: string | null;
  zugewiesen_at: string | null;
}

/**
 * Zugewiesene Patienten auf der PDL-Seite: Kontakt aufnehmen, Versorgung
 * koordinieren und den Ausgang bestätigen — bis dahin bleibt der Patient
 * hier als "offen" stehen.
 */
export function PdlPatientList({
  token,
  initial,
}: {
  token: string;
  initial: PdlPatientRow[];
}) {
  const [rows, setRows] = useState(initial);
  const [error, setError] = useState<string | null>(null);
  const [noteFor, setNoteFor] = useState<string | null>(null);
  const [grund, setGrund] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);

  // Feste Verlust-Gründe — fließen in die Team-Rückmeldung und Auswertung.
  const GRUENDE = [
    "Doch kein Interesse",
    "Anderer Pflegedienst übernimmt",
    "Keine Kapazität bei uns",
    "Nicht erreichbar",
    "Gesundheitlich (Krankenhaus/Reha/verstorben)",
  ] as const;

  async function confirm(row: PdlPatientRow, aktion: "aufgenommen" | "nicht_zustande") {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/public/hub-patient", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          token,
          kind: row.kind,
          id: row.id,
          aktion,
          notiz:
            aktion === "nicht_zustande"
              ? [grund, note.trim()].filter(Boolean).join(" — ")
              : undefined,
        }),
      });
      const json = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) throw new Error(json.error ?? "Fehler beim Speichern.");
      setRows((cur) => cur.filter((r) => r.id !== row.id));
      setNoteFor(null);
      setGrund(null);
      setNote("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Fehler");
    } finally {
      setBusy(false);
    }
  }

  if (rows.length === 0) {
    return (
      <p className="rounded-xl border bg-card p-5 text-sm text-muted-foreground shadow-sm">
        Aktuell keine offenen Patienten-Zuweisungen. Neue Zuweisungen kommen
        zusätzlich per E-Mail.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <p className="text-sm text-muted-foreground">
        Diese Patienten wurden Ihrem Standort zugewiesen — bitte Kontakt
        aufnehmen, den Versorgungsstart koordinieren und hier den Ausgang
        bestätigen.
      </p>
      {error && <p className="text-sm text-destructive">{error}</p>}
      <ul className="flex flex-col gap-2">
        {rows.map((r) => (
          <li
            key={r.id}
            className="flex flex-col gap-2 rounded-xl border border-amber-500/40 bg-amber-500/[0.04] p-4 shadow-sm"
          >
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
              <span className="font-medium">{r.name}</span>
              <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-800">
                offen
              </span>
              {r.zugewiesen_at && (
                <span className="text-xs text-muted-foreground">
                  zugewiesen am{" "}
                  {new Date(r.zugewiesen_at).toLocaleDateString("de-DE")}
                </span>
              )}
            </div>
            <p className="flex flex-wrap items-center gap-x-4 gap-y-0.5 text-sm">
              {r.telefon && (
                <a
                  href={`tel:${r.telefon}`}
                  className="flex items-center gap-1 text-primary hover:underline"
                >
                  <Phone className="size-3" />
                  {r.telefon}
                </a>
              )}
              {r.email && (
                <a
                  href={`mailto:${r.email}`}
                  className="flex items-center gap-1 text-primary hover:underline"
                >
                  <Mail className="size-3" />
                  {r.email}
                </a>
              )}
            </p>
            {r.kontext && (
              <p className="text-xs text-muted-foreground">{r.kontext}</p>
            )}
            <p className="text-xs">
              <span className="rounded border bg-muted/60 px-1.5 py-0.5 font-mono">
                {leadShortId(r.id)}
              </span>{" "}
              <span className="text-muted-foreground">
                — diese Lead-ID bitte beim Anlegen in MediFox als Referenz
                hinterlegen.
              </span>
            </p>
            <div className="flex flex-wrap items-center gap-1.5">
              <Button
                type="button"
                size="sm"
                disabled={busy}
                title="Bestätigt dem Marketing-Team: Der Patient wird bei Ihnen versorgt. Der Fall wird damit abgeschlossen und verschwindet aus dieser Liste."
                className="bg-emerald-600 hover:bg-emerald-700"
                onClick={() => confirm(r, "aufgenommen")}
              >
                <Check className="size-3.5" /> In Versorgung aufgenommen
              </Button>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                disabled={busy}
                title="Versorgung kam nicht zustande? Kurz den Grund angeben — das Team sieht die Rückmeldung und der Fall wird geschlossen."
                className="text-muted-foreground"
                onClick={() => {
                  setNoteFor(noteFor === r.id ? null : r.id);
                  setGrund(null);
                  setNote("");
                }}
              >
                <X className="size-3.5" /> kam nicht zustande
              </Button>
            </div>
            {noteFor === r.id && (
              <div className="flex flex-col gap-2 rounded-lg border bg-card p-3">
                <p className="text-xs font-medium">
                  Warum kam die Versorgung nicht zustande?
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {GRUENDE.map((g) => (
                    <button
                      key={g}
                      type="button"
                      onClick={() => setGrund(grund === g ? null : g)}
                      className={
                        grund === g
                          ? "rounded-full border border-primary bg-primary px-2.5 py-1 text-xs font-medium text-primary-foreground"
                          : "rounded-full border bg-background px-2.5 py-1 text-xs font-medium text-muted-foreground hover:text-foreground"
                      }
                    >
                      {g}
                    </button>
                  ))}
                </div>
                <Textarea
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  rows={2}
                  placeholder="Optional: Details ergänzen (z. B. welcher Pflegedienst, wann wieder relevant …)"
                />
                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="self-start"
                    disabled={busy || (!grund && !note.trim())}
                    onClick={() => confirm(r, "nicht_zustande")}
                  >
                    {busy ? "Speichert…" : "Bestätigen"}
                  </Button>
                  {!grund && !note.trim() && (
                    <span className="text-[11px] text-muted-foreground">
                      Bitte einen Grund wählen oder eintragen.
                    </span>
                  )}
                </div>
              </div>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
