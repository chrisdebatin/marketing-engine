import { notFound } from "next/navigation";
import { Headset } from "lucide-react";
import { createAdminClient } from "@/lib/supabase/admin";
import { resolveFrontofficeToken } from "@/lib/frontoffice-token";
import { hubsForBereich, leadBereichLabel } from "@/lib/leads";
import { capacityWeekStart } from "@/lib/capacity";
import { LeadBoard, type LeadRow } from "@/components/lead-board";

export const dynamic = "force-dynamic";

/**
 * Callcenter-Link (token-gated, ohne Login): Lead-Erfassung nur für den
 * eigenen Bereich (Alltagshilfe / Ambulant / Intensiv) — ohne Rest-Dashboard.
 */
export default async function FrontofficeTokenPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const bereich = await resolveFrontofficeToken(token);
  if (!bereich) notFound();

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
        .eq("bereich", bereich)
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

  const hubs = hubsForBereich(hubRows ?? [], bereich);
  const leads = (leadRows ?? []) as LeadRow[];
  const klinikNamen = [
    ...new Set((klinikRows ?? []).map((k) => k.name)),
  ].slice(0, 250);

  const weekStart = capacityWeekStart();
  const dieseWoche = leads.filter((l) => l.call_date >= weekStart).length;

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-5 px-4 py-8">
      <div className="flex items-start gap-3">
        <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
          <Headset className="size-5" />
        </span>
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            Frontoffice · Interessent {leadBereichLabel(bereich)}
          </h1>
          <p className="mt-0.5 text-sm text-muted-foreground">
            Jeden Interessenten-Anruf hier loggen — Quelle wählen, ggf.
            Klinik angeben, Standort der Weiterleitung, fertig.{" "}
            {dieseWoche > 0
              ? `Diese Woche bereits ${dieseWoche} Lead${dieseWoche === 1 ? "" : "s"}.`
              : ""}
          </p>
        </div>
      </div>

      <LeadBoard
        hubs={hubs}
        recent={leads}
        fixedBereich={bereich}
        klinikNamen={klinikNamen}
      />
    </main>
  );
}
