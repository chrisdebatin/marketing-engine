"use client";

import { useEffect, useRef, useState } from "react";
import type { Map as LeafletMap, CircleMarker } from "leaflet";
import "leaflet/dist/leaflet.css";
import { FileText, MapPin, Package } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { HubTags } from "@/components/md-tag";
import { cn } from "@/lib/utils";
import { placeKindLabel } from "@/lib/places";

/** Ein von der PDL eingetragener Ort (Auslage bzw. Box-Lieferung). */
export interface MapPlace {
  name: string;
  menge: number | null;
  placeKind: string | null;
  ort: string | null;
  date: string | null;
}

/** Ein Hub mit seinen eingetragenen Orten, getrennt nach Flyer und Boxen. */
export interface MapHub {
  id: string;
  name: string;
  md: string | null;
  pdl: string | null;
  pdlRole: string;
  color: string;
  lat: number | null;
  lng: number | null;
  flyer: MapPlace[];
  box: MapPlace[];
}

type Filter = "alle" | "flyer" | "box";

function esc(s: string): string {
  return s.replace(
    /[&<>"]/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c] ?? c,
  );
}

function placesFor(h: MapHub, filter: Filter): MapPlace[] {
  if (filter === "flyer") return h.flyer;
  if (filter === "box") return h.box;
  return [...h.flyer, ...h.box];
}

/**
 * Karte + Auslagen in einer Ansicht: links die Karte, rechts die Orte je Hub.
 * Klick auf einen Hub in der Liste springt zum Pin und öffnet das Popup.
 */
export function PlacementMapBoard({ hubs }: { hubs: MapHub[] }) {
  const [filter, setFilter] = useState<Filter>("alle");
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<LeafletMap | null>(null);
  const markersRef = useRef<Map<string, CircleMarker>>(new Map());

  const withPlaces = hubs
    .map((h) => ({ ...h, places: placesFor(h, filter) }))
    .filter((h) => h.places.length > 0)
    .sort((a, b) => b.places.length - a.places.length);
  const countFlyer = hubs.reduce((s, h) => s + h.flyer.length, 0);
  const countBox = hubs.reduce((s, h) => s + h.box.length, 0);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const L = await import("leaflet");
      if (cancelled || !containerRef.current) return;
      // Bei Filter-Wechsel neu aufbauen (Marker-Größen/Popups ändern sich).
      mapRef.current?.remove();
      mapRef.current = null;
      markersRef.current.clear();

      const map = L.map(containerRef.current).setView([51.3, 8.2], 6);
      mapRef.current = map;
      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: "&copy; OpenStreetMap",
        maxZoom: 19,
      }).addTo(map);

      const bounds: [number, number][] = [];
      for (const h of withPlaces) {
        if (h.lat == null || h.lng == null) continue;
        const lines = h.places
          .slice(0, 10)
          .map(
            (p) =>
              `• ${esc(p.name)} <em>(${esc(placeKindLabel(p.placeKind))}${
                p.ort ? `, ${esc(p.ort)}` : ""
              }${p.menge != null ? `, ${p.menge} Stück` : ""})</em>`,
          )
          .join("<br/>");
        const more =
          h.places.length > 10
            ? `<br/>… und ${h.places.length - 10} weitere`
            : "";
        const marker = L.circleMarker([h.lat, h.lng], {
          radius: Math.min(9 + h.places.length, 16),
          color: "#ffffff",
          weight: 2,
          fillColor: h.color,
          fillOpacity: 0.9,
        })
          .addTo(map)
          .bindPopup(
            `<strong>${esc(h.name)}</strong><br/>` +
              `${h.flyer.length} Flyer-Orte · ${h.box.length} Box-Lieferorte<br/><br/>` +
              lines +
              more,
          );
        markersRef.current.set(h.id, marker);
        bounds.push([h.lat, h.lng]);
      }
      if (bounds.length > 0) map.fitBounds(bounds, { padding: [30, 30] });
      setTimeout(() => map.invalidateSize(), 120);
    })();

    return () => {
      cancelled = true;
      mapRef.current?.remove();
      mapRef.current = null;
      markersRef.current.clear();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filter, hubs]);

  function focusHub(h: MapHub) {
    if (h.lat == null || h.lng == null || !mapRef.current) return;
    mapRef.current.setView([h.lat, h.lng], 11);
    markersRef.current.get(h.id)?.openPopup();
  }

  return (
    <div className="flex flex-col gap-3">
      {/* Filter-Chips */}
      <div className="flex flex-wrap items-center gap-1.5">
        {(
          [
            { k: "alle", label: `Alle (${countFlyer + countBox})` },
            { k: "flyer", label: `Flyer (${countFlyer})` },
            { k: "box", label: `Boxen (${countBox})` },
          ] as const
        ).map(({ k, label }) => (
          <button
            key={k}
            type="button"
            onClick={() => setFilter(k)}
            className={cn(
              "rounded-full border px-3 py-1 text-sm font-medium transition-colors",
              filter === k
                ? "border-primary bg-primary text-primary-foreground"
                : "border-border bg-muted text-muted-foreground hover:text-foreground",
            )}
          >
            {label}
          </button>
        ))}
        <span className="ml-auto hidden text-xs text-muted-foreground sm:block">
          Hub in der Liste anklicken → Karte springt zum Pin.
        </span>
      </div>

      {/* Karte + Liste in einem */}
      <div className="grid gap-3 lg:grid-cols-[1fr_400px]">
        <div
          ref={containerRef}
          className="z-0 h-[45vh] w-full overflow-hidden rounded-lg border lg:h-[70vh]"
        />

        <div className="flex max-h-[70vh] flex-col gap-2 overflow-y-auto pr-1">
          {withPlaces.length === 0 ? (
            <p className="rounded-xl border bg-card p-5 text-sm text-muted-foreground shadow-sm">
              Noch keine Einträge in dieser Auswahl. Die PDLs tragen Orte über
              ihren Hub-Link ein.
            </p>
          ) : (
            withPlaces.map((h) => (
              <section
                key={h.id}
                className="flex flex-col gap-2 rounded-xl border bg-card p-3.5 shadow-sm"
              >
                <button
                  type="button"
                  onClick={() => focusHub(h)}
                  disabled={h.lat == null}
                  className="flex w-full items-center gap-2 text-left disabled:cursor-default"
                  title={
                    h.lat == null
                      ? "Ohne Koordinaten — nicht auf der Karte"
                      : "Auf der Karte zeigen"
                  }
                >
                  <span
                    className="flex size-7 shrink-0 items-center justify-center rounded-lg text-white"
                    style={{ backgroundColor: h.color }}
                  >
                    <MapPin className="size-3.5" />
                  </span>
                  <span className="min-w-0 truncate text-sm font-semibold">
                    {h.name}
                  </span>
                  <Badge variant="secondary" className="ml-auto tabular-nums">
                    {h.places.length}
                  </Badge>
                </button>
                <HubTags md={h.md} pdl={h.pdl} pdlRole={h.pdlRole} />

                <ul className="flex flex-col gap-1">
                  {h.places.map((p, i) => {
                    const isBox = h.box.includes(p);
                    return (
                      <li
                        key={i}
                        className="flex items-baseline justify-between gap-2 border-t pt-1 text-sm first:border-t-0 first:pt-0"
                      >
                        <span className="flex min-w-0 items-baseline gap-1.5">
                          {isBox ? (
                            <Package className="size-3.5 shrink-0 translate-y-0.5 text-amber-600" />
                          ) : (
                            <FileText className="size-3.5 shrink-0 translate-y-0.5 text-primary" />
                          )}
                          <span className="min-w-0">
                            <span className="block truncate">{p.name}</span>
                            <span className="block truncate text-xs text-muted-foreground">
                              {placeKindLabel(p.placeKind)}
                              {p.ort ? ` · ${p.ort}` : ""}
                              {p.menge != null ? ` · ${p.menge} Stück` : ""}
                              {p.date ? ` · ${p.date}` : ""}
                            </span>
                          </span>
                        </span>
                      </li>
                    );
                  })}
                </ul>
                {h.lat == null && (
                  <p className="text-xs text-muted-foreground">
                    Ohne Koordinaten — nicht auf der Karte.
                  </p>
                )}
              </section>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
