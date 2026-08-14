import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Weiße Inhaltsbox mit klarer Kopfzeile (Referenz-Look): Titel 16px semibold,
 * optionale Erklärzeile („was ist das & was tue ich hier“), rechts Aktionen.
 * Für alle Sektionen verwenden, damit jede Information ein sichtbares Zuhause hat.
 */
export function SectionCard({
  title,
  description,
  icon: Icon,
  actions,
  className,
  contentClassName,
  children,
}: {
  title: React.ReactNode;
  /** Kurzer deutscher Hinweis, was hier zu tun ist — weglassen, wenn selbsterklärend. */
  description?: React.ReactNode;
  icon?: LucideIcon;
  actions?: React.ReactNode;
  className?: string;
  contentClassName?: string;
  children: React.ReactNode;
}) {
  return (
    <section className={cn("rounded-xl border bg-card shadow-sm", className)}>
      <header className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2 border-b px-4 py-3">
        <div className="min-w-0">
          <h2 className="flex items-center gap-2 text-base font-semibold">
            {Icon && <Icon className="size-4 text-primary" />}
            {title}
          </h2>
          {description && (
            <p className="mt-0.5 text-xs text-muted-foreground">{description}</p>
          )}
        </div>
        {actions && (
          <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>
        )}
      </header>
      <div className={cn("p-4", contentClassName)}>{children}</div>
    </section>
  );
}
