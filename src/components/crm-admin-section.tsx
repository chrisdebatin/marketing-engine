import { BarChart3 } from "lucide-react";
import { createAdminClient } from "@/lib/supabase/admin";
import { CrmHandoverStats } from "@/components/crm-handover-stats";

/**
 * Admin-Auswertung für /crm: wer hat wie viele Leads bearbeitet (und mit
 * welchem Ausgang), wie lange lagen Leads unangetastet im System
 * (erstbearbeitet_at − Eingang; Altbestand ohne Stempel bleibt außen vor)
 * und wie laufen die PDL-Übergaben (via CrmHandoverStats).
 */

interface LeadRowLite {
  bearbeiter: string | null;
  status: string;
  created: string | null;
  erstbearbeitet_at: string | null;
  zugewiesen_hub_id: string | null;
  zugewiesen_at: string | null;
  pdl_bestaetigt_at: string | null;
}

function fmtDauer(ms: number): string {
  const min = Math.round(ms / 60000);
  if (min < 60) return `${min} Min`;
  const h = ms / 3600000;
  if (h < 48) return `${h.toFixed(1).replace(".", ",")} Std`;
  return `${(h / 24).toFixed(1).replace(".", ",")} Tage`;
}

function avg(nums: number[]): number | null {
  if (nums.length === 0) return null;
  return nums.reduce((a, b) => a + b, 0) / nums.length;
}

