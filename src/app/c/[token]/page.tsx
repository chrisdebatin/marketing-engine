import { notFound } from "next/navigation";
import { PhoneOutgoing } from "lucide-react";
import { createAdminClient } from "@/lib/supabase/admin";
import { isCallcenterToken } from "@/lib/frontoffice-token";
import { PageHeader } from "@/components/page-header";
import {
  CallcenterCrm,
  type CallcenterContactRow,
} from "@/components/callcenter-crm";
import type {
  CrmPersonRow,
  CrmTargetRow,
} from "@/components/crm-targets-manager";

export const dynamic = "force-dynamic";
// Server-Actions dieser Seite rufen Claude auf — mehr Zeit als die 10s-Vorgabe.
export const maxDuration = 60;

/**
 * Call-Center-Link (token-gated, ohne Login): die Anruf-Liste der
 * Institutionen (Krankenhäuser & Co.) abarbeiten — auf demselben CRM wie
 * das interne „Ziele“ und die PDL-Dashboards.
 */
export default async function CallcenterTokenPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  if (!(await isCallcenterToken(token))) notFound();

  const admin = createAdminClient();
  const [
    { data: targetRows },
    { data: personRows },
    { data: contactRows },
    { data: hubRows },
  ] = await Promise.all([
    admin.from("crm_targets").select("*").order("name").limit(2000),
    admin.from("crm_persons").select("*").order("name").limit(4000),
    admin
      .from("crm_contacts")
      .select("id, target_id, kontakt_art, ansprechpartner, note, contact_date")
      .order("contact_date", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(500),
    admin.from("hubs").select("id, name, pdl_name, pdl_phone").order("name"),
  ]);

  return (
    <main className="mx-auto flex w-full max-w-4xl flex-1 flex-col gap-5 px-4 py-8">
      <PageHeader
        icon={PhoneOutgoing}
        title="Call-Center · Klinik-Kontakte"
        description="Die Anruf-Liste der Kliniken abarbeiten: fällige zuerst, jeden Anruf loggen. Jeder Kontakt landet im zentralen CRM — in derselben Institutions-Historie, mit der auch die PDLs arbeiten."
      />

      <CallcenterCrm
        targets={(targetRows ?? []) as CrmTargetRow[]}
        persons={(personRows ?? []) as CrmPersonRow[]}
        contacts={(contactRows ?? []) as CallcenterContactRow[]}
        hubs={hubRows ?? []}
      />
    </main>
  );
}
