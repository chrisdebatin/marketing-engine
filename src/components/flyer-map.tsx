"use client";

import { useEffect, useRef } from "react";
import type { Map as LeafletMap } from "leaflet";
import "leaflet/dist/leaflet.css";
import type { FlyerActionRow } from "@/components/flyer-actions-manager";

/**
 * Karte der Flyeraktionen: ein Kreis je verteilter PLZ, Farbe je Aktion,
 * Größe nach Flyer-Anzahl. PLZ-Koordinaten kommen von zippopotam.us
 * (kostenlos, ohne Key) und werden im localStorage gecacht — offline oder
 * bei API-Ausfall fehlen einzelne Kreise, mehr nicht.
 */

const CACHE_KEY = "plz-coords-v1";
const PALETTE = [
  "#7c3aed",
  "#0ea5e9",
  "#f59e0b",
  "#ef4444",
  "#10b981",
  "#ec4899",
  "#6366f1",
  "#14b8a6",
];

type Coords = Record<string, [number, number]>;

function loadCache(): Coords {
  try {
    return JSON.parse(localStorage.getItem(CACHE_KEY) ?? "{}") as Coords;
  } catch {
    return {};
  }
}

async function geocodePlz(plz: string, cache: Coords): Promise<[number, number] | null> {
  if (cache[plz]) return cache[plz];
  try {
    const res = await fetch(`https://api.zippopotam.us/de/${plz}`);
    if (!res.ok) return null;
    const json = (await res.json()) as {
      places?: { latitude: string; longitude: string }[];
    };
    const p = json.places?.[0];
    if (!p) return null;
    const coords: [number, number] = [Number(p.latitude), Number(p.longitude)];
    cache[plz] = coords;
    try {
      localStorage.setItem(CACHE_KEY, JSON.stringify(cache));
    } catch {
      /* Cache voll — egal */
    }
    return coords;
  } catch {
    return null;
  }
}

function esc(s: string): string {
  return s.replace(
    /[&<>"]/g,
    (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c] ?? c,
  );
}

export function FlyerMap({ actions }: { actions: FlyerActionRow[] }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<LeafletMap | null>(null);

  useEffect(() => {
    if (actions.length === 0) return;
    let cancelled = false;
    void (async () => {
      const L = await import("leaflet");
      if (cancelled || !containerRef.current || mapRef.current) return;

      const map = L.map(containerRef.current).setView([51.4, 7.5], 8);
      mapRef.current = map;
      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: "&copy; OpenStreetMap",
        maxZoom: 19,
      }).addTo(map);

      const cache = loadCache();
      const bounds: [number, number][] = [];

      for (let i = 0; i < actions.length; i++) {
        const a = actions[i];
        const color = PALETTE[i % PALETTE.length];
        const plzList = a.plz.split(/,\s*/).filter(Boolean);
        const perPlz = a.anzahl / Math.max(plzList.length, 1);
        // Radius nach Flyer-Menge je PLZ (Wurzel-Skala, 7–20 px)
        const radius = Math.min(20, Math.max(7, Math.sqrt(perPlz) / 6));

        for (const plz of plzList) {
          const coords = await geocodePlz(plz, cache);
          if (!coords || cancelled || !mapRef.current) continue;
          bounds.push(coords);
          L.circleMarker(coords, {
            radius,
            color: "#ffffff",
            weight: 2,
            fillColor: color,
            fillOpacity: 0.75,
          })
            .addTo(map)
            .bindPopup(
              `<strong>${esc(a.ort ?? `PLZ ${plz}`)}</strong><br/>` +
                `PLZ ${esc(plz)} · ${a.anzahl.toLocaleString("de-DE")} Flyer (Aktion)<br/>` +
                `${new Date(`${a.action_date}T00:00:00`).toLocaleDateString("de-DE")} · ${esc(a.inhalt)}`,
            );
          if (bounds.length > 0) {
            map.fitBounds(L.latLngBounds(bounds).pad(0.2));
          }
        }
      }
    })();
    return () => {
      cancelled = true;
      mapRef.current?.remove();
      mapRef.current = null;
    };
  }, [actions]);

  if (actions.length === 0) return null;

  return (
    <div className="overflow-hidden rounded-xl border shadow-sm">
      <div ref={containerRef} className="h-80 w-full sm:h-96" />
    </div>
  );
}
