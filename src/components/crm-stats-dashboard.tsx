"use client";

import { useMemo, useState } from "react";
import {
  Inbox,
  Send,
  Stethoscope,
  Timer,
  UserCheck,
  XCircle,
} from "lucide-react";
import { StatTile } from "@/components/ui/stat-tile";
import { cn } from "@/lib/utils";

/**
 * CRM-Admin-Dashboard: reine Statistik über beide Teams — Leads pro Tag je
 * Kanal (gestapelte Balken), Prozess-Funnel mit Conversion-Rates, "was
 * wollten die Leads" (Bereich), Bearbeiter-Auswertung mit Reaktionszeiten
 * und PDL-Übergaben mit Liegezeiten. Farben folgen fest dem Kanal (nie der
 * Reihenfolge) und sind CVD-geprüft; zu jedem Chart gibt es eine
 * Tabellen-Ansicht bzw. sichtbare Zahlen-Labels.
 */

export interface StatLead {
  kind: "call" | "meta";
  quelle: string;
  bereich: string | null;
  status: string;
  bearbeiter: string | null;
  created: string;
  erst: string | null;
  hub: string | null;
  zugewiesenAt: string | null;
  bestaetigtAt: string | null;
  pdlErgebnis: string | null;
}

/* Kanäle mit fester Farb-Zuordnung (validierte kategoriale Palette). */
const CHANNELS = [
  { key: "meta", label: "Meta-Anzeigen", varName: "--c-meta" },
  { key: "website", label: "Website", varName: "--c-website" },
  { key: "telefon0800", label: "0800-Anruf", varName: "--c-0800" },
  { key: "recare", label: "Recare", varName: "--c-recare" },
  { key: "agentur", label: "Lead-Agentur", varName: "--c-agentur" },
  { key: "andere", label: "Andere", varName: "--c-andere" },
] as const;
type ChannelKey = (typeof CHANNELS)[number]["key"];

const BEREICH_LABEL: Record<string, string> = {
  alltagshilfe: "Alltagshilfe",
  ambulant: "Ambulante Pflege",
  intensiv: "Intensivpflege",
  pflege: "Pflege (allgemein)",
};

const DAY_MS = 86_400_000;

function channelOf(l: StatLead): ChannelKey {
  const known = CHANNELS.some((c) => c.key === l.quelle);
  return known ? (l.quelle as ChannelKey) : "andere";
}

function fmtMin(ms: number): string {
  const min = Math.round(ms / 60000);
  if (min < 60) return `${min} Min`;
  const h = ms / 3_600_000;
  if (h < 48) return `${h.toFixed(1).replace(".", ",")} Std`;
  return `${(h / 24).toFixed(1).replace(".", ",")} Tage`;
}

function avg(nums: number[]): number | null {
  return nums.length ? nums.reduce((a, b) => a + b, 0) / nums.length : null;
}

