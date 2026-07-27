/** Gemeinsame Helfer für die wöchentliche Kapazitäts-Meldung. */

export interface CapacityReport {
  id: string;
  hub_id: string;
  week_start: string;
  freie_plaetze: number;
  beatmung_plaetze: number;
  wg_plaetze: number;
  kinder_moeglich: boolean;
  aufnahme_ab: string | null;
  notiz: string | null;
  updated_at?: string | null;
}

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
