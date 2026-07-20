import { UserPlus, UserMinus, Users } from "lucide-react";
import { requireSession } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { HubTags } from "@/components/md-tag";
import {
  abgangGrundLabel,
  leistungLabel,
  pdlRoleShort,
} from "@/lib/leistungen";
import type { PatientFlow } from "@/lib/types";

export const dynamic = "force-dynamic";

function formatPeriod(period: string): string {
  const d = new Date(`${period}-01T00:00:00`);
  if (Number.isNaN(d.getTime())) return period;
  return d.toLocaleDateString("de-DE", { month: "long", year: "numeric" });
}

function formatEventDate(iso: string): string {
  const d = new Date(`${iso}T00:00:00`);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("de-DE");
}

export default async function PatientenPage() {
  const session = await requireSession();
  // `patient_flows` hat RLS disabled und keinen anon-Grant → nur über den
  // Service-Role-Client lesbar (gleiches Muster wie `orders`).
  const admin = createAdminClient();

  // Fallback ?? [] — fehlt die Migration 0017, darf die Seite nicht crashen.
  const { data: flowsData } = await admin
    .from("patient_flows")
    .select(
      "id, hub_id, period, flow, leistung, display_name, reference_id, abgang_grund, event_date, note, created_at",
    )
    .order("period", { ascending: false })
    .order("created_at", { ascending: true });

  // Auf die Hubs der Session filtern (MD-Scoping; Admin sieht alle).
  const hubIds = new Set(session.hubs.map((h) => h.id));
  const flows = ((flowsData ?? []) as PatientFlow[]).filter((f) =>
    hubIds.has(f.hub_id),
  );

  const hubOf = (id: string) => session.hubs.find((h) => h.id === id);

  // Gruppieren: Monat → Hub → Einträge.
  const byPeriod = new Map<string, Map<string, PatientFlow[]>>();
  for (const f of flows) {
    const hubMap = byPeriod.get(f.period) ?? new Map<string, PatientFlow[]>();
    const arr = hubMap.get(f.hub_id) ?? [];
    arr.push(f);
    hubMap.set(f.hub_id, arr);
    byPeriod.set(f.period, hubMap);
  }

  const periods = [...byPeriod.keys()].sort().reverse();

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold">Patienten — Zu- &amp; Abgänge</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Monatliche Meldungen der PDLs über ihren Hub-Link: Neuaufnahmen und
          Abgänge je SGB-Leistung. Gespeichert werden nur Anzeigename und
          optionale Referenz-ID (Datenminimierung).
        </p>
      </div>

      {periods.length === 0 && (
        <p className="rounded-xl border bg-card p-5 text-sm text-muted-foreground shadow-sm">
          Noch keine Meldungen. Die PDLs tragen Zu- und Abgänge über ihren
          persönlichen Hub-Link ein (Bereich „Patienten-Meldung&rdquo;).
        </p>
      )}

      {periods.map((period) => {
        const hubMap = byPeriod.get(period)!;
        const monthFlows = [...hubMap.values()].flat();
        const monthZu = monthFlows.filter((f) => f.flow === "zugang").length;
        const monthAb = monthFlows.filter((f) => f.flow === "abgang").length;

        // Monats-Summen je Leistung.
        const perLeistung = new Map<string, { zu: number; ab: number }>();
        for (const f of monthFlows) {
          const s = perLeistung.get(f.leistung) ?? { zu: 0, ab: 0 };
          if (f.flow === "zugang") s.zu += 1;
          else s.ab += 1;
          perLeistung.set(f.leistung, s);
        }

        return (
          <section key={period} className="flex flex-col gap-3">
            <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
              <h2 className="text-lg font-semibold">{formatPeriod(period)}</h2>
              <span className="text-sm text-muted-foreground tabular-nums">
                {monthZu} Neuaufnahmen · {monthAb} Abgänge
              </span>
            </div>

            <div className="flex flex-wrap gap-1.5">
              {[...perLeistung.entries()].map(([l, s]) => (
                <Badge key={l} variant="outline" className="font-normal">
                  {leistungLabel(l)}: +{s.zu} / −{s.ab}
                </Badge>
              ))}
            </div>

            <div className="grid gap-4 lg:grid-cols-2">
              {[...hubMap.entries()]
                .sort(([a], [b]) =>
                  (hubOf(a)?.name ?? "").localeCompare(
                    hubOf(b)?.name ?? "",
                    "de",
                  ),
                )
                .map(([hubId, entries]) => {
                  const hub = hubOf(hubId);
                  const zugaenge = entries.filter((e) => e.flow === "zugang");
                  const abgaenge = entries.filter((e) => e.flow === "abgang");
                  return (
                    <Card key={hubId}>
                      <CardContent className="flex flex-col gap-3 p-5">
                        <div className="flex items-center gap-2">
                          <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                            <Users className="size-4" />
                          </span>
                          <span className="min-w-0 truncate font-semibold">
                            {hub?.name ?? "Unbekannter Hub"}
                          </span>
                          <HubTags
                            md={hub?.responsible_md ?? null}
                            pdl={hub?.pdl_name ?? null}
                            pdlRole={pdlRoleShort(hub?.name ?? null)}
                            className="ml-auto"
                          />
                        </div>

                        {(
                          [
                            ["zugang", "Neuaufnahmen", zugaenge],
                            ["abgang", "Abgänge", abgaenge],
                          ] as const
                        ).map(([key, label, list]) =>
                          list.length === 0 ? null : (
                            <div key={key} className="flex flex-col gap-1.5">
                              <p className="flex items-center gap-1.5 text-sm font-medium">
                                {key === "zugang" ? (
                                  <UserPlus className="size-4 text-chart-4" />
                                ) : (
                                  <UserMinus className="size-4 text-destructive" />
                                )}
                                {label} ({list.length})
                              </p>
                              <ul className="flex flex-col gap-1">
                                {list.map((e) => (
                                  <li
                                    key={e.id}
                                    className="flex items-baseline justify-between gap-3 border-t pt-1 text-sm first:border-t-0 first:pt-0"
                                  >
                                    <span className="min-w-0 truncate">
                                      {e.display_name}
                                      {e.reference_id && (
                                        <span className="ml-2 text-xs text-muted-foreground">
                                          {e.reference_id}
                                        </span>
                                      )}
                                    </span>
                                    <span className="shrink-0 text-right text-xs text-muted-foreground">
                                      {leistungLabel(e.leistung)}
                                      {e.flow === "zugang" && e.event_date && (
                                        <span className="block">
                                          aufgenommen{" "}
                                          {formatEventDate(e.event_date)}
                                        </span>
                                      )}
                                      {e.flow === "abgang" &&
                                        e.abgang_grund && (
                                          <span className="block">
                                            {abgangGrundLabel(e.abgang_grund)}
                                            {e.note ? ` („${e.note}“)` : ""}
                                          </span>
                                        )}
                                    </span>
                                  </li>
                                ))}
                              </ul>
                            </div>
                          ),
                        )}
                      </CardContent>
                    </Card>
                  );
                })}
            </div>
          </section>
        );
      })}
    </div>
  );
}