function median(nums: number[]): number | null {
  if (!nums.length) return null;
  const s = [...nums].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

function pct(part: number, whole: number): string {
  if (!whole) return "—";
  return `${Math.round((part / whole) * 100)} %`;
}

/** Wie weit ist ein Lead im Prozess gekommen? (kumulative Funnel-Stufe) */
function funnelRank(l: StatLead): number {
  if (l.status === "aufgenommen" || l.bestaetigtAt) return 4;
  if (l.zugewiesenAt) return 3;
  if (l.status === "erstgespraech") return 2;
  if (l.status === "kontaktiert") return 1;
  return 0;
}

export interface AnrufRow {
  datum: string; // JJJJ-MM-TT
  bearbeiter: string;
  ziel: string;
  ansprechpartner: string | null;
  note: string | null;
}

export function CrmStatsDashboard({
  leads,
  hubPdl,
  anrufe,
  now,
}: {
  leads: StatLead[];
  /** Hub-Name → PDL-Name (für die Übergabe-Tabelle). */
  hubPdl: Record<string, string>;
  /** Outbound-Anruf-Log (crm_contacts, kontakt_art=anruf). */
  anrufe: AnrufRow[];
  now: string;
}) {
  const [range, setRange] = useState<number>(30); // Tage; 0 = alles
  const nowMs = useMemo(() => new Date(now).getTime(), [now]);

  const data = useMemo(() => {
    const endDay = new Date(now);
    endDay.setHours(0, 0, 0, 0);
    const minCreated = leads.length
      ? Math.min(...leads.map((l) => new Date(l.created).getTime()))
      : endDay.getTime();
    const startMs =
      range > 0
        ? endDay.getTime() - (range - 1) * DAY_MS
        : new Date(minCreated).setHours(0, 0, 0, 0);
    const inRange = leads.filter((l) => new Date(l.created).getTime() >= startMs);

    // ── Buckets für den Tages-Chart (ab ~13 Wochen wochenweise) ──
    const spanDays = Math.max(1, Math.round((endDay.getTime() - startMs) / DAY_MS) + 1);
    const weekly = spanDays > 92;
    const step = weekly ? 7 * DAY_MS : DAY_MS;
    const bucketCount = Math.ceil((endDay.getTime() + DAY_MS - startMs) / step);
    const buckets = Array.from({ length: bucketCount }, (_, i) => {
      const d = new Date(startMs + i * step);
      return {
        label: weekly
          ? `ab ${d.getDate()}.${d.getMonth() + 1}.`
          : `${d.getDate()}.${d.getMonth() + 1}.`,
        counts: Object.fromEntries(CHANNELS.map((c) => [c.key, 0])) as Record<ChannelKey, number>,
        total: 0,
      };
    });
    for (const l of inRange) {
      const i = Math.floor((new Date(l.created).getTime() - startMs) / step);
      if (i < 0 || i >= buckets.length) continue;
      buckets[i].counts[channelOf(l)]++;
      buckets[i].total++;
    }

    // ── Kennzahlen ──
    const reaktionen = inRange
      .filter((l) => l.erst)
      .map((l) => new Date(l.erst!).getTime() - new Date(l.created).getTime())
      .filter((d) => d >= 0 && Number.isFinite(d));
    const recare = inRange.filter((l) => l.quelle === "recare");
    const aufgenommen = inRange.filter((l) => funnelRank(l) === 4);
    const uebergeben = inRange.filter((l) => l.zugewiesenAt);
    const unbearbeitet = inRange.filter((l) => l.status === "offen" && !l.bearbeiter);

    // ── Bereich ("was wollten die Leads") ──
    const bereich = new Map<string, number>();
    for (const l of inRange) {
      const key = l.bereich
        ? (BEREICH_LABEL[l.bereich] ?? l.bereich)
        : l.quelle === "meta"
          ? "Pflege (Meta-Anzeige)"
          : "ohne Angabe";
      bereich.set(key, (bereich.get(key) ?? 0) + 1);
    }
    const bereichRows = [...bereich.entries()].sort((a, b) => b[1] - a[1]);

    // ── Kanal-Summen (Legende + Balkenliste) ──
    const channelTotals = CHANNELS.map((c) => ({
      ...c,
      total: inRange.filter((l) => channelOf(l) === c.key).length,
    }));

    // ── Funnel ──
    const steps = [
      { label: "Eingegangen", hint: "alle Leads im Zeitraum" },
      { label: "Kontaktiert", hint: "mindestens einmal erreicht" },
      { label: "Erstgespräch", hint: "Beratung terminiert / geführt" },
      { label: "An PDL übergeben", hint: "Standort informiert" },
      { label: "Aufgenommen", hint: "in Versorgung bestätigt" },
    ].map((s, i) => ({ ...s, count: inRange.filter((l) => funnelRank(l) >= i).length }));
    const verloren = inRange.filter((l) => l.status === "verloren" && !l.bestaetigtAt).length;

    // ── Bearbeiter ──
    const byBearb = new Map<string, { total: number; aufgenommen: number; zeiten: number[] }>();
    for (const l of inRange) {
      if (!l.bearbeiter) continue;
      const e = byBearb.get(l.bearbeiter) ?? { total: 0, aufgenommen: 0, zeiten: [] };
      e.total++;
      if (funnelRank(l) === 4) e.aufgenommen++;
      if (l.erst) {
        const d = new Date(l.erst).getTime() - new Date(l.created).getTime();
        if (d >= 0 && Number.isFinite(d)) e.zeiten.push(d);
      }
      byBearb.set(l.bearbeiter, e);
    }
    const bearbeiterRows = [...byBearb.entries()].sort((a, b) => b[1].total - a[1].total);

    // ── PDL-Übergaben je Standort (inkl. Liegezeit) ──
    const byHub = new Map<
      string,
      { uebergeben: number; bestaetigt: number; liegezeiten: number[]; offen: number; aeltesteOffen: number }
    >();
    for (const l of inRange) {
      if (!l.zugewiesenAt || !l.hub) continue;
      const e =
        byHub.get(l.hub) ?? { uebergeben: 0, bestaetigt: 0, liegezeiten: [], offen: 0, aeltesteOffen: 0 };
      e.uebergeben++;
      if (l.bestaetigtAt) {
        e.bestaetigt++;
        const d = new Date(l.bestaetigtAt).getTime() - new Date(l.zugewiesenAt).getTime();
        if (d >= 0 && Number.isFinite(d)) e.liegezeiten.push(d);
      } else {
        e.offen++;
        e.aeltesteOffen = Math.max(e.aeltesteOffen, nowMs - new Date(l.zugewiesenAt).getTime());
      }
      byHub.set(l.hub, e);
    }
    const hubRows = [...byHub.entries()].sort((a, b) => b[1].uebergeben - a[1].uebergeben);
    const alleLiegezeiten = hubRows.flatMap(([, h]) => h.liegezeiten);

    // ── Leads nach Standort (Pie): Top 5 + "Andere" (Palette-Limit) ──
    const hubVerteilung = (() => {
      const sorted = hubRows.map(([hub, h]) => ({ label: hub, value: h.uebergeben }));
      const top = sorted.slice(0, 5);
      const rest = sorted.slice(5).reduce((a, b) => a + b.value, 0);
      return rest > 0 ? [...top, { label: "Andere", value: rest }] : top;
    })();

    // ── Outbound-Anrufe (Log) im Zeitraum ──
    const startIso = new Date(startMs).toISOString().slice(0, 10);
    const anrufeInRange = anrufe.filter((a) => a.datum >= startIso);
    const nichtErreicht = (a: AnrufRow) => /^nicht erreicht/i.test(a.note ?? "");
    const byCaller = new Map<string, { total: number; erreicht: number; nicht: number }>();
    for (const a of anrufeInRange) {
      const e = byCaller.get(a.bearbeiter) ?? { total: 0, erreicht: 0, nicht: 0 };
      e.total++;
      if (nichtErreicht(a)) e.nicht++;
      else e.erreicht++;
      byCaller.set(a.bearbeiter, e);
    }
    const callerRows = [...byCaller.entries()].sort((a, b) => b[1].total - a[1].total);

    return {
      hubVerteilung,
      anrufeInRange,
      callerRows,
      inRange,
      buckets,
      weekly,
      reaktionen,
      recare,
      aufgenommen,
      uebergeben,
      unbearbeitet,
      bereichRows,
      channelTotals,
      steps,
      verloren,
      bearbeiterRows,
      hubRows,
      alleLiegezeiten,
    };
  }, [leads, anrufe, range, now, nowMs]);

  const maxHub = Math.max(1, ...data.hubRows.map(([, h]) => h.uebergeben));
  const maxBearb = Math.max(1, ...data.bearbeiterRows.map(([, b]) => b.total));
  const maxBereich = Math.max(1, ...data.bereichRows.map(([, n]) => n));

  return (
    <div className="crm-viz flex flex-col gap-4">
      {/* Farb-Slots: kategoriale Palette (light + dark validiert) */}
      <style>{`
        .crm-viz{--c-meta:#2a78d6;--c-website:#eb6834;--c-0800:#1baf7a;--c-recare:#eda100;--c-agentur:#e87ba4;--c-andere:#898781;--f1:#86b6ef;--f2:#5598e7;--f3:#2a78d6;--f4:#1c5cab;--f5:#104281;--viz-grid:#e1e0d9;--viz-axis:#c3c2b7;--viz-crit:#d03b3b}
        .dark .crm-viz{--c-meta:#3987e5;--c-website:#d95926;--c-0800:#199e70;--c-recare:#c98500;--c-agentur:#d55181;--c-andere:#898781;--f1:#86b6ef;--f2:#5598e7;--f3:#3987e5;--f4:#256abf;--f5:#184f95;--viz-grid:#2c2c2a;--viz-axis:#383835;--viz-crit:#e66767}
        @media (prefers-color-scheme: dark){
          :root:not(.light) .crm-viz{--c-meta:#3987e5;--c-website:#d95926;--c-0800:#199e70;--c-recare:#c98500;--c-agentur:#d55181;--f3:#3987e5;--f4:#256abf;--f5:#184f95;--viz-grid:#2c2c2a;--viz-axis:#383835;--viz-crit:#e66767}
        }
      `}</style>

      {/* Zeitraum-Filter */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-muted-foreground">
          <span className="font-semibold text-foreground tabular-nums">
            {data.inRange.length}
          </span>{" "}
          Leads im Zeitraum · beide Teams
        </p>
        <div className="flex gap-0.5 overflow-x-auto rounded-full border bg-card p-0.5 shadow-sm">
          {[
            { v: 1, label: "Heute" },
            { v: 7, label: "7 Tage" },
            { v: 30, label: "30 Tage" },
            { v: 90, label: "90 Tage" },
            { v: 0, label: "Alles" },
          ].map((r) => (
            <button
              key={r.v}
              type="button"
              onClick={() => setRange(r.v)}
              className={cn(
                "rounded-full px-3 py-1.5 text-xs font-medium whitespace-nowrap transition-colors",
                range === r.v
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {r.label}
            </button>
          ))}
        </div>
      </div>

      {/* Kennzahlen-Kacheln (Referenz-Look: Icon-Disc + großer Wert) */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6">
        <StatTile
          icon={Inbox}
          tone="blue"
          coloredValue
          label="Leads gesamt"
          value={data.inRange.length}
          sub={`${data.unbearbeitet.length} noch unberührt`}
        />
        <StatTile
          icon={Timer}
          tone="orange"
          label="Ø bis Erstbearbeitung"
          value={avg(data.reaktionen) != null ? fmtMin(avg(data.reaktionen)!) : "—"}
          sub={median(data.reaktionen) != null ? `Median ${fmtMin(median(data.reaktionen)!)}` : "noch keine Stempel"}
        />
        <StatTile
          icon={Stethoscope}
          tone="purple"
          label="Recare-Leads"
          value={data.recare.length}
          sub={`davon ${data.recare.filter((l) => funnelRank(l) === 4).length} aufgenommen`}
        />
        <StatTile
          icon={UserCheck}
          tone="green"
          coloredValue
          label="Aufgenommen"
          value={data.aufgenommen.length}
          sub={`${pct(data.aufgenommen.length, data.inRange.length)} aller Leads`}
        />
        <StatTile
          icon={Send}
          tone="amber"
          label="An PDLs übergeben"
          value={data.uebergeben.length}
          sub={
            avg(data.alleLiegezeiten) != null
              ? `Ø Liegezeit ${fmtMin(avg(data.alleLiegezeiten)!)}`
              : "keine Rückmeldungen"
          }
        />
        <StatTile
          icon={XCircle}
          tone="gray"
          label="Verloren"
          value={data.verloren}
          sub={pct(data.verloren, data.inRange.length) + " aller Leads"}
        />
      </div>

      {/* Leads pro Tag je Kanal */}
      <section className="rounded-xl border bg-card p-4 shadow-sm">
        <h2 className="text-sm font-semibold">
          Leads pro {data.weekly ? "Woche" : "Tag"} — nach Kanal
        </h2>
        <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1">
          {data.channelTotals
            .filter((c) => c.total > 0 || c.key !== "andere")
            .map((c) => (
              <span key={c.key} className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <span
                  className="size-2.5 rounded-[3px]"
                  style={{ background: `var(${c.varName})` }}
                />
                {c.label} · <span className="font-semibold text-foreground tabular-nums">{c.total}</span>
              </span>
            ))}
        </div>
        <StackedBars buckets={data.buckets} />
        <details className="mt-2">
          <summary className="cursor-pointer text-xs text-muted-foreground select-none">
            Als Tabelle anzeigen
          </summary>
          <div className="mt-2 overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b text-left text-muted-foreground">
                  <th className="py-1 pr-3 font-medium">{data.weekly ? "Woche" : "Tag"}</th>
                  {CHANNELS.map((c) => (
                    <th key={c.key} className="py-1 pr-3 font-medium">{c.label}</th>
                  ))}
                  <th className="py-1 font-medium">Σ</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {data.buckets.filter((b) => b.total > 0).map((b) => (
                  <tr key={b.label}>
                    <td className="py-1 pr-3">{b.label}</td>
                    {CHANNELS.map((c) => (
                      <td key={c.key} className="py-1 pr-3 tabular-nums">{b.counts[c.key] || "·"}</td>
                    ))}
                    <td className="py-1 font-semibold tabular-nums">{b.total}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </details>
      </section>

      {/* Prozess-Funnel */}
      <section className="rounded-xl border bg-card p-4 shadow-sm">
        <h2 className="text-sm font-semibold">Der Prozess — jeder Schritt mit Conversion</h2>
        <p className="mt-0.5 text-xs text-muted-foreground">
          Jede Stufe zählt Leads, die diesen Schritt mindestens erreicht haben
          (Recare-Leads springen oft direkt zur Übergabe). {data.verloren} Lead
          {data.verloren === 1 ? "" : "s"} im Zeitraum verloren.
        </p>
        <div className="mt-3 flex flex-col">
          {data.steps.map((s, i) => {
            const first = data.steps[0].count || 1;
            const prev = i > 0 ? data.steps[i - 1].count : null;
            const w = Math.max(s.count / first, s.count > 0 ? 0.04 : 0);
            return (
              <div key={s.label}>
                {i > 0 && (
                  <p className="py-0.5 pl-2 text-[11px] text-muted-foreground">
                    ↓ {prev ? pct(s.count, prev) : "—"} vom vorherigen Schritt
                  </p>
                )}
                <div className="flex items-center gap-3">
                  <div className="w-36 shrink-0 sm:w-44">
                    <p className="text-sm font-medium">{s.label}</p>
                    <p className="text-[11px] text-muted-foreground">{s.hint}</p>
                  </div>
                  <div className="relative h-8 flex-1">
                    <div
                      className="absolute inset-y-0 left-0 rounded-r-[4px]"
                      style={{
                        width: `${w * 100}%`,
                        background: `var(--f${i + 1})`,
                        minWidth: s.count > 0 ? 6 : 0,
                      }}
                      title={`${s.label}: ${s.count} Leads`}
                    />
                    <span
                      className="absolute top-1/2 -translate-y-1/2 text-sm font-semibold tabular-nums"
                      style={{ left: `calc(${w * 100}% + 8px)` }}
                    >
                      {s.count}
                      <span className="ml-1.5 text-[11px] font-normal text-muted-foreground">
                        ({pct(s.count, data.steps[0].count)})
                      </span>
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      <div className="grid gap-4 lg:grid-cols-2">
        {/* Was wollten die Leads */}
        <section className="rounded-xl border bg-card p-4 shadow-sm">
          <h2 className="text-sm font-semibold">Was wollten die Leads?</h2>
          <p className="mt-0.5 text-xs text-muted-foreground">nach Bereich der Anfrage</p>
          <div className="mt-3 flex flex-col gap-2">
            {data.bereichRows.length === 0 && (
              <p className="text-sm text-muted-foreground">Noch keine Leads im Zeitraum.</p>
            )}
            {data.bereichRows.map(([label, n]) => (
              <div key={label} className="flex items-center gap-2">
                <span className="w-40 shrink-0 truncate text-sm" title={label}>{label}</span>
                <div className="h-5 flex-1">
                  <div
                    className="h-full rounded-r-[4px]"
                    style={{ width: `${(n / maxBereich) * 100}%`, background: "var(--f3)", minWidth: 4 }}
                    title={`${label}: ${n}`}
                  />
                </div>
                <span className="w-8 text-right text-sm font-semibold tabular-nums">{n}</span>
              </div>
            ))}
          </div>
        </section>

        {/* Wer hat bearbeitet */}
        <section className="rounded-xl border bg-card p-4 shadow-sm">
          <h2 className="text-sm font-semibold">Wer hat die Leads bearbeitet?</h2>
          <p className="mt-0.5 text-xs text-muted-foreground">
            inkl. Ø Zeit bis zur ersten Reaktion
          </p>
          <div className="mt-3 overflow-x-auto">
            {data.bearbeiterRows.length === 0 ? (
              <p className="text-sm text-muted-foreground">Noch keine bearbeiteten Leads.</p>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-xs text-muted-foreground">
                    <th className="py-1.5 pr-3 font-medium">Bearbeiter</th>
                    <th className="py-1.5 pr-3 font-medium">Leads</th>
                    <th className="py-1.5 pr-3 font-medium">aufgenommen</th>
                    <th className="py-1.5 font-medium">Ø Reaktion</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {data.bearbeiterRows.map(([name, b]) => (
                    <tr key={name}>
                      <td className="py-1.5 pr-3 font-medium">{name}</td>
                      <td className="py-1.5 pr-3">
                        <div className="flex items-center gap-2">
                          <div className="h-4 w-24 shrink-0">
                            <div
                              className="h-full rounded-r-[4px]"
                              style={{ width: `${(b.total / maxBearb) * 100}%`, background: "var(--f3)", minWidth: 4 }}
                            />
                          </div>
                          <span className="tabular-nums">{b.total}</span>
                        </div>
                      </td>
                      <td className="py-1.5 pr-3 tabular-nums">{b.aufgenommen}</td>
                      <td className="py-1.5 whitespace-nowrap">
                        {avg(b.zeiten) != null ? fmtMin(avg(b.zeiten)!) : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </section>
      </div>

      {/* PDL-Übergaben */}
      <section className="rounded-xl border bg-card p-4 shadow-sm">
        <h2 className="text-sm font-semibold">PDL-Übergaben je Standort</h2>
        <p className="mt-0.5 text-xs text-muted-foreground">
          Liegezeit = Übergabe bis Rückmeldung der PDL; offene Übergaben über
          48 Std sind markiert.
        </p>
        {data.hubVerteilung.length > 0 && (
          <div className="mt-3 flex flex-col items-start gap-4 sm:flex-row sm:items-center">
            <PieChart data={data.hubVerteilung} />
            <div className="flex flex-col gap-1">
              <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                Leads nach Standort
              </p>
              {data.hubVerteilung.map((s, i) => {
                const total = data.hubVerteilung.reduce((a, b) => a + b.value, 0);
                return (
                  <p key={s.label} className="flex items-center gap-1.5 text-xs">
                    <span
                      className="size-2.5 rounded-[3px]"
                      style={{ background: `var(${PIE_VARS[i]})` }}
                    />
                    {s.label}
                    <span className="font-semibold tabular-nums">{s.value}</span>
                    <span className="text-muted-foreground tabular-nums">
                      ({pct(s.value, total)})
                    </span>
                  </p>
                );
              })}
            </div>
          </div>
        )}
        <div className="mt-3 overflow-x-auto">
          {data.hubRows.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Im Zeitraum wurden keine Leads an PDLs übergeben.
            </p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-xs text-muted-foreground">
                  <th className="py-1.5 pr-3 font-medium">Standort (PDL)</th>
                  <th className="py-1.5 pr-3 font-medium">übergeben</th>
                  <th className="py-1.5 pr-3 font-medium">bestätigt</th>
                  <th className="py-1.5 pr-3 font-medium">Ø Liegezeit</th>
                  <th className="py-1.5 font-medium">noch offen</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {data.hubRows.map(([hub, h]) => {
                  const spaet = h.aeltesteOffen > 48 * 3_600_000;
                  return (
                    <tr key={hub}>
                      <td className="py-1.5 pr-3">
                        <span className="font-medium">{hub}</span>
                        {hubPdl[hub] && (
                          <span className="ml-1.5 text-xs text-muted-foreground">{hubPdl[hub]}</span>
                        )}
                      </td>
                      <td className="py-1.5 pr-3">
                        <div className="flex items-center gap-2">
                          <div className="h-4 w-28 shrink-0">
                            <div
                              className="h-full rounded-r-[4px]"
                              style={{ width: `${(h.uebergeben / maxHub) * 100}%`, background: "var(--f3)", minWidth: 4 }}
                            />
                          </div>
                          <span className="tabular-nums">{h.uebergeben}</span>
                        </div>
                      </td>
                      <td className="py-1.5 pr-3 tabular-nums">
                        {h.bestaetigt}
                        <span className="ml-1 text-xs text-muted-foreground">
                          ({pct(h.bestaetigt, h.uebergeben)})
                        </span>
                      </td>
                      <td className="py-1.5 pr-3 whitespace-nowrap">
                        {avg(h.liegezeiten) != null ? fmtMin(avg(h.liegezeiten)!) : "—"}
                      </td>
                      <td className="py-1.5 whitespace-nowrap tabular-nums">
                        {h.offen === 0 ? (
                          <span className="text-muted-foreground">0</span>
                        ) : spaet ? (
                          <span className="font-semibold" style={{ color: "var(--viz-crit)" }}>
                            ⚠ {h.offen} (wartet {fmtMin(h.aeltesteOffen)})
                          </span>
                        ) : (
                          <span>
                            {h.offen}
                            <span className="ml-1 text-xs text-muted-foreground">
                              (wartet {fmtMin(h.aeltesteOffen)})
                            </span>
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </section>

      {/* Outbound-Anrufe */}
      <section className="rounded-xl border bg-card p-4 shadow-sm">
        <h2 className="text-sm font-semibold">Outbound-Anrufe — wer hat telefoniert?</h2>
        <p className="mt-0.5 text-xs text-muted-foreground">
          Aus dem Anruf-Log der Outbound-Listen (beide Teams). Erreicht-Quote
          aus der Erreicht?/Nicht-erreicht-Abfrage beim Loggen.
        </p>
        {data.callerRows.length === 0 ? (
          <p className="mt-3 text-sm text-muted-foreground">
            Im Zeitraum wurden keine Outbound-Anrufe geloggt.
          </p>
        ) : (
          <>
            <div className="mt-3 overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-xs text-muted-foreground">
                    <th className="py-1.5 pr-3 font-medium">Bearbeiter</th>
                    <th className="py-1.5 pr-3 font-medium">Anrufe</th>
                    <th className="py-1.5 pr-3 font-medium">erreicht</th>
                    <th className="py-1.5 pr-3 font-medium">nicht erreicht</th>
                    <th className="py-1.5 font-medium">Erreicht-Quote</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {data.callerRows.map(([name, s]) => {
                    const maxCalls = Math.max(1, ...data.callerRows.map(([, x]) => x.total));
                    return (
                      <tr key={name}>
                        <td className="py-1.5 pr-3 font-medium">{name}</td>
                        <td className="py-1.5 pr-3">
                          <div className="flex items-center gap-2">
                            <div className="h-4 w-24 shrink-0">
                              <div
                                className="h-full rounded-r-[4px]"
                                style={{
                                  width: `${(s.total / maxCalls) * 100}%`,
                                  background: "var(--f3)",
                                  minWidth: 4,
                                }}
                              />
                            </div>
                            <span className="tabular-nums">{s.total}</span>
                          </div>
                        </td>
                        <td className="py-1.5 pr-3 tabular-nums text-emerald-700">{s.erreicht}</td>
                        <td className="py-1.5 pr-3 tabular-nums text-muted-foreground">{s.nicht}</td>
                        <td className="py-1.5 tabular-nums">{pct(s.erreicht, s.total)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <details className="mt-2">
              <summary className="cursor-pointer text-xs text-muted-foreground select-none">
                Alle Anrufe im Zeitraum anzeigen ({data.anrufeInRange.length}) — mit Ergebnis
              </summary>
              <ul className="mt-2 divide-y">
                {data.anrufeInRange.slice(0, 100).map((a, i) => {
                  const nicht = /^nicht erreicht/i.test(a.note ?? "");
                  return (
                    <li key={i} className="flex flex-wrap items-center gap-x-3 gap-y-0.5 py-1.5 text-sm">
                      <span className="w-20 shrink-0 text-xs text-muted-foreground tabular-nums">
                        {a.datum.split("-").reverse().slice(0, 2).join(".") + "."}
                      </span>
                      <span className="font-medium">{a.ziel}</span>
                      <span
                        className={cn(
                          "rounded-full px-2 py-0.5 text-[11px] font-semibold",
                          nicht
                            ? "bg-red-100 text-red-800"
                            : "bg-emerald-100 text-emerald-800",
                        )}
                      >
                        {nicht ? "nicht erreicht" : "erreicht"}
                      </span>
                      {a.ansprechpartner && (
                        <span className="text-xs text-muted-foreground">
                          mit {a.ansprechpartner}
                        </span>
                      )}
                      {a.note && (
                        <span className="text-xs text-muted-foreground">
                          {a.note.replace(/^nicht erreicht(\s*—\s*)?/i, "") || "—"}
                        </span>
                      )}
                      <span className="ml-auto text-xs text-muted-foreground">
                        {a.bearbeiter}
                      </span>
                    </li>
                  );
                })}
                {data.anrufeInRange.length > 100 && (
                  <li className="py-1.5 text-center text-xs text-muted-foreground">
                    +{data.anrufeInRange.length - 100} weitere — Zeitraum enger wählen
                  </li>
                )}
              </ul>
            </details>
          </>
        )}
      </section>
    </div>
  );
}

/* Pie-Slices nutzen dieselbe validierte kategoriale Palette wie der Kanal-Chart. */
const PIE_VARS = ["--c-meta", "--c-website", "--c-0800", "--c-recare", "--c-agentur", "--c-andere"] as const;

/** Donut-Pie (SVG) für "Leads nach Standort" — max. 5 Segmente + "Andere". */
function PieChart({ data }: { data: { label: string; value: number }[] }) {
  const total = data.reduce((a, b) => a + b.value, 0);
  if (!total) return null;
  const R = 56;
  const C = 64;
  const anteile = data.map((s) => s.value / total);
  const arcs = data.map((s, i) => {
    const anteil = anteile[i];
    const offset = anteile.slice(0, i).reduce((a, b) => a + b, 0);
    const start = -Math.PI / 2 + offset * Math.PI * 2;
    const end = start + anteil * Math.PI * 2;
    const x1 = C + R * Math.cos(start);
    const y1 = C + R * Math.sin(start);
    const x2 = C + R * Math.cos(end);
    const y2 = C + R * Math.sin(end);
    const gross = anteil > 0.5 ? 1 : 0;
    // Voll-Kreis (nur ein Segment) braucht zwei Halbbögen
    const d =
      anteil >= 0.999
        ? `M${C - R},${C} A${R},${R} 0 1 1 ${C + R},${C} A${R},${R} 0 1 1 ${C - R},${C}`
        : `M${C},${C} L${x1},${y1} A${R},${R} 0 ${gross} 1 ${x2},${y2} Z`;
    return { d, var: PIE_VARS[i] ?? "--c-andere", label: s.label, value: s.value };
  });
  return (
    <svg
      viewBox="0 0 128 128"
      className="size-32 shrink-0"
      role="img"
      aria-label="Leads nach Standort"
    >
      {arcs.map((a) => (
        <path
          key={a.label}
          d={a.d}
          fill={`var(${a.var})`}
          stroke="#fff"
          strokeWidth={2}
        >
          <title>{`${a.label}: ${a.value}`}</title>
        </path>
      ))}
      {/* Donut-Loch */}
      <circle cx={C} cy={C} r={26} fill="var(--card, #fff)" />
      <text
        x={C}
        y={C + 4}
        textAnchor="middle"
        fontSize={16}
        fontWeight={700}
        fill="currentColor"
      >
        {total}
      </text>
    </svg>
  );
}

/** Gestapelter Balken-Chart (SVG) mit Hover-Tooltip pro Tag/Woche. */
function StackedBars({
  buckets,
}: {
  buckets: { label: string; counts: Record<ChannelKey, number>; total: number }[];
}) {
  const [hover, setHover] = useState<number | null>(null);
  const W = 720;
  const H = 200;
  const PAD_L = 26;
  const PAD_B = 18;
  const PAD_T = 6;
  const plotW = W - PAD_L - 4;
  const plotH = H - PAD_T - PAD_B;
  const max = Math.max(1, ...buckets.map((b) => b.total));
  // "schöne" Obergrenze für die Gridlines
  const niceMax = max <= 5 ? 5 : Math.ceil(max / 5) * 5;
  const k = plotH / niceMax;
  const n = buckets.length;
  const slot = plotW / Math.max(1, n);
  const barW = Math.max(3, Math.min(28, slot * 0.7));
  const GAP = 1.5;
  const labelEvery = Math.max(1, Math.ceil(n / 8));

  if (buckets.every((b) => b.total === 0)) {
    return (
      <p className="mt-3 text-sm text-muted-foreground">Noch keine Leads im Zeitraum.</p>
    );
  }

  return (
    <div className="relative mt-3">
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label="Leads pro Tag nach Kanal">
        {/* Gridlines + Y-Beschriftung */}
        {[0, 0.5, 1].map((f) => {
          const y = PAD_T + plotH - f * niceMax * k;
          return (
            <g key={f}>
              <line x1={PAD_L} x2={W - 2} y1={y} y2={y} stroke={f === 0 ? "var(--viz-axis)" : "var(--viz-grid)"} strokeWidth={1} />
              <text x={PAD_L - 5} y={y + 3} textAnchor="end" fontSize={9} fill="var(--c-andere)">
                {Math.round(f * niceMax)}
              </text>
            </g>
          );
        })}
        {buckets.map((b, i) => {
          const x = PAD_L + i * slot + (slot - barW) / 2;
          let bottom = PAD_T + plotH;
          const segs = CHANNELS.filter((c) => b.counts[c.key] > 0);
          return (
            <g key={i}>
              {segs.map((c, si) => {
                const hPx = b.counts[c.key] * k;
                const isTop = si === segs.length - 1;
                const segBottom = bottom - (si > 0 ? GAP : 0);
                const segTop = bottom - hPx;
                bottom = segTop;
                const hh = Math.max(0.75, segBottom - segTop);
                if (isTop) {
                  const r = Math.min(4, barW / 2, hh);
                  return (
                    <path
                      key={c.key}
                      d={`M${x},${segTop + hh} L${x},${segTop + r} Q${x},${segTop} ${x + r},${segTop} L${x + barW - r},${segTop} Q${x + barW},${segTop} ${x + barW},${segTop + r} L${x + barW},${segTop + hh} Z`}
                      fill={`var(${c.varName})`}
                    />
                  );
                }
                return (
                  <rect key={c.key} x={x} y={segTop} width={barW} height={hh} fill={`var(${c.varName})`} />
                );
              })}
              {/* Hover-Fläche über die volle Spalte (größer als der Balken) */}
              <rect
                x={PAD_L + i * slot}
                y={PAD_T}
                width={slot}
                height={plotH}
                fill="transparent"
                onMouseEnter={() => setHover(i)}
                onMouseLeave={() => setHover(null)}
              />
              {i % labelEvery === 0 && (
                <text
                  x={PAD_L + i * slot + slot / 2}
                  y={H - 5}
                  textAnchor="middle"
                  fontSize={9}
                  fill="var(--c-andere)"
                >
                  {b.label}
                </text>
              )}
            </g>
          );
        })}
      </svg>
      {hover != null && buckets[hover] && (
        <div
          className="pointer-events-none absolute top-0 z-10 w-44 -translate-x-1/2 rounded-lg border bg-card p-2 text-xs shadow-md"
          style={{
            left: `${((PAD_L + hover * slot + slot / 2) / W) * 100}%`,
          }}
        >
          <p className="font-semibold">{buckets[hover].label}</p>
          {CHANNELS.filter((c) => buckets[hover].counts[c.key] > 0).map((c) => (
            <p key={c.key} className="mt-0.5 flex items-center gap-1.5">
              <span className="size-2 rounded-[2px]" style={{ background: `var(${c.varName})` }} />
              {c.label}
              <span className="ml-auto font-semibold tabular-nums">{buckets[hover].counts[c.key]}</span>
            </p>
          ))}
          <p className="mt-1 border-t pt-1 font-semibold">
            Gesamt <span className="float-right tabular-nums">{buckets[hover].total}</span>
          </p>
        </div>
      )}
    </div>
  );
}
