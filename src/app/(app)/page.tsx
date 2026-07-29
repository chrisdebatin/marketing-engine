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
import { AnfragenCapture } from "@/components/anfragen-capture";
import {
  KampagnenAnfragen,
  type AnfrageRow,
} from "@/components/kampagnen-anfragen";
import { createAdminClient } from "@/lib/supabase/admin";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
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

/** Große Kennzahl-Kachel für das Dashboard oben auf der Startseite. */
function StatCard({
  Icon,
  value,
  label,
  sub,
}: {
  Icon: LucideIcon;
  value: number;
  label: string;
  sub?: string;
}) {
  return (
    <Card>
      <CardContent className="flex flex-col gap-1.5 p-5">
        <span className="flex size-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
          <Icon className="size-4.5" />
        </span>
        <span className="text-3xl font-semibold tracking-tight tabular-nums">
          {value.toLocaleString("de-DE")}
        </span>
        <span className="text-sm font-medium">{label}</span>
        {sub && <span className="text-xs text-muted-foreground">{sub}</span>}
      </CardContent>
    </Card>
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

      {/* Kennzahlen-Dashboard */}
      <section className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard
          Icon={Package}
          value={totals.boxesDelivered}
          label="Boxen geliefert"
          sub={`${totals.boxSpots} Box-Lieferorte eingetragen`}
        />
        <StatCard
          Icon={ListChecks}
          value={totals.flyerSpots}
          label="Flyer-Auslagen (Orte)"
          sub="von den PDLs eingetragen"
        />
        <StatCard
          Icon={Truck}
          value={totals.flyersDelivered}
          label="Flyer geliefert"
          sub={`+ ${totals.aufstellerDelivered.toLocaleString("de-DE")} Aufsteller`}
        />
        <StatCard
          Icon={MapIcon}
          value={totals.boxSpots + totals.flyerSpots}
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

      {session.hubs.length > 0 && (
        <section className="flex flex-col gap-4">
          <h2 className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
            <Package className="size-4" />
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
                      <Card className="h-full transition-all hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-md">
                        <CardContent className="flex h-full flex-col gap-4 p-5">
                          <div className="flex items-start gap-3">
                            <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                              <Building2 className="size-5" />
                            </span>
                            <div className="min-w-0">
                              <h4 className="flex flex-wrap items-center gap-2 leading-tight font-semibold">
                                <span className="truncate">{h.name}</span>
                                <HubTags md={null} pdl={h.pdl_name} />
                              </h4>
                              {h.region && (
                                <p className="mt-0.5 flex items-center gap-1 text-sm text-muted-foreground">
                                  <User className="size-3.5 shrink-0" />
                                  <span className="truncate">{h.region}</span>
                                </p>
                              )}
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
            </div>
          ))}
        </section>
      )}
    </div>
  );
}
