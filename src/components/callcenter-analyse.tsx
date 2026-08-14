"use client";

import { useMemo, useState } from "react";
import {
  Bot,
  Clock,
  PhoneIncoming,
  PhoneMissed,
  TriangleAlert,
  UserPlus,
} from "lucide-react";
import { SectionCard } from "@/components/ui/section-card";
import { StatTile } from "@/components/ui/stat-tile";
import { cn } from "@/lib/utils";

/**
 * Ein verpasster Anruf aus der Benachrichtigungs-Mail der Telefonanlage.
 * Das ist die EINZIGE Datenquelle dieser Auswertung: Jede Mail = ein Anruf,
 * bei dem niemand rangegangen ist und den die KI-Agentin Nora angenommen hat.
 * Angenommene Anrufe erzeugen keine Mail und tauchen hier deshalb nicht auf.
 */
export interface AnalyseLead {
  /** Zeitpunkt des Anrufs (aus der Mail), ISO. */
  zeit: string;
  /** Uhrzeit-Stunde des Anrufs, 0–23 — aus dem Mailtext gelesen. */
  stunde: number;
  /** KI-Kategorie, aus dem Ergebnis-Text abgeleitet. */
  kategorie: "neuinteressent" | "bestandskunde" | "mitarbeiter_intern" | "sonstiges" | "kein_anliegen";
  /** Fachbereich der Anfrage, falls erfasst. */
  bereich: string | null;
}

/**
 * Bis wann das Callcenter aktuell besetzt ist. Anrufe danach sind der
 * eigentliche Streitpunkt: Wir wollen sehen, wie viel Nachfrage dort liegt.
 */
const BESETZT_VON = 8;
const BESETZT_BIS = 14;

const KATEGORIE_META: Record<
  AnalyseLead["kategorie"],
  { label: string; farbe: string; erklaerung: string }
> = {
  neuinteressent: {
    label: "Neuinteressent",
    farbe: "var(--cc-1)",
    erklaerung: "echte Neuanfrage — wird als Lead bearbeitet",
  },
  bestandskunde: {
    label: "Bestandskunde",
    farbe: "var(--cc-2)",
    erklaerung: "laufende Versorgung: Termine, Rechnung, Rückfragen",
  },
  mitarbeiter_intern: {
    label: "Mitarbeiter / intern",
    farbe: "var(--cc-3)",
    erklaerung: "eigene Mitarbeiter, Krankmeldung, Dienstplan",
  },
  sonstiges: {
    label: "Sonstiges",
    farbe: "var(--cc-4)",
    erklaerung: "Vertrieb, Werbung, falsch verbunden",
  },
  kein_anliegen: {
    label: "Ohne Anliegen",
    farbe: "var(--cc-5)",
    erklaerung: "aufgelegt ohne Anliegen, Nummer anonym — kein Rückruf möglich",
  },
};

function prozent(teil: number, ganz: number): number {
  return ganz > 0 ? Math.round((teil / ganz) * 100) : 0;
}


/**
 * Donut: Anteile der Anliegen-Arten. Ring statt Vollkreis, damit die
 * Gesamtzahl in die Mitte passt — die wichtigste Zahl bleibt groß und
 * lesbar. Segmente mit 2px Lücke, Legende immer daneben (Identität nie
 * nur über Farbe).
 */
