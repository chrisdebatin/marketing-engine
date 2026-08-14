import { requireSession } from "@/lib/auth";
import { buildTeamAnrufe, buildTeamInbound, buildTeamOutbound } from "@/lib/team-leads";
import { CrmBoard } from "@/components/crm-board";
import { CrmIntro } from "@/components/crm-intro";
import { PageHeader } from "@/components/page-header";
import { TeamWorkspace } from "@/components/team-workspace";
import { FrontofficeSection } from "./frontoffice-section";

export const dynamic = "force-dynamic";
// Server-Actions der CRM-Sektionen rufen Claude auf — mehr Zeit als die 10s-Vorgabe.
export const maxDuration = 60;

/**
 * CRM & Leads: Team-Switch (Belinda & Adelina / Davina) über dem großen
 * Toggle "Anstehende Leads" vs. "Outbound-Anrufe" — jedes Team hat seine
 * eigene Lead-Inbox und seine eigene Anrufliste. Alles direkt bearbeitbar
 * (Admin-Session). Das volle Institutionen-CRM liegt auf /crm-admin.
 */
export default async function CrmPage() {
  const session = await requireSession();
  // Lead-Mails (Recare, verpasste Anrufe) auch beim /crm-Aufruf einsammeln —
  // sonst erscheinen neue Mails erst, wenn jemand eine /t-Seite öffnet.
  // Gedrosselt (1×/Minute) und fehler-tolerant.
  const { syncRecareMails } = await import("@/lib/recare-import");
  await syncRecareMails().catch(() => null);
  const [ksInbound, ccInbound, ksOutbound, ccOutbound, ksAnrufe, ccAnrufe] =
    await Promise.all([
      buildTeamInbound("kundenservice"),
      buildTeamInbound("callcenter"),
      buildTeamOutbound("kundenservice"),
      buildTeamOutbound("callcenter"),
      buildTeamAnrufe("kundenservice"),
      buildTeamAnrufe("callcenter"),
    ]);
  const { createAdminClient } = await import("@/lib/supabase/admin");
  const { data: hubRows } = await createAdminClient().from("hubs").select("id, name");
  const hubs = (hubRows ?? []).map((h) => ({ id: h.id, name: h.name }));
  // Kontakte-Verzeichnis: bei beiden Teams identisch (alle Leads + alle
  // Institutionen, dedupliziert) — zum Nachschlagen bei Inbound-Anrufen.
  const kontakteInbound = [...ksInbound, ...ccInbound].sort((a, b) =>
    (b.datum ?? "").localeCompare(a.datum ?? ""),
  );
  const seenTargets = new Set<string>();
  const kontakteOutbound = [...ksOutbound, ...ccOutbound].filter((t) => {
    if (seenTargets.has(t.id)) return false;
    seenTargets.add(t.id);
    return true;
  });
  const editable = session.isAdmin;
  const editorName = session.profile?.name?.trim() || "Admin";
  const openCount = (l: { status: string }[]) =>
    l.filter((x) => ["offen", "kontaktiert", "erstgespraech"].includes(x.status)).length;
  const today = new Date().toISOString().slice(0, 10);
  const dueCount = (l: { letzter_besuch: string | null; naechster_besuch: string | null }[]) =>
    l.filter((t) => !t.letzter_besuch || (t.naechster_besuch !== null && t.naechster_besuch <= today)).length;

  const workspace = (
    team: "kundenservice" | "callcenter",
    view: "inbound" | "outbound" | "kontakte",
  ) => (
    <TeamWorkspace
      monitor
      editable={editable}
      view={view}
      inboundLog={team === "kundenservice"}
      token=""
      memberName={editorName}
      inbound={team === "kundenservice" ? ksInbound : ccInbound}
      outbound={team === "kundenservice" ? ksOutbound : ccOutbound}
      anrufe={team === "kundenservice" ? ksAnrufe : ccAnrufe}
      kontakteInbound={kontakteInbound}
      kontakteOutbound={kontakteOutbound}
      hubs={hubs}
    />
  );

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="CRM & Leads"
        description="Leads und Anruflisten beider Teams — hier direkt bearbeitbar, jede Aktion wird unter deinem Namen gespeichert."
      />

      <CrmIntro />

      <CrmBoard
        teams={[
          {
            id: "kundenservice",
            label: "Belinda & Adelina",
            leadsBadge: openCount(ksInbound),
            outboundBadge: dueCount(ksOutbound),
            leads: (
              <div className="flex flex-col gap-6">
                {workspace("kundenservice", "inbound")}
                <details className="group rounded-xl border bg-card shadow-sm">
                  <summary className="cursor-pointer list-none p-4 text-sm font-semibold select-none">
                    Anruf manuell erfassen &amp; Quellen-Auswertung
                    <span className="ml-2 text-xs font-normal text-muted-foreground group-open:hidden">
                      aufklappen
                    </span>
                  </summary>
                  <div className="border-t p-4">
                    <FrontofficeSection />
                  </div>
                </details>
              </div>
            ),
            outbound: workspace("kundenservice", "outbound"),
            kontakte: workspace("kundenservice", "kontakte"),
          },
          {
            id: "callcenter",
            label: "Davina",
            leadsBadge: openCount(ccInbound),
            outboundBadge: dueCount(ccOutbound),
            leads: workspace("callcenter", "inbound"),
            outbound: workspace("callcenter", "outbound"),
            kontakte: workspace("callcenter", "kontakte"),
          },
        ]}
      />
    </div>
  );
}
