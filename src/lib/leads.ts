/** Frontoffice: Quellen, über die Interessenten aufmerksam geworden sind. */
export const LEAD_QUELLEN = [
  { key: "google", label: "Google/Suche" },
  { key: "website", label: "Website" },
  { key: "flyer", label: "Flyer/Aufsteller" },
  { key: "box", label: "CM-Box" },
  { key: "krankenhaus", label: "Krankenhaus/Sozialdienst" },
  { key: "recare", label: "Recare" },
  { key: "arzt", label: "Arztpraxis" },
  { key: "empfehlung", label: "Empfehlung" },
  { key: "social", label: "Social Media" },
  { key: "presse", label: "Presse/Anzeige" },
  { key: "telefon0800", label: "0800-Anruf" },
  { key: "agentur", label: "Lead-Agentur" },
  { key: "sonstiges", label: "Sonstiges" },
] as const;

/**
 * Quellen, die das Call-Center (Davina) bearbeitet — nur Recare; alles
 * andere (Website, 0800, Meta, Agentur, B2B) liegt beim Kundenservice DE.
 */
export const CALLCENTER_QUELLEN = new Set(["recare"]);

/**
 * Standorte, an denen das DE-Team den Beratungstermin selbst bucht
 * (Zugriff auf den Beraterinnen-Kalender) und den Neukunden direkt in
 * MediFox anlegt (beide unter dem DUS-Mandanten — eine Company).
 * Überall sonst: Lead an die PDL übergeben.
 */
export function isDirectBookingHub(name: string | null | undefined): boolean {
  if (!name) return false;
  const n = name.toLowerCase();
  return n.includes("düsseldorf") || n.includes("gevelsberg");
}

export function leadQuelleLabel(key: string | null | undefined): string {
  if (!key) return "";
  return LEAD_QUELLEN.find((q) => q.key === key)?.label ?? key;
}

/** Interessenten-Bereiche (je Callcenter-Team ein eigener Link). */
export const LEAD_BEREICHE = [
  { key: "alltagshilfe", label: "Alltagshilfe" },
  { key: "ambulant", label: "Ambulant" },
  { key: "intensiv", label: "Intensiv" },
] as const;

export type LeadBereich = (typeof LEAD_BEREICHE)[number]["key"];

export function leadBereichLabel(key: string | null | undefined): string {
  if (!key) return "";
  return LEAD_BEREICHE.find((b) => b.key === key)?.label ?? key;
}

/** Passende Standorte je Bereich (für das Weiterleitungs-Select). */
export function hubsForBereich<T extends { name: string }>(
  hubs: T[],
  bereich: string | null,
): T[] {
  if (bereich === "alltagshilfe") {
    return hubs.filter((h) => h.name.startsWith("Alltagshilfe"));
  }
  if (bereich === "intensiv") {
    return hubs.filter((h) => /intensiv/i.test(h.name));
  }
  if (bereich === "ambulant") {
    return hubs.filter(
      (h) => !h.name.startsWith("Alltagshilfe") && !/intensiv/i.test(h.name),
    );
  }
  return hubs;
}
