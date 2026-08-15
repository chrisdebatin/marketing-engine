"use client";

import { cn } from "@/lib/utils";

/**
 * Button der Mitarbeiter-App. Bewusst NICHT ui/button aus dem CRM:
 * dort ist die Standardhoehe 32px (Desktop-Dichte), hier brauchen wir 52px
 * fuer sichere Bedienung mit dem Daumen.
 */
export function MButton({
  children,
  variant = "primary",
  loading = false,
  className,
  disabled,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "ghost";
  loading?: boolean;
}) {
  return (
    <button
      {...props}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={cn(
        "inline-flex w-full items-center justify-center gap-2 rounded-xl px-5",
        "text-[17px] font-semibold transition-colors",
        "focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50",
        "disabled:opacity-60",
        variant === "primary" && "bg-primary text-primary-foreground",
        variant === "secondary" && "border border-border bg-card text-foreground",
        variant === "ghost" && "text-primary",
        className,
      )}
      style={{ minHeight: "var(--m-control)" }}
    >
      {loading && (
        <span
          aria-hidden
          className="size-4 animate-spin rounded-full border-2 border-current border-t-transparent"
        />
      )}
      {children}
    </button>
  );
}
