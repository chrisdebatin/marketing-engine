/** Status-Logik für CRM-Ziel-Orte (geteilt zwischen intern und PDL-Seite). */

export interface CrmDates {
  letzter_besuch: string | null;
  naechster_besuch: string | null;
}

export type CrmStatus = "erstbesuch" | "faellig" | "geplant";

/** heute als ISO-Datum (JJJJ-MM-TT). */
export function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

export function crmStatus(t: CrmDates, today: string = todayIso()): CrmStatus {
  if (!t.letzter_besuch) return "erstbesuch";
  if (t.naechster_besuch && t.naechster_besuch <= today) return "faellig";
  return "geplant";
}

/**
 * Ob ein geloggter Anruf jemanden erreicht hat. Konvention aus
 * logCallcenterCall: Nicht-erreicht-Anrufe bekommen das Notiz-Präfix
 * „Nicht erreicht“ — es gibt (noch) keine eigene Spalte dafür.
 */
export function anrufErreicht(note: string | null | undefined): boolean {
  return !(note ?? "").startsWith("Nicht erreicht");
}

export function formatIsoDate(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(`${iso}T00:00:00`);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("de-DE");
}

/** Kontakt-Arten, die die PDL beim Loggen wählt. */
export const KONTAKT_ARTEN = [
  { key: "box", label: "Box vorbeigebracht" },
  { key: "flyer", label: "Flyer ausgelegt" },
  { key: "besuch", label: "Persönlicher Besuch" },
  { key: "anruf", label: "Anruf" },
] as const;

export function kontaktArtLabel(key: string | null | undefined): string {
  if (!key) return "";
  // 'lead' wird nicht aktiv gewählt, sondern vom Frontoffice geloggt.
  if (key === "lead") return "Lead eingegangen";
  return KONTAKT_ARTEN.find((k) => k.key === key)?.label ?? key;
}

/**
 * Relevanz eines Ziel-Ortes (1 = höchste Priorität, 3 = niedrigste).
 * Fallback: aus der note ("… Relevanz 2 …"), solange Spalte 0030 fehlt.
 */
export function relevanzOf(t: {
  relevanz?: number | null;
  note?: string | null;
}): 1 | 2 | 3 | null {
  if (t.relevanz === 1 || t.relevanz === 2 || t.relevanz === 3) {
    return t.relevanz;
  }
  const m = t.note?.match(/Relevanz ([1-3])/);
  return m ? ((Number(m[1]) as 1 | 2 | 3) ?? null) : null;
}

/** Was laut Plan an einen Ziel-Ort geliefert/gemacht werden soll (To-do). */
export const PLAN_ARTEN = [
  { key: "box", label: "Box vorbeibringen" },
  { key: "flyer", label: "Flyer auslegen" },
  { key: "besuch", label: "Persönlich vorstellen" },
  { key: "anruf", label: "Anrufen" },
] as const;

export function planLabel(key: string | null | undefined): string {
  if (!key) return "";
  return PLAN_ARTEN.find((k) => k.key === key)?.label ?? key;
}

