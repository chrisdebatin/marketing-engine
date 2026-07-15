import { requireSession } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getMaterialTypes, getStandortSuggestions } from "@/lib/data";
import { updateHubPdl } from "./actions";
import {
  CatalogManager,
  type CatalogManagerItem,
} from "@/components/catalog-manager";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { CopyLink } from "@/components/copy-link";
import { CreateHubForm } from "@/components/create-hub-form";
import { HubTags } from "@/components/md-tag";
import { ActivityForm } from "@/components/activity-form";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { ClipboardList } from "lucide-react";
import {
  Building2,
  FileText,
  Megaphone,
  Package,
  MapPin,
  Truck,
  User,
} from "lucide-react";
import type { Hub } from "@/lib/types";

export const dynamic = "force-dynamic";

/** Compact stat tile: icon chip + big number + label, tinted per metric. */
function StatTile({
  icon: Icon,
  value,
  label,
  accent,
  muted,
}: {
  icon: React.ComponentType<{ className?: string }>;
  value: number;
  label: string;
  accent: string;
  muted?: boolean;
}) {
  return (
    <div className="flex items-center gap-2.5 rounded-lg border bg-card px-3 py-2.5">
      <span
        className={cn(
          "flex size-8 shrink-0 items-center justify-center rounded-md",
          muted ? "bg-muted text-muted-foreground" : accent,
        )}
      >
        <Icon className="size-4" />
      </span>
      <div className="min-w-0">
        <div className="text-lg leading-none font-semibold tabular-nums">
          {value}
        </div>
        <div className="mt-1 truncate text-xs text-muted-foreground">
          {label}
        </div>
      </div>
    </div>
  );
}

interface PlacementRow {
  standort_name: string;
  menge: number | null;
  kind: string;
}

interface HubStats {
  deliveries: number;
  flyers: number;
  aufsteller: number;
  boxes: number;
  placements: number;
  locations: PlacementRow[];
}

