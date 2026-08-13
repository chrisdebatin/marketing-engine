import { redirect } from "next/navigation";
import { requireSession } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { isRecruitingLead } from "@/lib/lead-forward";
import { CrmStatsDashboard, type StatLead } from "@/components/crm-stats-dashboard";
import { ZieleSection } from "@/app/(app)/crm/ziele-section";

export const dynamic = "force-dynamic";

/**
 * CRM-Admin (nur Admins): reines Stats-Dashboard — Leads pro Tag je Kanal,
 * Prozess-Funnel mit Conversion-Rates, Bearbeiter- und PDL-Auswertung.
 * Verwaltung (CSV-Import etc.) bleibt eingeklappt erreichbar.
 */
export default async function CrmAdminPage() {
  const session = await requireSession();
  if (!session.isAdmin) redirect("/crm");

  const admin = createAdminClient();
  // select("*") statt fester Spaltenliste: fehlt eine Spalte aus einer noch
  // nicht eingespielten Migration, liefert die Abfrage trotzdem Daten (die
  // betroffene Kennzahl bleibt dann einfach leer).
  const [callsRes, metaRes, hubsRes] = await Promise.all([
    admin.from("lead_calls").select("*").limit(4000),
    admin.from("meta_leads").select("*").neq("status", "geloescht").limit(4000),
    admin.from("hubs").select("id, name, pdl_name"),
  ]);

  const hubName = new Map((hubsRes.data ?? []).map((h) => [h.id, h.name]));
  const hubPdl: Record<string, string> = {};
  for (const h of hubsRes.data ?? []) {
    if (h.pdl_name) hubPdl[h.name] = h.pdl_name;
  }

  const leads: StatLead[] = [
    ...(callsRes.data ?? []).map((l) => ({
      kind: "call" as const,
      quelle: l.quelle,
      bereich: l.bereich,
      status: l.status,
      bearbeiter: l.bearbeiter,
      created: l.created_at ?? l.call_date,
      erst: l.erstbearbeitet_at ?? null,
      hub: hubName.get(l.zugewiesen_hub_id ?? "") ?? null,
      zugewiesenAt: l.zugewiesen_at ?? null,
      bestaetigtAt: l.pdl_bestaetigt_at ?? null,
      pdlErgebnis: l.pdl_ergebnis ?? null,
    })),
    // Meta: nur Kunden-Leads (Recruiting läuft separat übers Recruiting-Postfach).
    ...(metaRes.data ?? [])
      .filter((l) => !isRecruitingLead(l.campaign_name))
      .map((l) => ({
        kind: "meta" as const,
        quelle: "meta",
        bereich: null,
        status: l.status,
        bearbeiter: l.bearbeiter,
        created: l.created_time ?? l.created_at ?? "",
        erst: l.erstbearbeitet_at ?? null,
        hub: hubName.get(l.zugewiesen_hub_id ?? "") ?? null,
        zugewiesenAt: l.zugewiesen_at ?? null,
        bestaetigtAt: l.pdl_bestaetigt_at ?? null,
        pdlErgebnis: l.pdl_ergebnis ?? null,
      })),
  ].filter((l) => l.created);

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h1 className="text-2xl font-semibold">CRM-Admin</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Zahlen über beide Teams: Kanäle, Prozess-Funnel, Reaktionszeiten und
          PDL-Übergaben.
        </p>
      </div>

      <CrmStatsDashboard
        leads={leads}
        hubPdl={hubPdl}
        now={new Date().toISOString()}
      />

      {/* Kontakte werden in den Team-Ansichten (/crm → Kontakte) gepflegt —
          hier nur noch Stats. Import & Einstellungen bleiben eingeklappt
          erreichbar. */}
      <details className="group rounded-xl border bg-card shadow-sm">
        <summary className="cursor-pointer list-none p-4 text-sm font-semibold select-none">
          Verwaltung (CSV-Import, Follow-up-Einstellungen, Institutionen)
          <span className="ml-2 text-xs font-normal text-muted-foreground group-open:hidden">
            aufklappen
          </span>
        </summary>
        <div className="border-t p-4">
          <ZieleSection mode="full" />
        </div>
      </details>
    </div>
  );
}
