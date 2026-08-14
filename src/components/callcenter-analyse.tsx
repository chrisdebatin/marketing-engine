"use client";

import { useMemo, useState } from "react";
import {
  Bot,
  Clock,
  PhoneCall,
  PhoneIncoming,
  PhoneMissed,
  TriangleAlert,
  UserPlus,
} from "lucide-react";
import { SectionCard } from "@/components/ui/section-card";
import { StatTile } from "@/components/ui/stat-tile";
import { cn } from "@/lib/utils";

/** Ein eingehender Anruf aus dem Telefonanlagen-Export (phone_calls). */
export interface AnalyseCall {
  /** ISO-Zeitpunkt des Anrufs. */
  zeit: string;
  hub: string | null;
  angenommen: boolean;
  /** Gesprächsdauer in Sekunden — 0 bei verpassten Anrufen. */
  sekunden: number;
}

/** Ein 0800-Lead aus der KI-Vorsortierung der Verpasst-Mails (lead_calls). */
export interface AnalyseLead {
  zeit: string;
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

function stundeVon(iso: string): number {
  return new Date(iso).getHours();
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
  calls,
  leads,
  tage,
  zeitraum,
}: {
  calls: AnalyseCall[];
  leads: AnalyseLead[];
  /** Anzahl Tage, für die Telefonanlagen-Daten vorliegen. */
  tage: number;
  /** Abgedeckter Zeitraum der Telefonanlagen-Daten, für die Datenbasis-Zeile. */
  zeitraum?: { von: string; bis: string } | null;
}) {
  const [tabelle, setTabelle] = useState(false);

  const k = useMemo(() => {
    const gesamt = calls.length;
    const angenommen = calls.filter((c) => c.angenommen).length;
    const verpasst = gesamt - angenommen;

    // Stunden-Achse auf den tatsächlich belegten Bereich zuschneiden (mit
    // einer Stunde Rand), sonst stehen rechts nur leere Spalten. Der Rand
    // bis mindestens BESETZT_BIS+2 bleibt sichtbar — dort liegt die Aussage.
    // reduce statt Spread: calls kann sehr groß sein (Stack-Overflow bei
    // Math.min(...arr)) und ist bei leerer Datenbasis leer.
    const grenzen = calls.reduce(
      (acc, c) => {
        const h = stundeVon(c.zeit);
        return { min: Math.min(acc.min, h), max: Math.max(acc.max, h) };
      },
      { min: BESETZT_VON, max: BESETZT_BIS + 1 },
    );
    const vonStunde = Math.max(0, grenzen.min - 1);
    const bisStunde = Math.min(23, grenzen.max + 1);
    const stunden = Array.from(
      { length: Math.max(bisStunde - vonStunde + 1, 1) },
      (_, i) => i + vonStunde,
    ).map((h) => {
      const inStunde = calls.filter((c) => stundeVon(c.zeit) === h);
      const an = inStunde.filter((c) => c.angenommen).length;
      return {
        h,
        gesamt: inStunde.length,
        angenommen: an,
        verpasst: inStunde.length - an,
        besetzt: h >= BESETZT_VON && h < BESETZT_BIS,
      };
    });
    const maxStunde = Math.max(1, ...stunden.map((s) => s.gesamt));

    // Kernfrage: Was liegt nach Dienstschluss?
    const nachSchluss = calls.filter((c) => stundeVon(c.zeit) >= BESETZT_BIS);
    const vorBeginn = calls.filter((c) => stundeVon(c.zeit) < BESETZT_VON);
    const ausserhalb = nachSchluss.length + vorBeginn.length;
    const ausserhalbVerpasst = [...nachSchluss, ...vorBeginn].filter(
      (c) => !c.angenommen,
    ).length;

    // Kategorien der KI-vorsortierten Verpasst-Anrufe.
    const gesamtLeads = leads.length;
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

    // Verlust-Schätzung: Interessenten-Quote der eingegangenen Anrufe auf die
    // verpassten Anrufe außerhalb der Besetzung übertragen.
    const interessentenQuote = gesamtLeads > 0 ? interessenten / gesamtLeads : 0;
    const verloreneProTag =
      tage > 0 ? (ausserhalbVerpasst * interessentenQuote) / tage : 0;

    // Spitzenstunde und die erste Stunde nach Dienstschluss.
    const spitze = [...stunden].sort((a, b) => b.gesamt - a.gesamt)[0];
    const nachSchlussAnteil = prozent(nachSchluss.length, gesamt);

    return {
      gesamt,
      angenommen,
      verpasst,
      stunden,
      maxStunde,
      nachSchluss: nachSchluss.length,
      nachSchlussVerpasst: nachSchluss.filter((c) => !c.angenommen).length,
      nachSchlussAnteil,
      ausserhalb,
      ausserhalbVerpasst,
      jeKategorie,
      gesamtLeads,
      interessenten,
      ohneRueckruf,
      interessentenQuote,
      verloreneProTag,
      spitze,
    };
  }, [calls, leads, tage]);

  if (calls.length === 0 && leads.length === 0) {
    return (
      <SectionCard
        title="Callcenter-Analyse"
        icon={PhoneIncoming}
        description="Noch keine Datenbasis vorhanden."
      >
        <p className="text-sm text-muted-foreground">
          Für die Annahmequote und die Uhrzeiten-Verteilung wird der CSV-Export
          der Telefonanlage gebraucht — den lädst du unter{" "}
          <span className="font-medium text-foreground">Statistik</span> hoch.
          Sobald ein Export drin ist, erscheint hier die vollständige
          Auswertung.
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
          --cc-4: #eda100; --cc-5: #e87ba4;
        }
        @media (prefers-color-scheme: dark) {
          .cc-viz {
            --cc-an: #30c78d; --cc-miss: #ff6369;
            --cc-1: #3987e5; --cc-2: #ff7d47; --cc-3: #30c78d;
            --cc-4: #ffb31a; --cc-5: #f58cb4;
          }
        }
      `}</style>

      {/* Datenbasis offenlegen: zwei Quellen mit ggf. unterschiedlichem
          Zeitraum — sonst liest man die Prozentwerte als einen Datensatz. */}
      <p className="text-xs text-muted-foreground">
        <b className="text-foreground">Datenbasis:</b> Annahmequote und Uhrzeiten
        stammen aus dem Telefonanlagen-Export
        {zeitraum
          ? ` (${new Date(`${zeitraum.von}T00:00:00`).toLocaleDateString("de-DE")}–${new Date(`${zeitraum.bis}T00:00:00`).toLocaleDateString("de-DE")}, ${tage} ${tage === 1 ? "Tag" : "Tage"})`
          : ""}
        ; die Anliegen-Verteilung aus den KI-gelesenen Verpasst-Mails ({k.gesamtLeads}{" "}
        Anrufe). Beide Zeiträume können abweichen — regelmäßige CSV-Uploads unter
        &bdquo;Statistik&ldquo; machen die Auswertung belastbar.
      </p>

      {/* ── Kennzahlen ── */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        <StatTile
          icon={PhoneIncoming}
          tone="blue"
          coloredValue
          label="Eingehende Anrufe"
          value={k.gesamt}
          sub={
            tage > 0
              ? `${Math.round(k.gesamt / tage)} pro Tag · ${tage} ${tage === 1 ? "Tag" : "Tage"} Datenbasis`
              : "keine Telefondaten"
          }
        />
        <StatTile
          icon={PhoneCall}
          tone="green"
          coloredValue
          label="Von uns angenommen"
          value={`${prozent(k.angenommen, k.gesamt)} %`}
          sub={`${k.angenommen} von ${k.gesamt} Anrufen`}
        />
        <StatTile
          icon={Bot}
          tone="amber"
          coloredValue={k.verpasst > 0}
          label="Bei Nora gelandet"
          value={k.verpasst}
          sub={`${prozent(k.verpasst, k.gesamt)} % — KI-Agentin nimmt ab, wenn niemand rangeht`}
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
          icon={UserPlus}
          tone="purple"
          coloredValue
          label="Echte Neuanfragen"
          value={`${prozent(k.interessenten, k.gesamtLeads)} %`}
          sub={`${k.interessenten} von ${k.gesamtLeads} Nora-Anrufen`}
        />
      </div>

      {/* ── Kernaussage: Erreichbarkeit endet zu früh ── */}
      {k.nachSchluss > 0 && (
        <div className="flex flex-col gap-2 rounded-xl border border-amber-500/50 bg-amber-50/60 p-4 shadow-sm dark:bg-amber-500/[0.06]">
          <p className="flex items-center gap-2 text-base font-semibold">
            <TriangleAlert className="size-4.5 shrink-0 text-amber-600" />
            {k.nachSchlussAnteil} % aller Anrufe kommen nach {BESETZT_BIS}:00 —
            wenn niemand mehr am Telefon ist
          </p>
          <p className="text-sm text-muted-foreground">
            Das sind <b className="text-foreground">{k.nachSchluss} Anrufe</b> im
            Auswertungszeitraum, davon{" "}
            <b className="text-foreground">{k.nachSchlussVerpasst} nicht angenommen</b>.
            Bei einer Neuanfragen-Quote von {prozent(k.interessenten, k.gesamtLeads)} %
            entspricht das{" "}
            <b className="text-foreground">
              rund {k.verloreneProTag.toFixed(1)} verlorenen Interessenten pro Tag
            </b>
            {tage >= 5
              ? ` — hochgerechnet ${Math.round(k.verloreneProTag * 21)} pro Monat (21 Arbeitstage).`
              : "."}
          </p>
          <p className="text-xs text-muted-foreground">
            Rechenweg: verpasste Anrufe außerhalb der Besetzung ({k.ausserhalbVerpasst})
            × Neuanfragen-Quote ({prozent(k.interessenten, k.gesamtLeads)} %) ÷{" "}
            {tage} {tage === 1 ? "Tag" : "Tage"} Datenbasis. Angenommen ist, dass
            Anrufer nach Dienstschluss die gleiche Anliegen-Verteilung haben wie
            tagsüber.
            {tage < 5 && (
              <>
                {" "}
                <b className="text-amber-700 dark:text-amber-500">
                  Achtung: nur {tage} {tage === 1 ? "Tag" : "Tage"} Datenbasis
                </b>{" "}
                — für eine belastbare Aussage bitte weitere Telefon-Exporte
                unter &bdquo;Statistik&ldquo; hochladen. Eine Monats-Hochrechnung
                zeigen wir erst ab 5 Tagen.
              </>
            )}
          </p>
        </div>
      )}

      {/* ── Zeitstrahl: Wann rufen die Leute an? ── */}
      <SectionCard
        title="Wann rufen die Leute an?"
        icon={Clock}
        description={`Eingehende Anrufe je Uhrzeit. Grün = angenommen, rot = nicht durchgekommen. Der graue Bereich ist außerhalb der aktuellen Besetzung (${BESETZT_VON}–${BESETZT_BIS} Uhr).`}
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
                  <th className="px-2 py-1.5 font-medium">Anrufe</th>
                  <th className="px-2 py-1.5 font-medium">Angenommen</th>
                  <th className="px-2 py-1.5 font-medium">Verpasst</th>
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
                      <td className="px-2 py-1.5 tabular-nums">{s.angenommen}</td>
                      <td
                        className={cn(
                          "px-2 py-1.5 tabular-nums",
                          s.verpasst > 0 && "font-medium text-destructive",
                        )}
                      >
                        {s.verpasst}
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
                  style={{ backgroundColor: "var(--cc-an)" }}
                />
                angenommen
              </span>
              <span className="flex items-center gap-1.5">
                <span
                  className="size-2.5 rounded-[2px]"
                  style={{ backgroundColor: "var(--cc-miss)" }}
                />
                nicht durchgekommen
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
              aria-label="Eingehende Anrufe je Uhrzeit, angenommen und verpasst"
            >
              {k.stunden.map((s) => {
                const hoehe = (s.gesamt / k.maxStunde) * 100;
                return (
                  <div
                    key={s.h}
                    className={cn(
                      "flex h-full flex-col items-center justify-end gap-1 rounded-t-sm",
                      !s.besetzt && "bg-slate-100/70 dark:bg-slate-500/10",
                    )}
                    title={`${String(s.h).padStart(2, "0")}:00 Uhr — ${s.gesamt} Anrufe (${s.angenommen} angenommen, ${s.verpasst} verpasst)${s.besetzt ? "" : " · außerhalb der Besetzung"}`}
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
                      {/* verpasst oben, angenommen unten auf der Grundlinie */}
                      {s.verpasst > 0 && (
                        <div
                          className="w-full rounded-t-[4px]"
                          style={{
                            height: `${(s.verpasst / s.gesamt) * 100}%`,
                            backgroundColor: "var(--cc-miss)",
                            // 2px Fläche zwischen den Segmenten
                            boxShadow: "0 2px 0 0 var(--card)",
                          }}
                        />
                      )}
                      {s.angenommen > 0 && (
                        <div
                          className="w-full"
                          style={{
                            height: `${(s.angenommen / s.gesamt) * 100}%`,
                            backgroundColor: "var(--cc-an)",
                            borderRadius:
                              s.verpasst > 0 ? "0" : "4px 4px 0 0",
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
      {k.gesamtLeads > 0 && (
        <SectionCard
          title="Worum ging es bei den verpassten Anrufen?"
          icon={PhoneMissed}
          description="KI-Auswertung der Verpasst-Mails: Die Agentin Nora nimmt ab, fasst zusammen — daraus wird die Kategorie abgeleitet. Nur Neuinteressenten landen als offener Lead in der Liste."
          className="cc-viz"
        >
          <div className="flex flex-col gap-4">
            <DonutChart daten={k.jeKategorie} gesamt={k.gesamtLeads} />
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
