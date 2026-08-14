"use client";

import { useState } from "react";
import { Mail, Phone, Star, UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import {
  BEWERBER_STATUS_LABEL,
  BEWERBER_STATUS_TONE,
  SCORE_LABEL,
  SCORE_TONE,
  type BewerberScore,
} from "@/lib/bewerber";

export interface PdlBewerberRow {
  id: string;
  name: string;
  telefon: string | null;
  email: string | null;
  rolle: string | null;
  quelle: string;
  score: number | null;
  score_grund: string | null;
  status: string;
  notiz: string | null;
  zugewiesen_at: string;
  erstkontakt_at: string | null;
}

/** "vor 3 Std" / "vor 2 Tagen" — wie lange liegt die Bewerbung schon? */
function seit(iso: string, jetzt: number): string {
  const std = (jetzt - new Date(iso).getTime()) / 3_600_000;
  if (std < 1) return `vor ${Math.max(1, Math.round(std * 60))} Min`;
  if (std < 48) return `vor ${Math.round(std)} Std`;
  return `vor ${Math.round(std / 24)} Tagen`;
}

/**
 * "Meine Bewerber": Bewerbungen aus Meta-Anzeigen und Website, die dem
 * Standort zugewiesen wurden. Die PDL meldet zurück, was daraus wird — der
 * erste Statuswechsel stoppt die Liegezeit-Messung.
 */
export function PdlBewerberList({
  token,
  initial,
  now,
}: {
  token: string;
  initial: PdlBewerberRow[];
  /** Serverzeit — Date.now() im Render verstößt gegen react-hooks/purity. */
  now: string;
}) {
  const jetzt = new Date(now).getTime();
  const [rows, setRows] = useState(initial);
  const [busy, setBusy] = useState<string | null>(null);
  const [fehler, setFehler] = useState<string | null>(null);
  const [notizFuer, setNotizFuer] = useState<string | null>(null);
  const [notiz, setNotiz] = useState("");

  async function update(id: string, patch: { status?: string; notiz?: string }) {
    setBusy(id);
    setFehler(null);
    try {
      const res = await fetch("/api/public/hub-bewerber", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, id, ...patch }),
      });
      const j = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) throw new Error(j.error ?? "Fehler beim Speichern.");
      setRows((cur) =>
        cur.map((r) =>
          r.id === id
            ? {
                ...r,
                ...(patch.status ? { status: patch.status } : {}),
                ...(patch.notiz !== undefined ? { notiz: patch.notiz } : {}),
                erstkontakt_at:
                  r.erstkontakt_at ??
                  (patch.status && patch.status !== "neu"
                    ? new Date().toISOString()
                    : null),
              }
            : r,
        ),
      );
      setNotizFuer(null);
    } catch (e) {
      setFehler(e instanceof Error ? e.message : "Fehler");
    } finally {
      setBusy(null);
    }
  }

  // Offene zuerst, darin die stärksten Bewerbungen oben.
  const sortiert = [...rows].sort((a, b) => {
    const offen = (r: PdlBewerberRow) =>
      ["eingestellt", "abgesagt"].includes(r.status) ? 1 : 0;
    return (
      offen(a) - offen(b) ||
      (b.score ?? 0) - (a.score ?? 0) ||
      a.zugewiesen_at.localeCompare(b.zugewiesen_at)
    );
  });

  if (rows.length === 0) {
    return (
      <p className="rounded-xl border bg-card p-5 text-sm text-muted-foreground shadow-sm">
        Aktuell keine Bewerbungen für Ihren Standort. Neue Bewerbungen aus
        unseren Stellenanzeigen erscheinen automatisch hier.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm text-muted-foreground">
        Bewerbungen aus unseren Stellenanzeigen für Ihren Standort.{" "}
        <b className="text-foreground">Bitte zeitnah melden</b> — Bewerber
        springen erfahrungsgemäß schnell ab.
      </p>
      {fehler && <p className="text-sm text-destructive">{fehler}</p>}

      <ul className="flex flex-col gap-2">
        {sortiert.map((r) => {
          const offen = !["eingestellt", "abgesagt"].includes(r.status);
          const wartetSeitStd =
            (jetzt - new Date(r.zugewiesen_at).getTime()) / 3_600_000;
          const spaet = offen && !r.erstkontakt_at && wartetSeitStd > 48;
          return (
            <li
              key={r.id}
              className={cn(
                "flex flex-col gap-2 rounded-xl border bg-card p-4 shadow-sm",
                spaet && "border-red-300 bg-red-50/40",
                !offen && "opacity-70",
              )}
            >
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                <span className="font-semibold">{r.name}</span>
                {r.score != null && (
                  <span
                    title={r.score_grund ?? undefined}
                    className={cn(
                      "flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold",
                      SCORE_TONE[r.score as BewerberScore],
                    )}
                  >
                    <Star className="size-3" />
                    {SCORE_LABEL[r.score as BewerberScore]}
                  </span>
                )}
                <span
                  className={cn(
                    "rounded-full px-2 py-0.5 text-xs font-medium",
                    BEWERBER_STATUS_TONE[r.status] ??
                      "bg-muted text-muted-foreground",
                  )}
                >
                  {BEWERBER_STATUS_LABEL[r.status] ?? r.status}
                </span>
                {r.rolle && (
                  <span className="text-xs text-muted-foreground">{r.rolle}</span>
                )}
                <span
                  className={cn(
                    "ml-auto text-xs",
                    spaet ? "font-semibold text-red-700" : "text-muted-foreground",
                  )}
                >
                  {r.erstkontakt_at
                    ? `gemeldet ${seit(r.erstkontakt_at, jetzt)}`
                    : `eingegangen ${seit(r.zugewiesen_at, jetzt)}`}
                </span>
              </div>

              <p className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
                {r.telefon && (
                  <a
                    href={`tel:${r.telefon.replace(/\s/g, "")}`}
                    className="flex items-center gap-1.5 font-medium text-primary hover:underline"
                  >
                    <Phone className="size-3.5" />
                    {r.telefon}
                  </a>
                )}
                {r.email && (
                  <a
                    href={`mailto:${r.email}`}
                    className="flex items-center gap-1.5 font-medium text-primary hover:underline"
                  >
                    <Mail className="size-3.5" />
                    {r.email}
                  </a>
                )}
                {!r.telefon && !r.email && (
                  <span className="text-muted-foreground">
                    keine Kontaktdaten hinterlegt
                  </span>
                )}
              </p>

              {r.notiz && (
                <p className="rounded-lg border bg-muted/30 px-2.5 py-1.5 text-xs">
                  {r.notiz}
                </p>
              )}

              {offen && (
                <div className="flex flex-wrap items-center gap-1.5 border-t pt-2">
                  {r.status === "neu" && (
                    <Button
                      type="button"
                      size="sm"
                      disabled={busy === r.id}
                      onClick={() => update(r.id, { status: "kontaktiert" })}
                    >
                      <Phone className="size-3.5" /> Kontaktiert
                    </Button>
                  )}
                  {["neu", "kontaktiert"].includes(r.status) && (
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      disabled={busy === r.id}
                      onClick={() => update(r.id, { status: "gespraech" })}
                    >
                      Gespräch vereinbart
                    </Button>
                  )}
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    disabled={busy === r.id}
                    className="border-emerald-300 text-emerald-800 hover:bg-emerald-50"
                    onClick={() => update(r.id, { status: "eingestellt" })}
                  >
                    Eingestellt
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    disabled={busy === r.id}
                    className="border-red-200 text-red-700 hover:bg-red-50 hover:text-red-700"
                    onClick={() => update(r.id, { status: "abgesagt" })}
                  >
                    Abgesagt
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    className="ml-auto text-muted-foreground"
                    onClick={() => {
                      setNotizFuer(notizFuer === r.id ? null : r.id);
                      setNotiz(r.notiz ?? "");
                    }}
                  >
                    {r.notiz ? "Notiz bearbeiten" : "Notiz"}
                  </Button>
                </div>
              )}

              {notizFuer === r.id && (
                <div className="flex flex-col gap-2 rounded-lg border bg-muted/30 p-3">
                  <Textarea
                    value={notiz}
                    onChange={(e) => setNotiz(e.target.value)}
                    rows={2}
                    placeholder="z. B. Rückruf vereinbart für Montag"
                    className="bg-background"
                  />
                  <div className="flex items-center gap-2">
                    <Button
                      type="button"
                      size="sm"
                      disabled={busy === r.id}
                      onClick={() => update(r.id, { notiz })}
                    >
                      {busy === r.id ? "Speichert…" : "Speichern"}
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      onClick={() => setNotizFuer(null)}
                    >
                      Abbrechen
                    </Button>
                  </div>
                </div>
              )}
            </li>
          );
        })}
      </ul>

      <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <UserPlus className="size-3.5" />
        Die Einstufung (Hoch/Mittel/Niedrig) beruht nur auf den vorliegenden
        Daten — Erreichbarkeit und beworbene Stelle. Sie ersetzt kein Gespräch.
      </p>
    </div>
  );
}
