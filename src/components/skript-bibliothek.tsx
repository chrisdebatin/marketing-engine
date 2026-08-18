"use client";

import { useState } from "react";
import { Check, Copy, MessageCircleQuestion, Target } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Skript } from "@/lib/skripte";

/** Semantische Farbe je Zielgruppe — Kliniken blau, Patienten grün, Recare violett. */
const FARBEN: Record<Skript["farbe"], { tab: string; rand: string; kopf: string; punkt: string }> = {
  blau: {
    tab: "bg-blue-600 text-white",
    rand: "border-blue-200",
    kopf: "bg-blue-50 text-blue-900",
    punkt: "bg-blue-600",
  },
  emerald: {
    tab: "bg-emerald-600 text-white",
    rand: "border-emerald-200",
    kopf: "bg-emerald-50 text-emerald-900",
    punkt: "bg-emerald-600",
  },
  violett: {
    tab: "bg-violet-600 text-white",
    rand: "border-violet-200",
    kopf: "bg-violet-50 text-violet-900",
    punkt: "bg-violet-600",
  },
  orange: {
    tab: "bg-orange-600 text-white",
    rand: "border-orange-200",
    kopf: "bg-orange-50 text-orange-900",
    punkt: "bg-orange-600",
  },
};

/** Satz zum Vorlesen — ein Klick legt ihn in die Zwischenablage. */
function Satz({ text }: { text: string }) {
  const [kopiert, setKopiert] = useState(false);
  return (
    <div className="group flex items-start gap-2 rounded-lg border bg-card p-3">
      <p className="min-w-0 flex-1 text-[15px] leading-relaxed">
        &bdquo;{text}&ldquo;
      </p>
      <button
        type="button"
        aria-label="Satz kopieren"
        title="Satz kopieren"
        className={cn(
          "flex size-8 shrink-0 items-center justify-center rounded-md border transition-colors",
          kopiert
            ? "border-emerald-300 bg-emerald-50 text-emerald-700"
            : "text-muted-foreground hover:bg-muted hover:text-foreground",
        )}
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(text);
            setKopiert(true);
            window.setTimeout(() => setKopiert(false), 1500);
          } catch {
            // Zwischenablage gesperrt (z. B. ohne HTTPS) — Text bleibt lesbar.
          }
        }}
      >
        {kopiert ? <Check className="size-4" /> : <Copy className="size-4" />}
        <span className="sr-only">{kopiert ? "kopiert" : "kopieren"}</span>
      </button>
    </div>
  );
}

/**
 * Skript-Bibliothek mit Tabs je Zielgruppe. Alles sichtbar, nichts hinter
 * Klicks versteckt — im Telefonat bleibt keine Zeit zum Suchen.
 */
export function SkriptBibliothek({ skripte }: { skripte: Skript[] }) {
  const [aktiv, setAktiv] = useState(skripte[0]?.slug ?? "");
  const s = skripte.find((x) => x.slug === aktiv) ?? skripte[0];
  if (!s) return null;
  const f = FARBEN[s.farbe];

  return (
    <div className="flex flex-col gap-4">
      {/* Zielgruppen-Umschalter */}
      <div className="flex flex-wrap gap-1 rounded-xl border bg-card p-1 shadow-sm">
        {skripte.map((x) => (
          <button
            key={x.slug}
            type="button"
            onClick={() => setAktiv(x.slug)}
            className={cn(
              "flex-1 rounded-lg px-3 py-2 text-sm font-medium whitespace-nowrap transition-colors",
              x.slug === s.slug
                ? FARBEN[x.farbe].tab
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            {x.titel}
          </button>
        ))}
      </div>

      {/* Kopfzeile: Ton und Ziel — das Wichtigste vor dem ersten Satz */}
      <div className={cn("rounded-xl border p-4", f.rand, f.kopf)}>
        <p className="text-xs font-semibold tracking-wide uppercase opacity-70">
          {s.zielgruppe}
        </p>
        <div className="mt-2 grid gap-3 sm:grid-cols-2">
          <div>
            <p className="text-xs font-semibold opacity-70">Ton</p>
            <p className="text-sm leading-snug">{s.ton}</p>
          </div>
          <div>
            <p className="flex items-center gap-1 text-xs font-semibold opacity-70">
              <Target className="size-3" /> Ziel des Gesprächs
            </p>
            <p className="text-sm leading-snug">{s.ziel}</p>
          </div>
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-1.5">
          <span className="text-xs opacity-70">Gilt für:</span>
          {s.quellen.map((q) => (
            <span
              key={q}
              className="rounded-full border border-current/20 bg-white/60 px-2 py-0.5 text-xs font-medium"
            >
              {q}
            </span>
          ))}
        </div>
      </div>

      {/* Kurzfassung, falls vorhanden */}
      {s.kurz && (
        <div className="rounded-xl border bg-card p-4 shadow-sm">
          <p className="mb-2 text-sm font-semibold">
            Kurzfassung zum Sprechen{" "}
            <span className="font-normal text-muted-foreground">
              (~30 Sekunden)
            </span>
          </p>
          <Satz text={s.kurz} />
        </div>
      )}

      {/* Schritte */}
      <div className="flex flex-col gap-3">
        {s.schritte.map((schritt, i) => (
          <div key={schritt.titel} className="rounded-xl border bg-card p-4 shadow-sm">
            <div className="mb-3 flex items-center gap-2.5">
              <span
                className={cn(
                  "flex size-7 shrink-0 items-center justify-center rounded-full text-sm font-bold text-white tabular-nums",
                  f.punkt,
                )}
              >
                {i + 1}
              </span>
              <h3 className="text-base font-semibold">{schritt.titel}</h3>
            </div>
            <div className="flex flex-col gap-2">
              {schritt.saetze.map((satz) => (
                <Satz key={satz} text={satz} />
              ))}
            </div>
            {schritt.hinweis && (
              <p className="mt-2.5 rounded-lg bg-muted/60 px-3 py-2 text-[13px] leading-relaxed text-muted-foreground">
                <strong className="text-foreground">Hinweis:</strong>{" "}
                {schritt.hinweis}
              </p>
            )}
          </div>
        ))}
      </div>

      {/* Einwände */}
      <div className="rounded-xl border bg-card p-4 shadow-sm">
        <h3 className="mb-3 flex items-center gap-2 text-base font-semibold">
          <MessageCircleQuestion className="size-4.5 text-muted-foreground" />
          Typische Einwände
        </h3>
        <div className="flex flex-col gap-2.5">
          {s.einwaende.map((e) => (
            <div key={e.einwand} className="rounded-lg border p-3">
              <p className="text-sm font-semibold text-foreground">
                &bdquo;{e.einwand}&ldquo;
              </p>
              <p className="mt-1.5 flex gap-2 text-[15px] leading-relaxed">
                <span aria-hidden className={cn("mt-1.5 h-px w-4 shrink-0", f.punkt)} />
                <span className="min-w-0">&bdquo;{e.antwort}&ldquo;</span>
              </p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
