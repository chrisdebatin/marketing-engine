import { requireSession } from "@/lib/auth";
import { PdlTabs } from "@/components/pdl-tabs";
import { CrmIntro } from "@/components/crm-intro";
import { CrmHandoverStats } from "@/components/crm-handover-stats";
import { FrontofficeSection } from "./frontoffice-section";
import { ZieleSection } from "./ziele-section";

export const dynamic = "force-dynamic";
// Server-Actions der CRM-Sektionen rufen Claude auf — mehr Zeit als die 10s-Vorgabe.
export const maxDuration = 60;

/**
 * CRM & Leads — konsolidiert die früheren Tabs "Frontoffice" und
 * "CRM & Call-Center" in einer Seite: grafisches Intro (wer bearbeitet
 * was), Inbound-Leads und die Institutionen-/Anrufverwaltung.
 */
export default async function CrmPage() {
  const session = await requireSession();
  return (
    <div className="flex flex-col gap-5">
      <div>
        <h1 className="text-2xl font-semibold">CRM &amp; Leads</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Eine Seite für beide Teams: eingehende Anfragen (Kundenservice +
          Call-Center) und die zentrale Anruf- und Besuchsliste der
          Institutionen.
        </p>
      </div>

      <CrmIntro />

      {session.isAdmin && <CrmHandoverStats />}

      <PdlTabs
        tabs={[
          {
            id: "leads",
            label: "Anfragen (Inbound)",
            content: <FrontofficeSection />,
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
