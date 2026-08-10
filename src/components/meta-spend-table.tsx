import { Wallet } from "lucide-react";
import { metaAdAccountId, metaConfigured, metaFetch } from "@/lib/meta-api";

interface InsightRow {
  campaign_name?: string;
  spend?: string;
}

const euro = (n: number) =>
  n.toLocaleString("de-DE", { style: "currency", currency: "EUR" });

const iso = (d: Date) => d.toISOString().slice(0, 10);

/**
 * Ausgaben-Tabelle: Spend je Kampagne und gesamt über vier Zeiträume
 * (heute, letzte 7 Tage inkl. heute, laufender Monat, Lifetime) — live
 * aus der Meta-API bei jedem Seitenaufruf.
 */
export async function MetaSpendTable() {
  if (!metaConfigured()) return null;

  const now = new Date();
  const today = iso(now);
  const sevenDaysAgo = iso(new Date(now.getTime() - 6 * 86400_000));
  const monthStart = today.slice(0, 8) + "01";

  const periods: { label: string; params: Record<string, string> }[] = [
    { label: "Heute", params: { time_range: JSON.stringify({ since: today, until: today }) } },
    {
      label: "7 Tage",
      params: { time_range: JSON.stringify({ since: sevenDaysAgo, until: today }) },
    },
    {
      label: "Monat",
      params: { time_range: JSON.stringify({ since: monthStart, until: today }) },
    },
    { label: "Gesamt", params: { date_preset: "maximum" } },
  ];

  const acct = metaAdAccountId();
  let results: InsightRow[][];
  try {
    results = await Promise.all(
      periods.map(async (p) => {
        const r = await metaFetch(`${acct}/insights`, {
          level: "campaign",
          fields: "campaign_name,spend",
          limit: "100",
          ...p.params,
        });
        return (r.data ?? []) as InsightRow[];
      }),
    );
  } catch {
    return null; // Kampagnen-Übersicht oben meldet API-Fehler bereits
  }

  // je Kampagne: Spend pro Zeitraum-Spalte
  const byCampaign = new Map<string, number[]>();
  const totals = periods.map(() => 0);
  results.forEach((rows, col) => {
    for (const r of rows) {
      const name = r.campaign_name ?? "?";
      const spend = Number(r.spend) || 0;
      if (!byCampaign.has(name)) byCampaign.set(name, periods.map(() => 0));
      byCampaign.get(name)![col] = spend;
      totals[col] += spend;
    }
  });
  if (byCampaign.size === 0) return null;

  const sorted = [...byCampaign.entries()].sort(
    (a, b) => b[1][periods.length - 1] - a[1][periods.length - 1],
  );

  return (
    <section className="flex flex-col gap-3 border-t pt-5">
      <h2 className="flex items-center gap-2 text-lg font-semibold">
        <Wallet className="size-4 text-primary" />
        Ausgaben
      </h2>
      <div className="overflow-x-auto rounded-xl border bg-card shadow-sm">
        <table className="w-full min-w-[560px] text-sm">
          <thead>
            <tr className="border-b text-left text-xs text-muted-foreground">
              <th className="px-4 py-2.5 font-medium">Kampagne</th>
              {periods.map((p) => (
                <th key={p.label} className="px-4 py-2.5 text-right font-medium">
                  {p.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sorted.map(([name, spends]) => (
              <tr key={name} className="border-b last:border-0">
                <td className="max-w-[280px] truncate px-4 py-2" title={name}>
                  {name}
                </td>
                {spends.map((s, i) => (
                  <td
                    key={i}
                    className={
                      s > 0
                        ? "px-4 py-2 text-right tabular-nums"
                        : "px-4 py-2 text-right text-muted-foreground"
                    }
                  >
                    {s > 0 ? euro(s) : "—"}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="border-t bg-muted/40 font-semibold">
              <td className="px-4 py-2.5">Summe (alle Kampagnen)</td>
              {totals.map((t, i) => (
                <td key={i} className="px-4 py-2.5 text-right tabular-nums">
                  {euro(t)}
                </td>
              ))}
            </tr>
          </tfoot>
        </table>
      </div>
      <p className="text-xs text-muted-foreground">
        „7 Tage" und „Monat" jeweils inklusive heute. „Gesamt" = gesamte
        Laufzeit inkl. pausierter und alter Kampagnen.
      </p>
    </section>
  );
}
