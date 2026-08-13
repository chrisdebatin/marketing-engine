import { notFound } from "next/navigation";
import { Headset, PhoneCall } from "lucide-react";
import { createAdminClient } from "@/lib/supabase/admin";
import { buildTeamInbound, buildTeamOutbound } from "@/lib/team-leads";
import { syncRecareMails } from "@/lib/recare-import";
import { TeamWorkspace } from "@/components/team-workspace";

export const dynamic = "force-dynamic";

/**
 * Persönliche Team-Seite (Davina / Belinda / Adelina) — kein Login, ein
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
  const [inbound, outbound, otherInbound, otherOutbound, { data: hubRows }] =
    await Promise.all([
      buildTeamInbound(team),
      buildTeamOutbound(team),
      buildTeamInbound(otherTeam),
      buildTeamOutbound(otherTeam),
      admin.from("hubs").select("id, name"),
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
        inboundLog={!isCallcenter}
        inbound={inbound}
        outbound={outbound}
        kontakteInbound={kontakteInbound}
        kontakteOutbound={kontakteOutbound}
        hubs={(hubRows ?? []).map((h) => ({ id: h.id, name: h.name }))}
      />
    </main>
  );
}
