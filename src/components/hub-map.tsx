"use client";

import { useEffect, useRef } from "react";
import type { Map as LeafletMap } from "leaflet";
import "leaflet/dist/leaflet.css";

export interface HubMarker {
  name: string;
  md: string | null;
  pdl: string | null;
  color: string;
  lat: number;
  lng: number;
  flyers: number;
  aufsteller: number;
  boxes: number;
  placements: number;
}

function esc(s: string): string {
  return s.replace(
    /[&<>"]/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c] ?? c,
  );
}

export function HubMap({ markers }: { markers: HubMarker[] }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<LeafletMap | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const L = await import("leaflet");
      if (cancelled || !containerRef.current || mapRef.current) return;

      const map = L.map(containerRef.current).setView([51.3, 8.2], 6);
      mapRef.current = map;

      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: "&copy; OpenStreetMap",
        maxZoom: 19,
      }).addTo(map);

      const bounds: [number, number][] = [];
      for (const m of markers) {
        L.circleMarker([m.lat, m.lng], {
          radius: 9,
          color: "#ffffff",
          weight: 2,
          fillColor: m.color,
          fillOpacity: 0.9,
        })
          .addTo(map)
          .bindPopup(
            `<strong>${esc(m.name)}</strong><br/>` +
              `MD: ${esc(m.md ?? "—")}<br/>` +
              `PDL: ${esc(m.pdl ?? "—")}<br/>` +
              `${m.flyers} Flyer · ${m.aufsteller} Aufsteller · ${m.boxes} Boxen geliefert<br/>` +
              `${m.placements} Orte eingetragen`,
          );
        bounds.push([m.lat, m.lng]);
      }
      if (bounds.length > 0) map.fitBounds(bounds, { padding: [30, 30] });
      setTimeout(() => map.invalidateSize(), 120);
    })();

    return () => {
      cancelled = true;
      mapRef.current?.remove();
      mapRef.current = null;
    };
  }, [markers]);

  return (
    <div
      ref={containerRef}
      className="z-0 h-[70vh] w-full overflow-hidden rounded-lg border"
    />
  );
}
