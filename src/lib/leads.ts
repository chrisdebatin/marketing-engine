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
  { key: "sonstiges", label: "Sonstiges" },
] as const;

export function leadQuelleLabel(key: string | null | undefined): string {
  if (!key) return "";
  return LEAD_QUELLEN.find((q) => q.key === key)?.label ?? key;
}
