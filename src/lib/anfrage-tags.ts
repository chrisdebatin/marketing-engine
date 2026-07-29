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

export function anfrageTag(key: string | null | undefined) {
  if (!key) return null;
  return ANFRAGE_TAGS.find((t) => t.key === key) ?? null;
}
