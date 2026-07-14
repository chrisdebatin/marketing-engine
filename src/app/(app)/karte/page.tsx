import { requireSession } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { hubCoords, mdColor } from "@/lib/hub-coords";
import { HubMap, type HubMarker } from "@/components/hub-map";
import type { Hub } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function KartePage() {
  await requireSession();
  const supabase = await createClient();

  const [{ data: hubsData }, { data: deliveries }, { data: placements }] =
    await Promise.all([
      supabase
        .from("hubs")
        .select("id, name, responsible_md, pdl_name")
        .order("name"),
      supabase
        .from("deliveries")
        .select("hub_id, flyer_count, box_count, aufsteller_count"),
      supabase.from("delivery_placements").select("hub_id"),
    ]);

  const hubs = (hubsData ?? []) as Pick<
    Hub,
    "id" | "name" | "responsible_md" | "pdl_name"
  >[];

  const flyers = new Map<string, number>();
  const aufsteller = new Map<string, number>();
  const boxes = new Map<string, number>();
  const placed = new Map<string, number>();
  for (const d of deliveries ?? []) {
    flyers.set(d.hub_id, (flyers.get(d.hub_id) ?? 0) + (d.flyer_count ?? 0));
    aufsteller.set(
      d.hub_id,
      (aufsteller.get(d.hub_id) ?? 0) + (d.aufsteller_count ?? 0),
    );
    boxes.set(d.hub_id, (boxes.get(d.hub_id) ?? 0) + (d.box_count ?? 0));
  }
  for (const p of placements ?? [])
    placed.set(p.hub_id, (placed.get(p.hub_id) ?? 0) + 1);

  // build markers, jittering hubs that share the same coordinates
  const usedAt = new Map<string, number>();
  const markers: HubMarker[] = [];
  const withoutCoords: string[] = [];

  for (const h of hubs) {
    const coords = hubCoords(h.name);
    if (!coords) {
      withoutCoords.push(h.name);
      continue;
    }
    const key = `${coords[0]},${coords[1]}`;
    const n = usedAt.get(key) ?? 0;
    usedAt.set(key, n + 1);
    const angle = n * (Math.PI / 3);
    const r = n === 0 ? 0 : 0.02;
    markers.push({
      name: h.name,
      md: h.responsible_md,
      pdl: h.pdl_name,
      color: mdColor(h.responsible_md),
      lat: coords[0] + r * Math.cos(angle),
      lng: coords[1] + r * Math.sin(angle),
      flyers: flyers.get(h.id) ?? 0,
      aufsteller: aufsteller.get(h.id) ?? 0,
      boxes: boxes.get(h.id) ?? 0,
      placements: placed.get(h.id) ?? 0,
    });
  }

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-2xl font-semibold">Karte</h1>
        <p className="text-sm text-muted-foreground">
          Deine Hubs auf der Karte. Farbe = verantwortlicher MD. Klick auf einen
          Pin für Details.
        </p>
      </div>

      <HubMap markers={markers} />

      {withoutCoords.length > 0 && (
        <p className="text-xs text-muted-foreground">
          Ohne Standort (nicht auf der Karte): {withoutCoords.join(", ")}
        </p>
      )}
    </div>
  );
}
