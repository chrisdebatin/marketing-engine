import { notFound } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { PlacementBoard } from "@/components/placement-board";
import {
  OrderShop,
  type OrderWithItems,
  type ShopOrderItemLine,
} from "@/components/order-shop";
import {
  PatientFlowReport,
  type FlowEntry,
  type FlowMonth,
} from "@/components/patient-flow-report";

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

  // Erfassbare Monate: aktueller Monat + Vormonat (PDLs melden oft rückwirkend).
  const now = new Date();
  const toPeriod = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  const flowPeriods = [
    toPeriod(now),
    toPeriod(new Date(now.getFullYear(), now.getMonth() - 1, 1)),
  ];

  // material_catalog/order_items/patient_flows may not exist yet on the live
  // DB (migrations pending) — every query below falls back to [] instead of
  // crashing.
  const [
    { data: deliveries },
    { data: placements },
    { data: orders },
    { data: catalogData },
    { data: flowRows },
  ] = await Promise.all([
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
    admin
      .from("material_catalog")
      .select("key, name, description")
      .eq("active", true)
      .order("sort_order", { ascending: true }),
    admin
      .from("patient_flows")
      .select("id, period, flow, leistung, display_name, reference_id")
      .eq("hub_id", hub.id)
      .in("period", flowPeriods)
      .order("created_at", { ascending: true }),
  ]);

  const flowMonths: FlowMonth[] = flowPeriods.map((period) => ({
    period,
    entries: ((flowRows ?? []) as FlowEntry[]).filter(
      (e) => e.period === period,
    ),
  }));

  const catalog = catalogData ?? [];
  const orderList = orders ?? [];

  // Second simple query for the cart positions (no embedded-relation selects),
  // then join in JS.
  const itemsByOrder = new Map<string, ShopOrderItemLine[]>();
  if (orderList.length > 0) {
    const { data: itemRows } = await admin
      .from("order_items")
      .select("order_id, material_key, quantity")
      .in(
        "order_id",
        orderList.map((o) => o.id),
      );
    for (const row of itemRows ?? []) {
      const arr = itemsByOrder.get(row.order_id) ?? [];
      arr.push({ material_key: row.material_key, quantity: row.quantity });
      itemsByOrder.set(row.order_id, arr);
    }
  }

  const shopOrders: OrderWithItems[] = orderList.map((o) => ({
    ...o,
    items: itemsByOrder.get(o.id),
  }));

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
          <h2 className="text-xl font-semibold">Material bestellen</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Materialien in den Warenkorb legen und bestellen. Das
            Marketing-Team kümmert sich um den Versand.
          </p>
        </div>
        {catalog.length === 0 ? (
          <p className="rounded-xl border bg-card p-5 text-sm text-muted-foreground shadow-sm">
            Der Material-Katalog ist derzeit nicht verfügbar. Bitte später
            erneut versuchen oder das Marketing-Team direkt kontaktieren.
          </p>
        ) : (
          <OrderShop token={token} catalog={catalog} initial={shopOrders} />
        )}
      </section>

      <section className="flex flex-col gap-3 border-t pt-6">
        <div>
          <h2 className="text-xl font-semibold">
            Patienten-Meldung: Zu- &amp; Abgänge
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Bitte trage jeden Monat deine Neuaufnahmen und Abgänge je Leistung
            ein.
          </p>
        </div>
        <PatientFlowReport token={token} months={flowMonths} />
      </section>
    </main>
  );
}
