import { cn } from "@/lib/utils";

/**
 * Einheitlicher Seitenkopf für alle Seiten der App (und die Token-Seiten):
 * h1 + kurze Beschreibung, optional rechts eine Aktionszeile (Buttons, Chips).
 * Bewusst schlicht — die Hierarchie kommt aus Größe und Farbe, nicht aus Deko.
 */
export function PageHeader({
  title,
  description,
  eyebrow,
  actions,
  className,
}: {
  title: React.ReactNode;
  description?: React.ReactNode;
  /** Kleine Zeile über dem Titel (z. B. „Persönlicher Bereich“). */
  eyebrow?: React.ReactNode;
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
      {actions && (
        <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>
      )}
    </header>
  );
}
