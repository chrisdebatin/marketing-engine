import { createAdminClient } from "@/lib/supabase/admin";
import { CALLCENTER_QUELLEN, isDirectBookingHub } from "@/lib/leads";
import { isRecruitingLead } from "@/lib/lead-forward";
import { leadEmail, leadFullName, leadPhone } from "@/lib/meta-lead-fields";
import type { InboundLead } from "@/components/team-workspace";

/**
 * Inbound-Leads eines Teams zusammensetzen (SERVER ONLY) — gemeinsam
 * genutzt von den persönlichen Team-Seiten (/t) und den Team-Monitoren
 * auf /crm. Quelle bestimmt das Team: Call-Center = Recare, Kundenservice
 * = alles andere inkl. Meta-Kunden-Leads.
 */
export async function buildTeamInbound(
  team: "kundenservice" | "callcenter",
): Promise<InboundLead[]> {
  const admin = createAdminClient();
  const isCallcenter = team === "callcenter";

  const [{ data: callRows }, { data: metaRows }, { data: hubRows }] =
    await Promise.all([
      admin
        .from("lead_calls")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(200),
      !isCallcenter
        ? admin
            .from("meta_leads")
            .select("*")
            .neq("status", "geloescht")
            .order("created_time", { ascending: false })
            .limit(200)
        : Promise.resolve({ data: [] as never[] }),
      admin.from("hubs").select("id, name, pdl_name"),
    ]);

  const hubName = (id: string | null) =>
    (hubRows ?? []).find((h) => h.id === id)?.name ?? null;
  const hubPdl = (id: string | null) =>
    (hubRows ?? []).find((h) => h.id === id)?.pdl_name ?? null;

  // Standort-Vorschlag: normalisierter Hub-Name im Lead-Text (Kampagne,
  // Klinik, Notiz) — "Kunden-BadOeynhausen-…" trifft "Bad Oeynhausen".
  const norm = (s: string) => s.toLowerCase().replace(/[^a-zä-ü0-9]/g, "");
  const suggestHub = (text: string): string | null => {
    const t = norm(text);
    if (t.length < 4) return null;
    for (const h of hubRows ?? []) {
      const hn = norm(h.name.replace(/^alltagshilfe\s+/i, ""));
      if (hn.length >= 4 && t.includes(hn)) return h.id;
    }
    return null;
  };

  const inbound: InboundLead[] = [];
  for (const c of callRows ?? []) {
    const mine = isCallcenter
      ? CALLCENTER_QUELLEN.has(c.quelle)
      : !CALLCENTER_QUELLEN.has(c.quelle);
    if (!mine) continue;
    inbound.push({
      kind: "call",
      id: c.id,
      name: c.lead_name || "(ohne Name)",
      telefon: c.telefon ?? null,
      email: c.email ?? null,
      quelle: c.quelle,
      quelle_detail: c.quelle_detail ?? null,
      datum: c.created_at ?? c.call_date,
      status: c.status ?? "offen",
      bearbeiter: c.bearbeiter ?? null,
      notiz: c.notiz ?? null,
      ergebnis: c.ergebnis ?? null,
      hub: hubName(c.hub_id),
      zugewiesen_hub: hubName(c.zugewiesen_hub_id ?? null),
      zugewiesen_pdl: hubPdl(c.zugewiesen_hub_id ?? null),
      zugewiesen_at: c.zugewiesen_at ?? null,
      pdl_bestaetigt_at: c.pdl_bestaetigt_at ?? null,
      pdl_ergebnis: c.pdl_ergebnis ?? null,
      vorschlag_hub_id: suggestHub(
        `${c.quelle_detail ?? ""} ${c.notiz ?? ""} ${c.lead_name ?? ""}`,
      ),
      direct_booking: isDirectBookingHub(
        hubName(c.zugewiesen_hub_id ?? null) ??
          hubName(suggestHub(`${c.quelle_detail ?? ""} ${c.notiz ?? ""}`) ?? null),
      ),
    });
  }
  if (!isCallcenter) {
    for (const m of metaRows ?? []) {
      if (isRecruitingLead(m.campaign_name)) continue;
      inbound.push({
        kind: "meta",
        id: m.id,
        name: leadFullName(m.field_data) ?? "(ohne Name)",
        telefon: leadPhone(m.field_data),
        email: leadEmail(m.field_data),
        quelle: "meta",
        quelle_detail: m.campaign_name,
        datum: m.created_time ?? m.created_at ?? "",
        status: m.status,
        bearbeiter: m.bearbeiter ?? null,
        notiz: m.notiz ?? null,
        ergebnis: m.ergebnis ?? null,
        hub: null,
        zugewiesen_hub: hubName(m.zugewiesen_hub_id ?? null),
        zugewiesen_pdl: hubPdl(m.zugewiesen_hub_id ?? null),
        zugewiesen_at: m.zugewiesen_at ?? null,
        pdl_bestaetigt_at: m.pdl_bestaetigt_at ?? null,
        pdl_ergebnis: m.pdl_ergebnis ?? null,
        vorschlag_hub_id: suggestHub(m.campaign_name ?? ""),
        direct_booking: isDirectBookingHub(
          hubName(m.zugewiesen_hub_id ?? null) ??
            hubName(suggestHub(m.campaign_name ?? "") ?? null),
        ),
      });
    }
  }
  inbound.sort((a, b) => (b.datum ?? "").localeCompare(a.datum ?? ""));
  return inbound;
}
