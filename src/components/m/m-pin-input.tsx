"use client";

import { useEffect, useRef } from "react";
import { cn } from "@/lib/utils";

/**
 * 6-stellige PIN-Eingabe.
 *
 * Umsetzung bewusst als EIN unsichtbares Input ueber sechs gezeichneten
 * Kaestchen — nicht sechs echte Inputs. Gruende:
 *  - Backspace, Auswahl und Einfuegen funktionieren wie erwartet, ohne
 *    Fokus-Springerei (die klassische Fehlerquelle bei Segment-Inputs).
 *  - Screenreader sehen genau ein Feld mit klarem Label.
 *  - iOS zeigt zuverlaessig die Zifferntastatur.
 */
export function MPinInput({
  value,
  onChange,
  onComplete,
  label,
  autoFocus,
  disabled,
  shake,
  mode = "current",
}: {
  value: string;
  onChange: (v: string) => void;
  onComplete?: (v: string) => void;
  label: string;
  autoFocus?: boolean;
  disabled?: boolean;
  shake?: boolean;
  /** "new" beim Festlegen, "current" beim Entsperren (Passwortmanager-Hinweis). */
  mode?: "new" | "current";
}) {
  const ref = useRef<HTMLInputElement>(null);
  const firedFor = useRef<string | null>(null);

  useEffect(() => {
    if (autoFocus) ref.current?.focus();
  }, [autoFocus]);

  // Auto-Absenden bei der 6. Ziffer — aber pro Wert nur einmal.
  useEffect(() => {
    if (value.length === 6 && firedFor.current !== value) {
      firedFor.current = value;
      onComplete?.(value);
    }
    if (value.length < 6) firedFor.current = null;
  }, [value, onComplete]);

  return (
    <div
      className={cn("relative", shake && "m-shake")}
      role="group"
      aria-label={label}
    >
      <input
        ref={ref}
        type="text"
        inputMode="numeric"
        pattern="[0-9]*"
        autoComplete={mode === "new" ? "new-password" : "current-password"}
        maxLength={6}
        disabled={disabled}
        aria-label={label}
        value={value}
        onChange={(e) => onChange(e.target.value.replace(/\D/g, "").slice(0, 6))}
        // Unsichtbar, aber fokussierbar und ueber den Kaestchen liegend.
        className="absolute inset-0 z-10 h-full w-full cursor-pointer text-[17px] opacity-0"
      />

      <div className="flex justify-center gap-2.5" aria-hidden>
        {Array.from({ length: 6 }).map((_, i) => {
          const filled = i < value.length;
          const active = i === value.length && !disabled;
          return (
            <div
              key={i}
              className={cn(
                "flex items-center justify-center rounded-lg border bg-card transition-colors",
                filled || active ? "border-primary" : "border-input",
                active && "ring-[3px] ring-ring/50",
                disabled && "opacity-60",
              )}
              style={{ width: 48, height: 56 }}
            >
              {filled && (
                <span className="size-3 rounded-full bg-foreground" />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
