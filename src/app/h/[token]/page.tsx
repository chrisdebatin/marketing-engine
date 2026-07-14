import { notFound } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { PlacementBoard } from "@/components/placement-board";
import { OrderForm } from "@/components/order-form";

export const dynamic = "force-dynamic";

export default async function HubShareLinkPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const admin = createAdminClient();

  const { data: hub } = await admin
    .from("hubs")
    .select("id, name")
    .eq("share_token", token)
    .single();

  if (!hub) notFound();

  const [{ data: deliveries }, { data: placements }, { data: orders }] =
    await Promise.all([
      admin
        .from("deliveries")
        .select("flyer_count, box_count, aufsteller_count")
        .eq("hub_id", hub.id),
      admin
        .from("delivery_placements")
        .select("id, standort_name, menge, kind")
        .eq("hub_id", hub.id)
        .order("created_at", { ascending: false }),
      admin
        .from("orders")
        .select("id, material, quantity, status, note, created_at")
        .eq("hub_id", hub.id)
        .in("source", ["pdl", "admin"])
        .order("created_at", { ascending: false }),
    ]);

  const flyers = (deliveries ?? []).reduce((s, d) => s + (d.flyer_count ?? 0), 0);
  const boxes = (deliveries ?? []).reduce((s, d) => s + (d.box_count ?? 0), 0);
  const aufsteller = (deliveries ?? []).reduce(
    (s, d) => s + (d.aufsteller_count ?? 0),
    0,
  );

  return (
    <main className="mx-auto flex w-full max-w-xl flex-1 flex-col gap-6 px-4 py-8">
      <div>
        <p className="text-sm text-muted-foreground">Marketing-Engine</p>
        <h1 className="text-2xl font-semibold">
          Flyer &amp; Boxen · {hub.name}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {flyers > 0 ? (
            <>
              Für diesen Hub geliefert: <strong>{flyers} Flyer</strong>
              {aufsteller > 0 && <> · {aufsteller} Aufsteller</>}
              {boxes > 0 && <> · {boxes} Boxen</>}.{" "}
            </>
          ) : null}
          Trage ein, wo Flyer ausgelegt und wo Case-Management-Boxen geliefert
          wurden.
        </p>
      </div>

      <PlacementBoard
        token={token}
        initial={placements ?? []}
        endpoint="/api/public/hub-placement"
        allowBoxes
      />

      <section className="flex flex-col gap-3 border-t pt-6">
        <div>
          <h2 className="text-xl font-semibold">Material nachbestellen</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Boxen, Flyer oder Flyer-Aufsteller (Plexiglas) anfordern. Das
            Marketing-Team kümmert sich um den Versand.
          </p>
        </div>
        <OrderForm token={token} initial={orders ?? []} />
      </section>
    </main>
  );
}
