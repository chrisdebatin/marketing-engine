import { notFound } from "next/navigation";
import { Headset, PhoneCall } from "lucide-react";
import { createAdminClient } from "@/lib/supabase/admin";
import { CALLCENTER_QUELLEN } from "@/lib/leads";
import { isRecruitingLead } from "@/lib/lead-forward";
import {
  leadEmail,
  leadFullName,
  leadPhone,
} from "@/lib/meta-lead-fields";
import { syncRecareMails } from "@/lib/recare-import";
import {
  TeamWorkspace,
  type InboundLead,
  type OutboundTarget,
} from "@/components/team-workspace";

export const dynamic = "force-dynamic";

/**
 * Persönliche Team-Seite (Davina / Belinda / Adelina) — kein Login, ein
 * Link pro Person. Inbound-Leads gefiltert nach Team-Quellen (Kundenservice:
 * Website/0800/…, Call-Center: Meta/Recare/Agentur) + Outbound-Anrufliste
 * mit Kategorie-Split (Praxen → Kundenservice, Krankenhäuser → Call-Center,
 * Rest gemeinsam).
 */
export default async function TeamMemberPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const admin = createAdminClient();

  const { data: member } = await admin
    .from("team_members")
    .select("id, name, team, active")
    .eq("token", token)
    .maybeSingle();
  if (!member || !member.active) notFound();
  const isCallcenter = member.team === "callcenter";

  // Recare-Mails aus dem angebundenen Postfach einsammeln (idempotent) —
  // neue Anfragen erscheinen direkt in der Liste. Fehler blockieren nichts.
  let recareHint: string | null = null;
  if (isCallcenter) {
    const sync = await syncRecareMails().catch(() => null);
    if (sync?.error === "outlook_not_connected") {
      recareHint =
        "Recare-Import: kein Outlook-Postfach angebunden (Admin → E-Mail-Anbindung).";
    }
  }

  const [{ data: callRows }, { data: metaRows }, { data: targetRows }, { data: hubRows }] =
    await Promise.all([
      admin
        .from("lead_calls")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(200),
      isCallcenter
        ? admin
            .from("meta_leads")
            .select("*")
            .neq("status", "geloescht")
            .order("created_time", { ascending: false })
            .limit(200)
        : Promise.resolve({ data: [] as never[] }),
      admin
        .from("crm_targets")
        .select(
          "id, name, kategorie, ort, adresse, hub_id, relevanz, letzter_besuch, letzte_kontakt_art, naechster_besuch, besuchs_notiz, intervall_wochen",
        )
        .not("kategorie", "in", "(meta_kunde,meta_mitarbeiter)"),
      admin.from("hubs").select("id, name"),
    ]);

  const hubName = (id: string | null) =>
    (hubRows ?? []).find((h) => h.id === id)?.name ?? null;

  // Inbound: Quelle bestimmt das Team.
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
    });
  }
  if (isCallcenter) {
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
        notiz: null,
        ergebnis: null,
        hub: null,
      });
    }
  }
  inbound.sort((a, b) => (b.datum ?? "").localeCompare(a.datum ?? ""));

  // Outbound-Split: praxis exklusiv Kundenservice, krankenhaus exklusiv
  // Call-Center, alle übrigen Kategorien als gemeinsamer Pool.
  const exclusive = isCallcenter ? "krankenhaus" : "praxis";
  const excluded = isCallcenter ? "praxis" : "krankenhaus";
  const outbound: OutboundTarget[] = (targetRows ?? [])
    .filter((t) => (t.kategorie ?? "sonstiges") !== excluded)
    .map((t) => ({
      id: t.id,
      name: t.name,
      kategorie: t.kategorie ?? "sonstiges",
      ort: t.ort ?? null,
      relevanz: t.relevanz ?? null,
      hub: hubName(t.hub_id),
      letzter_besuch: t.letzter_besuch ?? null,
      letzte_kontakt_art: t.letzte_kontakt_art ?? null,
      naechster_besuch: t.naechster_besuch ?? null,
      besuchs_notiz: t.besuchs_notiz ?? null,
      exklusiv: (t.kategorie ?? "sonstiges") === exclusive,
    }));

  return (
    <main className="mx-auto flex w-full max-w-4xl flex-1 flex-col gap-5 px-4 py-8">
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-primary via-primary to-chart-5 p-6 text-primary-foreground shadow-lg">
        <p className="flex items-center gap-2 text-sm font-medium tracking-wide text-primary-foreground/80 uppercase">
          {isCallcenter ? (
            <PhoneCall className="size-4" />
          ) : (
            <Headset className="size-4" />
          )}
          {isCallcenter ? "Call-Center" : "Kundenservice"}
        </p>
        <h1 className="mt-1 text-3xl font-semibold tracking-tight">
          Hallo {member.name}!
        </h1>
        <p className="mt-2 text-sm text-primary-foreground/85">
          Ihre persönliche Arbeitsliste — Leads übernehmen, Status setzen,
          Anrufe loggen. Jede Aktion wird unter Ihrem Namen gespeichert.
        </p>
      </div>

      {recareHint && (
        <p className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
          {recareHint}
        </p>
      )}

      <TeamWorkspace
        token={token}
        memberName={member.name}
        inbound={inbound}
        outbound={outbound}
      />
    </main>
  );
}
