import { notFound } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { PlacementBoard } from "@/components/placement-board";

export const dynamic = "force-dynamic";

export default async function ShareLinkPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const admin = createAdminClient();

  const { data: delivery } = await admin
    .from("deliveries")
    .select("id, hub_id, flyer_count, box_count, aufsteller_count, note")
    .eq("share_token", token)
    .single();

  if (!delivery) notFound();

  const [{ data: hub }, { data: placements }] = await Promise.all([
    admin.from("hubs").select("name").eq("id", delivery.hub_id).single(),
    admin
      .from("delivery_placements")
      .select("id, standort_name, menge")
      .eq("delivery_id", delivery.id)
      .order("created_at", { ascending: false }),
  ]);

  return (
    <main className="mx-auto flex w-full max-w-xl flex-1 flex-col gap-6 px-4 py-8">
      <div>
        <p className="text-sm text-muted-foreground">Marketing-Engine</p>
        <h1 className="text-2xl font-semibold">
          Flyer-Auslage · {hub?.name ?? "Hub"}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Geliefert: <strong>{delivery.flyer_count} Flyer</strong>
          {delivery.aufsteller_count > 0 && (
            <> · {delivery.aufsteller_count} Aufsteller</>
          )}
          {delivery.box_count > 0 && <> · {delivery.box_count} Boxen</>}. Bitte
          trage ein, wo die Flyer ausgelegt wurden.
        </p>
        {delivery.note && (
          <p className="mt-1 text-sm text-muted-foreground">
            Hinweis: {delivery.note}
          </p>
        )}
      </div>

      <PlacementBoard token={token} initial={placements ?? []} />
    </main>
  );
}
