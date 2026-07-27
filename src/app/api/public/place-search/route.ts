import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { hubCoords } from "@/lib/hub-coords";

export const runtime = "nodejs";

/**
 * Orts-Suche für das Schnell-Log (token-gated): schlägt echte Orte aus der
 * Karte vor, mit Umkreis-Bias auf den Standort des Hubs.
 *
 * - Mit GOOGLE_MAPS_API_KEY: Google Places (Text Search) — beste Qualität.
 * - Ohne Key: Photon/OpenStreetMap als kostenloser Fallback.
 */

export interface PlaceSuggestion {
  name: string;
  adresse: string | null;
  ort: string | null;
  kategorie: string | null;
}

const GOOGLE_TYPE_MAP: [RegExp, string][] = [
  [/hospital/, "krankenhaus"],
  [/doctor|physiotherapist|dental|medical_lab/, "praxis"],
  [/pharmacy|drugstore/, "apotheke"],
  [/nursing|retirement|assisted_living/, "pflegeeinrichtung"],
];

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

async function searchGoogle(
  q: string,
  coords: [number, number] | null,
): Promise<PlaceSuggestion[] | null> {
  const key = process.env.GOOGLE_MAPS_API_KEY;
  if (!key) return null;
  try {
    const res = await fetch("https://places.googleapis.com/v1/places:searchText", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": key,
        "X-Goog-FieldMask":
          "places.displayName,places.formattedAddress,places.types,places.addressComponents",
      },
      body: JSON.stringify({
        textQuery: q,
        languageCode: "de",
        regionCode: "DE",
        pageSize: 6,
        ...(coords
          ? {
              locationBias: {
                circle: {
                  center: { latitude: coords[0], longitude: coords[1] },
                  radius: 30000,
                },
              },
            }
          : {}),
      }),
    });
    if (!res.ok) {
      console.error("place-search: Google-Fehler", res.status);
      return null;
    }
    const body = (await res.json()) as {
      places?: {
        displayName?: { text?: string };
        formattedAddress?: string;
        types?: string[];
        addressComponents?: { types?: string[]; longText?: string }[];
      }[];
    };
    return (body.places ?? []).flatMap((p) => {
      const name = p.displayName?.text?.trim();
      if (!name) return [];
      const typeStr = (p.types ?? []).join(" ");
      const kategorie =
        GOOGLE_TYPE_MAP.find(([re]) => re.test(typeStr))?.[1] ?? null;
      const city =
        p.addressComponents?.find((c) => c.types?.includes("locality"))
          ?.longText ?? null;
      // formattedAddress enthält Stadt/Land — nur Straße + Nr. behalten.
      const street = (p.formattedAddress ?? "").split(",")[0]?.trim() || null;
      return [{ name, adresse: street, ort: city, kategorie }];
    });
  } catch (err) {
    console.error("place-search: Google nicht erreichbar", err);
    return null;
  }
}

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

  const coords = hubCoords(hub.name);
  const places =
    (await searchGoogle(q, coords)) ?? (await searchPhoton(q, coords));

  return NextResponse.json({ places: places.slice(0, 6) });
}
