"use client";

import { useEffect, useRef, useState } from "react";
import type { Map as LeafletMap } from "leaflet";
import "leaflet/dist/leaflet.css";

/**
 * Karte über der Outbound-Anrufliste: ein Punkt je Institution (Geocoding
 * über den Orts-Namen via Photon/OSM, im localStorage gecacht). Bernstein =
 * fällig, grau = versorgt. Einklappbar, standardmäßig offen.
 */

export interface OutboundMapTarget {
  id: string;
  name: string;
  ort: string | null;
  hub: string | null;
  hub_pdl: string | null;
  faellig: boolean;
  letzter_besuch: string | null;
}

const CACHE_KEY = "ort-coords-v1";

function loadCache(): Record<string, [number, number] | null> {
  try {
    return JSON.parse(localStorage.getItem(CACHE_KEY) ?? "{}");
  } catch {
    return {};
  }
}

async function geocodeOrt(
  ort: string,
  cache: Record<string, [number, number] | null>,
): Promise<[number, number] | null> {
  if (ort in cache) return cache[ort];
  let coords: [number, number] | null = null;
  try {
    const res = await fetch(
      `https://photon.komoot.io/api/?q=${encodeURIComponent(ort + ", Deutschland")}&limit=1&lang=de`,
    );
    if (res.ok) {
      const json = (await res.json()) as {
        features?: { geometry?: { coordinates?: [number, number] } }[];
      };
      const c = json.features?.[0]?.geometry?.coordinates;
      if (c) coords = [c[1], c[0]];
    }
  } catch {
    /* offline → Punkt fehlt einfach */
  }
  cache[ort] = coords;
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(cache));
  } catch {
    /* Cache voll — egal */
  }
  return coords;
}

const esc = (s: string) =>
  s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c] ?? c);

export function OutboundMap({ targets }: { targets: OutboundMapTarget[] }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<LeafletMap | null>(null);
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    if (!visible || targets.length === 0) return;
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
      // Gleiche Orte leicht versetzen, damit sich Punkte nicht verdecken.
      const seen = new Map<string, number>();
      for (const t of targets) {
        if (!t.ort) continue;
        const base = await geocodeOrt(t.ort, cache);
        if (!base || cancelled || !mapRef.current) continue;
        const n = seen.get(t.ort) ?? 0;
        seen.set(t.ort, n + 1);
        const jitter = 0.006;
        const coords: [number, number] = [
          base[0] + (n % 5) * jitter - 2 * jitter * Math.floor(n / 5),
          base[1] + Math.floor(n / 5) * jitter,
        ];
        bounds.push(coords);
        L.circleMarker(coords, {
          radius: 7,
          color: "#ffffff",
          weight: 1.5,
          fillColor: t.faellig ? "#d97706" : "#94a3b8",
          fillOpacity: 0.9,
        })
          .addTo(map)
          .bindPopup(
            `<strong>${esc(t.name)}</strong><br/>` +
              `${esc(t.ort)}${t.hub ? ` · Standort ${esc(t.hub)}` : ""}<br/>` +
              (t.hub_pdl ? `PDL: ${esc(t.hub_pdl)}<br/>` : "") +
              (t.faellig
                ? "<span style='color:#d97706;font-weight:600'>Anruf fällig</span>"
                : t.letzter_besuch
                  ? `zuletzt ${esc(new Date(`${t.letzter_besuch}T00:00:00`).toLocaleDateString("de-DE"))}`
                  : "noch kein Kontakt"),
          );
        if (bounds.length > 0 && bounds.length % 10 === 0) {
          map.fitBounds(L.latLngBounds(bounds).pad(0.15));
        }
      }
      if (!cancelled && mapRef.current && bounds.length > 0) {
        map.fitBounds(L.latLngBounds(bounds).pad(0.15));
      }
    })();
    return () => {
      cancelled = true;
      mapRef.current?.remove();
      mapRef.current = null;
    };
  }, [targets, visible]);

  if (targets.length === 0) return null;

  return (
    <div className="overflow-hidden rounded-xl border shadow-sm">
      <button
        type="button"
        onClick={() => setVisible((v) => !v)}
        className="flex w-full items-center gap-2 bg-card px-4 py-2.5 text-sm font-semibold"
      >
        Karte
        <span className="flex items-center gap-1 text-xs font-normal text-muted-foreground">
          <span className="inline-block size-2 rounded-full bg-amber-600" /> fällig
          <span className="ml-2 inline-block size-2 rounded-full bg-slate-400" /> versorgt
        </span>
        <span className="ml-auto text-xs font-normal text-muted-foreground">
          {visible ? "ausblenden" : "einblenden"}
        </span>
      </button>
      {visible && <div ref={containerRef} className="h-72 w-full sm:h-80" />}
    </div>
  );
}
