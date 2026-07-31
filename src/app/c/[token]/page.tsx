import { notFound } from "next/navigation";
import { PhoneOutgoing } from "lucide-react";
import { createAdminClient } from "@/lib/supabase/admin";
import { isCallcenterToken } from "@/lib/frontoffice-token";
import {
  CallcenterCrm,
  type CallcenterContactRow,
} from "@/components/callcenter-crm";
import type {
  CrmPersonRow,
  CrmTargetRow,
} from "@/components/crm-targets-manager";

export const dynamic = "force-dynamic";

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
      <div className="flex items-start gap-3">
        <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
          <PhoneOutgoing className="size-5" />
        </span>
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            Call-Center · Klinik-Kontakte
          </h1>
          <p className="mt-0.5 text-sm text-muted-foreground">
            Die Anruf-Liste der Kliniken abarbeiten: fällige zuerst, jeden
            Anruf loggen. Jeder Kontakt landet im zentralen CRM — in
            derselben Institutions-Historie, mit der auch die PDLs arbeiten.
          </p>
        </div>
      </div>

      <CallcenterCrm
        targets={(targetRows ?? []) as CrmTargetRow[]}
        persons={(personRows ?? []) as CrmPersonRow[]}
        contacts={(contactRows ?? []) as CallcenterContactRow[]}
        hubs={hubRows ?? []}
      />
    </main>
  );
}
