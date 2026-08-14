import { notFound } from "next/navigation";
import { Headset } from "lucide-react";
import { createAdminClient } from "@/lib/supabase/admin";
import { isFrontofficeToken } from "@/lib/frontoffice-token";
import { capacityWeekStart } from "@/lib/capacity";
import { LeadBoard, type LeadRow } from "@/components/lead-board";
import { PageHeader } from "@/components/page-header";

export const dynamic = "force-dynamic";

/**
 * Callcenter-Link (token-gated, ohne Login): Lead-Erfassung für alle drei
 * Bereiche — mehr vom Dashboard gibt es hier nicht.
 */
export default async function FrontofficeTokenPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  if (!(await isFrontofficeToken(token))) notFound();

  const admin = createAdminClient();
  const cutoff28 = (() => {
    const d = new Date();
    d.setDate(d.getDate() - 28);
    return d.toISOString().slice(0, 10);
  })();

  const [{ data: hubRows }, { data: leadRows }, { data: klinikRows }] =
    await Promise.all([
      admin.from("hubs").select("id, name").order("name"),
      admin
        .from("lead_calls")
        .select("*")
        .gte("call_date", cutoff28)
        .order("call_date", { ascending: false })
        .order("created_at", { ascending: false })
        .limit(30),
      admin
        .from("crm_targets")
        .select("name")
        .eq("kategorie", "krankenhaus")
        .order("name")
        .limit(400),
    ]);

  const leads = (leadRows ?? []) as LeadRow[];
  const klinikNamen = [
    ...new Set((klinikRows ?? []).map((k) => k.name)),
  ].slice(0, 250);

  const weekStart = capacityWeekStart();
  const dieseWoche = leads.filter((l) => l.call_date >= weekStart).length;

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-5 px-4 py-8">
      <PageHeader
        icon={Headset}
        title="Frontoffice · Lead-Erfassung"
        description={`Jeden Interessenten-Anruf hier loggen — Bereich und Quelle wählen, Name eintragen, Standort der Weiterleitung, fertig.${
          dieseWoche > 0
            ? ` Diese Woche bereits ${dieseWoche} Lead${dieseWoche === 1 ? "" : "s"}.`
            : ""
        }`}
      />

      <LeadBoard hubs={hubRows ?? []} recent={leads} klinikNamen={klinikNamen} />
    </main>
  );
}
