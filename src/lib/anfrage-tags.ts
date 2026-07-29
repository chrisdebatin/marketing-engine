/** Kategorie-Tags für Anfragen-To-dos (Kanban). */
export const ANFRAGE_TAGS = [
  { key: "meta", label: "Meta-Anzeige", chip: "bg-sky-500/15 text-sky-700 dark:text-sky-300" },
  { key: "zeitung", label: "Zeitungsanzeige", chip: "bg-amber-500/15 text-amber-700 dark:text-amber-300" },
  { key: "stellenanzeige", label: "Stellenanzeige", chip: "bg-violet-500/15 text-violet-700 dark:text-violet-300" },
  { key: "material", label: "Material", chip: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300" },
  { key: "flyer", label: "Flyer", chip: "bg-rose-500/15 text-rose-700 dark:text-rose-300" },
  { key: "online", label: "Online-Anzeige", chip: "bg-cyan-500/15 text-cyan-700 dark:text-cyan-300" },
  { key: "sonstiges", label: "Sonstiges", chip: "bg-muted text-muted-foreground" },
] as const;

/**
 * Feste Chip-Farbe je Standort: stabiler Hash über die Hub-ID, damit ein
 * Standort überall dieselbe Farbe trägt (ohne Konfiguration).
 */
const HUB_CHIP_COLORS = [
  "bg-blue-500/15 text-blue-700 dark:text-blue-300",
  "bg-teal-500/15 text-teal-700 dark:text-teal-300",
  "bg-orange-500/15 text-orange-700 dark:text-orange-300",
  "bg-fuchsia-500/15 text-fuchsia-700 dark:text-fuchsia-300",
  "bg-lime-500/15 text-lime-700 dark:text-lime-300",
  "bg-indigo-500/15 text-indigo-700 dark:text-indigo-300",
  "bg-red-500/15 text-red-700 dark:text-red-300",
  "bg-yellow-500/15 text-yellow-700 dark:text-yellow-300",
  "bg-purple-500/15 text-purple-700 dark:text-purple-300",
  "bg-green-500/15 text-green-700 dark:text-green-300",
  "bg-pink-500/15 text-pink-700 dark:text-pink-300",
  "bg-sky-500/15 text-sky-700 dark:text-sky-300",
];

export function hubChip(hubId: string): string {
  let h = 0;
  for (let i = 0; i < hubId.length; i++) {
    h = (h * 31 + hubId.charCodeAt(i)) >>> 0;
  }
  return HUB_CHIP_COLORS[h % HUB_CHIP_COLORS.length];
}

export function anfrageTag(key: string | null | undefined) {
  if (!key) return null;
  return ANFRAGE_TAGS.find((t) => t.key === key) ?? null;
}
