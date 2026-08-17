import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Bausteine für die beiden Handbuch-Seiten unter /crm-hilfe. Bewusst
 * schlichte, druckbare Blöcke im Karten-Stil des Projekts — die Seiten
 * werden am Bildschirm durchgegangen ODER ausgedruckt.
 */

/** Nummerierter Abschnitt: große Zahl links, Inhalt rechts. */
export function Kapitel({
  nummer,
  titel,
  untertitel,
  children,
}: {
  nummer: number;
  titel: string;
  untertitel?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-xl border bg-card p-4 shadow-sm sm:p-5">
      <div className="flex items-start gap-3">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary text-base font-bold text-primary-foreground tabular-nums">
          {nummer}
        </span>
        <div className="min-w-0">
          <h2 className="text-lg font-semibold tracking-tight">{titel}</h2>
          {untertitel && (
            <p className="mt-0.5 text-sm text-muted-foreground">{untertitel}</p>
          )}
        </div>
      </div>
      <div className="mt-4 flex flex-col gap-3">{children}</div>
    </section>
  );
}

/** Zwischenüberschrift innerhalb eines Kapitels. */
export function Zwischentitel({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
      {children}
    </h3>
  );
}

/** Nummerierte Schrittfolge — die Hauptform der Anleitung. */
export function Schritte({ children }: { children: React.ReactNode }) {
  return (
    <ol className="flex list-none flex-col gap-2.5 text-sm leading-relaxed">
      {children}
    </ol>
  );
}

export function Schritt({
  n,
  titel,
  children,
}: {
  n: number;
  titel?: string;
  children: React.ReactNode;
}) {
  return (
    <li className="flex gap-2.5">
      <span className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-[12px] font-bold text-primary tabular-nums">
        {n}
      </span>
      <span className="min-w-0 flex-1">
        {titel && <strong className="font-semibold">{titel}</strong>}
        {titel && " — "}
        {children}
      </span>
    </li>
  );
}

/** Beschriftung eines Buttons/Reiters genau so, wie sie im CRM steht. */
export function Klick({ children }: { children: React.ReactNode }) {
  return (
    <span className="mx-0.5 rounded-md border border-blue-200 bg-blue-50 px-1.5 py-0.5 text-[13px] font-semibold whitespace-nowrap text-blue-700">
      {children}
    </span>
  );
}

const TON = {
  blau: "border-blue-200 bg-blue-50 text-blue-900",
  gruen: "border-emerald-200 bg-emerald-50 text-emerald-900",
  gelb: "border-amber-200 bg-amber-50 text-amber-900",
  rot: "border-red-200 bg-red-50 text-red-900",
  lila: "border-purple-200 bg-purple-50 text-purple-900",
} as const;

const TON_ICON = {
  blau: "text-blue-600",
  gruen: "text-emerald-600",
  gelb: "text-amber-600",
  rot: "text-red-600",
  lila: "text-purple-600",
} as const;

/** Farbiger Hinweiskasten — Merksatz, Warnung, Sonderfall. */
export function Hinweis({
  ton = "blau",
  titel,
  icon: Icon,
  children,
}: {
  ton?: keyof typeof TON;
  titel: string;
  icon?: LucideIcon;
  children?: React.ReactNode;
}) {
  return (
    <div className={cn("rounded-xl border p-3.5", TON[ton])}>
      <p className="flex items-center gap-2 text-sm font-semibold">
        {Icon && <Icon className={cn("size-4 shrink-0", TON_ICON[ton])} />}
        {titel}
      </p>
      {children && (
        <div className="mt-1.5 text-sm leading-relaxed">{children}</div>
      )}
    </div>
  );
}

/** „Was tun wenn …“ — Problem links, Lösung rechts. */
export function FallListe({ children }: { children: React.ReactNode }) {
  return <dl className="flex flex-col gap-2">{children}</dl>;
}

export function Fall({
  frage,
  children,
}: {
  frage: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border bg-muted/40 p-3.5">
      <dt className="text-sm font-semibold">{frage}</dt>
      <dd className="mt-1 text-sm leading-relaxed text-muted-foreground">
        {children}
      </dd>
    </div>
  );
}

/** Screenshot aus public/handbuch/ mit Rahmen und Bildunterschrift. */
export function Bild({
  src,
  alt,
  caption,
}: {
  src: string;
  alt: string;
  caption: string;
}) {
  return (
    <figure className="flex flex-col gap-1.5">
      {/* eslint-disable-next-line @next/next/no-img-element -- statische
          Handbuch-Screenshots, bewusst ohne next/image */}
      <img
        src={src}
        alt={alt}
        className="w-full max-w-3xl rounded-xl border bg-white shadow-sm"
      />
      <figcaption className="text-xs text-muted-foreground">
        {caption}
      </figcaption>
    </figure>
  );
}
