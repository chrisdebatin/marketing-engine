import { UserPlus } from "lucide-react";
import { requireSession } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { isRecruitingLead } from "@/lib/lead-forward";
import { leadEmail, leadFullName, leadPhone } from "@/lib/meta-lead-fields";
import { PageHeader } from "@/components/page-header";
import { StatTile } from "@/components/ui/stat-tile";
import { RecruitingOverview, type RecruitingRow } from "@/components/recruiting-overview";

export const dynamic = "force-dynamic";

/** Stichtage außerhalb des Renders (react-hooks/purity). */
function zeitraume() {
  const now = Date.now();
  return {
    heute: new Date(now).toISOString().slice(0, 10),
    tage7: new Date(now - 7 * 86_400_000).toISOString().slice(0, 10),
    tage30: new Date(now - 30 * 86_400_000).toISOString().slice(0, 10),
  };
}

/** Rolle aus dem Meta-Kampagnennamen ("Mitarbeiter-Hameln-Fachkraft-…"). */
function rolleAus(campaign: string | null): string | null {
  if (!campaign) return null;
  if (/fachkraft|examiniert/i.test(campaign)) return "Pflegefachkraft";
  if (/helfer|lg1|lg2/i.test(campaign)) return "Pflegehelfer";
  if (/hauswirtschaft|alltagshilfe/i.test(campaign)) return "Hauswirtschaft";
  return null;
}

/**
 * Recruiting-Leads: alle Bewerber-Anfragen aus Meta-Anzeigen und dem
 * Website-Formular (KI-erkannt) an einem Ort — Tagesübersicht + Liste.
 */
export default async function RecruitingPage() {
  await requireSession();
  const admin = createAdminClient();

  const [metaRes, websiteRes] = await Promise.all([
    admin
      .from("meta_leads")
      .select("id, created_time, created_at, campaign_name, field_data, forwarded_at")
      .neq("status", "geloescht")
      .order("created_time", { ascending: false })
      .limit(1000),
    admin
      .from("lead_calls")
      .select("id, created_at, call_date, lead_name, telefon, email, notiz, ergebnis")
      .eq("quelle", "website")
      .ilike("ergebnis", "Bewerbung%")
      .order("created_at", { ascending: false })
      .limit(500),
  ]);

  const rows: RecruitingRow[] = [
    ...(metaRes.data ?? [])
      .filter((l) => isRecruitingLead(l.campaign_name))
      .map((l) => ({
        id: `m-${l.id}`,
        datum: l.created_time ?? l.created_at ?? "",
        name: leadFullName(l.field_data) ?? "(ohne Name)",
        telefon: leadPhone(l.field_data),
        email: leadEmail(l.field_data),
        quelle: "meta" as const,
        detail: l.campaign_name,
        rolle: rolleAus(l.campaign_name),
        weitergeleitet: Boolean(l.forwarded_at),
      })),
    ...(websiteRes.data ?? []).map((l) => ({
      id: `w-${l.id}`,
      datum: l.created_at ?? l.call_date,
      name: l.lead_name ?? "(ohne Name)",
      telefon: l.telefon,
      email: l.email,
      quelle: "website" as const,
      detail: l.notiz,
      rolle: null,
      // "Bewerbung — automatisch an Recruiting weitergeleitet" vs. Fehlschlag-Vermerk
      weitergeleitet: /weitergeleitet/i.test(l.ergebnis ?? ""),
    })),
  ]
    .filter((r) => r.datum)
    .sort((a, b) => b.datum.localeCompare(a.datum));

  const { heute, tage7, tage30 } = zeitraume();
  const rows30 = rows.filter((r) => r.datum.slice(0, 10) >= tage30);

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        icon={UserPlus}
        title="Recruiting-Leads"
        description="Alle Bewerber-Anfragen an einem Ort: Meta-Anzeigen (automatisch weitergeleitet ans Recruiting) und Website-Bewerbungen (KI-erkannt, weitergeleitet an recruiting@pflegeunion.de)."
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile
          label="Heute"
          value={String(rows.filter((r) => r.datum.slice(0, 10) === heute).length)}
          tone="blue"
          icon={UserPlus}
        />
        <StatTile
          label="Letzte 7 Tage"
          value={String(rows.filter((r) => r.datum.slice(0, 10) >= tage7).length)}
          tone="purple"
          icon={UserPlus}
        />
        <StatTile
          label="Letzte 30 Tage"
          value={String(rows30.length)}
          tone="orange"
          icon={UserPlus}
        />
        <StatTile
          label="Gesamt"
          value={String(rows.length)}
          tone="green"
          icon={UserPlus}
        />
      </div>

      <RecruitingOverview rows={rows30} />
    </div>
  );
}
