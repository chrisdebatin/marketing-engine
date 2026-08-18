import { notFound } from "next/navigation";
import {
  Headset,
  HelpCircle,
  MessageSquareQuote,
  PhoneCall,
  Users,
} from "lucide-react";
import { createAdminClient } from "@/lib/supabase/admin";
import { buildTeamAnrufe, buildTeamInbound, buildTeamOutbound } from "@/lib/team-leads";
import { syncRecareMails } from "@/lib/recare-import";
import { PageHeader } from "@/components/page-header";
import { TeamWorkspace } from "@/components/team-workspace";

export const dynamic = "force-dynamic";

/**
 * Persönliche Team-Seite (Devina / Belinda / Adeline) — kein Login, ein
 * Link pro Person. Inbound-Leads nach Team-Routing (lib/team-leads) +
 * Outbound-Anrufliste mit Kategorie-Split (Praxen → Kundenservice,
 * Krankenhäuser → Call-Center, Rest gemeinsam).
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

  // Lead-Mails (Recare, verpasste Anrufe) einsammeln — idempotent und
  // serverseitig gedrosselt; Fehler blockieren die Seite nicht.
  let recareHint: string | null = null;
  {
    const sync = await syncRecareMails().catch(() => null);
    if (sync?.error === "outlook_not_connected") {
      recareHint =
        "Lead-Postfach nicht eingerichtet — LEADS_IMAP_USER/PASS setzen (Gmail-App-Passwort) oder Outlook anbinden.";
    } else if (sync?.error === "imap_error") {
      recareHint = "Lead-Postfach (IMAP) nicht erreichbar — Zugangsdaten prüfen.";
    }
  }

  const team = isCallcenter ? ("callcenter" as const) : ("kundenservice" as const);
  const otherTeam = isCallcenter ? ("kundenservice" as const) : ("callcenter" as const);
  const [inbound, outbound, otherInbound, otherOutbound, anrufe, { data: hubRows }] =
    await Promise.all([
      buildTeamInbound(team),
      buildTeamOutbound(team),
      buildTeamInbound(otherTeam),
      buildTeamOutbound(otherTeam),
      buildTeamAnrufe(team),
      admin.from("hubs").select("id, name, pdl_name, pdl_phone, pdl_email"),
    ]);
  // Kontakte-Verzeichnis: bei allen gleich — Leads + Institutionen beider
  // Teams (dedupliziert), damit man bei einem Anruf den letzten Status findet.
  const kontakteInbound = [...inbound, ...otherInbound].sort((a, b) =>
    (b.datum ?? "").localeCompare(a.datum ?? ""),
  );
  const seenTargets = new Set<string>();
  const kontakteOutbound = [...outbound, ...otherOutbound].filter((t) => {
    if (seenTargets.has(t.id)) return false;
    seenTargets.add(t.id);
    return true;
  });

  return (
    <main className="mx-auto flex w-full max-w-4xl flex-1 flex-col gap-5 px-4 py-8">
      <PageHeader
        icon={isCallcenter ? PhoneCall : Headset}
        eyebrow={isCallcenter ? "Call-Center" : "Kundenservice"}
        title={`Hallo ${member.name}!`}
        description="Ihre persönliche Arbeitsliste — Leads übernehmen, Status setzen, Anrufe loggen. Jede Aktion wird unter Ihrem Namen gespeichert."
      />

      {/* Nachschlagewerke: die /t-Seiten laufen ohne Sidebar, sonst kaeme
          das Team gar nicht an Skripte und PDL-Verzeichnis heran. */}
      <div className="grid gap-2 sm:grid-cols-3">
        <a
          href="/skripte"
          className="flex items-center gap-2.5 rounded-xl border bg-card p-3 shadow-sm transition-shadow hover:shadow-md"
        >
          <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-orange-100 text-orange-600">
            <MessageSquareQuote className="size-4.5" />
          </span>
          <span className="text-sm font-semibold">Gesprächs-Skripte</span>
        </a>
        <a
          href="/pdl-verzeichnis"
          className="flex items-center gap-2.5 rounded-xl border bg-card p-3 shadow-sm transition-shadow hover:shadow-md"
        >
          <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-emerald-100 text-emerald-600">
            <Users className="size-4.5" />
          </span>
          <span className="text-sm font-semibold">PDL-Verzeichnis</span>
        </a>
        <a
          href="/crm-hilfe"
          className="flex items-center gap-2.5 rounded-xl border bg-card p-3 shadow-sm transition-shadow hover:shadow-md"
        >
          <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-blue-100 text-blue-600">
            <HelpCircle className="size-4.5" />
          </span>
          <span className="text-sm font-semibold">Hilfe &amp; Handbuch</span>
        </a>
      </div>

      {recareHint && (
        <p className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
          {recareHint}
        </p>
      )}

      <TeamWorkspace
        token={token}
        memberName={member.name}
        inboundLog={!isCallcenter}
        inbound={inbound}
        outbound={outbound}
        anrufe={anrufe}
        kontakteInbound={kontakteInbound}
        kontakteOutbound={kontakteOutbound}
        hubs={(hubRows ?? []).map((h) => ({ id: h.id, name: h.name }))}
        pdlListe={(hubRows ?? []).map((h) => ({
          name: h.name,
          pdl: h.pdl_name,
          telefon: h.pdl_phone,
          email: h.pdl_email,
        }))}
      />
    </main>
  );
}
