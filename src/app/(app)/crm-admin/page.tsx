import { redirect } from "next/navigation";
import { requireSession } from "@/lib/auth";
import { CrmAdminSection } from "@/components/crm-admin-section";
import { ZieleSection } from "@/app/(app)/crm/ziele-section";

export const dynamic = "force-dynamic";

/**
 * CRM-Admin (nur Admins, eigener Menüpunkt unter "CRM & Leads"): wer hat
 * was bearbeitet, Reaktionszeiten, Rückstand und PDL-Übergaben.
 */
export default async function CrmAdminPage() {
  const session = await requireSession();
  if (!session.isAdmin) redirect("/crm");

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h1 className="text-2xl font-semibold">CRM-Admin</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Auswertung über beide Teams: wer bearbeitet was, wie schnell werden
          Leads angefasst, und wie laufen die Übergaben an die PDLs.
        </p>
      </div>
      <CrmAdminSection />

      {/* Kontakte werden in den Team-Ansichten (/crm → Kontakte) gepflegt —
          hier nur noch Stats. Import & Einstellungen bleiben eingeklappt
          erreichbar. */}
      <details className="group rounded-xl border bg-card shadow-sm">
        <summary className="cursor-pointer list-none p-4 text-sm font-semibold select-none">
          Verwaltung (CSV-Import, Follow-up-Einstellungen, Institutionen)
          <span className="ml-2 text-xs font-normal text-muted-foreground group-open:hidden">
            aufklappen
          </span>
        </summary>
        <div className="border-t p-4">
          <ZieleSection mode="full" />
        </div>
      </details>
    </div>
  );
}