export async function CrmAdminSection() {
  const admin = createAdminClient();
  const [callsRes, metaRes] = await Promise.all([
    admin
      .from("lead_calls")
      .select(
        "bearbeiter, status, created_at, call_date, erstbearbeitet_at, zugewiesen_hub_id, zugewiesen_at, pdl_bestaetigt_at",
      )
      .limit(2000),
    admin
      .from("meta_leads")
      .select(
        "bearbeiter, status, created_time, erstbearbeitet_at, zugewiesen_hub_id, zugewiesen_at, pdl_bestaetigt_at",
      )
      .neq("status", "geloescht")
      .limit(2000),
  ]);

  const rows: LeadRowLite[] = [
    ...(callsRes.data ?? []).map((l) => ({
      bearbeiter: l.bearbeiter,
      status: l.status,
      created: l.created_at ?? l.call_date,
      erstbearbeitet_at: l.erstbearbeitet_at,
      zugewiesen_hub_id: l.zugewiesen_hub_id,
      zugewiesen_at: l.zugewiesen_at,
      pdl_bestaetigt_at: l.pdl_bestaetigt_at,
    })),
    ...(metaRes.data ?? []).map((l) => ({
      bearbeiter: l.bearbeiter,
      status: l.status,
      created: l.created_time,
      erstbearbeitet_at: l.erstbearbeitet_at,
      zugewiesen_hub_id: l.zugewiesen_hub_id,
      zugewiesen_at: l.zugewiesen_at,
      pdl_bestaetigt_at: l.pdl_bestaetigt_at,
    })),
  ];

  // ---- je Bearbeiter ----
  const byBearbeiter = new Map<
    string,
    { total: number; kontaktiert: number; erstgespraech: number; aufgenommen: number; verloren: number; reaktionen: number[] }
  >();
  for (const l of rows) {
    if (!l.bearbeiter) continue;
    const e =
      byBearbeiter.get(l.bearbeiter) ?? {
        total: 0,
        kontaktiert: 0,
        erstgespraech: 0,
        aufgenommen: 0,
        verloren: 0,
        reaktionen: [],
      };
    e.total++;
    if (l.status === "kontaktiert") e.kontaktiert++;
    if (l.status === "erstgespraech") e.erstgespraech++;
    if (l.status === "aufgenommen" || l.pdl_bestaetigt_at) e.aufgenommen++;
    if (l.status === "verloren" && !l.pdl_bestaetigt_at) e.verloren++;
    if (l.created && l.erstbearbeitet_at) {
      const d = new Date(l.erstbearbeitet_at).getTime() - new Date(l.created).getTime();
      if (d >= 0 && Number.isFinite(d)) e.reaktionen.push(d);
    }
    byBearbeiter.set(l.bearbeiter, e);
  }
  const bearbeiterRows = [...byBearbeiter.entries()].sort((a, b) => b[1].total - a[1].total);

  // ---- Reaktionszeit gesamt + Rückstand ----
  const alleReaktionen = rows
    .filter((l) => l.created && l.erstbearbeitet_at)
    .map((l) => new Date(l.erstbearbeitet_at!).getTime() - new Date(l.created!).getTime())
    .filter((d) => d >= 0 && Number.isFinite(d));
  const avgReaktion = avg(alleReaktionen);
  const unbearbeitet = rows.filter((l) => l.status === "offen" && !l.bearbeiter);
  const aeltester = unbearbeitet
    .map((l) => (l.created ? Date.now() - new Date(l.created).getTime() : 0))
    .sort((a, b) => b - a)[0];

  return (
    <div className="flex flex-col gap-5">
      {/* Überblick */}
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-xl border bg-card p-4 shadow-sm">
          <p className="text-xs text-muted-foreground">Ø Zeit bis zur ersten Bearbeitung</p>
          <p className="mt-1 text-2xl font-semibold">
            {avgReaktion != null ? fmtDauer(avgReaktion) : "—"}
          </p>
          <p className="mt-0.5 text-[11px] text-muted-foreground">
            über {alleReaktionen.length} Leads mit Bearbeitungs-Stempel (läuft ab jetzt mit)
          </p>
        </div>
        <div className="rounded-xl border bg-card p-4 shadow-sm">
          <p className="text-xs text-muted-foreground">Offen & noch niemand dran</p>
          <p className="mt-1 text-2xl font-semibold">{unbearbeitet.length}</p>
          <p className="mt-0.5 text-[11px] text-muted-foreground">
            {aeltester ? `ältester wartet seit ${fmtDauer(aeltester)}` : "nichts wartet"}
          </p>
        </div>
        <div className="rounded-xl border bg-card p-4 shadow-sm">
          <p className="text-xs text-muted-foreground">Leads gesamt (beide Teams)</p>
          <p className="mt-1 text-2xl font-semibold">{rows.length}</p>
          <p className="mt-0.5 text-[11px] text-muted-foreground">
            davon {rows.filter((l) => l.zugewiesen_hub_id).length} an PDLs übergeben
          </p>
        </div>
      </div>

      {/* je Bearbeiter */}
      <div className="rounded-xl border bg-card p-4 shadow-sm">
        <p className="mb-3 flex items-center gap-1.5 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
          <BarChart3 className="size-3.5" />
          Bearbeitung je Person
        </p>
        {bearbeiterRows.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Noch keine bearbeiteten Leads.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-xs text-muted-foreground">
                  <th className="py-1.5 pr-4 font-medium">Bearbeiter</th>
                  <th className="py-1.5 pr-4 font-medium">Leads</th>
                  <th className="py-1.5 pr-4 font-medium">kontaktiert</th>
                  <th className="py-1.5 pr-4 font-medium">Erstgespräch</th>
                  <th className="py-1.5 pr-4 font-medium">aufgenommen</th>
                  <th className="py-1.5 pr-4 font-medium">verloren</th>
                  <th className="py-1.5 pr-4 font-medium">Ø Reaktionszeit</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {bearbeiterRows.map(([name, s]) => {
                  const a = avg(s.reaktionen);
                  return (
                    <tr key={name}>
                      <td className="py-1.5 pr-4 font-medium">{name}</td>
                      <td className="py-1.5 pr-4 tabular-nums">{s.total}</td>
                      <td className="py-1.5 pr-4 tabular-nums">{s.kontaktiert}</td>
                      <td className="py-1.5 pr-4 tabular-nums">{s.erstgespraech}</td>
                      <td className="py-1.5 pr-4 tabular-nums text-emerald-700">{s.aufgenommen}</td>
                      <td className="py-1.5 pr-4 tabular-nums text-muted-foreground">{s.verloren}</td>
                      <td className="py-1.5 pr-4">{a != null ? fmtDauer(a) : "—"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* PDL-Übergaben (Standorte, Ø Response, offene Übergaben) */}
      <CrmHandoverStats />
    </div>
  );
}