export default async function AdminPage() {
  const session = await requireSession();

  if (!session.isAdmin) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Kein Zugriff</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          Dieser Bereich ist nur für Admins.
        </CardContent>
      </Card>
    );
  }

  const supabase = await createClient();
  const [{ data: hubsData }, { data: deliveries }, { data: placements }] =
    await Promise.all([
      supabase
        .from("hubs")
        .select(
          "id, name, region, address, responsible_md, pdl_name, pdl_email, pdl_phone, share_token, created_at",
        )
        .order("responsible_md")
        .order("name"),
      supabase
        .from("deliveries")
        .select("hub_id, flyer_count, box_count, aufsteller_count"),
      supabase
        .from("delivery_placements")
        .select("hub_id, standort_name, menge, kind")
        .order("created_at", { ascending: false }),
    ]);

  const hubs = (hubsData ?? []) as Hub[];

  // Data for the embedded "Aktivität erfassen" feature (moved here from its own tab).
  const [materialTypes, standorte] = await Promise.all([
    getMaterialTypes(),
    getStandortSuggestions(hubs.map((h) => h.id)),
  ]);

  // Shop-Katalog: material_catalog hat RLS disabled → nur via Service-Role-
  // Client lesbar. Fällt auf [] zurück, solange Migration 0013 in der Live-DB
  // fehlt (Query schlägt dann fehl, darf die Seite aber nicht crashen).
  const admin = createAdminClient();
  const { data: catalogData } = await admin
    .from("material_catalog")
    .select("id, key, name, description, active, sort_order")
    .order("sort_order", { ascending: true });
  const catalogItems: CatalogManagerItem[] = (catalogData ?? []).map((c) => ({
    id: c.id,
    key: c.key,
    name: c.name,
    description: c.description,
    active: c.active,
  }));

  const stats = new Map<string, HubStats>();
  const bump = (id: string): HubStats => {
    let s = stats.get(id);
    if (!s) {
      s = {
        deliveries: 0,
        flyers: 0,
        aufsteller: 0,
        boxes: 0,
        placements: 0,
        locations: [],
      };
      stats.set(id, s);
    }
    return s;
  };
  for (const d of deliveries ?? []) {
    const s = bump(d.hub_id);
    s.deliveries += 1;
    s.flyers += d.flyer_count ?? 0;
    s.aufsteller += d.aufsteller_count ?? 0;
    s.boxes += d.box_count ?? 0;
  }
  for (const p of placements ?? []) {
    const s = bump(p.hub_id);
    s.placements += 1;
    s.locations.push({
      standort_name: p.standort_name,
      menge: p.menge,
      kind: p.kind,
    });
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold">Admin · Hubs</h1>
        <p className="text-sm text-muted-foreground">
          Übersicht aller Hubs mit verantwortlichem MD und lokaler PDL. Jeder Hub
          hat einen dauerhaften Link für die PDL zum Eintragen der Auslage-Orte.
        </p>
      </div>

      <CreateHubForm />

      {hubs.length > 0 && (
        <details className="group rounded-xl border bg-card shadow-sm">
          <summary className="flex cursor-pointer list-none items-center gap-2 p-5 font-semibold select-none">
            <ClipboardList className="size-4 text-primary" />
            Aktivität erfassen
            <span className="ml-auto text-xs font-normal text-muted-foreground group-open:hidden">
              aufklappen
            </span>
          </summary>
          <div className="border-t p-5">
            <p className="mb-4 text-sm text-muted-foreground">
              Flyer/Aufsteller ausgelegt oder Box beliefert – auch offline.
            </p>
            <ActivityForm
              hubs={hubs.map((h) => ({ id: h.id, name: h.name }))}
              materialTypes={materialTypes.map((m) => ({
                id: m.id,
                name: m.name,
              }))}
              standorte={standorte}
            />
          </div>
        </details>
      )}

      <details className="group rounded-xl border bg-card shadow-sm">
        <summary className="flex cursor-pointer list-none items-center gap-2 p-5 font-semibold select-none">
          <Package className="size-4 text-primary" />
          Material-Katalog
          <span className="ml-auto text-xs font-normal text-muted-foreground group-open:hidden">
            aufklappen
          </span>
        </summary>
        <div className="border-t p-5">
          <p className="mb-4 text-sm text-muted-foreground">
            Artikel, die PDLs über den Hub-Link im Shop bestellen können.
            Inaktive Artikel werden im Shop ausgeblendet.
          </p>
          <CatalogManager items={catalogItems} />
        </div>
      </details>

      <ul className="flex flex-col gap-4">
        {hubs.map((h) => {
          const s = stats.get(h.id) ?? {
            deliveries: 0,
            flyers: 0,
            aufsteller: 0,
            boxes: 0,
            placements: 0,
            locations: [],
          };
          return (
            <li
              key={h.id}
              className="rounded-xl border bg-card p-4 shadow-sm transition-shadow hover:shadow-md sm:p-5"
            >
              <div className="flex flex-col gap-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="flex items-start gap-3">
                    <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                      <Building2 className="size-5" />
                    </span>
                    <div className="min-w-0">
                      <h2 className="flex flex-wrap items-center gap-2 leading-tight font-semibold">
                        <span className="truncate">{h.name}</span>
                        <HubTags md={h.responsible_md} pdl={h.pdl_name} />
                      </h2>
                      <p className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-sm text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <User className="size-3.5" />
                          {h.responsible_md ?? "—"}
                        </span>
                        {h.region && (
                          <>
                            <span aria-hidden>·</span>
                            <span>{h.region}</span>
                          </>
                        )}
                      </p>
                      {h.address && (
                        <p className="mt-0.5 flex items-center gap-1 text-sm text-muted-foreground">
                          <MapPin className="size-3.5 shrink-0" />
                          <span className="truncate">{h.address}</span>
                        </p>
                      )}
                    </div>
                  </div>
                  <CopyLink
                    token={h.share_token}
                    prefix="/h"
                    label="PDL-Link kopieren"
                  />
                </div>

                <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-5">
                  <StatTile
                    icon={Truck}
                    value={s.deliveries}
                    label="Lieferungen"
                    accent="bg-chart-2/12 text-chart-2"
                    muted={s.deliveries === 0}
                  />
                  <StatTile
                    icon={FileText}
                    value={s.flyers}
                    label="Flyer geliefert"
                    accent="bg-chart-1/12 text-chart-1"
                    muted={s.flyers === 0}
                  />
                  <StatTile
                    icon={Megaphone}
                    value={s.aufsteller}
                    label="Aufsteller"
                    accent="bg-chart-3/12 text-chart-3"
                    muted={s.aufsteller === 0}
                  />
                  <StatTile
                    icon={Package}
                    value={s.boxes}
                    label="Boxen"
                    accent="bg-chart-4/12 text-chart-4"
                    muted={s.boxes === 0}
                  />
                  <StatTile
                    icon={MapPin}
                    value={s.placements}
                    label="Orte eingetragen"
                    accent="bg-chart-5/12 text-chart-5"
                    muted={s.placements === 0}
                  />
                </div>

                {s.locations.length > 0 && (
                  <details className="group rounded-lg border bg-muted/40 px-3 py-2">
                    <summary className="flex cursor-pointer list-none items-center gap-1.5 text-sm font-medium select-none">
                      <MapPin className="size-4 text-muted-foreground" />
                      Eingetragene Orte ({s.locations.length})
                    </summary>
                    <ul className="mt-2 flex flex-col gap-1.5">
                      {s.locations.map((loc, i) => (
                        <li
                          key={i}
                          className="flex items-center justify-between gap-3 border-t pt-1.5 text-sm first:border-t-0 first:pt-0"
                        >
                          <span className="flex min-w-0 items-center gap-2">
                            <Badge
                              variant={
                                loc.kind === "box" ? "default" : "secondary"
                              }
                              className="shrink-0"
                            >
                              {loc.kind === "box" ? "Box" : "Flyer"}
                            </Badge>
                            <span className="truncate">{loc.standort_name}</span>
                          </span>
                          {loc.menge != null && (
                            <span className="shrink-0 text-muted-foreground">
                              {loc.menge} Stück
                            </span>
                          )}
                        </li>
                      ))}
                    </ul>
                  </details>
                )}

                <form
                  // Uncontrolled inputs seed from defaultValue only on mount.
                  // After a save the action revalidates and the hub fields change;
                  // keying the form by those values remounts it so the new values
                  // become fresh defaults instead of tripping base-ui's "changing
                  // the default value of an initialized uncontrolled FieldControl".
                  key={`${h.pdl_name ?? ""}|${h.pdl_email ?? ""}|${h.pdl_phone ?? ""}|${h.address ?? ""}`}
                  action={updateHubPdl}
                  className="flex flex-col gap-3 border-t pt-4"
                >
                  <input type="hidden" name="hub_id" value={h.id} />
                  <div>
                    <label className="mb-1 block text-xs text-muted-foreground">
                      Adresse (optional)
                    </label>
                    <Input
                      name="address"
                      defaultValue={h.address ?? ""}
                      placeholder="Straße Nr., PLZ Ort"
                    />
                  </div>
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
                    <div className="flex-1">
                      <label className="mb-1 block text-xs text-muted-foreground">
                        Lokale PDL (Name)
                      </label>
                      <Input
                        name="pdl_name"
                        defaultValue={h.pdl_name ?? ""}
                        placeholder="Name der Pflege-Dienstleitung"
                      />
                    </div>
                    <div className="flex-1">
                      <label className="mb-1 block text-xs text-muted-foreground">
                        PDL E-Mail (optional)
                      </label>
                      <Input
                        name="pdl_email"
                        type="email"
                        defaultValue={h.pdl_email ?? ""}
                        placeholder="pdl@…"
                      />
                    </div>
                    <div className="flex-1">
                      <label className="mb-1 block text-xs text-muted-foreground">
                        PDL Telefon (optional)
                      </label>
                      <Input
                        name="pdl_phone"
                        type="tel"
                        defaultValue={h.pdl_phone ?? ""}
                        placeholder="z. B. 030 1234567"
                      />
                    </div>
                    <Button type="submit" variant="outline">
                      Speichern
                    </Button>
                  </div>
                </form>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
