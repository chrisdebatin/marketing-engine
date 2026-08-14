import { Baby, BedDouble, CalendarCheck, Wind } from "lucide-react";
import { requireSession } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  capacityWeekStart,
  SCORE_HINT,
  scoreClasses,
  type CapacityReport,
} from "@/lib/capacity";
import { formatIsoDate } from "@/lib/crm";
import { Badge } from "@/components/ui/badge";
import { CapacityFreetext } from "@/components/capacity-freetext";
import { PageHeader } from "@/components/page-header";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";
// Server-Actions dieser Seite rufen Claude auf — mehr Zeit als die 10s-Vorgabe.
export const maxDuration = 60;

/** Zeitpunkt der Meldung (deutsche Zeit), z. B. "04.08., 14:32". */
function meldungZeit(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleString("de-DE", {
    timeZone: "Europe/Berlin",
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function ScoreBadge({ value }: { value: number | null | undefined }) {
  if (value == null) return <span className="text-muted-foreground">—</span>;
  return (
    <span
      className={cn(
        "inline-flex size-6 items-center justify-center rounded-md text-xs font-semibold tabular-nums",
        scoreClasses(value),
      )}
    >
      {value}
    </span>
  );
}

function Stat({
  icon: Icon,
  value,
  label,
}: {
  icon: React.ComponentType<{ className?: string }>;
  value: number | string;
  label: string;
}) {
  return (
    <div className="flex items-center gap-2.5 rounded-lg border bg-card px-3 py-2.5">
      <span className="flex size-8 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
        <Icon className="size-4" />
      </span>
      <div className="min-w-0">
        <div className="text-lg leading-none font-semibold tabular-nums">
          {value}
        </div>
        <div className="mt-1 truncate text-xs text-muted-foreground">
          {label}
        </div>
      </div>
    </div>
  );
}

/**
 * Kapazitäts-Report: die wöchentlichen Meldungen der PDLs je Standort —
 * Grundlage, um Klinik-/Recare-Anfragen schnell (perspektivisch
 * automatisch) annehmen zu können.
 */
export default async function KapazitaetPage() {
  const session = await requireSession();
  const admin = createAdminClient();
  const week = capacityWeekStart();

  const { data: rows, error } = await admin
    .from("capacity_reports")
    .select("*")
    .order("week_start", { ascending: false });
  const tableMissing = error?.code === "PGRST205" || error?.code === "42P01";
  const reports = (rows ?? []) as CapacityReport[];

  const hubs = [...session.hubs].sort((a, b) =>
    a.name.localeCompare(b.name, "de"),
  );
  const byHub = new Map<string, CapacityReport[]>();
  for (const r of reports) {
    const arr = byHub.get(r.hub_id) ?? [];
    arr.push(r);
    byHub.set(r.hub_id, arr);
  }

  const hubRows = hubs.map((h) => {
    const list = byHub.get(h.id) ?? [];
    const latest = list[0] ?? null;
    const isCurrent = latest?.week_start === week;
    return { hub: h, latest, isCurrent, history: list.slice(0, 8) };
  });

  const gemeldet = hubRows.filter((r) => r.isCurrent).length;
  const withData = hubRows.filter((r) => r.latest);
  const freiGesamt = withData.reduce(
    (s, r) => s + (r.latest?.freie_plaetze ?? 0),
    0,
  );
  // Ø-Score je Leistungsbereich über die jeweils letzte Meldung je Standort.
  const avgScore = (
    key: "pflege_score" | "alltagshilfe_score" | "wundversorgung_score",
  ) => {
    const values = withData
      .map((r) => r.latest?.[key])
      .filter((v): v is number => typeof v === "number");
    if (values.length === 0) return "—";
    return (values.reduce((s, v) => s + v, 0) / values.length)
      .toFixed(1)
      .replace(".", ",");
  };

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Kapazitäts-Report"
        description={
          <>
            Wöchentliche Meldungen der PDLs (Woche ab {formatIsoDate(week)}) —
            freie Plätze, Beatmung, WG, Kinder und frühester Aufnahmetermin je
            Standort. Diese Daten sind die Grundlage, um Recare-/Klinik-Anfragen
            schnell und perspektivisch automatisch anzunehmen. Erinnerung an
            säumige PDLs: Kommunikation → „Kapazitäts-Erinnerung senden&rdquo;.
          </>
        }
      />

      {tableMissing ? (
        <p className="rounded-xl border bg-card p-5 text-sm text-muted-foreground shadow-sm">
          Die Tabelle <code>capacity_reports</code> fehlt noch — bitte einmal{" "}
          <code>supabase/apply_all_pending.sql</code> im Supabase SQL-Editor
          ausführen.
        </p>
      ) : (
        <>
          {/* Freitext-Eintrag: KI ordnet Zahlen den Standorten zu */}
          <CapacityFreetext />

          {/* Kennzahlen (Basis: jeweils letzte Meldung je Standort) */}
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
            <Stat
              icon={BedDouble}
              value={avgScore("pflege_score")}
              label="Ø Pflege (1–5)"
            />
            <Stat
              icon={Baby}
              value={avgScore("alltagshilfe_score")}
              label="Ø Alltagshilfe (1–5)"
            />
            <Stat
              icon={Wind}
              value={avgScore("wundversorgung_score")}
              label="Ø Wundversorgung (1–5)"
            />
            <Stat icon={BedDouble} value={freiGesamt} label="Freie Plätze gesamt" />
            <Stat
              icon={CalendarCheck}
              value={`${gemeldet}/${hubs.length}`}
              label="Diese Woche gemeldet"
            />
          </div>

          {/* Tabelle je Standort */}
          <section className="flex flex-col gap-2 rounded-xl border bg-card p-5 shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[760px] text-sm">
                <thead>
                  <tr className="border-b text-left text-xs text-muted-foreground">
                    <th className="py-1.5 pr-2 font-medium">Standort</th>
                    <th className="px-2 py-1.5 font-medium">Status</th>
                    <th className="px-2 py-1.5 font-medium">Pflege</th>
                    <th className="px-2 py-1.5 font-medium">Alltagshilfe</th>
                    <th className="px-2 py-1.5 font-medium">Wundversorgung</th>
                    <th className="px-2 py-1.5 font-medium">Aufnahme ab</th>
                    <th className="px-2 py-1.5 font-medium">Anmerkung</th>
                  </tr>
                </thead>
                <tbody>
                  {hubRows.map(({ hub, latest, isCurrent }) => (
                    <tr key={hub.id} className="border-b align-top last:border-b-0">
                      <td className="py-1.5 pr-2 font-medium">{hub.name}</td>
                      <td className="px-2 py-1.5">
                        {latest ? (
                          <Badge
                            variant="outline"
                            className={
                              isCurrent
                                ? "border-chart-4/40 bg-chart-4/10 text-chart-4"
                                : "border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-400"
                            }
                          >
                            {isCurrent
                              ? "aktuell"
                              : `Stand ${formatIsoDate(latest.week_start)}`}
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="text-muted-foreground">
                            keine Meldung
                          </Badge>
                        )}
                        {latest && meldungZeit(latest.updated_at) && (
                          <span className="mt-0.5 block text-[11px] text-muted-foreground tabular-nums">
                            gemeldet {meldungZeit(latest.updated_at)} Uhr
                          </span>
                        )}
                      </td>
                      <td className="px-2 py-1.5">
                        <ScoreBadge value={latest?.pflege_score} />
                      </td>
                      <td className="px-2 py-1.5">
                        <ScoreBadge value={latest?.alltagshilfe_score} />
                      </td>
                      <td className="px-2 py-1.5">
                        <ScoreBadge value={latest?.wundversorgung_score} />
                      </td>
                      <td className="px-2 py-1.5 tabular-nums">
                        {latest?.aufnahme_ab
                          ? formatIsoDate(latest.aufnahme_ab)
                          : "—"}
                      </td>
                      <td className="max-w-56 px-2 py-1.5 text-xs text-muted-foreground">
                        {latest?.notiz ?? ""}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="text-xs text-muted-foreground">
              Skala je Leistungsbereich: {SCORE_HINT}. Die gemeldeten
              Platz-Zahlen (Frei/Beatmung/WG/Kinder) stehen im Verlauf unten.
            </p>
          </section>

          {/* Verlauf je Standort */}
          <details className="group rounded-xl border bg-card shadow-sm">
            <summary className="flex cursor-pointer list-none items-center gap-2 p-5 font-semibold select-none">
              <BedDouble className="size-4 text-primary" />
              Verlauf (letzte Wochen je Standort)
              <span className="ml-auto text-xs font-normal text-muted-foreground group-open:hidden">
                aufklappen
              </span>
            </summary>
            <div className="grid gap-3 border-t p-5 lg:grid-cols-2 2xl:grid-cols-3">
              {hubRows
                .filter((r) => r.history.length > 0)
                .map(({ hub, history }) => (
                  <div key={hub.id} className="rounded-lg border p-3">
                    <p className="text-sm font-semibold">{hub.name}</p>
                    <ul className="mt-1 flex flex-col gap-0.5 text-xs text-muted-foreground">
                      {history.map((r) => (
                        <li key={r.id} className="tabular-nums">
                          {formatIsoDate(r.week_start)}:{" "}
                          {[
                            r.pflege_score != null
                              ? `Pflege ${r.pflege_score}`
                              : null,
                            r.alltagshilfe_score != null
                              ? `Alltagshilfe ${r.alltagshilfe_score}`
                              : null,
                            r.wundversorgung_score != null
                              ? `Wund ${r.wundversorgung_score}`
                              : null,
                            `${r.freie_plaetze} frei`,
                            r.beatmung_plaetze > 0
                              ? `${r.beatmung_plaetze} Beatmung`
                              : null,
                            r.wg_plaetze > 0 ? `${r.wg_plaetze} WG` : null,
                            r.aufnahme_ab
                              ? `ab ${formatIsoDate(r.aufnahme_ab)}`
                              : null,
                          ]
                            .filter(Boolean)
                            .join(" · ")}
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
            </div>
          </details>
        </>
      )}
    </div>
  );
}
