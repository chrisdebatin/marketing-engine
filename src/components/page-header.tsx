import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Einheitlicher Seitenkopf für alle Seiten der App (und die Token-Seiten):
 * h1 + kurze Beschreibung, optional links ein Icon-Badge und rechts eine
 * Aktionszeile (Buttons, Chips). Bewusst schlicht — die Hierarchie kommt
 * aus Größe und Farbe, nicht aus Deko.
 */
export function PageHeader({
  title,
  description,
  eyebrow,
  icon: Icon,
  actions,
  className,
}: {
  title: React.ReactNode;
  description?: React.ReactNode;
  /** Kleine Zeile über dem Titel (z. B. „Persönlicher Bereich“). */
  eyebrow?: React.ReactNode;
  /** Optionales Icon-Badge links neben Titel/Beschreibung. */
  icon?: LucideIcon;
  actions?: React.ReactNode;
  className?: string;
}) {
  return (
    <header
      className={cn(
        "flex flex-wrap items-end justify-between gap-x-6 gap-y-3",
        className,
      )}
    >
      <div className="flex min-w-0 items-start gap-3">
        {Icon && (
          <span className="mt-0.5 flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <Icon className="size-5" />
          </span>
        )}
        <div className="flex min-w-0 flex-col gap-1">
          {eyebrow && (
            <p className="text-xs font-semibold tracking-wide text-primary uppercase">
              {eyebrow}
            </p>
          )}
          <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
          {description && (
            <p className="max-w-3xl text-sm text-muted-foreground">
              {description}
            </p>
          )}
        </div>
      </div>
      {actions && (
        <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>
      )}
    </header>
  );
}
