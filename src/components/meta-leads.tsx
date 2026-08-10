import { Users } from "lucide-react";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  MetaApiError,
  getPageAccessToken,
  metaConfigured,
  metaFetch,
  metaPageId,
} from "@/lib/meta-api";
import { generateFollowupDraft } from "@/lib/followup-ai";
import { forwardLead, isRecruitingLead } from "@/lib/lead-forward";
import { mailConfigured } from "@/lib/mailer";
import {
  cityFromCampaign,
  leadEmail,
  leadFirstName,
  leadFullName,
  leadPhone,
} from "@/lib/meta-lead-fields";
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

  // Follow-up-Entwürfe für neue offene Leads mit E-Mail erzeugen (max. 8 pro
  // Seitenaufruf, parallel). Versand bleibt manuell (1-Klick in der Liste).
  try {
    const { data: pending } = await admin
      .from("meta_leads")
      .select("id, campaign_name, ad_name, field_data")
      .eq("status", "offen")
      .is("followup_status", null)
      .order("created_time", { ascending: false })
      .limit(8);
    await Promise.allSettled(
      (pending ?? [])
        .filter((l) => leadEmail(l.field_data))
        .map(async (l) => {
          const draft = await generateFollowupDraft({
            name: leadFirstName(l.field_data),
            campaignName: l.campaign_name,
            adName: l.ad_name,
          });
          if (draft) {
            await admin
              .from("meta_leads")
              .update({
                followup_subject: draft.subject,
                followup_body: draft.body,
                followup_status: "entwurf",
              })
              .eq("id", l.id);
          }
        }),
    );
  } catch (err) {
    // Spalten fehlen (Migration 0048 nicht eingespielt) o. ä. — Liste trotzdem zeigen.
    console.error("meta-leads: Entwurfs-Erzeugung übersprungen:", err);
  }

  // Leads ins CRM übernehmen (crm_targets + Ansprechperson), als eigene
  // Kategorien meta_mitarbeiter/meta_kunde — getrennt von den Krankenhäusern.
  // Idempotent über meta_leads.crm_target_id, max. 25 pro Seitenaufruf.
  try {
    const { data: toCrm } = await admin
      .from("meta_leads")
      .select("id, campaign_name, ad_name, created_time, field_data")
      .is("crm_target_id", null)
      .order("created_time", { ascending: false })
      .limit(25);
    for (const l of toCrm ?? []) {
      const name = leadFullName(l.field_data) ?? leadEmail(l.field_data) ?? "Meta-Lead";
      const { data: target, error: targetError } = await admin
        .from("crm_targets")
        .insert({
          name,
          kategorie: isRecruitingLead(l.campaign_name) ? "meta_mitarbeiter" : "meta_kunde",
          ort: cityFromCampaign(l.campaign_name),
          ansprechpartner: name,
          note: [
            "Meta-Lead aus Instant-Formular",
            l.campaign_name ? `Kampagne: ${l.campaign_name}` : null,
            l.ad_name ? `Anzeige: ${l.ad_name}` : null,
          ]
            .filter(Boolean)
            .join(" · "),
        })
        .select("id")
        .single();
      if (targetError || !target) break; // Spalten/Tabelle fehlen o. ä. — nächster Lauf
      await admin.from("crm_persons").insert({
        target_id: target.id,
        name,
        telefon: leadPhone(l.field_data),
        email: leadEmail(l.field_data),
        notiz: l.campaign_name ? `Meta-Kampagne ${l.campaign_name}` : "Meta-Lead",
      });
      await admin.from("meta_leads").update({ crm_target_id: target.id }).eq("id", l.id);
    }
  } catch (err) {
    console.error("meta-leads: CRM-Übernahme übersprungen:", err);
  }

  // Mitarbeiter-Anfragen ans Recruiting-Postfach weiterleiten (einmal pro Lead,
  // idempotent über forwarded_at; max. 15 pro Seitenaufruf). Ohne eingerichteten
  // Versandweg bleibt forwarded_at leer, der nächste Lauf holt es nach.
  if (mailConfigured()) {
    try {
      const { data: toForward } = await admin
        .from("meta_leads")
        .select("id, campaign_name, ad_name, created_time, field_data")
        .is("forwarded_at", null)
        .order("created_time", { ascending: false })
        .limit(15);
      for (const l of toForward ?? []) {
        if (!isRecruitingLead(l.campaign_name)) continue;
        const res = await forwardLead(l);
        await admin
          .from("meta_leads")
          .update(
            res.ok
              ? { forwarded_at: new Date().toISOString(), forward_error: null }
              : { forward_error: res.error },
          )
          .eq("id", l.id);
        if (!res.ok) break; // Versandweg gestört — nicht 15-mal gegen die Wand
      }
    } catch (err) {
      console.error("meta-leads: Weiterleitung übersprungen:", err);
    }
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
