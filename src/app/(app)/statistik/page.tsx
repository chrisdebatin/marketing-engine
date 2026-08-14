import Link from "next/link";
import { Phone, PhoneIncoming, PhoneMissed, PhoneOutgoing, TrendingUp } from "lucide-react";
import { requireSession } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { CallUpload } from "@/components/call-upload";
import { PageHeader } from "@/components/page-header";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

/** Montag der Woche eines ISO-Datums (JJJJ-MM-TT). */
function mondayOf(iso: string): string {
  const d = new Date(`${iso}T00:00:00`);
  const day = (d.getDay() + 6) % 7; // Mo=0 … So=6
  d.setDate(d.getDate() - day);
  return d.toISOString().slice(0, 10);
}

function shortDate(iso: string): string {
  const d = new Date(`${iso}T00:00:00`);
  return d.toLocaleDateString("de-DE", { day: "numeric", month: "numeric" });
}

/**
 * Anruf-Tracking auf Basis der Telefonanlagen-Exporte (CSV-Upload):
 * eingehende Anrufe pro Woche und je Standort, inkl. verpasster Anrufe.
 */
export default async function StatistikPage({
  searchParams,
}: {
  searchParams: Promise<{ wochen?: string }>;
}) {
  await requireSession();
  const params = await searchParams;
  const weeks = [4, 8, 12].includes(Number(params.wochen))
    ? Number(params.wochen)
    : 8;

  const thisMonday = mondayOf(new Date().toISOString().slice(0, 10));
  const weekStarts: string[] = [];
  for (let i = weeks - 1; i >= 0; i--) {
    const d = new Date(`${thisMonday}T00:00:00`);
    d.setDate(d.getDate() - i * 7);
    weekStarts.push(d.toISOString().slice(0, 10));
  }
  const cutoff = weekStarts[0];

  const admin = createAdminClient();
  const { data: callRows, error: callErr } = await admin
    .from("phone_calls")
    .select("call_time, hub_name, direction, answered")
    .gte("call_time", `${cutoff}T00:00:00`);
  const tableMissing =
    callErr?.code === "PGRST205" || callErr?.code === "42P01";
  const calls = callRows ?? [];

  // Wochen-Reihe: eingehende Anrufe (Chart) + verpasste je Woche.
  const byWeek = new Map<string, { inbound: number; missed: number }>(
    weekStarts.map((w) => [w, { inbound: 0, missed: 0 }]),
  );
  const byHub = new Map<
    string,
    { inbound: number; answered: number; missed: number; outbound: number }
  >();
  for (const c of calls) {
    const day = c.call_time.slice(0, 10);
    const hubKey = c.hub_name ?? "Nicht zugeordnet";
    const h =
      byHub.get(hubKey) ?? { inbound: 0, answered: 0, missed: 0, outbound: 0 };
    if (c.direction === "inbound") {
      const w = byWeek.get(mondayOf(day));
      if (w) {
        w.inbound++;
        if (!c.answered) w.missed++;
      }
      h.inbound++;
      if (c.answered) h.answered++;
      else h.missed++;
    } else if (c.direction === "outbound") {
      h.outbound++;
    }
    byHub.set(hubKey, h);
  }

  const series = weekStarts.map((w) => ({
    week: w,
    label: shortDate(w),
    value: byWeek.get(w)?.inbound ?? 0,
  }));
  const maxValue = Math.max(1, ...series.map((s) => s.value));
  const maxIdx = series.reduce(
    (best, s, i) => (s.value > series[best].value ? i : best),
    0,
  );
  const totalIn = calls.filter((c) => c.direction === "inbound").length;
  const totalMissed = calls.filter(
    (c) => c.direction === "inbound" && !c.answered,
  ).length;
  const totalOut = calls.filter((c) => c.direction === "outbound").length;
  const dieseWoche = series[series.length - 1]?.value ?? 0;

  const hubRows = [...byHub.entries()]
    .map(([name, v]) => ({ name, ...v }))
    .sort((a, b) => b.inbound - a.inbound || a.name.localeCompare(b.name, "de"));

  return (
    <div className="flex flex-col gap-6">
      {/* Chart-Farbtoken: validierte Referenz-Palette, hell + dunkel */}
      <style>{`
        .viz-root { --series-1: #2a78d6; }
        @media (prefers-color-scheme: dark) {
          .viz-root { --series-1: #3987e5; }
        }
      `}</style>

      <PageHeader
        title="Statistik · Anrufe"
        description="Alle Anrufe der Standorte — Datenbasis ist der CSV-Export der Telefonanlage, den du unten hochlädst. Zuordnung zum Standort über den Telefon-Trunk; interne Gespräche zählen nicht."
      />

      <CallUpload />

      {tableMissing ? (
        <p className="rounded-xl border bg-card p-5 text-sm text-muted-foreground shadow-sm">
          Die Tabelle <code>phone_calls</code> fehlt noch — bitte einmal{" "}
          <code>supabase/apply_all_pending.sql</code> im Supabase SQL-Editor
          ausführen, dann die CSV hochladen.
        </p>
      ) : calls.length === 0 ? (
        <p className="rounded-xl border bg-card p-5 text-sm text-muted-foreground shadow-sm">
          Noch keine Anruf-Daten im Zeitraum — oben den CSV-Export hochladen.
        </p>
      ) : (
        <>
          {/* Zeitraum */}
          <div className="flex items-center gap-1.5">
            {[4, 8, 12].map((w) => (
              <Link
                key={w}
                href={`/statistik?wochen=${w}`}
                className={cn(
                  "rounded-full border px-3 py-1 text-sm font-medium transition-colors",
                  weeks === w
                    ? "border-primary bg-primary/10 text-primary"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                {w} Wochen
              </Link>
            ))}
          </div>

          {/* Kennzahlen */}
          <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
            {(
              [
                [PhoneIncoming, dieseWoche, "Eingehend diese Woche"],
                [PhoneIncoming, totalIn, `Eingehend gesamt (${weeks} Wo.)`],
                [
                  PhoneMissed,
                  totalMissed,
                  `Verpasst (${totalIn > 0 ? Math.round((totalMissed / totalIn) * 100) : 0} %)`,
                ],
                [PhoneOutgoing, totalOut, "Ausgehend gesamt"],
              ] as const
            ).map(([Icon, value, label]) => (
              <div
                key={label}
                className="flex items-center gap-2.5 rounded-lg border bg-card px-3 py-2.5"
              >
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
            ))}
          </div>

          {/* Säulen-Chart: eingehende Anrufe pro Woche (eine Serie) */}
          <section className="viz-root flex flex-col gap-3 rounded-xl border bg-card p-5 shadow-sm">
            <p className="flex items-center gap-1.5 font-semibold">
              <TrendingUp className="size-4 text-primary" />
              Eingehende Anrufe pro Woche
            </p>
            <div
              className="grid items-end gap-2"
              style={{
                gridTemplateColumns: `repeat(${series.length}, minmax(0, 1fr))`,
                height: "11rem",
              }}
              role="img"
              aria-label={`Eingehende Anrufe pro Woche, letzte ${weeks} Wochen`}
            >
              {series.map((s, i) => {
                const isLatest = i === series.length - 1;
                const showLabel = s.value > 0 && (isLatest || i === maxIdx);
                return (
                  <div
                    key={s.week}
                    className="flex h-full flex-col items-center justify-end gap-1"
                    title={`Woche ab ${shortDate(s.week)}: ${s.value} Anruf${s.value === 1 ? "" : "e"}`}
                  >
                    {showLabel && (
                      <span className="text-xs font-semibold tabular-nums">
                        {s.value}
                      </span>
                    )}
                    <div
                      className="w-full max-w-6 rounded-t-[4px]"
                      style={{
                        height: `${Math.max(s.value === 0 ? 2 : 6, (s.value / maxValue) * 100)}%`,
                        backgroundColor:
                          s.value === 0 ? "transparent" : "var(--series-1)",
                        borderBottom:
                          s.value === 0 ? "2px solid var(--border)" : undefined,
                        opacity: isLatest ? 1 : 0.85,
                      }}
                    />
                  </div>
                );
              })}
            </div>
            <div
              className="grid gap-2 border-t pt-1.5"
              style={{
                gridTemplateColumns: `repeat(${series.length}, minmax(0, 1fr))`,
              }}
            >
              {series.map((s) => (
                <span
                  key={s.week}
                  className="text-center text-[0.65rem] text-muted-foreground tabular-nums"
                >
                  {s.label}
                </span>
              ))}
            </div>
            <p className="text-xs text-muted-foreground">
              Laufende Woche ist die letzte Säule. Werte an höchster und
              aktueller Säule; alle Werte per Mouse-over und in der Tabelle
              unten.
            </p>
          </section>

          {/* Tabellen-Ansicht: je Standort */}
          <section className="flex flex-col gap-2 rounded-xl border bg-card p-5 shadow-sm">
            <p className="flex items-center gap-1.5 font-semibold">
              <Phone className="size-4 text-primary" />
              Je Standort (letzte {weeks} Wochen)
            </p>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[520px] text-sm">
                <thead>
                  <tr className="border-b text-left text-xs text-muted-foreground">
                    <th className="py-1.5 pr-2 font-medium">Standort</th>
                    <th className="px-2 py-1.5 font-medium">Eingehend</th>
                    <th className="px-2 py-1.5 font-medium">Angenommen</th>
                    <th className="px-2 py-1.5 font-medium">Verpasst</th>
                    <th className="px-2 py-1.5 font-medium">Ausgehend</th>
                  </tr>
                </thead>
                <tbody>
                  {hubRows.map((r) => (
                    <tr key={r.name} className="border-b last:border-b-0">
                      <td className="py-1.5 pr-2 font-medium">{r.name}</td>
                      <td className="px-2 py-1.5 font-semibold tabular-nums">
                        {r.inbound}
                      </td>
                      <td className="px-2 py-1.5 tabular-nums">{r.answered}</td>
                      <td
                        className={cn(
                          "px-2 py-1.5 tabular-nums",
                          r.missed > 0 && "font-medium text-destructive",
                        )}
                      >
                        {r.missed}
                      </td>
                      <td className="px-2 py-1.5 tabular-nums">{r.outbound}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </>
      )}
    </div>
  );
}
