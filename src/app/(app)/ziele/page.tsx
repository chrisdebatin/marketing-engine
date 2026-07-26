import { requireSession } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  CrmTargetsManager,
  type CrmTargetRow,
} from "@/components/crm-targets-manager";

export const dynamic = "force-dynamic";

/**
 * CRM: zentrale Liste der Ziel-Orte (Krankenhäuser, Praxen, …) mit
 * Hub-Zuteilung und Follow-up-Rhythmus. Die PDLs sehen ihre Besuchs-Liste
 * auf dem eigenen Dashboard und haken Besuche dort ab.
 */
export default async function ZielePage() {
  const session = await requireSession();
  const admin = createAdminClient();

  // Fallback ?? [] — fehlt Migration 0026, darf die Seite nicht crashen.
  const { data } = await admin
    .from("crm_targets")
    .select("*")
    .order("name");

  const hubIds = new Set(session.hubs.map((h) => h.id));
  const targets = ((data ?? []) as CrmTargetRow[]).filter(
    (t) => t.hub_id === null || hubIds.has(t.hub_id),
  );

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold">Ziel-Orte (CRM)</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Deine zentrale Liste der Krankenhäuser, Praxen &amp; Co. — aufgeteilt
          auf die Hubs. Die PDLs sehen ihre Besuchs-Liste mit Fälligkeiten auf
          ihrem Dashboard und haken Besuche ab; danach wird automatisch das
          Follow-up terminiert.
        </p>
      </div>

      <CrmTargetsManager
        targets={targets}
        hubs={session.hubs.map((h) => ({ id: h.id, name: h.name }))}
      />
    </div>
  );
}
