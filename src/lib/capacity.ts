/** Gemeinsame Helfer für die wöchentliche Kapazitäts-Meldung. */

export interface CapacityReport {
  id: string;
  hub_id: string;
  week_start: string;
  freie_plaetze: number;
  beatmung_plaetze: number;
  wg_plaetze: number;
  kinder_moeglich: boolean;
  pflege_score?: number | null;
  alltagshilfe_score?: number | null;
  wundversorgung_score?: number | null;
  aufnahme_ab: string | null;
  notiz: string | null;
  updated_at?: string | null;
}

/** Die drei gemeldeten Leistungsbereiche (Skala 1–5). */
export const SCORE_FIELDS = [
  { key: "pflege_score", label: "Pflege" },
  { key: "alltagshilfe_score", label: "Alltagshilfe" },
  { key: "wundversorgung_score", label: "Wundversorgung" },
] as const;
export type ScoreKey = (typeof SCORE_FIELDS)[number]["key"];

/** 5 = volle Kapazität (grün) … 1 = keine Kapazität (rot). */
export function clampScore(v: unknown): number | null {
  const n = Math.trunc(Number(v));
  return Number.isFinite(n) && n >= 1 && n <= 5 ? n : null;
}

/** Farbklassen je Score — grün (5) bis rot (1). */
export function scoreClasses(score: number): string {
  switch (score) {
    case 5:
      return "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400";
    case 4:
      return "bg-lime-500/15 text-lime-700 dark:text-lime-400";
    case 3:
      return "bg-amber-500/15 text-amber-700 dark:text-amber-400";
    case 2:
      return "bg-orange-500/15 text-orange-700 dark:text-orange-400";
    default:
      return "bg-red-500/15 text-red-700 dark:text-red-400";
  }
}

export const SCORE_HINT =
  "5 = volle Kapazität (grün) · 1 = keine Kapazität (rot)";

/** Montag der aktuellen Woche als ISO-Datum. */
export function capacityWeekStart(today?: string): string {
  const d = new Date(`${today ?? new Date().toISOString().slice(0, 10)}T00:00:00`);
  const day = (d.getDay() + 6) % 7; // Mo=0 … So=6
  d.setDate(d.getDate() - day);
  return d.toISOString().slice(0, 10);
}

export function clampPlaetze(v: unknown): number {
  const n = Math.trunc(Number(v));
  return Number.isFinite(n) ? Math.min(99, Math.max(0, n)) : 0;
}
