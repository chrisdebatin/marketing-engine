/**
 * Leistungsarten, nach denen die Standort-Verantwortlichen monatliche
 * Patienten-Zu- und -Abgänge erfassen. `key` wird in `patient_flows.leistung`
 * gespeichert; `label` ist die deutsche Anzeige. Neue Leistungen = hier
 * ergänzen (kein DB-Change nötig, da `leistung` ein Text-Feld ist).
 *
 * Pflege-Hubs und Alltagshilfe-Hubs haben unterschiedliche Leistungslisten;
 * bei der Alltagshilfe heißen die Verantwortlichen zudem "Standortleitung"
 * statt "PDL".
 */

export interface Leistung {
  key: string;
  label: string;
}

/** Leistungen der Pflege-Hubs (ambulant, Tagespflege, Intensiv). */
export const LEISTUNGEN_PFLEGE: Leistung[] = [
  { key: "sachleistung_sgb11", label: "Pflegesachleistung (SGB XI)" },
  { key: "behandlungspflege_sgb5", label: "Behandlungspflege (SGB V)" },
  { key: "entlastung_45b", label: "Entlastungsleistungen (§ 45b)" },
  { key: "verhinderungspflege", label: "Verhinderungspflege (§ 39)" },
  { key: "tagespflege", label: "Tagespflege" },
];

/** Leistungen der Alltagshilfe-Hubs. */
export const LEISTUNGEN_ALLTAGSHILFE: Leistung[] = [
  { key: "entlastung_45b", label: "Entlastungsleistungen (§ 45b)" },
  { key: "verhinderungspflege", label: "Verhinderungspflege (§ 39)" },
  {
    key: "umgewandelte_sachleistung_45a",
    label: "Umgewandelte Sachleistung (§ 45a)",
  },
  { key: "selbstzahler", label: "Selbstzahler" },
];

/** Alle bekannten Leistungen (dedupliziert) — für Label-Lookup und Reports. */
export const LEISTUNGEN: Leistung[] = [
  ...LEISTUNGEN_PFLEGE,
  ...LEISTUNGEN_ALLTAGSHILFE.filter(
    (l) => !LEISTUNGEN_PFLEGE.some((p) => p.key === l.key),
  ),
];

/** Alltagshilfe-Hubs werden über den Namen erkannt ("Alltagshilfe …"). */
export function isAlltagshilfeHub(hubName: string | null): boolean {
  return (hubName ?? "").toLowerCase().startsWith("alltagshilfe");
}

/** Die für einen Hub gültige Leistungsliste. */
export function leistungenForHub(hubName: string | null): Leistung[] {
  return isAlltagshilfeHub(hubName)
    ? LEISTUNGEN_ALLTAGSHILFE
    : LEISTUNGEN_PFLEGE;
}

/** Kurz-Label der Standort-Verantwortlichen ("PDL" bzw. "SL"). */
export function pdlRoleShort(hubName: string | null): string {
  return isAlltagshilfeHub(hubName) ? "SL" : "PDL";
}

/** Voll-Label der Standort-Verantwortlichen. */
export function pdlRoleLabel(hubName: string | null): string {
  return isAlltagshilfeHub(hubName) ? "Standortleitung" : "PDL";
}

/** Anzeige-Label für einen Leistungs-Key; unbekannte unverändert anzeigen. */
export function leistungLabel(key: string | null): string {
  if (key == null) return "";
  return LEISTUNGEN.find((l) => l.key === key)?.label ?? key;
}
