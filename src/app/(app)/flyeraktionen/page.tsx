import { requireSession } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  FlyerActionsManager,
  type FlyerActionRow,
} from "@/components/flyer-actions-manager";
import { FlyerMap } from "@/components/flyer-map";
import { PageHeader } from "@/components/page-header";

export const dynamic = "force-dynamic";

export default async function FlyerAktionenPage() {
  await requireSession();
  // `flyer_actions` hat RLS disabled → nur über den Service-Role-Client.
  const admin = createAdminClient();

  // Fallback ?? [] — fehlt Migration 0019, darf die Seite nicht crashen.
  const { data } = await admin
    .from("flyer_actions")
    .select("id, action_date, anzahl, plz, inhalt, note, ort")
    .order("action_date", { ascending: false })
    .order("created_at", { ascending: false });

  const actions = (data ?? []) as FlyerActionRow[];

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Flyeraktionen"
        description="Log der durchgeführten Verteil- und Postwurf-Aktionen: Datum, Anzahl, Ziel-PLZ und Inhalt."
      />

      <FlyerMap actions={actions} />

      <FlyerActionsManager initial={actions} />
    </div>
  );
}
