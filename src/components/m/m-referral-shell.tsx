"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronLeft, Check } from "lucide-react";
import { MButton } from "@/components/m/m-button";

/** Kopfzeile der Formulare. */
export function MFormHeader({ title }: { title: string }) {
  return (
    <header className="m-safe-top sticky top-0 z-30 flex items-center gap-1 border-b border-border bg-card px-2 py-2">
      <Link
        href="/mitarbeiter/empfehlen"
        aria-label="Zurueck"
        className="m-tap flex items-center justify-center rounded-lg text-foreground"
      >
        <ChevronLeft size={24} aria-hidden />
      </Link>
      <span className="text-[17px] font-semibold text-foreground">{title}</span>
    </header>
  );
}

/**
 * Erfolgsansicht nach dem Absenden. Ersetzt das Formular vollstaendig,
 * damit ein versehentliches erneutes Absenden gar nicht moeglich ist.
 */
export function MSuccess({
  vorname,
  text,
  againHref,
  againLabel,
}: {
  vorname: string;
  text: string;
  againHref: string;
  againLabel: string;
}) {
  const router = useRouter();

  return (
    <main className="m-safe-top flex min-h-dvh flex-col justify-between px-5 pb-8 pt-10">
      <div className="flex flex-1 flex-col items-center justify-center text-center">
        <div
          className="flex size-[72px] items-center justify-center rounded-full"
          style={{ background: "var(--m-success)" }}
        >
          <Check size={38} color="white" strokeWidth={3} aria-hidden />
        </div>
        <h1 className="mt-6 text-[26px] font-bold text-foreground">
          Danke, {vorname}!
        </h1>
        <p className="mt-3 max-w-[32ch] text-[17px] leading-relaxed text-muted-foreground">
          {text}
        </p>
      </div>

      <div className="flex flex-col gap-3">
        <MButton onClick={() => router.replace("/mitarbeiter/start")}>
          Fertig
        </MButton>
        <MButton
          variant="secondary"
          onClick={() => router.replace(againHref)}
        >
          {againLabel}
        </MButton>
      </div>
    </main>
  );
}
