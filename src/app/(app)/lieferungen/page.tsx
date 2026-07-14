import Link from "next/link";
import { Truck } from "lucide-react";
import { requireSession } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CopyLink } from "@/components/copy-link";
import { HubTags } from "@/components/md-tag";
import { OrderPlanner, type PlannerOrder } from "@/components/order-planner";
import type { Delivery, Order } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function LieferungenPage() {
  const session = await requireSession();
  const supabase = await createClient();
  // `orders` has RLS disabled and no anon grant, so it is only readable via the
  // service-role client (same pattern as the public PDL routes).
  const admin = createAdminClient();

  const [{ data: deliveries }, { data: ordersData }] = await Promise.all([
    supabase
      .from("deliveries")
      .select(
        "id, hub_id, flyer_count, box_count, aufsteller_count, note, share_token, created_at",
      )
      .order("created_at", { ascending: false }),
    admin
      .from("orders")
      .select(
        "id, hub_id, hub_input, material, quantity, status, source, note, created_at",
      )
      .in("source", ["plan", "pdl", "admin"])
      .order("created_at", { ascending: false }),
  ]);

  const list = (deliveries ?? []) as Delivery[];

  // placement counts per delivery
  const ids = list.map((d) => d.id);
  const counts = new Map<string, number>();
  if (ids.length > 0) {
    const { data: pls } = await supabase
      .from("delivery_placements")
      .select("delivery_id")
      .in("delivery_id", ids);
    for (const p of pls ?? []) {
      if (!p.delivery_id) continue;
      counts.set(p.delivery_id, (counts.get(p.delivery_id) ?? 0) + 1);
    }
  }

  const hubName = (id: string) =>
    session.hubs.find((h) => h.id === id)?.name ?? id;
  const hubMd = (id: string) =>
    session.hubs.find((h) => h.id === id)?.responsible_md ?? null;
  const hubPdl = (id: string) =>
    session.hubs.find((h) => h.id === id)?.pdl_name ?? null;

  const hubOptions = session.hubs.map((h) => ({
    id: h.id,
    name: h.name,
    responsible_md: h.responsible_md,
    pdl_name: h.pdl_name,
  }));
  const plannerOrders: PlannerOrder[] = (
    (ordersData ?? []) as Pick<
      Order,
      | "id"
      | "hub_id"
      | "hub_input"
      | "material"
      | "quantity"
      | "status"
      | "source"
      | "note"
      | "created_at"
    >[]
  ).map((o) => ({
    id: o.id,
    hub_id: o.hub_id,
    hub_name:
      (o.hub_id ? session.hubs.find((h) => h.id === o.hub_id)?.name : null) ??
      o.hub_input ??
      "Unbekannter Hub",
    material: o.material,
    quantity: o.quantity,
    status: o.status,
    source: o.source,
    note: o.note,
    created_at: o.created_at,
  }));

  function formatDate(iso: string) {
    const d = new Date(iso);
    const pad = (n: number) => String(n).padStart(2, "0");
    return `${pad(d.getDate())}.${pad(d.getMonth() + 1)}.${d.getFullYear()}, ${pad(d.getHours())}:${pad(d.getMinutes())} Uhr`;
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Lieferungen</h1>
        <Button
          size="sm"
          nativeButton={false}
          render={<Link href="/lieferungen/neu" />}
        >
          Neue Lieferung
        </Button>
      </div>

      <section className="flex flex-col gap-3">
        <div>
          <h2 className="text-lg font-semibold">
            Offene Bestellungen · Auslieferung planen
          </h2>
          <p className="text-sm text-muted-foreground">
            Plane, was an die Hubs geliefert werden soll. Enthält auch
            Material-Anfragen der PDLs. Status setzen, wenn erledigt.
          </p>
        </div>
        <OrderPlanner orders={plannerOrders} hubs={hubOptions} />
      </section>

      <div className="border-t pt-6">
        <h2 className="mb-3 text-lg font-semibold">Erfasste Lieferungen</h2>
      </div>

      {list.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Noch keine Lieferungen erfasst.{" "}
          <Link href="/lieferungen/neu" className="underline">
            Jetzt erfassen
          </Link>
          .
        </p>
      ) : (
        <ul className="flex flex-col gap-2.5">
          {list.map((d) => {
            const placed = counts.get(d.id) ?? 0;
            return (
              <li
                key={d.id}
                className="flex flex-col gap-3 rounded-xl border bg-card p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="flex min-w-0 items-start gap-3">
                  <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    <Truck className="size-4.5" />
                  </span>
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-medium">{hubName(d.hub_id)}</span>
                      <HubTags md={hubMd(d.hub_id)} pdl={hubPdl(d.hub_id)} />
                    </div>
                    <div className="mt-1 flex flex-wrap items-center gap-1.5">
                      <Badge variant="outline">{d.flyer_count} Flyer</Badge>
                      {d.aufsteller_count > 0 && (
                        <Badge variant="outline">
                          {d.aufsteller_count} Aufsteller
                        </Badge>
                      )}
                      {d.box_count > 0 && (
                        <Badge variant="outline">{d.box_count} Boxen</Badge>
                      )}
                      <Badge variant={placed > 0 ? "secondary" : "outline"}>
                        {placed} Orte eingetragen
                      </Badge>
                    </div>
                    <p className="mt-1.5 text-xs text-muted-foreground">
                      {formatDate(d.created_at)}
                      {d.note ? ` · ${d.note}` : ""}
                    </p>
                  </div>
                </div>
                <CopyLink token={d.share_token} />
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
