import Link from "next/link";
import { MapPin, Phone, Mail, ChevronRight } from "lucide-react";
import { requireSession } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { mdColor } from "@/lib/hub-coords";
import { pdlRoleShort } from "@/lib/leistungen";
import { splitPdlEmails, splitPdlPhones } from "@/lib/pdl";
import { cn } from "@/lib/utils";
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

  // Nach verantwortlichem MD clustern ("Ohne MD" zuletzt).
  const mdGroupMap = new Map<
    string,
    { md: string | null; hubs: typeof hubs }
  >();
  for (const h of hubs) {
    const key = h.responsible_md ?? "~ohne";
    const g = mdGroupMap.get(key);
    if (g) g.hubs.push(h);
    else mdGroupMap.set(key, { md: h.responsible_md, hubs: [h] });
  }
  const mdGroups = [...mdGroupMap.values()].sort((a, b) => {
    if (a.md === null) return 1;
    if (b.md === null) return -1;
    return a.md.localeCompare(b.md, "de");
  });

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

      {mdGroups.map((g) => (
        <section key={g.md ?? "—"} className="flex flex-col gap-3">
          <div className="flex items-center gap-2">
            <span
              aria-hidden
              className="size-2.5 rounded-full"
              style={{ backgroundColor: mdColor(g.md) }}
            />
            <h2 className="text-lg font-semibold">{g.md ?? "Ohne MD"}</h2>
            <span className="text-sm text-muted-foreground">
              ({g.hubs.length} {g.hubs.length === 1 ? "Hub" : "Hubs"})
            </span>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {g.hubs.map((h) => {
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
              className="relative overflow-hidden rounded-2xl border-border/70 transition-all hover:-translate-y-0.5 hover:shadow-lg hover:ring-1 hover:ring-primary/20"
            >
              <span
                aria-hidden
                className="absolute inset-x-0 top-0 h-1.5"
                style={{
                  background: `linear-gradient(90deg, ${color}, ${color}66)`,
                }}
              />
              <CardContent className="flex h-full flex-col gap-4 p-5">
                {/* Titel in voller Breite — nie abgeschnitten */}
                <div className="flex flex-col gap-1.5">
                  <Link
                    href={`/hubs/${h.id}`}
                    className="group/title flex items-start justify-between gap-2 hover:text-primary"
                  >
                    <span className="text-lg leading-snug font-semibold break-words">
                      {h.name}
                    </span>
                    <span className="mt-1 flex size-6 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground transition-all group-hover/title:bg-primary group-hover/title:text-primary-foreground">
                      <ChevronRight className="size-3.5" />
                    </span>
                  </Link>
                  <HubTags
                    md={h.responsible_md}
                    pdl={h.pdl_name}
                    pdlRole={pdlRoleShort(h.name)}
                  />
                  {(h.address || h.region) && (
                    <span className="flex items-center gap-1 text-xs text-muted-foreground">
                      <MapPin className="size-3 shrink-0" />
                      <span className="truncate">{h.address ?? h.region}</span>
                    </span>
                  )}
                </div>

                {/* Kennzahlen als Stat-Leiste */}
                <div className="grid grid-cols-4 divide-x divide-border rounded-xl border bg-muted/40 py-2.5">
                  {(
                    [
                      [a.flyers, "Flyer"],
                      [a.aufsteller, "Aufst."],
                      [a.boxes, "Boxen"],
                      [a.placements, "Orte"],
                    ] as const
                  ).map(([value, label]) => (
                    <div
                      key={label}
                      className="flex flex-col items-center gap-0.5 px-1"
                    >
                      <span
                        className={cn(
                          "text-base leading-none font-semibold tabular-nums",
                          value === 0 && "text-muted-foreground/60",
                        )}
                      >
                        {value.toLocaleString("de-DE")}
                      </span>
                      <span className="text-[0.65rem] tracking-wide text-muted-foreground uppercase">
                        {label}
                      </span>
                    </div>
                  ))}
                </div>

                {/* Kontakt */}
                {(splitPdlPhones(h.pdl_phone).length > 0 ||
                  splitPdlEmails(h.pdl_email).length > 0) && (
                  <div className="flex flex-col gap-1 text-sm">
                    {splitPdlPhones(h.pdl_phone).map((phone) => (
                      <a
                        key={phone}
                        href={`tel:${phone}`}
                        className="flex items-center gap-1.5 text-primary hover:underline"
                      >
                        <Phone className="size-3.5 shrink-0" />
                        {phone}
                      </a>
                    ))}
                    {splitPdlEmails(h.pdl_email).map((email) => (
                      <a
                        key={email}
                        href={`mailto:${email}`}
                        className="flex min-w-0 items-center gap-1.5 text-primary hover:underline"
                      >
                        <Mail className="size-3.5 shrink-0" />
                        <span className="truncate">{email}</span>
                      </a>
                    ))}
                  </div>
                )}

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

                <div className="mt-auto border-t pt-3">
                  <CopyLink
                    token={h.share_token}
                    prefix="/h"
                    label={`${pdlRoleShort(h.name)}-Link kopieren`}
                  />
                </div>
              </CardContent>
            </Card>
              );
            })}
          </div>
        </section>
      ))}
    </div>
  );
}
