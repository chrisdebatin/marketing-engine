/**
 * SGB-Leistungsarten, nach denen die PDLs monatliche Patienten-Zu- und
 * -Abgänge erfassen. `key` wird in `patient_flows.leistung` gespeichert;
 * `label` ist die deutsche Anzeige. Neue Leistungen = hier ergänzen
 * (kein DB-Change nötig, da `leistung` ein Text-Feld ist).
 */
export const LEISTUNGEN = [
  { key: "sachleistung_sgb11", label: "Pflegesachleistung (SGB XI)" },
  { key: "behandlungspflege_sgb5", label: "Behandlungspflege (SGB V)" },
  { key: "entlastung_45b", label: "Entlastungsleistungen (§ 45b)" },
  { key: "verhinderungspflege", label: "Verhinderungspflege (§ 39)" },
  { key: "tagespflege", label: "Tagespflege" },
] as const;

export type LeistungKey = (typeof LEISTUNGEN)[number]["key"];

export const LEISTUNG_KEYS = LEISTUNGEN.map((l) => l.key) as [
  LeistungKey,
  ...LeistungKey[],
];

/** Anzeige-Label für einen Leistungs-Key; unbekannte unverändert anzeigen. */
export function leistungLabel(key: string | null): string {
  if (key == null) return "";
  return LEISTUNGEN.find((l) => l.key === key)?.label ?? key;
}
