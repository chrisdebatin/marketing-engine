import { notFound } from "next/navigation";
import { ListChecks } from "lucide-react";
import { createAdminClient } from "@/lib/supabase/admin";
import { leistungenForHub } from "@/lib/leistungen";
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

  // Erfassbare Monate: aktueller Monat + zwei Vormonate (es wird oft
  // rückwirkend gemeldet, z. B. Mai bei Meldung im Juli).
  const now = new Date();
  const toPeriod = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  const flowPeriods = [0, 1, 2].map((back) =>
    toPeriod(new Date(now.getFullYear(), now.getMonth() - back, 1)),
  );

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
      .select("id, period, flow, leistung, display_name, reference_id, abgang_grund, note")
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
          Dies ist Ihre persönliche Seite für den Standort — kein Login nötig,
          Link einfach speichern.
        </p>
      </div>

      {/* Kurz-Überblick: was auf dieser Seite zu tun ist */}
      <StepBox
        title="So nutzen Sie diese Seite — 3 Aufgaben:"
        steps={[
          <>
            <strong className="text-foreground">Orte eintragen:</strong> Wo
            haben Sie Flyer ausgelegt oder Boxen abgegeben?
          </>,
          <>
            <strong className="text-foreground">Material bestellen:</strong>{" "}
            Nachschub an Flyern, Boxen &amp; Co. anfordern.
          </>,
          <>
            <strong className="text-foreground">Patienten melden:</strong>{" "}
            Jeden Monat alle Neuaufnahmen und Abgänge eintragen.
          </>,
        ]}
      />

      <section className="flex flex-col gap-3">
        <div>
          <h2 className="text-xl font-semibold">
            1. Auslage-Orte eintragen
          </h2>
        </div>
        <StepBox
          title="So geht's:"
          steps={[
            <>
              Oben wählen:{" "}
              <strong className="text-foreground">„Flyer ausgelegt&rdquo;</strong>{" "}
              oder{" "}
              <strong className="text-foreground">„Box geliefert&rdquo;</strong>.
            </>,
            <>
              Ort eintragen (z.&nbsp;B. „Apotheke am Markt&rdquo;), Anzahl
              angeben und auf{" "}
              <strong className="text-foreground">„Hinzufügen&rdquo;</strong>{" "}
              klicken.
            </>,
            <>
              Vertippt? Über das{" "}
              <strong className="text-foreground">Stift-Symbol</strong> am
              Eintrag können Sie Ort und Anzahl jederzeit korrigieren.
            </>,
          ]}
        />
        <PlacementBoard
          token={token}
          initial={placements ?? []}
          endpoint="/api/public/hub-placement"
          allowBoxes
        />
      </section>

      <section className="flex flex-col gap-3 border-t pt-6">
        <div>
          <h2 className="text-xl font-semibold">2. Material bestellen</h2>
        </div>
        <StepBox
          title="So geht's:"
          steps={[
            <>
              Beim gewünschten Material die{" "}
              <strong className="text-foreground">Menge</strong> eintragen und{" "}
              <strong className="text-foreground">
                „In den Warenkorb&rdquo;
              </strong>{" "}
              klicken — gern mehrere Materialien sammeln.
            </>,
            <>
              Unten im Warenkorb auf{" "}
              <strong className="text-foreground">
                „Bestellung absenden&rdquo;
              </strong>{" "}
              klicken. Das Marketing-Team kümmert sich um den Versand.
            </>,
            <>
              Etwas nicht dabei? Über{" "}
              <strong className="text-foreground">
                „Etwas anderes benötigt?&rdquo;
              </strong>{" "}
              frei beschreiben und direkt bestellen. Den Status sehen Sie unter
              „Deine Bestellungen&rdquo;.
            </>,
          ]}
          footer={
            <>
              <strong className="text-foreground">
                Bitte nur bei tatsächlichem Bedarf bestellen.
              </strong>{" "}
              Bei Rückfragen gern anrufen:{" "}
              <a href="tel:+491772988173" className="text-primary underline">
                0177&nbsp;2988&nbsp;173
              </a>{" "}
              — oder per E-Mail an{" "}
              <a
                href="mailto:marketing@igs-holding.de"
                className="text-primary underline"
              >
                marketing@igs-holding.de
              </a>
              .
            </>
          }
        />
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
            3. Patienten-Meldung: Zu- &amp; Abgänge
          </h2>
        </div>
        <PatientFlowReport
          token={token}
          months={flowMonths}
          leistungen={leistungenForHub(hub.name)}
        />
      </section>
    </main>
  );
}

/** Einheitliche, einfache Schritt-für-Schritt-Erklärung je Bereich. */
function StepBox({
  title,
  steps,
  footer,
}: {
  title: string;
  steps: React.ReactNode[];
  footer?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-2 rounded-xl border border-primary/20 bg-primary/[0.04] p-4 text-sm">
      <p className="flex items-center gap-2 font-semibold">
        <ListChecks className="size-4 text-primary" />
        {title}
      </p>
      <ol className="ml-5 flex list-decimal flex-col gap-1 text-muted-foreground">
        {steps.map((s, i) => (
          <li key={i}>{s}</li>
        ))}
      </ol>
      {footer && <p className="text-xs text-muted-foreground">{footer}</p>}
    </div>
  );
}
