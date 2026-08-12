import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { hubCoords } from "@/lib/hub-coords";
import { normName } from "@/lib/crm-log";
import { formatIsoDate, kontaktArtLabel } from "@/lib/crm";

export const runtime = "nodejs";

/**
 * Orts-Suche für das Schnell-Log (token-gated): schlägt echte Orte aus
 * OpenStreetMap (Photon) vor, mit Umkreis-Bias auf den Standort des Hubs.
 * Kostenlos, ohne API-Key.
 */

export interface PlaceSuggestion {
  name: string;
  adresse: string | null;
  ort: string | null;
  kategorie: string | null;
  /** Disclaimer, wer (PDL/Standort) schon dort war bzw. den Ort auf der Liste hat. */
  hinweis?: string | null;
}

const OSM_VALUE_MAP: Record<string, string> = {
  hospital: "krankenhaus",
  clinic: "krankenhaus",
  doctors: "praxis",
  dentist: "praxis",
  physiotherapist: "praxis",
  pharmacy: "apotheke",
  nursing_home: "pflegeeinrichtung",
  social_facility: "pflegeeinrichtung",
  medical_supply: "sanitaetshaus",
};

async function searchPhoton(
  q: string,
  coords: [number, number] | null,
): Promise<PlaceSuggestion[]> {
  try {
    const params = new URLSearchParams({ q, limit: "6", lang: "de" });
    if (coords) {
      params.set("lat", String(coords[0]));
      params.set("lon", String(coords[1]));
    }
    const res = await fetch(`https://photon.komoot.io/api/?${params}`, {
      headers: { "User-Agent": "marketing-engine (interne Orts-Suche)" },
    });
    if (!res.ok) return [];
    const body = (await res.json()) as {
      features?: {
        properties?: {
          name?: string;
          street?: string;
          housenumber?: string;
          city?: string;
          osm_value?: string;
        };
      }[];
    };
    return (body.features ?? []).flatMap((f) => {
      const p = f.properties ?? {};
      if (!p.name) return [];
      const adresse = [p.street, p.housenumber].filter(Boolean).join(" ") || null;
      return [
        {
          name: p.name,
          adresse,
          ort: p.city ?? null,
          kategorie: OSM_VALUE_MAP[p.osm_value ?? ""] ?? null,
        },
      ];
    });
  } catch {
    return [];
  }
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const token = (url.searchParams.get("token") ?? "").trim();
  const q = (url.searchParams.get("q") ?? "").trim();
  if (!token || q.length < 3) {
    return NextResponse.json({ places: [] });
  }

  const admin = createAdminClient();
  const { data: hub } = await admin
    .from("hubs")
    .select("id, name")
    .eq("share_token", token)
    .single();
  if (!hub) {
    return NextResponse.json({ error: "Ungültiger Link." }, { status: 404 });
  }

  // Vorschläge gegen die Listen ALLER Standorte abgleichen: Nachbar-Hubs
  // bekommen von OSM oft dieselben Kliniken vorgeschlagen — der Hinweis
  // zeigt, wer den Ort schon auf der Liste hat und wann dort Kontakt war.
  const [places, { data: targetRows }, { data: hubRows }] = await Promise.all([
    searchPhoton(q, hubCoords(hub.name)),
    admin
      .from("crm_targets")
      .select("name, ort, hub_id, letzter_besuch, letzte_kontakt_art")
      .not("hub_id", "is", null),
    admin.from("hubs").select("id, name, pdl_name"),
  ]);
  const hubName = (id: string | null) =>
    (hubRows ?? []).find((h) => h.id === id)?.name ?? "einem anderen Standort";
  // "PDL Sabine M. (Hameln)" — Name macht die Absprache leichter als nur der Standort.
  const wer = (id: string | null) => {
    const h = (hubRows ?? []).find((x) => x.id === id);
    return h?.pdl_name ? `${h.pdl_name} (${h.name})` : hubName(id);
  };

  const withHint = places.slice(0, 6).map((p) => {
    const pn = normName(p.name);
    if (pn.length < 5) return p;
    const owner = (targetRows ?? []).find((t) => {
      const tn = normName(t.name);
      const nameMatch =
        tn === pn ||
        (pn.length >= 8 && tn.includes(pn)) ||
        (tn.length >= 8 && pn.includes(tn));
      if (!nameMatch) return false;
      const po = (p.ort ?? "").trim().toLowerCase();
      const to = (t.ort ?? "").trim().toLowerCase();
      // Bei widersprüchlichen Orten (z. B. gleichnamige Apotheken in zwei
      // Städten) kein Treffer; fehlender Ort auf einer Seite zählt als Treffer.
      if (po && to && !to.includes(po) && !po.includes(to)) return false;
      return true;
    });
    if (!owner) return p;
    if (owner.hub_id === hub.id) {
      return { ...p, hinweis: "Bereits auf Ihrer Liste" };
    }
    // Anderer Standort war schon dort → bleibt wählbar, aber mit klarem
    // "wer wo schon war"-Disclaimer (PDL-Name, Kontaktart, Datum).
    if (owner.letzter_besuch) {
      return {
        ...p,
        hinweis: `Schon von ${wer(owner.hub_id)} besucht — ${kontaktArtLabel(owner.letzte_kontakt_art) || "Kontakt"} am ${formatIsoDate(owner.letzter_besuch)}`,
      };
    }
    return {
      ...p,
      hinweis: `Steht auf der Liste von ${wer(owner.hub_id)} — dort noch kein Kontakt, bitte kurz absprechen`,
    };
  });

  return NextResponse.json({ places: withHint });
}
