import { Timer } from "lucide-react";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Admin-Auswertung: Patienten-Übergaben an PDLs je Standort — wie viele,
 * wie viele bestätigt, wie schnell die Rückmeldung kam (Response-Zeit =
 * pdl_bestaetigt_at − zugewiesen_at), und was noch offen ist.
 */

interface Row {
  zugewiesen_hub_id: string | null;
  zugewiesen_at: string | null;
  pdl_bestaetigt_at: string | null;
  pdl_ergebnis: string | null;
}

function fmtDauer(ms: number): string {
  const h = ms / 3_600_000;
  if (h < 1) return `${Math.max(1, Math.round(ms / 60000))} Min`;
  if (h < 48) return `${h.toFixed(1).replace(".", ",")} Std`;
  return `${(h / 24).toFixed(1).replace(".", ",")} Tage`;
}

interface HubStats {
  uebergeben: number;
  bestaetigt: number;
  aufgenommen: number;
  offen: number;
  sumMs: number;
  maxOffenMs: number;
}

/** Aggregation außerhalb des Renderns (nutzt die aktuelle Uhrzeit). */
function aggregate(rows: Row[]): Map<string, HubStats> {
  const byHub = new Map<string, HubStats>();
  const now = Date.now();
  for (const r of rows) {
    const id = r.zugewiesen_hub_id!;
    const s =
      byHub.get(id) ??
      { uebergeben: 0, bestaetigt: 0, aufgenommen: 0, offen: 0, sumMs: 0, maxOffenMs: 0 };
    s.uebergeben += 1;
    const start = r.zugewiesen_at ? Date.parse(r.zugewiesen_at) : NaN;
    if (r.pdl_bestaetigt_at) {
      s.bestaetigt += 1;
      if (r.pdl_ergebnis?.startsWith("in Versorgung")) s.aufgenommen += 1;
      const end = Date.parse(r.pdl_bestaetigt_at);
      if (Number.isFinite(start) && Number.isFinite(end) && end > start) {
        s.sumMs += end - start;
      }
    } else {
      s.offen += 1;
      if (Number.isFinite(start)) s.maxOffenMs = Math.max(s.maxOffenMs, now - start);
    }
    byHub.set(id, s);
  }
  return byHub;
}

export async function CrmHandoverStats() {
  const admin = createAdminClient();
  const [{ data: calls, error: e1 }, { data: metas }, { data: hubs }] =
    await Promise.all([
      admin
        .from("lead_calls")
        .select("zugewiesen_hub_id, zugewiesen_at, pdl_bestaetigt_at, pdl_ergebnis")
        .not("zugewiesen_hub_id", "is", null),
      admin
        .from("meta_leads")
        .select("zugewiesen_hub_id, zugewiesen_at, pdl_bestaetigt_at, pdl_ergebnis")
        .not("zugewiesen_hub_id", "is", null),
      admin.from("hubs").select("id, name"),
    ]);
  // Migration 0054 fehlt noch → Sektion still weglassen.
  if (e1?.code === "42703" || e1?.code === "PGRST204") return null;

  const rows: Row[] = [...(calls ?? []), ...(metas ?? [])];
  if (rows.length === 0) return null;

  const byHub = aggregate(rows);

  const hubName = (id: string) => (hubs ?? []).find((h) => h.id === id)?.name ?? "?";
  const sorted = [...byHub.entries()].sort((a, b) => b[1].uebergeben - a[1].uebergeben);
  const totals = [...byHub.values()].reduce(
    (a, s) => ({
      uebergeben: a.uebergeben + s.uebergeben,
      bestaetigt: a.bestaetigt + s.bestaetigt,
      aufgenommen: a.aufgenommen + s.aufgenommen,
      offen: a.offen + s.offen,
      sumMs: a.sumMs + s.sumMs,
    }),
    { uebergeben: 0, bestaetigt: 0, aufgenommen: 0, offen: 0, sumMs: 0 },
  );

  return (
    <section className="flex flex-col gap-2 rounded-xl border bg-card p-5 shadow-sm">
      <p className="flex items-center gap-1.5 font-semibold">
        <Timer className="size-4 text-primary" />
        Patienten-Übergaben an PDLs (je Standort)
      </p>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[640px] text-sm">
          <thead>
            <tr className="border-b text-left text-xs text-muted-foreground">
              <th className="py-1.5 pr-2 font-medium">Standort</th>
              <th className="px-2 py-1.5 text-right font-medium">Übergeben</th>
              <th className="px-2 py-1.5 text-right font-medium">Aufgenommen</th>
              <th className="px-2 py-1.5 text-right font-medium">Offen</th>
              <th className="px-2 py-1.5 text-right font-medium">Ø Response</th>
              <th className="px-2 py-1.5 text-right font-medium">Längste offen</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map(([id, s]) => (
              <tr key={id} className="border-b last:border-b-0">
                <td className="py-1.5 pr-2 font-medium">{hubName(id)}</td>
                <td className="px-2 py-1.5 text-right tabular-nums">{s.uebergeben}</td>
                <td className="px-2 py-1.5 text-right tabular-nums">
                  {s.aufgenommen}
                  {s.bestaetigt > s.aufgenommen && (
                    <span className="text-xs text-muted-foreground">
                      {" "}
                      (+{s.bestaetigt - s.aufgenommen} nicht zustande)
                    </span>
                  )}
                </td>
                <td className="px-2 py-1.5 text-right tabular-nums">
                  {s.offen > 0 ? (
                    <span className="font-semibold text-amber-700">{s.offen}</span>
                  ) : (
                    "0"
                  )}
                </td>
                <td className="px-2 py-1.5 text-right tabular-nums">
                  {s.bestaetigt > 0 ? fmtDauer(s.sumMs / s.bestaetigt) : "—"}
                </td>
                <td className="px-2 py-1.5 text-right tabular-nums">
                  {s.offen > 0 ? (
                    <span
                      className={
                        s.maxOffenMs > 48 * 3_600_000
                          ? "font-semibold text-red-600"
                          : undefined
                      }
                    >
                      {fmtDauer(s.maxOffenMs)}
                    </span>
                  ) : (
                    "—"
                  )}
                </td>
              </tr>
            ))}
            <tr className="border-t bg-muted/40 font-semibold">
              <td className="py-1.5 pr-2">Gesamt</td>
              <td className="px-2 py-1.5 text-right tabular-nums">{totals.uebergeben}</td>
              <td className="px-2 py-1.5 text-right tabular-nums">{totals.aufgenommen}</td>
              <td className="px-2 py-1.5 text-right tabular-nums">{totals.offen}</td>
              <td className="px-2 py-1.5 text-right tabular-nums">
                {totals.bestaetigt > 0 ? fmtDauer(totals.sumMs / totals.bestaetigt) : "—"}
              </td>
              <td className="px-2 py-1.5" />
            </tr>
          </tbody>
        </table>
      </div>
      <p className="text-xs text-muted-foreground">
        Response = Zeit von der Übergabe bis zur PDL-Bestätigung. Offene
        Übergaben über 48 Std erscheinen rot.
      </p>
    </section>
  );
}
