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

      <div className="mt-2 border-t pt-5">
        <h2 className="mb-3 text-lg font-semibold">Institutionen-CRM (Verwaltung)</h2>
        <ZieleSection mode="full" />
      </div>
    </div>
  );
}
