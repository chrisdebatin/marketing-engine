import { cn } from "@/lib/utils";

/**
 * App-weite Chip-Töne mit fester Bedeutung (Design-System):
 * Farbe trägt überall dieselbe Semantik — nie nur Deko.
 *
 *  amber  = wartet / offen / fällig heute
 *  blue   = in Arbeit / kontaktiert
 *  purple = Termin vereinbart / Erstgespräch
 *  green  = Erfolg / aufgenommen / erledigt
 *  red    = überfällig / Fehler / dringend
 *  gray   = neutral / verloren / inaktiv
 *  orange = Hinweis / mittlere Dringlichkeit
 */
export const CHIP_TONES = {
  amber: "bg-amber-100 text-amber-800",
  blue: "bg-blue-100 text-blue-800",
  purple: "bg-purple-100 text-purple-800",
  green: "bg-emerald-100 text-emerald-800",
  red: "bg-red-100 text-red-700",
  gray: "bg-slate-200/70 text-slate-600",
  orange: "bg-orange-100 text-orange-800",
} as const;

export type ChipTone = keyof typeof CHIP_TONES;

/**
 * DIE eine Status-Zuordnung für Leads — überall identisch verwenden
 * (Lead-Karten, Intro, Verzeichnisse, Auswertungen):
 * offen=amber · kontaktiert=blau · erstgespraech=lila · aufgenommen=grün ·
 * verloren=grau · überfällig=rot.
 */
export const LEAD_STATUS_TONE: Record<string, ChipTone> = {
  offen: "amber",
  kontaktiert: "blue",
  erstgespraech: "purple",
  aufgenommen: "green",
  verloren: "gray",
  ueberfaellig: "red",
};

export function leadStatusChip(status: string): string {
  return CHIP_TONES[LEAD_STATUS_TONE[status] ?? "gray"];
}

/** Kleine Status-/Meta-Pille — Projekt-Idiom. */
export function Chip({
  tone = "gray",
  className,
  title,
  children,
}: {
  tone?: ChipTone;
  className?: string;
  title?: string;
  children: React.ReactNode;
}) {
  return (
    <span
      title={title}
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold whitespace-nowrap",
        CHIP_TONES[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}
