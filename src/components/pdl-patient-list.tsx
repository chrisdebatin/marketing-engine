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
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);

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
          notiz: aktion === "nicht_zustande" ? note : undefined,
        }),
      });
      const json = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) throw new Error(json.error ?? "Fehler beim Speichern.");
      setRows((cur) => cur.filter((r) => r.id !== row.id));
      setNoteFor(null);
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
                className="bg-emerald-600 hover:bg-emerald-600/90"
                onClick={() => confirm(r, "aufgenommen")}
              >
                <Check className="size-3.5" /> In Versorgung aufgenommen
              </Button>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                disabled={busy}
                className="text-muted-foreground"
                onClick={() => setNoteFor(noteFor === r.id ? null : r.id)}
              >
                <X className="size-3.5" /> kam nicht zustande
              </Button>
            </div>
            {noteFor === r.id && (
              <div className="flex flex-col gap-1.5">
                <Textarea
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  rows={2}
                  placeholder="Kurz warum? (z. B. anderweitig versorgt, nicht erreichbar)"
                />
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="self-start"
                  disabled={busy}
                  onClick={() => confirm(r, "nicht_zustande")}
                >
                  Bestätigen
                </Button>
              </div>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
