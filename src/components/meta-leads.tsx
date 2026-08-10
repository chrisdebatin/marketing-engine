import { Users } from "lucide-react";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  MetaApiError,
  getPageAccessToken,
  metaConfigured,
  metaFetch,
  metaPageId,
} from "@/lib/meta-api";
import { MetaLeadsList, type LeadRow } from "@/components/meta-leads-list";

interface MetaLead {
  id: string;
  created_time?: string;
  campaign_name?: string;
  ad_name?: string;
  field_data?: { name: string; values: string[] }[];
}

/**
 * Meta-Leads auf dem Dashboard: synchronisiert bei jedem Seitenaufruf die
 * Instant-Formular-Leads von Meta in die Tabelle meta_leads (idempotent,
 * Status bleibt erhalten) und zeigt sie mit Kontaktdaten + offen/kontaktiert.
 * Benötigt einen Token mit leads_retrieval — sonst erscheint ein Hinweis.
 */
export async function MetaLeads() {
  if (!metaConfigured()) return null;
  const pageId = metaPageId();
  if (!pageId) return null;

  const admin = createAdminClient();
  let syncError: string | null = null;

  try {
    const pageToken = await getPageAccessToken(pageId);
    const forms = await metaFetch(
      `${pageId}/leadgen_forms`,
      { fields: "id", limit: "50" },
      "GET",
      pageToken,
    );
    const rows: MetaLead[] = [];
    for (const form of (forms.data ?? []) as { id: string }[]) {
      const r = await metaFetch(
        `${form.id}/leads`,
        { fields: "id,created_time,campaign_name,ad_name,field_data", limit: "200" },
        "GET",
        pageToken,
      );
      for (const lead of (r.data ?? []) as MetaLead[]) {
        rows.push({ ...lead, ...{ form_id: form.id } } as MetaLead & {
          form_id: string;
        });
      }
    }
    if (rows.length > 0) {
      // ignoreDuplicates: bestehende Zeilen (inkl. Status) nicht anfassen
      await admin.from("meta_leads").upsert(
        rows.map((l) => ({
          id: l.id,
          form_id: (l as { form_id?: string }).form_id ?? null,
          campaign_name: l.campaign_name ?? null,
          ad_name: l.ad_name ?? null,
          created_time: l.created_time ?? null,
          field_data: l.field_data ?? null,
        })),
        { onConflict: "id", ignoreDuplicates: true },
      );
    }
  } catch (err) {
    syncError =
      err instanceof MetaApiError && /leads_retrieval/i.test(err.message)
        ? "token_permission"
        : err instanceof Error
          ? err.message
          : "Sync-Fehler";
  }

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
            {data!.filter((l) => l.status === "offen").length} offen
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
