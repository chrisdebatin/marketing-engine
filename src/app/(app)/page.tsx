import Link from "next/link";
import {
  Truck,
  ClipboardList,
  ListChecks,
  MapPin,
  Megaphone,
  Package,
  Sparkles,
  Map as MapIcon,
  Settings,
  Building2,
  type LucideIcon,
} from "lucide-react";
import { requireSession } from "@/lib/auth";
import { AnfragenCapture } from "@/components/anfragen-capture";
import {
  KampagnenAnfragen,
  type AnfrageRow,
} from "@/components/kampagnen-anfragen";
import { createAdminClient } from "@/lib/supabase/admin";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { StatTile } from "@/components/ui/stat-tile";
import { PageHeader } from "@/components/page-header";
import { HubTags } from "@/components/md-tag";
import { mdColor } from "@/lib/hub-coords";
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
        className={cn(
          "h-1.5 w-full overflow-hidden rounded-full",
          done ? "bg-chart-4/20" : "bg-primary/15",
        )}
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

  // Service-Client wie im Rest der App (unabhängig von RLS/Anon-Key).
  const admin = createAdminClient();
  const [{ data: deliveries }, { data: placements }] = await Promise.all([
    admin
      .from("deliveries")
      .select("hub_id, flyer_count, aufsteller_count, box_count"),
    admin.from("delivery_placements").select("hub_id, menge, kind"),
  ]);

  // Kennzahlen für das Dashboard oben — auf die Hubs der Session begrenzt.
  const sessionHubIds = new Set(session.hubs.map((h) => h.id));
  const scopedDeliveries = (deliveries ?? []).filter((d) =>
    sessionHubIds.has(d.hub_id),
  );
  const scopedPlacements = (placements ?? []).filter((p) =>
    sessionHubIds.has(p.hub_id),
  );
  const totals = {
    boxesDelivered: scopedDeliveries.reduce((s, d) => s + (d.box_count ?? 0), 0),
    flyersDelivered: scopedDeliveries.reduce(
      (s, d) => s + (d.flyer_count ?? 0),
      0,
    ),
    aufstellerDelivered: scopedDeliveries.reduce(
      (s, d) => s + (d.aufsteller_count ?? 0),
      0,
    ),
    flyerSpots: scopedPlacements.filter((p) => p.kind !== "box").length,
    boxSpots: scopedPlacements.filter((p) => p.kind === "box").length,
  };

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

  // Hubs nach verantwortlichem MD gruppieren (alphabetisch, "Ohne MD" zuletzt).
  const groupMap = new Map<string, { md: string | null; hubs: typeof session.hubs }>();
  for (const h of session.hubs) {
    const key = h.responsible_md ?? "~ohne";
    const g = groupMap.get(key);
    if (g) g.hubs.push(h);
    else groupMap.set(key, { md: h.responsible_md, hubs: [h] });
  }
  const mdGroups = [...groupMap.values()].sort((a, b) => {
    if (a.md === null) return 1;
    if (b.md === null) return -1;
    return a.md.localeCompare(b.md, "de");
  });

  // Anfragen-Kanban (Thema "Kampagnen-Anfragen") für den Schnell-Eingang.
  const { data: anfrageTopic } = await admin
    .from("note_topics")
    .select("id")
    .ilike("title", "Kampagnen-Anfragen")
    .maybeSingle();
  const { data: anfrageRows } = anfrageTopic
    ? await admin
        .from("hub_notes")
        .select("*")
        .eq("topic_id", anfrageTopic.id)
        .eq("is_todo", true)
        .order("created_at", { ascending: false })
        .limit(100)
    : { data: [] };

  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        title={`Hallo${session.profile.name ? `, ${session.profile.name}` : ""}`}
        description={
          session.hubs.length === 0
            ? "Dir ist noch kein Hub zugeordnet. Bitte wende dich an einen Admin."
            : `${session.hubs.length} Hub${session.hubs.length === 1 ? "" : "s"} · Boxen-Fortschritt im Überblick`
        }
      />

      {/* Kennzahlen-Dashboard */}
      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile
          icon={Package}
          tone="blue"
          coloredValue
          value={totals.boxesDelivered.toLocaleString("de-DE")}
          label="Boxen geliefert"
          sub={`${totals.boxSpots} Box-Lieferorte eingetragen`}
        />
        <StatTile
          icon={MapPin}
          tone="green"
          value={totals.flyerSpots.toLocaleString("de-DE")}
          label="Flyer-Auslagen (Orte)"
          sub="von den PDLs eingetragen"
        />
        <StatTile
          icon={Megaphone}
          tone="purple"
          value={totals.flyersDelivered.toLocaleString("de-DE")}
          label="Flyer geliefert"
          sub={`+ ${totals.aufstellerDelivered.toLocaleString("de-DE")} Aufsteller`}
        />
        <StatTile
          icon={MapIcon}
          tone="orange"
          value={(totals.boxSpots + totals.flyerSpots).toLocaleString("de-DE")}
          label="Orte gesamt"
          sub="alle Auslagen & Box-Lieferorte"
        />
      </section>

      {/* Anfragen-Eingang: Freitext → KI → Kanban */}
      <AnfragenCapture />
      <KampagnenAnfragen
        hubs={session.hubs.map((h) => ({ id: h.id, name: h.name }))}
        anfragen={(anfrageRows ?? []) as AnfrageRow[]}
      />

      <section className="flex flex-col gap-3">
        <h2 className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
          Schnellzugriff
        </h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {tiles.map(({ href, title, description, Icon }) => (
            <Link key={href} href={href} className="group">
              <Card className="h-full transition-colors hover:ring-primary/30 group-focus-visible:ring-2 group-focus-visible:ring-ring">
                <CardContent className="flex h-full flex-col gap-1 p-5">
                  <div className="flex items-center gap-2">
                    <Icon className="size-4 text-primary" />
                    <h3 className="font-medium">{title}</h3>
                  </div>
                  <p className="text-sm text-muted-foreground">{description}</p>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      </section>

      {session.hubs.length > 0 && (
        <section className="flex flex-col gap-4">
          <h2 className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
            Hub-Übersicht nach MD
          </h2>
          {mdGroups.map((g) => (
            <div key={g.md ?? "—"} className="flex flex-col gap-3">
              <div className="flex items-center gap-2">
                <span
                  aria-hidden
                  className="size-2.5 rounded-full"
                  style={{ backgroundColor: mdColor(g.md) }}
                />
                <h3 className="font-semibold">{g.md ?? "Ohne MD"}</h3>
                <Badge variant="secondary">{g.hubs.length}</Badge>
              </div>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {g.hubs.map((h) => {
                  const s = boxStats.get(h.id) ?? {
                    delivered: 0,
                    distributed: 0,
                  };
                  return (
                    <Link key={h.id} href={`/hubs/${h.id}`} className="group">
                      <Card className="h-full transition-colors hover:ring-primary/30 group-focus-visible:ring-2 group-focus-visible:ring-ring">
                        <CardContent className="flex h-full flex-col gap-4 p-5">
                          <div className="min-w-0">
                            <h4 className="flex flex-wrap items-center gap-2 leading-tight font-medium">
                              <span className="truncate">{h.name}</span>
                              <HubTags md={null} pdl={h.pdl_name} />
                            </h4>
                            {h.region && (
                              <p className="mt-0.5 truncate text-sm text-muted-foreground">
                                {h.region}
                              </p>
                            )}
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
            </div>
          ))}
        </section>
      )}
    </div>
  );
}
