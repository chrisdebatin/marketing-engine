import { requireSession } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { hubCoords, mdColor } from "@/lib/hub-coords";
import { pdlRoleShort } from "@/lib/leistungen";
import {
  PlacementMapBoard,
  type MapHub,
  type MapPlace,
} from "@/components/placement-map-board";

export const dynamic = "force-dynamic";

function formatDate(iso: string | null): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString("de-DE");
}

export default async function KartePage() {
  // Hubs aus der Session (Service-Client, MD-Scoping); Orte über den
  // Service-Client — gleiches Muster wie der Rest der App.
  const session = await requireSession();
  const admin = createAdminClient();

  // select("*") statt fester Spaltenliste: `place_kind` existiert erst nach
  // Migration 0018 — so rendert die Seite auch ohne die Spalte.
  const { data: placementsData } = await admin
    .from("delivery_placements")
    .select("*")
    .order("created_at", { ascending: false });

  const placements = (placementsData ?? []) as {
    hub_id: string;
    standort_name: string;
    menge: number | null;
    kind: string;
    place_kind?: string | null;
    ort?: string | null;
    adresse?: string | null;
    created_at: string | null;
  }[];

  // Nach Hub gruppieren, getrennt nach Flyer/Box.
  const byHub = new Map<string, { flyer: MapPlace[]; box: MapPlace[] }>();
  for (const p of placements) {
    const entry = byHub.get(p.hub_id) ?? { flyer: [], box: [] };
    const place: MapPlace = {
      name: p.standort_name,
      menge: p.menge,
      placeKind: p.place_kind ?? null,
      ort: p.ort ?? null,
      adresse: p.adresse ?? null,
      date: formatDate(p.created_at),
    };
    if (p.kind === "box") entry.box.push(place);
    else entry.flyer.push(place);
    byHub.set(p.hub_id, entry);
  }

  // Marker bauen; Hubs mit identischen Koordinaten leicht versetzen.
  const usedAt = new Map<string, number>();
  const mapHubs: MapHub[] = session.hubs.map((h) => {
    const coords = hubCoords(h.name);
    let lat: number | null = null;
    let lng: number | null = null;
    if (coords) {
      const key = `${coords[0]},${coords[1]}`;
      const n = usedAt.get(key) ?? 0;
      usedAt.set(key, n + 1);
      const angle = n * (Math.PI / 3);
      const r = n === 0 ? 0 : 0.02;
      lat = coords[0] + r * Math.cos(angle);
      lng = coords[1] + r * Math.sin(angle);
    }
    const entry = byHub.get(h.id) ?? { flyer: [], box: [] };
    return {
      id: h.id,
      name: h.name,
      md: h.responsible_md,
      pdl: h.pdl_name,
      pdlRole: pdlRoleShort(h.name),
      color: mdColor(h.responsible_md),
      lat,
      lng,
      flyer: entry.flyer,
      box: entry.box,
    };
  });

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-2xl font-semibold">Karte der Auslage-Orte</h1>
        <p className="text-sm text-muted-foreground">
          Alle Orte, die die PDLs über ihre Links eingetragen haben —
          Krankenhäuser, Praxen, Apotheken &amp; Co., gruppiert nach Hub.
          Farbe = verantwortlicher MD.
        </p>
      </div>

      <PlacementMapBoard hubs={mapHubs} />
    </div>
  );
}
