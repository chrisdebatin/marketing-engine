"use client";

import { useId } from "react";
import { cn } from "@/lib/utils";

/**
 * Formularfeld der Mitarbeiter-App.
 *
 * Wichtig fuer iOS: die Schriftgroesse im Input liegt bei 17px. Unter 16px
 * zoomt Safari beim Fokussieren automatisch hinein — das wirkt kaputt und
 * verschiebt das Layout.
 *
 * Label steht IMMER ueber dem Feld (nie nur Placeholder): Placeholder
 * verschwinden beim Tippen und sind fuer die Zielgruppe unbrauchbar.
 */
export function MField({
  label,
  hint,
  error,
  optional,
  textarea,
  className,
  ...props
}: React.InputHTMLAttributes<HTMLInputElement> &
  React.TextareaHTMLAttributes<HTMLTextAreaElement> & {
    label: string;
    hint?: string;
    error?: string;
    optional?: boolean;
    textarea?: boolean;
  }) {
  const id = useId();
  const errorId = `${id}-error`;
  const hintId = `${id}-hint`;

  const shared = cn(
    "w-full rounded-xl border bg-card px-4 text-[17px] text-foreground",
    "placeholder:text-muted-foreground/70",
    "focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50",
    error ? "border-destructive" : "border-input",
    className,
  );

  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-[15px] font-semibold text-foreground">
        {label}
        {optional && (
          <span className="ml-1.5 font-normal text-muted-foreground">
            (optional)
          </span>
        )}
      </label>

      {hint && (
        <p id={hintId} className="text-[13px] text-muted-foreground">
          {hint}
        </p>
      )}

      {textarea ? (
        <textarea
          {...(props as React.TextareaHTMLAttributes<HTMLTextAreaElement>)}
          id={id}
          rows={3}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? errorId : hint ? hintId : undefined}
          className={cn(shared, "py-3 leading-relaxed")}
        />
      ) : (
        <input
          {...(props as React.InputHTMLAttributes<HTMLInputElement>)}
          id={id}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? errorId : hint ? hintId : undefined}
          className={shared}
          style={{ height: "var(--m-field)" }}
        />
      )}

      {error && (
        <p id={errorId} className="text-[15px] font-medium text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}
