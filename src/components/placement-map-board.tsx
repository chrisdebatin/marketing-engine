"use client";

import { useEffect, useRef, useState } from "react";
import type { Map as LeafletMap } from "leaflet";
import "leaflet/dist/leaflet.css";
import { FileText, MapPin, Package } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { HubTags } from "@/components/md-tag";
import { cn } from "@/lib/utils";
import { placeKindLabel } from "@/lib/places";

/** Ein von der PDL eingetragener Ort (Auslage bzw. Box-Lieferung). */
export interface MapPlace {
  name: string;
  menge: number | null;
  placeKind: string | null;
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

function esc(s: string): string {
  return s.replace(
    /[&<>"]/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c] ?? c,
  );
}

/**
 * Karte + Liste aller von den PDLs eingetragenen Orte, gruppiert nach Hub,
 * umschaltbar zwischen den Kategorien Flyer und Boxen.
 */
export function PlacementMapBoard({ hubs }: { hubs: MapHub[] }) {
  const [kind, setKind] = useState<"flyer" | "box">("flyer");
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<LeafletMap | null>(null);

  const withPlaces = hubs
    .map((h) => ({ ...h, places: kind === "flyer" ? h.flyer : h.box }))
    .filter((h) => h.places.length > 0);
  const totalPlaces = withPlaces.reduce((s, h) => s + h.places.length, 0);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const L = await import("leaflet");
      if (cancelled || !containerRef.current) return;
      // Karte bei Kategorie-Wechsel neu aufbauen.
      mapRef.current?.remove();
      mapRef.current = null;

      const map = L.map(containerRef.current).setView([51.3, 8.2], 6);
      mapRef.current = map;
      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: "&copy; OpenStreetMap",
        maxZoom: 19,
      }).addTo(map);

      const bounds: [number, number][] = [];
      for (const h of withPlaces) {
        if (h.lat == null || h.lng == null) continue;
        const placesHtml = h.places
          .slice(0, 10)
          .map(
            (p) =>
              `• ${esc(p.name)} <em>(${esc(placeKindLabel(p.placeKind))}${
                p.menge != null ? `, ${p.menge} Stück` : ""
              })</em>`,
          )
          .join("<br/>");
        const more =
          h.places.length > 10
            ? `<br/>… und ${h.places.length - 10} weitere`
            : "";
        L.circleMarker([h.lat, h.lng], {
          radius: Math.min(9 + h.places.length, 16),
          color: "#ffffff",
          weight: 2,
          fillColor: h.color,
          fillOpacity: 0.9,
        })
          .addTo(map)
          .bindPopup(
            `<strong>${esc(h.name)}</strong><br/>` +
              `${h.places.length} ${kind === "flyer" ? "Flyer-Orte" : "Box-Lieferorte"}<br/><br/>` +
              placesHtml +
              more,
          );
        bounds.push([h.lat, h.lng]);
      }
      if (bounds.length > 0) map.fitBounds(bounds, { padding: [30, 30] });
      setTimeout(() => map.invalidateSize(), 120);
    })();

    return () => {
      cancelled = true;
      mapRef.current?.remove();
      mapRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [kind, hubs]);

  return (
    <div className="flex flex-col gap-4">
      {/* Kategorie-Umschalter */}
      <div className="grid max-w-sm grid-cols-2 gap-1 rounded-lg bg-muted p-1">
        {(
          [
            { k: "flyer", label: "Flyer-Auslagen", Icon: FileText },
            { k: "box", label: "Box-Lieferungen", Icon: Package },
          ] as const
        ).map(({ k, label, Icon }) => (
          <button
            key={k}
            type="button"
            onClick={() => setKind(k)}
            className={cn(
              "flex items-center justify-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors",
              kind === k
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            <Icon className="size-4" />
            {label}
          </button>
        ))}
      </div>

      <p className="text-sm text-muted-foreground">
        {totalPlaces}{" "}
        {kind === "flyer"
          ? "Flyer-Orte"
          : "Box-Lieferorte"}{" "}
        in {withPlaces.length} Hubs. Pin anklicken für Details; Größe = Anzahl
        Orte.
      </p>

      <div
        ref={containerRef}
        className="z-0 h-[55vh] w-full overflow-hidden rounded-lg border"
      />

      {/* Liste nach Hub */}
      {withPlaces.length === 0 ? (
        <p className="rounded-xl border bg-card p-5 text-sm text-muted-foreground shadow-sm">
          Noch keine Einträge in dieser Kategorie. Die PDLs tragen Orte über
          ihren Hub-Link ein.
        </p>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {withPlaces.map((h) => (
            <Card key={h.id}>
              <CardContent className="flex flex-col gap-3 p-5">
                <div className="flex items-center gap-2">
                  <span
                    className="flex size-8 shrink-0 items-center justify-center rounded-lg text-white"
                    style={{ backgroundColor: h.color }}
                  >
                    <MapPin className="size-4" />
                  </span>
                  <span className="min-w-0 truncate font-semibold">
                    {h.name}
                  </span>
                  <Badge variant="secondary" className="tabular-nums">
                    {h.places.length}
                  </Badge>
                  <HubTags
                    md={h.md}
                    pdl={h.pdl}
                    pdlRole={h.pdlRole}
                    className="ml-auto"
                  />
                </div>
                <ul className="flex flex-col gap-1">
                  {h.places.map((p, i) => (
                    <li
                      key={i}
                      className="flex items-baseline justify-between gap-3 border-t pt-1 text-sm first:border-t-0 first:pt-0"
                    >
                      <span className="min-w-0">
                        <span className="block truncate">{p.name}</span>
                        <span className="block truncate text-xs text-muted-foreground">
                          {placeKindLabel(p.placeKind)}
                          {p.date ? ` · ${p.date}` : ""}
                        </span>
                      </span>
                      {p.menge != null && (
                        <span className="shrink-0 text-xs text-muted-foreground tabular-nums">
                          {p.menge} Stück
                        </span>
                      )}
                    </li>
                  ))}
                </ul>
                {h.lat == null && (
                  <p className="text-xs text-muted-foreground">
                    Ohne Koordinaten — nicht auf der Karte.
                  </p>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
