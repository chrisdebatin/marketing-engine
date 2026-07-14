import { requireSession } from "@/lib/auth";
import { getMaterialTypes } from "@/lib/data";
import { createClient } from "@/lib/supabase/server";
import { ActivityList } from "@/components/activity-list";
import type { Activity } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function EintraegePage() {
  const session = await requireSession();
  const supabase = await createClient();

  const [{ data: activities }, materialTypes] = await Promise.all([
    supabase
      .from("activities")
      .select("*")
      .eq("user_id", session.userId)
      .order("occurred_on", { ascending: false })
      .order("created_at", { ascending: false }),
    getMaterialTypes(),
  ]);

  const hubNames = Object.fromEntries(session.hubs.map((h) => [h.id, h.name]));
  const materialNames = Object.fromEntries(
    materialTypes.map((m) => [m.id, m.name]),
  );

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight">
          Meine Einträge
        </h1>
        <p className="text-sm text-muted-foreground">
          Erfasste Aktivitäten – Änderungen werden offline gespeichert und
          automatisch synchronisiert.
        </p>
      </div>
      <ActivityList
        initial={(activities ?? []) as Activity[]}
        hubNames={hubNames}
        materialNames={materialNames}
      />
    </div>
  );
}
