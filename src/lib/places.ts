/**
 * Kategorien für Auslage-/Liefer-Orte (delivery_placements.place_kind).
 * Neue Kategorien = hier ergänzen (kein DB-Change nötig, Text-Feld).
 */
export const PLACE_KINDS = [
  { key: "krankenhaus", label: "Krankenhaus" },
  { key: "praxis", label: "Arztpraxis" },
  { key: "apotheke", label: "Apotheke" },
  { key: "pflegeeinrichtung", label: "Pflegeeinrichtung" },
  { key: "sanitaetshaus", label: "Sanitätshaus" },
  { key: "sonstiges", label: "Sonstiges" },
] as const;

export type PlaceKindKey = (typeof PLACE_KINDS)[number]["key"];

/** Anzeige-Label; unbekannte Keys (Altbestand ohne Kategorie) → "Sonstiges". */
export function placeKindLabel(key: string | null | undefined): string {
  if (!key) return "Sonstiges";
  return PLACE_KINDS.find((p) => p.key === key)?.label ?? key;
}

export function isPlaceKind(key: string): boolean {
  return PLACE_KINDS.some((p) => p.key === key);
}
