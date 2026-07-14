import { notFound } from "next/navigation";
import { requireSession } from "@/lib/auth";
import { getMaterialTypes, getStandortSuggestions } from "@/lib/data";
import { createClient } from "@/lib/supabase/server";
import { ActivityForm } from "@/components/activity-form";
import type { Activity, ActivityType } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function BearbeitenPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await requireSession();
  const supabase = await createClient();

  const { data: activity } = await supabase
    .from("activities")
    .select("*")
    .eq("id", id)
    .eq("user_id", session.userId)
    .single();

  if (!activity) notFound();
  const a = activity as Activity;

  const hubIds = session.hubs.map((h) => h.id);
  const [materialTypes, standorte] = await Promise.all([
    getMaterialTypes(),
    getStandortSuggestions(hubIds),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-semibold">Eintrag bearbeiten</h1>
      <ActivityForm
        mode="edit"
        hubs={session.hubs.map((h) => ({ id: h.id, name: h.name }))}
        materialTypes={materialTypes.map((m) => ({ id: m.id, name: m.name }))}
        standorte={standorte}
        initial={{
          id: a.id,
          hub_id: a.hub_id,
          standort_name: a.standort_name,
          type: a.type as ActivityType,
          occurred_on: a.occurred_on,
          note: a.note,
          details: (a.details ?? {}) as Record<string, unknown>,
        }}
      />
    </div>
  );
}
