import { Users } from "lucide-react";
import { createAdminClient } from "@/lib/supabase/admin";
import { metaConfigured, metaPageId } from "@/lib/meta-api";
import { isRecruitingLead } from "@/lib/lead-forward";
import { syncMetaLeads } from "@/lib/meta-lead-sync";
import { MetaLeadsList, type LeadRow } from "@/components/meta-leads-list";

/**
 * Meta-Leads auf dem Dashboard: stößt beim Seitenaufruf den kompletten
 * Lead-Durchlauf an (Sync, Kunden-Follow-up-Entwürfe, CRM-Übernahme,
 * Recruiting-Weiterleitung — siehe lib/meta-lead-sync, läuft zusätzlich
 * stündlich per Cron) und zeigt die Liste mit Kontaktdaten + Status.
 */
export async function MetaLeads() {
  if (!metaConfigured() || !metaPageId()) return null;

  const { syncError } = await syncMetaLeads();

  const admin = createAdminClient();
  const { data, error: dbError } = await admin
    .from("meta_leads")
    .select("*")
    .order("created_time", { ascending: false })
    .limit(200);
  const tableMissing = dbError?.code === "PGRST205" || dbError?.code === "42P01";

  return (
    <section className="flex flex-col gap-3 border-t pt-5">
      <h2 className="flex items-center gap-2 text-lg font-semibold">
        <Users className="size-4 text-primary" />
        Leads
        {(data?.length ?? 0) > 0 && (
          <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-semibold text-primary">
            {data!.filter((l) => l.status === "offen" && !isRecruitingLead(l.campaign_name)).length}{" "}
            offene Kunden-Anfragen
          </span>
        )}
      </h2>

      {syncError === "token_permission" && (
        <p className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          Dem Meta-Token fehlt die Berechtigung <code>leads_retrieval</code> —
          Kontaktdaten können noch nicht abgerufen werden. Einmal im Business
          Manager beim Systemnutzer „Token generieren" mit den bisherigen
          Berechtigungen <strong>plus leads_retrieval</strong> ausführen und den
          neuen Token als <code>META_ACCESS_TOKEN</code> eintragen (lokal +
          Vercel).
        </p>
      )}
      {syncError && syncError !== "token_permission" && (
        <p className="text-sm text-muted-foreground">
          Lead-Sync gerade nicht möglich ({syncError}) — Anzeige zeigt den
          letzten Stand.
        </p>
      )}
      {tableMissing ? (
        <p className="rounded-xl border bg-card p-5 text-sm text-muted-foreground shadow-sm">
          Die Tabelle <code>meta_leads</code> fehlt noch — bitte einmal{" "}
          <code>supabase/apply_all_pending.sql</code> im Supabase SQL-Editor
          ausführen.
        </p>
      ) : (data?.length ?? 0) === 0 ? (
        !syncError && (
          <p className="rounded-xl border bg-card p-5 text-sm text-muted-foreground shadow-sm">
            Noch keine Leads eingegangen.
          </p>
        )
      ) : (
        <MetaLeadsList initial={(data ?? []) as LeadRow[]} />
      )}
    </section>
  );
}
