import Link from "next/link";
import { MapPin, User, Phone, Mail, ChevronRight } from "lucide-react";
import { requireSession } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { mdColor } from "@/lib/hub-coords";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { CopyLink } from "@/components/copy-link";
import { HubTags } from "@/components/md-tag";
import { HubTaskChips } from "@/components/hub-task-chips";

export const dynamic = "force-dynamic";

interface Agg {
  flyers: number;
  aufsteller: number;
  boxes: number;
  placements: number;
}

export default async function HubsPage() {
  // Hubs kommen aus der Session (Service-Role-Client, MD-Scoping inklusive) —
  // gleiches Muster wie im Rest der App, unabhängig von RLS/Anon-Key.
  const session = await requireSession();
  const admin = createAdminClient();

  const [
    { data: deliveries },
    { data: placements },
    { data: taskRows },
    { data: checkRows },
  ] = await Promise.all([
    admin
      .from("deliveries")
      .select("hub_id, flyer_count, box_count, aufsteller_count"),
    admin.from("delivery_placements").select("hub_id"),
    admin.from("hub_tasks").select("id, title").order("created_at"),
    admin.from("hub_task_checks").select("task_id, hub_id"),
  ]);

  const hubs = [...session.hubs].sort(
    (a, b) =>
      (a.responsible_md ?? "").localeCompare(b.responsible_md ?? "") ||
      a.name.localeCompare(b.name),
  );

  const tasks = taskRows ?? [];
  const doneSet = new Set(
    (checkRows ?? []).map((c) => `${c.task_id}|${c.hub_id}`),
  );

  const agg = new Map<string, Agg>();
  const bump = (id: string): Agg => {
    let a = agg.get(id);
    if (!a) {
      a = { flyers: 0, aufsteller: 0, boxes: 0, placements: 0 };
      agg.set(id, a);
    }
    return a;
  };
  for (const d of deliveries ?? []) {
    const a = bump(d.hub_id);
    a.flyers += d.flyer_count ?? 0;
    a.aufsteller += d.aufsteller_count ?? 0;
    a.boxes += d.box_count ?? 0;
  }
  for (const p of placements ?? []) bump(p.hub_id).placements += 1;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight">Hubs</h1>
        <p className="text-sm text-muted-foreground">
          Übersicht aller {hubs.length} Hubs mit verantwortlichem MD, PDL-Kontakt
          und gelieferten Materialien.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {hubs.map((h) => {
          const a = agg.get(h.id) ?? {
            flyers: 0,
            aufsteller: 0,
            boxes: 0,
            placements: 0,
          };
          const color = mdColor(h.responsible_md);
          return (
            <Card
              key={h.id}
              className="relative overflow-hidden transition-all hover:-translate-y-0.5 hover:shadow-md"
            >
              <span
                aria-hidden
                className="absolute inset-x-0 top-0 h-1"
                style={{ backgroundColor: color }}
              />
              <CardContent className="flex flex-col gap-3 p-5">
                <div className="flex flex-col gap-0.5">
                  <div className="flex items-center gap-2">
                    <Link
                      href={`/hubs/${h.id}`}
                      className="group/title flex min-w-0 items-center gap-1 font-semibold hover:text-primary"
                    >
                      <span className="truncate">{h.name}</span>
                      <ChevronRight className="size-4 shrink-0 text-muted-foreground transition-transform group-hover/title:translate-x-0.5 group-hover/title:text-primary" />
                    </Link>
                    <HubTags
                      md={h.responsible_md}
                      pdl={h.pdl_name}
                      className="ml-auto"
                    />
                  </div>
                  {h.region && (
                    <span className="flex items-center gap-1 text-xs text-muted-foreground">
                      <MapPin className="size-3" />
                      {h.region}
                    </span>
                  )}
                  {h.address && (
                    <span className="flex items-center gap-1 text-xs text-muted-foreground">
                      <MapPin className="size-3 shrink-0" />
                      <span className="truncate">{h.address}</span>
                    </span>
                  )}
                </div>

                <div className="flex flex-col gap-1 text-sm">
                  <span className="flex items-center gap-1.5 text-muted-foreground">
                    <User className="size-3.5" style={{ color }} />
                    MD: {h.responsible_md ?? "—"}
                  </span>
                  {h.pdl_name && (
                    <span className="text-muted-foreground">
                      PDL: {h.pdl_name}
                    </span>
                  )}
                  {h.pdl_phone && (
                    <a
                      href={`tel:${h.pdl_phone}`}
                      className="flex items-center gap-1.5 text-primary hover:underline"
                    >
                      <Phone className="size-3.5" />
                      {h.pdl_phone}
                    </a>
                  )}
                  {h.pdl_email && (
                    <a
                      href={`mailto:${h.pdl_email}`}
                      className="flex items-center gap-1.5 text-primary hover:underline"
                    >
                      <Mail className="size-3.5" />
                      {h.pdl_email}
                    </a>
                  )}
                </div>

                <div className="flex flex-wrap gap-1.5">
                  <Badge variant="outline">{a.flyers} Flyer</Badge>
                  <Badge variant="outline">{a.aufsteller} Aufsteller</Badge>
                  <Badge variant="outline">{a.boxes} Boxen</Badge>
                  <Badge variant={a.placements > 0 ? "secondary" : "outline"}>
                    {a.placements} Orte
                  </Badge>
                </div>

                {tasks.length > 0 && (
                  <HubTaskChips
                    hubId={h.id}
                    chips={tasks.map((t) => ({
                      taskId: t.id,
                      title: t.title,
                      done: doneSet.has(`${t.id}|${h.id}`),
                    }))}
                  />
                )}

                <div className="mt-1">
                  <CopyLink
                    token={h.share_token}
                    prefix="/h"
                    label="PDL-Link kopieren"
                  />
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
