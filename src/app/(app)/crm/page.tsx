import { requireSession } from "@/lib/auth";
import { buildTeamInbound } from "@/lib/team-leads";
import { PdlTabs } from "@/components/pdl-tabs";
import { CrmIntro } from "@/components/crm-intro";
import { CrmHandoverStats } from "@/components/crm-handover-stats";
import { TeamWorkspace } from "@/components/team-workspace";
import { FrontofficeSection } from "./frontoffice-section";
import { ZieleSection } from "./ziele-section";

export const dynamic = "force-dynamic";
// Server-Actions der CRM-Sektionen rufen Claude auf — mehr Zeit als die 10s-Vorgabe.
export const maxDuration = 60;

/**
 * CRM & Leads — eine Seite für alle: grafisches Intro (wer bearbeitet was),
 * je ein Lead-Monitor pro Team (Belinda & Adelina / Davina, gleiche Ansicht
 * wie ihre persönlichen Seiten, nur ohne Aktionen) und die zentrale
 * Institutionen-/Anrufverwaltung.
 */
export default async function CrmPage() {
  const session = await requireSession();
  const [ksInbound, ccInbound] = await Promise.all([
    buildTeamInbound("kundenservice"),
    buildTeamInbound("callcenter"),
  ]);
  const { createAdminClient } = await import("@/lib/supabase/admin");
  const { data: hubRows } = await createAdminClient().from("hubs").select("id, name");
  const hubs = (hubRows ?? []).map((h) => ({ id: h.id, name: h.name }));
  const editable = session.isAdmin;
  const editorName = session.profile?.name?.trim() || "Admin";
  const openCount = (l: { status: string }[]) =>
    l.filter((x) => ["offen", "kontaktiert"].includes(x.status)).length;

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h1 className="text-2xl font-semibold">CRM &amp; Leads</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Gesamtsicht für alle: die Leads beider Teams (bearbeitet wird auf
          den persönlichen Links) und die zentrale Anruf- und Besuchsliste
          der Institutionen.
        </p>
      </div>

      <CrmIntro />

      {session.isAdmin && <CrmHandoverStats />}

      <PdlTabs
        tabs={[
          {
            id: "kundenservice",
            label: "Belinda & Adelina",
            badge: openCount(ksInbound),
            content: (
              <div className="flex flex-col gap-6">
                <TeamWorkspace
                  monitor
                  editable={editable}
                  token=""
                  memberName={editorName}
                  inbound={ksInbound}
                  outbound={[]}
                  hubs={hubs}
                />
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
          },
          {
            id: "callcenter",
            label: "Davina",
            badge: openCount(ccInbound),
            content: (
              <div className="flex flex-col gap-3">
                <TeamWorkspace
                  monitor
                  editable={editable}
                  token=""
                  memberName={editorName}
                  inbound={ccInbound}
                  outbound={[]}
                  hubs={hubs}
                />
                <p className="text-xs text-muted-foreground">
                  Davinas Krankenhaus-Anrufliste läuft über ihren persönlichen
                  Link; die zentrale Liste steht im Tab „Institutionen &amp;
                  Anrufe&ldquo;.
                </p>
              </div>
            ),
          },
          {
            id: "institutionen",
            label: "Institutionen & Anrufe",
            content: <ZieleSection />,
          },
        ]}
      />
    </div>
  );
}
