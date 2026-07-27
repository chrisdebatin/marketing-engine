import Link from "next/link";
import { Phone, TrendingUp } from "lucide-react";
import { requireSession } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { kontaktArtLabel } from "@/lib/crm";
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
 * Tracking-Dashboard: geloggte Anrufe pro Woche (Trend) und je Standort —
 * plus Kontext über die übrigen Kontakt-Arten. Zeitraum wählbar.
 */
export default async function StatistikPage({
  searchParams,
}: {
  searchParams: Promise<{ wochen?: string }>;
}) {
  const session = await requireSession();
  const params = await searchParams;
  const weeks = [4, 8, 12].includes(Number(params.wochen))
    ? Number(params.wochen)
    : 8;

  // Wochen-Raster: die letzten `weeks` Wochen inkl. laufender Woche.
  const thisMonday = mondayOf(new Date().toISOString().slice(0, 10));
  const weekStarts: string[] = [];
  for (let i = weeks - 1; i >= 0; i--) {
    const d = new Date(`${thisMonday}T00:00:00`);
    d.setDate(d.getDate() - i * 7);
    weekStarts.push(d.toISOString().slice(0, 10));
  }
  const cutoff = weekStarts[0];

  const admin = createAdminClient();
  const { data: contactRows } = await admin
    .from("crm_contacts")
    .select("hub_id, kontakt_art, contact_date")
    .gte("contact_date", cutoff);
  const contacts = contactRows ?? [];

  // Anrufe je Woche (Chart) + alle Arten je Hub (Tabelle).
  const anrufeByWeek = new Map<string, number>(weekStarts.map((w) => [w, 0]));
  const byHub = new Map<
    string,
    { anruf: number; box: number; besuch: number; flyer: number }
  >();
  for (const c of contacts) {
    if (c.kontakt_art === "anruf") {
      const w = mondayOf(c.contact_date);
      if (anrufeByWeek.has(w)) {
        anrufeByWeek.set(w, (anrufeByWeek.get(w) ?? 0) + 1);
      }
    }
    if (c.hub_id) {
      const s =
        byHub.get(c.hub_id) ?? { anruf: 0, box: 0, besuch: 0, flyer: 0 };
      if (c.kontakt_art === "anruf") s.anruf++;
      else if (c.kontakt_art === "box") s.box++;
      else if (c.kontakt_art === "flyer") s.flyer++;
      else s.besuch++;
      byHub.set(c.hub_id, s);
    }
  }

  const series = weekStarts.map((w) => ({
    week: w,
    label: shortDate(w),
    value: anrufeByWeek.get(w) ?? 0,
  }));
  const maxValue = Math.max(1, ...series.map((s) => s.value));
  const total = series.reduce((sum, s) => sum + s.value, 0);
  const dieseWoche = series[series.length - 1]?.value ?? 0;
  const letzteWoche = series[series.length - 2]?.value ?? 0;
  const schnitt = Math.round((total / weeks) * 10) / 10;
  const maxIdx = series.reduce(
    (best, s, i) => (s.value > series[best].value ? i : best),
    0,
  );

  const hubRows = session.hubs
    .map((h) => ({
      name: h.name,
      ...(byHub.get(h.id) ?? { anruf: 0, box: 0, besuch: 0, flyer: 0 }),
    }))
    .map((r) => ({ ...r, gesamt: r.anruf + r.box + r.besuch + r.flyer }))
    .filter((r) => r.gesamt > 0)
    .sort((a, b) => b.anruf - a.anruf || b.gesamt - a.gesamt);
  const ohneAktivitaet = session.hubs.length - hubRows.length;

  return (
    <div className="flex flex-col gap-6">
      {/* Chart-Farbtoken: validierte Referenz-Palette, hell + dunkel */}
      <style>{`
        .viz-root { --series-1: #2a78d6; }
        @media (prefers-color-scheme: dark) {
          .viz-root { --series-1: #3987e5; }
        }
      `}</style>

      <div>
        <h1 className="text-2xl font-semibold">Statistik · Anrufe</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Von den PDLs geloggte Anrufe — Trend pro Woche und je Standort.
          Datenbasis ist das Kontakt-Log (Schnell-Log &amp; Kontakt-Formular).
        </p>
      </div>

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
            [dieseWoche, "Anrufe diese Woche"],
            [letzteWoche, "Anrufe letzte Woche"],
            [total, `Anrufe gesamt (${weeks} Wochen)`],
            [schnitt, "Ø pro Woche"],
          ] as const
        ).map(([value, label]) => (
          <div
            key={label}
            className="flex items-center gap-2.5 rounded-lg border bg-card px-3 py-2.5"
          >
            <span className="flex size-8 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
              <Phone className="size-4" />
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

      {/* Säulen-Chart: Anrufe pro Woche (eine Serie → keine Legende) */}
      <section className="viz-root flex flex-col gap-3 rounded-xl border bg-card p-5 shadow-sm">
        <p className="flex items-center gap-1.5 font-semibold">
          <TrendingUp className="size-4 text-primary" />
          Anrufe pro Woche
        </p>
        <div
          className="grid items-end gap-2"
          style={{
            gridTemplateColumns: `repeat(${series.length}, minmax(0, 1fr))`,
            height: "11rem",
          }}
          role="img"
          aria-label={`Anrufe pro Woche, letzte ${weeks} Wochen`}
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
          Laufende Woche ist die letzte Säule. Werte an höchster und aktueller
          Säule; alle Werte per Mouse-over und in der Tabelle unten.
        </p>
      </section>

      {/* Tabellen-Ansicht: je Standort, Anrufe zuerst */}
      <section className="flex flex-col gap-2 rounded-xl border bg-card p-5 shadow-sm">
        <p className="font-semibold">
          Je Standort (letzte {weeks} Wochen)
        </p>
        {hubRows.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Im Zeitraum wurden noch keine Kontakte geloggt.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[520px] text-sm">
              <thead>
                <tr className="border-b text-left text-xs text-muted-foreground">
                  <th className="py-1.5 pr-2 font-medium">Standort</th>
                  <th className="px-2 py-1.5 font-medium">
                    {kontaktArtLabel("anruf")}e
                  </th>
                  <th className="px-2 py-1.5 font-medium">Boxen</th>
                  <th className="px-2 py-1.5 font-medium">Besuche</th>
                  <th className="px-2 py-1.5 font-medium">Flyer</th>
                  <th className="px-2 py-1.5 font-medium">Gesamt</th>
                </tr>
              </thead>
              <tbody>
                {hubRows.map((r) => (
                  <tr key={r.name} className="border-b last:border-b-0">
                    <td className="py-1.5 pr-2 font-medium">{r.name}</td>
                    <td className="px-2 py-1.5 font-semibold tabular-nums">
                      {r.anruf}
                    </td>
                    <td className="px-2 py-1.5 tabular-nums">{r.box}</td>
                    <td className="px-2 py-1.5 tabular-nums">{r.besuch}</td>
                    <td className="px-2 py-1.5 tabular-nums">{r.flyer}</td>
                    <td className="px-2 py-1.5 tabular-nums">{r.gesamt}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {ohneAktivitaet > 0 && (
          <p className="text-xs text-muted-foreground">
            {ohneAktivitaet} Standort{ohneAktivitaet === 1 ? "" : "e"} ohne
            geloggte Kontakte im Zeitraum.
          </p>
        )}
      </section>
    </div>
  );
}
