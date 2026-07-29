/** Personal-Anzeigen (Recruiting): Plattformen. */
export const PERSONAL_PLATTFORMEN = [
  { key: "meta", label: "Meta" },
  { key: "join", label: "Join" },
  { key: "indeed", label: "Indeed" },
  { key: "stepstone", label: "StepStone" },
  { key: "kleinanzeigen", label: "Kleinanzeigen" },
  { key: "agentur", label: "Agentur für Arbeit" },
  { key: "website", label: "Website" },
] as const;

export function plattformLabel(key: string | null | undefined): string {
  if (!key) return "";
  return PERSONAL_PLATTFORMEN.find((p) => p.key === key)?.label ?? key;
}
