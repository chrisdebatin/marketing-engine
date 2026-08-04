"use client";

import { useState } from "react";
import { toast } from "sonner";
import { BedDouble, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { formatIsoDate } from "@/lib/crm";
import { cn } from "@/lib/utils";
import {
  SCORE_FIELDS,
  SCORE_HINT,
  scoreClasses,
  type CapacityReport,
  type ScoreKey,
} from "@/lib/capacity";

/**
 * Wöchentliche Kapazitäts-Meldung der PDL: freie Plätze (gesamt, Beatmung,
 * WG), Kinder-Versorgung, frühester Aufnahmetermin. Grundlage für die
 * schnelle Annahme von Klinik-/Recare-Anfragen durch das Marketing-Team.
 */
export function CapacityForm({
  token,
  weekStart,
  current,
  previous,
}: {
  token: string;
  weekStart: string;
  /** Meldung der laufenden Woche (falls schon abgegeben). */
  current: CapacityReport | null;
  /** Letzte frühere Meldung — als Vorbelegung. */
  previous: CapacityReport | null;
}) {
  const seed = current ?? previous;
  const [freie, setFreie] = useState(String(seed?.freie_plaetze ?? 0));
  const [beatmung, setBeatmung] = useState(String(seed?.beatmung_plaetze ?? 0));
  const [wg, setWg] = useState(String(seed?.wg_plaetze ?? 0));
  const [kinder, setKinder] = useState(Boolean(seed?.kinder_moeglich));
  const [scores, setScores] = useState<Record<ScoreKey, number | null>>({
    pflege_score: seed?.pflege_score ?? null,
    alltagshilfe_score: seed?.alltagshilfe_score ?? null,
    wundversorgung_score: seed?.wundversorgung_score ?? null,
  });
  const [aufnahmeAb, setAufnahmeAb] = useState(current?.aufnahme_ab ?? "");
  const [notiz, setNotiz] = useState(current?.notiz ?? "");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(Boolean(current));

  async function save() {
    if (saving) return;
    setSaving(true);
    try {
      const res = await fetch("/api/public/capacity", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          token,
          freie_plaetze: freie,
          beatmung_plaetze: beatmung,
          wg_plaetze: wg,
          kinder_moeglich: kinder,
          ...scores,
          aufnahme_ab: aufnahmeAb,
          notiz,
        }),
      });
      const body = (await res.json().catch(() => ({}))) as {
        error?: string;
        report?: CapacityReport;
      };
      if (!res.ok || !body.report) {
        toast.error(body.error ?? "Speichern fehlgeschlagen.");
        return;
      }
      setSaved(true);
      toast.success("Kapazität für diese Woche gemeldet — danke!");
    } catch {
      toast.error("Netzwerkfehler. Bitte erneut versuchen.");
    } finally {
      setSaving(false);
    }
  }

  const numField = (
    label: string,
    value: string,
    set: (v: string) => void,
    hint?: string,
  ) => (
    <label className="flex flex-col gap-1 text-sm">
      <span className="font-medium">{label}</span>
      <Input
        type="number"
        min={0}
        max={99}
        inputMode="numeric"
        value={value}
        onChange={(e) => set(e.target.value)}
        className="w-24 bg-background"
        disabled={saving}
      />
      {hint && <span className="text-xs text-muted-foreground">{hint}</span>}
    </label>
  );

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h2 className="text-xl font-semibold">Kapazität melden</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Bitte einmal pro Woche aktualisieren — das Marketing-Team nutzt
          diese Zahlen, um Klinik- und Recare-Anfragen für Ihren Standort
          schnell zu beantworten. Woche ab {formatIsoDate(weekStart)}.
        </p>
      </div>

      {saved ? (
        <p className="flex items-center gap-2 rounded-xl border border-chart-4/40 bg-chart-4/10 px-4 py-2.5 text-sm font-medium text-chart-4">
          <Check className="size-4" />
          Für diese Woche gemeldet — Änderungen unten überschreiben die
          Meldung.
        </p>
      ) : (
        <p className="flex items-center gap-2 rounded-xl border border-amber-500/40 bg-amber-500/10 px-4 py-2.5 text-sm font-medium text-amber-700 dark:text-amber-400">
          <BedDouble className="size-4" />
          Für diese Woche liegt noch keine Meldung vor
          {previous
            ? ` — Vorbelegung aus der Woche vom ${formatIsoDate(previous.week_start)}.`
            : "."}
        </p>
      )}

      <div className="flex flex-col gap-3 rounded-xl border bg-card p-4 shadow-sm">
        {/* Kapazitäts-Skala je Leistungsbereich */}
        <div className="flex flex-col gap-2">
          <p className="text-sm font-medium">
            Kapazität je Bereich{" "}
            <span className="font-normal text-muted-foreground">
              ({SCORE_HINT})
            </span>
          </p>
          <div className="flex flex-wrap gap-6">
            {SCORE_FIELDS.map(({ key, label }) => (
              <div key={key} className="flex flex-col gap-1 text-sm">
                <span className="font-medium">{label}</span>
                <div className="flex items-center gap-1">
                  {[1, 2, 3, 4, 5].map((n) => (
                    <button
                      key={n}
                      type="button"
                      disabled={saving}
                      onClick={() =>
                        setScores((prev) => ({
                          ...prev,
                          [key]: prev[key] === n ? null : n,
                        }))
                      }
                      className={cn(
                        "size-8 rounded-md border text-sm font-semibold tabular-nums transition-colors",
                        scores[key] === n
                          ? cn(scoreClasses(n), "border-transparent ring-2 ring-primary/40")
                          : "bg-background text-muted-foreground hover:text-foreground",
                      )}
                    >
                      {n}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="flex flex-wrap gap-6">
          {numField(
            "Freie Plätze gesamt",
            freie,
            setFreie,
            "Wie viele neue Patienten können Sie aktuell aufnehmen?",
          )}
          {numField(
            "davon mit Beatmung",
            beatmung,
            setBeatmung,
            "Invasive/nicht-invasive Beatmung",
          )}
          {numField("davon Wohngemeinschaft", wg, setWg, "Freie WG-Plätze")}
        </div>

        <div className="flex flex-wrap items-end gap-6">
          <label className="flex cursor-pointer items-center gap-2 text-sm select-none">
            <input
              type="checkbox"
              checked={kinder}
              onChange={(e) => setKinder(e.target.checked)}
              className="size-4 accent-primary"
              disabled={saving}
            />
            Versorgung von Kindern möglich
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium">Frühester Aufnahmetermin</span>
            <Input
              type="date"
              value={aufnahmeAb}
              onChange={(e) => setAufnahmeAb(e.target.value)}
              className="w-44 bg-background"
              disabled={saving}
            />
          </label>
        </div>

        <div className="flex flex-col gap-1">
          <Label className="text-sm font-medium">Anmerkung (optional)</Label>
          <Textarea
            value={notiz}
            onChange={(e) => setNotiz(e.target.value)}
            placeholder="z. B. „ab August wieder 2 Plätze frei“, Personal-Engpass, besondere Anforderungen…"
            maxLength={1000}
            className="min-h-16 bg-background"
            disabled={saving}
          />
        </div>

        <div>
          <Button type="button" disabled={saving} onClick={() => void save()}>
            {saving
              ? "Speichere…"
              : saved
                ? "Meldung aktualisieren"
                : "Kapazität melden"}
          </Button>
        </div>
      </div>
    </div>
  );
}
