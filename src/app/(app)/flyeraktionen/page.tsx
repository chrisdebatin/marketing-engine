import { requireSession } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  FlyerActionsManager,
  type FlyerActionRow,
} from "@/components/flyer-actions-manager";

export const dynamic = "force-dynamic";

export default async function FlyerAktionenPage() {
  await requireSession();
  // `flyer_actions` hat RLS disabled → nur über den Service-Role-Client.
  const admin = createAdminClient();

  // Fallback ?? [] — fehlt Migration 0019, darf die Seite nicht crashen.
  const { data } = await admin
    .from("flyer_actions")
    .select("id, action_date, anzahl, plz, inhalt, note")
    .order("action_date", { ascending: false })
    .order("created_at", { ascending: false });

  const actions = (data ?? []) as FlyerActionRow[];

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold">Flyeraktionen</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Log der durchgeführten Verteil- und Postwurf-Aktionen: Datum, Anzahl,
          Ziel-PLZ und Inhalt.
        </p>
      </div>

      <FlyerActionsManager initial={actions} />
    </div>
  );
}
