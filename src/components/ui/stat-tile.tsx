import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * KPI-Kachel im Referenz-Look (InvoCRM): weiße Karte, farbige Icon-Disc,
 * großer bold Wert, kleine Subzeile. Farbton = Bedeutung, nicht Deko —
 * gleiche Kennzahl app-weit im gleichen Ton.
 */
const DISC_TONES = {
  blue: "bg-blue-100 text-blue-600",
  green: "bg-emerald-100 text-emerald-600",
  purple: "bg-purple-100 text-purple-600",
  orange: "bg-orange-100 text-orange-600",
  red: "bg-red-100 text-red-600",
  amber: "bg-amber-100 text-amber-600",
  gray: "bg-slate-200/70 text-slate-600",
} as const;

/** Wert wahlweise in der Akzentfarbe (wie im Referenzbild) statt neutral. */
const VALUE_TONES = {
  blue: "text-blue-600",
  green: "text-emerald-600",
  purple: "text-purple-600",
  orange: "text-orange-600",
  red: "text-red-600",
  amber: "text-amber-600",
  gray: "text-foreground",
} as const;

export type StatTone = keyof typeof DISC_TONES;

export function StatTile({
  icon: Icon,
  label,
  value,
  sub,
  tone = "blue",
  coloredValue = false,
  className,
}: {
  icon: LucideIcon;
  label: React.ReactNode;
  value: React.ReactNode;
  /** Kleine Zusatzzeile unter dem Wert (Delta, Zeitraum, Erklärung). */
  sub?: React.ReactNode;
  tone?: StatTone;
  /** Wert in der Akzentfarbe färben (sparsam einsetzen, 1–2 pro Reihe). */
  coloredValue?: boolean;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col gap-2 rounded-xl border bg-card p-4 shadow-sm",
        className,
      )}
    >
      <div className="flex items-center gap-2.5">
        <span
          className={cn(
            "flex size-9 shrink-0 items-center justify-center rounded-full",
            DISC_TONES[tone],
          )}
        >
          <Icon className="size-4.5" />
        </span>
        <span className="text-sm font-medium text-muted-foreground">{label}</span>
      </div>
      <div
        className={cn(
          "text-[1.75rem] leading-none font-bold tracking-tight tabular-nums",
          coloredValue ? VALUE_TONES[tone] : "text-foreground",
        )}
      >
        {value}
      </div>
      {sub && <div className="text-xs text-muted-foreground">{sub}</div>}
    </div>
  );
}
