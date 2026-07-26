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

export function formatIsoDate(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(`${iso}T00:00:00`);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("de-DE");
}

/** Kontakt-Arten, die die PDL beim Loggen wählt. */
export const KONTAKT_ARTEN = [
  { key: "box", label: "Box vorbeigebracht" },
  { key: "besuch", label: "Persönlicher Besuch" },
  { key: "anruf", label: "Anruf" },
] as const;

export function kontaktArtLabel(key: string | null | undefined): string {
  if (!key) return "";
  return KONTAKT_ARTEN.find((k) => k.key === key)?.label ?? key;
}

