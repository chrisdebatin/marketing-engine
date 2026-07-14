import Link from "next/link";
import {
  Truck,
  ClipboardList,
  ListChecks,
  Sparkles,
  Map as MapIcon,
  Settings,
  Building2,
  ArrowRight,
  Package,
  User,
  type LucideIcon,
} from "lucide-react";
import { requireSession } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { Card, CardContent } from "@/components/ui/card";
import { HubTags } from "@/components/md-tag";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

interface Tile {
  href: string;
  title: string;
  description: string;
  Icon: LucideIcon;
}

const TILES: Tile[] = [
  {
    href: "/lieferungen",
    title: "Lieferung erfassen",
    description:
      "Flyer/Boxen an Hubs eintragen und Links für die Pflege-Dienstleitungen erzeugen.",
    Icon: Truck,
  },
  {
    href: "/erfassen",
    title: "Aktivität erfassen",
    description:
      "Flyer/Aufsteller ausgelegt oder Box beliefert – auch offline.",
    Icon: ClipboardList,
  },
  {
    href: "/eintraege",
    title: "Meine Einträge",
    description: "Erfasste Aktivitäten ansehen, bearbeiten oder löschen.",
    Icon: ListChecks,
  },
  {
    href: "/hubs",
    title: "Hubs",
    description: "Kachel-Übersicht aller Hubs mit PDL-Kontakt und Materialien.",
    Icon: Building2,
  },
  {
    href: "/karte",
    title: "Karte",
    description: "Deine Hubs auf der Karte – Farbe nach verantwortlichem MD.",
    Icon: MapIcon,
  },
  {
    href: "/assistant",
    title: "Assistant",
    description: "Fragen zu Zahlen und Auswertungen stellen.",
    Icon: Sparkles,
  },
];

interface BoxStat {
  delivered: number;
  distributed: number;
}

/**
 * Boxen-Fortschritt eines Hubs: wie viele der gelieferten Boxen bereits
 * ausgeliefert (an Orten platziert) wurden.
 */
function BoxProgress({ delivered, distributed }: BoxStat) {
  const pct =
    delivered > 0
      ? Math.min(100, Math.round((distributed / delivered) * 100))
      : 0;
  const done = delivered > 0 && distributed >= delivered;

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-baseline justify-between text-sm">
        <span className="text-muted-foreground">Boxen ausgeliefert</span>
        <span className="font-medium tabular-nums">
          {distributed}
          <span className="text-muted-foreground"> / {delivered}</span>
        </span>
      </div>
      <div
        className="h-2 w-full overflow-hidden rounded-full bg-muted"
        role="progressbar"
        aria-valuenow={pct}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label="Boxen ausgeliefert"
      >
        <div
          className={cn(
            "h-full rounded-full transition-all",
            done ? "bg-chart-4" : "bg-primary",
          )}
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="text-xs text-muted-foreground">
        {delivered === 0
          ? "Noch keine Boxen geliefert"
          : done
            ? "Alle gelieferten Boxen ausgeliefert"
            : `${pct} % ausgeliefert`}
      </span>
    </div>
  );
}

export default async function HomePage() {
  const session = await requireSession();

  const supabase = await createClient();
  const [{ data: deliveries }, { data: placements }] = await Promise.all([
    supabase.from("deliveries").select("hub_id, box_count"),
    supabase.from("delivery_placements").select("hub_id, menge, kind"),
  ]);

  // Gelieferte Boxen je Hub (Summe der Lieferungen) vs. ausgelieferte Boxen
  // (Summe der Mengen der als "box" eingetragenen Orte).
  const boxStats = new Map<string, BoxStat>();
  const stat = (id: string): BoxStat => {
    let s = boxStats.get(id);
    if (!s) {
      s = { delivered: 0, distributed: 0 };
      boxStats.set(id, s);
    }
    return s;
  };
  for (const d of deliveries ?? []) stat(d.hub_id).delivered += d.box_count ?? 0;
  for (const p of placements ?? []) {
    if (p.kind === "box") stat(p.hub_id).distributed += p.menge ?? 0;
  }

  const tiles = session.isAdmin
    ? [
        ...TILES,
        {
          href: "/admin",
          title: "Admin",
          description: "Standort-Import, Hubs & Mitarbeiter verwalten.",
          Icon: Settings,
        },
      ]
    : TILES;

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-1">
        <h1 className="text-3xl font-semibold tracking-tight">
          Hallo{session.profile.name ? `, ${session.profile.name}` : ""}
        </h1>
        <p className="text-sm text-muted-foreground">
          {session.hubs.length === 0
            ? "Dir ist noch kein Hub zugeordnet. Bitte wende dich an einen Admin."
            : `${session.hubs.length} Hub${session.hubs.length === 1 ? "" : "s"} · Boxen-Fortschritt im Überblick`}
        </p>
      </div>

      {session.hubs.length > 0 && (
        <section className="flex flex-col gap-3">
          <h2 className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
            <Package className="size-4" />
            Hub-Übersicht
          </h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {session.hubs.map((h) => {
              const s = boxStats.get(h.id) ?? { delivered: 0, distributed: 0 };
              return (
                <Link key={h.id} href={`/hubs/${h.id}`} className="group">
                  <Card className="h-full transition-all hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-md">
                    <CardContent className="flex h-full flex-col gap-4 p-5">
                    <div className="flex items-start gap-3">
                      <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                        <Building2 className="size-5" />
                      </span>
                      <div className="min-w-0">
                        <h3 className="flex flex-wrap items-center gap-2 leading-tight font-semibold">
                          <span className="truncate">{h.name}</span>
                          <HubTags md={h.responsible_md} pdl={h.pdl_name} />
                        </h3>
                        <p className="mt-0.5 flex items-center gap-1 text-sm text-muted-foreground">
                          <User className="size-3.5 shrink-0" />
                          <span className="truncate">
                            {h.responsible_md ?? "—"}
                          </span>
                        </p>
                      </div>
                    </div>
                      <div className="mt-auto">
                        <BoxProgress
                          delivered={s.delivered}
                          distributed={s.distributed}
                        />
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              );
            })}
          </div>
        </section>
      )}

      <section className="flex flex-col gap-3">
        <h2 className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
          <ArrowRight className="size-4" />
          Schnellzugriff
        </h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {tiles.map(({ href, title, description, Icon }) => (
            <Link key={href} href={href} className="group">
              <Card className="relative h-full overflow-hidden transition-all hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-md">
                <CardContent className="flex h-full flex-col gap-3 p-5">
                  <div className="flex items-center justify-between">
                    <span className="flex size-11 items-center justify-center rounded-xl bg-primary/10 text-primary transition-colors group-hover:bg-primary group-hover:text-primary-foreground">
                      <Icon className="size-5" />
                    </span>
                    <ArrowRight className="size-4 -translate-x-1 text-muted-foreground opacity-0 transition-all group-hover:translate-x-0 group-hover:opacity-100" />
                  </div>
                  <div className="flex flex-col gap-1">
                    <h3 className="font-semibold">{title}</h3>
                    <p className="text-sm text-muted-foreground">
                      {description}
                    </p>
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}