function DonutChart({
  daten,
  gesamt,
}: {
  daten: { key: string; label: string; farbe: string; anzahl: number }[];
  gesamt: number;
}) {
  const R = 70;
  const STROKE = 26;
  const umfang = 2 * Math.PI * R;
  // Prefix-Summen statt laufender Variable (react-hooks/immutability).
  const starts = daten.reduce<number[]>(
    (acc, d, i) => [...acc, (acc[i] ?? 0) + d.anzahl],
    [0],
  );

  return (
    <div className="flex flex-wrap items-center justify-center gap-x-8 gap-y-4">
      <svg
        viewBox="0 0 180 180"
        className="size-44 shrink-0 -rotate-90"
        role="img"
        aria-label={`Anliegen-Verteilung: ${daten.map((d) => `${d.label} ${d.anzahl}`).join(", ")}`}
      >
        {daten.map((d, i) => {
          const anteil = d.anzahl / gesamt;
          const offset = (starts[i] / gesamt) * umfang;
          // 2px Lücke zwischen den Segmenten
          const laenge = Math.max(anteil * umfang - 2, 0.5);
          return (
            <circle
              key={d.key}
              cx="90"
              cy="90"
              r={R}
              fill="none"
              stroke={d.farbe}
              strokeWidth={STROKE}
              strokeDasharray={`${laenge} ${umfang - laenge}`}
              strokeDashoffset={-offset}
            >
              <title>{`${d.label}: ${d.anzahl} (${prozent(d.anzahl, gesamt)} %)`}</title>
            </circle>
          );
        })}
        {/* Mittelwert im Ring — wieder aufrecht drehen */}
        <g className="rotate-90" style={{ transformOrigin: "90px 90px" }}>
          <text
            x="90"
            y="86"
            textAnchor="middle"
            className="fill-foreground text-[1.75rem] font-bold tabular-nums"
          >
            {gesamt}
          </text>
          <text
            x="90"
            y="104"
            textAnchor="middle"
            className="fill-muted-foreground text-[0.7rem]"
          >
            Anrufe
          </text>
        </g>
      </svg>

      <ul className="flex min-w-0 flex-col gap-2">
        {daten.map((d) => (
          <li key={d.key} className="flex items-center gap-2.5 text-sm">
            <span
              className="size-3 shrink-0 rounded-[3px]"
              style={{ backgroundColor: d.farbe }}
            />
            <span className="min-w-0 flex-1 font-medium">{d.label}</span>
            <span className="shrink-0 font-semibold tabular-nums">
              {d.anzahl}
            </span>
            <span className="w-12 shrink-0 text-right text-muted-foreground tabular-nums">
              {prozent(d.anzahl, gesamt)} %
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/**
 * Callcenter-Analyse: Wie viele Anrufe kommen rein, wie viele nehmen wir an,
 * wann rufen die Leute an — und wie viele Interessenten verlieren wir
 * außerhalb der Besetzung. Zwei Datenquellen, bewusst getrennt ausgewiesen:
 * der CSV-Export der Telefonanlage (Annahmequote, Uhrzeiten) und die
 * KI-vorsortierten Verpasst-Mails (worum es ging).
 */
export function CallcenterAnalyse({
  leads,
  tage,
  zeitraum,
}: {
  leads: AnalyseLead[];
  /** Anzahl Tage, an denen verpasste Anrufe eingegangen sind. */
  tage: number;
  /** Abgedeckter Zeitraum, für die Datenbasis-Zeile. */
  zeitraum?: { von: string; bis: string } | null;
}) {
  const [tabelle, setTabelle] = useState(false);

  const k = useMemo(() => {
    const gesamt = leads.length;

    // Stunden-Achse auf den belegten Bereich zuschneiden (eine Stunde Rand),
    // mindestens aber das Besetzungsfenster zeigen. reduce statt Spread,
    // damit große Datenmengen keinen Stack-Overflow auslösen.
    const grenzen = leads.reduce(
      (acc, l) => ({
        min: Math.min(acc.min, l.stunde),
        max: Math.max(acc.max, l.stunde),
      }),
      { min: BESETZT_VON, max: BESETZT_BIS + 1 },
    );
    const vonStunde = Math.max(0, grenzen.min - 1);
    const bisStunde = Math.min(23, grenzen.max + 1);
    const stunden = Array.from(
      { length: Math.max(bisStunde - vonStunde + 1, 1) },
      (_, i) => i + vonStunde,
    ).map((h) => {
      const inStunde = leads.filter((l) => l.stunde === h);
      return {
        h,
        gesamt: inStunde.length,
        interessenten: inStunde.filter((l) => l.kategorie === "neuinteressent")
          .length,
        besetzt: h >= BESETZT_VON && h < BESETZT_BIS,
      };
    });
    const maxStunde = Math.max(1, ...stunden.map((s) => s.gesamt));

    // Kernfrage: Wie viele verpasste Anrufe liegen außerhalb der Besetzung?
    const ausserhalbListe = leads.filter(
      (l) => l.stunde >= BESETZT_BIS || l.stunde < BESETZT_VON,
    );
    const nachSchlussListe = leads.filter((l) => l.stunde >= BESETZT_BIS);
    const ausserhalb = ausserhalbListe.length;
    const nachSchluss = nachSchlussListe.length;
    const nachSchlussAnteil = prozent(nachSchluss, gesamt);
    // Verlorene Interessenten: echte Neuanfragen außerhalb der Besetzung.
    const interessentenAusserhalb = ausserhalbListe.filter(
      (l) => l.kategorie === "neuinteressent",
    ).length;
    const verloreneProTag = tage > 0 ? interessentenAusserhalb / tage : 0;

    const jeKategorie = (
      Object.keys(KATEGORIE_META) as AnalyseLead["kategorie"][]
    )
      .map((key) => ({
        key,
        ...KATEGORIE_META[key],
        anzahl: leads.filter((l) => l.kategorie === key).length,
      }))
      .filter((r) => r.anzahl > 0)
      .sort((a, b) => b.anzahl - a.anzahl);

    const interessenten = leads.filter(
      (l) => l.kategorie === "neuinteressent",
    ).length;
    // Anonym + kein Anliegen: niemand, den man zurückrufen könnte.
    const ohneRueckruf = leads.filter(
      (l) => l.kategorie === "kein_anliegen",
    ).length;

    const spitze = [...stunden].sort((a, b) => b.gesamt - a.gesamt)[0];

    return {
      gesamt,
      stunden,
      maxStunde,
      ausserhalb,
      nachSchluss,
      nachSchlussAnteil,
      interessentenAusserhalb,
      verloreneProTag,
      jeKategorie,
      interessenten,
      ohneRueckruf,
      spitze,
    };
  }, [leads, tage]);

  if (leads.length === 0) {
    return (
      <SectionCard
        title="Callcenter-Analyse"
        icon={PhoneIncoming}
        description="Noch keine verpassten Anrufe erfasst."
      >
        <p className="text-sm text-muted-foreground">
          Diese Auswertung beruht auf den Benachrichtigungs-Mails der
          Telefonanlage über verpasste Anrufe. Sobald welche eingehen,
          erscheint hier die Auswertung.
        </p>
      </SectionCard>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Chart-Farbtoken: validierte Referenz-Palette (hell + dunkel) */}
      <style>{`
        .cc-viz {
          --cc-an: #1baf7a; --cc-miss: #e5484d;
          --cc-1: #2a78d6; --cc-2: #eb6834; --cc-3: #1baf7a;
          --cc-4: #eda100; --cc-5: #e87ba4; --cc-rest: #c7d2e0;
        }
        @media (prefers-color-scheme: dark) {
          .cc-viz {
            --cc-an: #30c78d; --cc-miss: #ff6369;
            --cc-1: #3987e5; --cc-2: #ff7d47; --cc-3: #30c78d;
            --cc-4: #ffb31a; --cc-5: #f58cb4; --cc-rest: #4a5568;
          }
        }
      `}</style>

      {/* Datenbasis offenlegen — eine einzige Quelle, klar benannt. */}
      <p className="rounded-lg border bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
        <b className="text-foreground">Datenbasis:</b> ausschließlich die
        Benachrichtigungs-Mails der Telefonanlage über{" "}
        <b className="text-foreground">verpasste Anrufe</b> — {k.gesamt} Stück
        {zeitraum
          ? ` vom ${new Date(`${zeitraum.von}T00:00:00`).toLocaleDateString("de-DE")} bis ${new Date(`${zeitraum.bis}T00:00:00`).toLocaleDateString("de-DE")} (${tage} ${tage === 1 ? "Tag" : "Tage"})`
          : ""}
        . Uhrzeit und Anliegen stammen aus dem Mailtext, die Kategorie liest
        die KI daraus. <b className="text-foreground">Wichtig:</b> Anrufe, die
        jemand angenommen hat, erzeugen keine Mail und fehlen hier komplett —
        eine Annahmequote lässt sich daraus nicht berechnen.
      </p>

      {/* ── Kennzahlen ── */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile
          icon={Bot}
          tone="amber"
          coloredValue
          label="Verpasste Anrufe"
          value={k.gesamt}
          sub={
            tage > 0
              ? `${(k.gesamt / tage).toFixed(1)} pro Tag · bei Nora gelandet`
              : "bei Nora gelandet"
          }
        />
        <StatTile
          icon={UserPlus}
          tone="purple"
          coloredValue
          label="Echte Neuanfragen"
          value={k.interessenten}
          sub={`${prozent(k.interessenten, k.gesamt)} % der verpassten Anrufe`}
        />
        <StatTile
          icon={PhoneMissed}
          tone="red"
          coloredValue={k.ohneRueckruf > 0}
          label="Ohne Rückruf-Chance"
          value={k.ohneRueckruf}
          sub="anonym & ohne Anliegen — verloren"
        />
        <StatTile
          icon={Clock}
          tone="blue"
          coloredValue={k.ausserhalb > 0}
          label={`Außerhalb ${BESETZT_VON}–${BESETZT_BIS} Uhr`}
          value={k.ausserhalb}
          sub={`${prozent(k.ausserhalb, k.gesamt)} % — davon ${k.interessentenAusserhalb} Neuanfragen`}
        />
      </div>

      {/* ── Kernaussage: Erreichbarkeit endet zu früh ── */}
      {k.nachSchluss > 0 && (
        <div className="flex flex-col gap-2 rounded-xl border border-amber-500/50 bg-amber-50/60 p-4 shadow-sm dark:bg-amber-500/[0.06]">
          <p className="flex items-center gap-2 text-base font-semibold">
            <TriangleAlert className="size-4.5 shrink-0 text-amber-600" />
            {k.nachSchlussAnteil} % der verpassten Anrufe kommen nach{" "}
            {BESETZT_BIS}:00 — wenn niemand mehr am Telefon ist
          </p>
          <p className="text-sm text-muted-foreground">
            Das sind <b className="text-foreground">{k.nachSchluss} Anrufe</b>,
            die niemand angenommen hat. Außerhalb der Besetzungszeit
            ({BESETZT_VON}–{BESETZT_BIS} Uhr) waren{" "}
            <b className="text-foreground">
              {k.interessentenAusserhalb} echte Neuanfragen
            </b>{" "}
            dabei — also{" "}
            <b className="text-foreground">
              rund {k.verloreneProTag.toFixed(1)} verlorene Interessenten pro Tag
            </b>
            {tage >= 5
              ? ` — hochgerechnet ${Math.round(k.verloreneProTag * 21)} pro Monat (21 Arbeitstage).`
              : "."}
          </p>
          <p className="text-xs text-muted-foreground">
            Gezählt, nicht geschätzt: Es sind die tatsächlich als
            &bdquo;Neuinteressent&ldquo; eingestuften Anrufe außerhalb der
            Besetzung, geteilt durch {tage} {tage === 1 ? "Tag" : "Tage"}.
            {tage < 5 && (
              <>
                {" "}
                <b className="text-amber-700 dark:text-amber-500">
                  Nur {tage} {tage === 1 ? "Tag" : "Tage"} Datenbasis
                </b>{" "}
                — eine Monats-Hochrechnung zeigen wir erst ab 5 Tagen.
              </>
            )}
          </p>
        </div>
      )}

      {/* ── Zeitstrahl: Wann kommen die verpassten Anrufe? ── */}
      <SectionCard
        title="Wann kommen die verpassten Anrufe?"
        icon={Clock}
        description={`Verpasste Anrufe je Uhrzeit — lila der Anteil echter Neuanfragen. Der graue Bereich liegt außerhalb der aktuellen Besetzung (${BESETZT_VON}–${BESETZT_BIS} Uhr).`}
        actions={
          <button
            type="button"
            onClick={() => setTabelle((v) => !v)}
            className="rounded-md border bg-background px-2.5 py-1 text-xs font-medium text-muted-foreground hover:text-foreground"
          >
            {tabelle ? "Diagramm" : "Als Tabelle"}
          </button>
        }
        className="cc-viz"
      >
        {tabelle ? (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[420px] text-sm">
              <thead>
                <tr className="border-b text-left text-xs text-muted-foreground">
                  <th className="py-1.5 pr-2 font-medium">Uhrzeit</th>
                  <th className="px-2 py-1.5 font-medium">Verpasste Anrufe</th>
                  <th className="px-2 py-1.5 font-medium">davon Neuanfragen</th>
                  <th className="px-2 py-1.5 font-medium">Besetzung</th>
                </tr>
              </thead>
              <tbody>
                {k.stunden
                  .filter((s) => s.gesamt > 0)
                  .map((s) => (
                    <tr key={s.h} className="border-b last:border-b-0">
                      <td className="py-1.5 pr-2 font-medium tabular-nums">
                        {String(s.h).padStart(2, "0")}:00
                      </td>
                      <td className="px-2 py-1.5 font-semibold tabular-nums">
                        {s.gesamt}
                      </td>
                      <td className="px-2 py-1.5 tabular-nums">
                        {s.interessenten}
                      </td>
                      <td className="px-2 py-1.5 text-xs text-muted-foreground">
                        {s.besetzt ? "besetzt" : "nicht besetzt"}
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {/* Legende — Identität nie nur über Farbe */}
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs">
              <span className="flex items-center gap-1.5">
                <span
                  className="size-2.5 rounded-[2px]"
                  style={{ backgroundColor: "var(--cc-1)" }}
                />
                echte Neuanfrage
              </span>
              <span className="flex items-center gap-1.5">
                <span
                  className="size-2.5 rounded-[2px]"
                  style={{ backgroundColor: "var(--cc-rest)" }}
                />
                sonstige verpasste Anrufe
              </span>
              <span className="ml-auto text-muted-foreground">
                Spitze: {String(k.spitze?.h ?? 0).padStart(2, "0")}:00 Uhr mit{" "}
                {k.spitze?.gesamt ?? 0} Anrufen
              </span>
            </div>

            <div
              className="grid items-end gap-1"
              style={{
                gridTemplateColumns: `repeat(${k.stunden.length}, minmax(0, 1fr))`,
                height: "13rem",
              }}
              role="img"
              aria-label="Verpasste Anrufe je Uhrzeit, davon echte Neuanfragen"
            >
              {k.stunden.map((s) => {
                const hoehe = (s.gesamt / k.maxStunde) * 100;
                const rest = s.gesamt - s.interessenten;
                return (
                  <div
                    key={s.h}
                    className={cn(
                      "flex h-full flex-col items-center justify-end gap-1 rounded-t-sm",
                      !s.besetzt && "bg-slate-100/70 dark:bg-slate-500/10",
                    )}
                    title={`${String(s.h).padStart(2, "0")}:00 Uhr — ${s.gesamt} verpasste Anrufe, davon ${s.interessenten} echte Neuanfragen${s.besetzt ? "" : " · außerhalb der Besetzung"}`}
                  >
                    {s.gesamt > 0 && (
                      <span className="text-[0.65rem] font-semibold tabular-nums">
                        {s.gesamt}
                      </span>
                    )}
                    <div
                      className="flex w-full max-w-7 flex-col justify-end"
                      style={{ height: `${Math.max(hoehe, s.gesamt > 0 ? 4 : 0)}%` }}
                    >
                      {/* Neuanfragen oben hervorgehoben, Rest darunter */}
                      {s.interessenten > 0 && (
                        <div
                          className="w-full rounded-t-[4px]"
                          style={{
                            height: `${(s.interessenten / s.gesamt) * 100}%`,
                            backgroundColor: "var(--cc-1)",
                            boxShadow: "0 2px 0 0 var(--card)",
                          }}
                        />
                      )}
                      {rest > 0 && (
                        <div
                          className="w-full"
                          style={{
                            height: `${(rest / s.gesamt) * 100}%`,
                            backgroundColor: "var(--cc-rest)",
                            borderRadius:
                              s.interessenten > 0 ? "0" : "4px 4px 0 0",
                          }}
                        />
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Achse + Besetzungs-Markierung */}
            <div
              className="grid gap-1 border-t pt-1.5"
              style={{
                gridTemplateColumns: `repeat(${k.stunden.length}, minmax(0, 1fr))`,
              }}
            >
              {k.stunden.map((s) => (
                <span
                  key={s.h}
                  className={cn(
                    "text-center text-[0.65rem] tabular-nums",
                    s.besetzt
                      ? "font-medium text-foreground"
                      : "text-muted-foreground",
                  )}
                >
                  {s.h}
                </span>
              ))}
            </div>
            <p className="text-xs text-muted-foreground">
              Fett = aktuell besetzt ({BESETZT_VON}–{BESETZT_BIS} Uhr). Alle
              Werte per Mouse-over und über &bdquo;Als Tabelle&ldquo;.
            </p>
          </div>
        )}
      </SectionCard>

      {/* ── Worum ging es? ── */}
      {k.gesamt > 0 && (
        <SectionCard
          title="Worum ging es bei den verpassten Anrufen?"
          icon={PhoneMissed}
          description="Die KI liest jede Verpasst-Mail und ordnet den Anruf ein. Nur Neuinteressenten landen als offener Lead in der Liste."
          className="cc-viz"
        >
          <div className="flex flex-col gap-4">
            <DonutChart daten={k.jeKategorie} gesamt={k.gesamt} />
            {/* Erklärung je Kategorie — was steckt hinter dem Segment? */}
            <ul className="flex flex-col gap-1 border-t pt-3">
              {k.jeKategorie.map((r) => (
                <li
                  key={r.key}
                  className="flex items-baseline gap-2 text-xs text-muted-foreground"
                >
                  <span
                    className="size-2 shrink-0 translate-y-px rounded-[2px]"
                    style={{ backgroundColor: r.farbe }}
                  />
                  <span className="font-medium text-foreground">{r.label}</span>
                  <span>— {r.erklaerung}</span>
                </li>
              ))}
            </ul>
          </div>
        </SectionCard>
      )}
    </div>
  );
}
