"use client";

import { useState } from "react";
import { CalendarClock, MapPin, Phone, Users } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { placeKindLabel } from "@/lib/places";
import {
  crmStatus,
  formatIsoDate,
  kontaktArtLabel,
  planLabel,
  relevanzOf,
  todayIso,
} from "@/lib/crm";
import type { CrmTargetRow } from "@/components/crm-targets-manager";

const HUB_ALL = "__all__";
const CARD_CAP = 50;

type Stage = "neu" | "faellig" | "kontakt";

const STAGES: { key: Stage; title: string; hint: string; accent: string }[] = [
  {
    key: "neu",
    title: "Erstkontakt offen",
    hint: "Noch nie besucht — nach Prio sortiert",
    accent: "border-t-slate-400",
  },
  {
    key: "faellig",
    title: "Follow-up fällig",
    hint: "Letzter Kontakt liegt zu lange zurück",
    accent: "border-t-amber-500",
  },
  {
    key: "kontakt",
    title: "In Kontakt",
    hint: "Kontakt geloggt — nächster Termin steht",
    accent: "border-t-emerald-500",
  },
];

/** Farbcode je Orts-Kategorie (Kartenrand + Legende). */
const KAT_COLORS: Record<string, { border: string; dot: string; label: string }> = {
  krankenhaus: { border: "border-l-sky-500", dot: "bg-sky-500", label: "Krankenhaus" },
  praxis: { border: "border-l-emerald-500", dot: "bg-emerald-500", label: "Praxis" },
  pflegeeinrichtung: {
    border: "border-l-violet-500",
    dot: "bg-violet-500",
    label: "Pflege/Sozialstation",
  },
  apotheke: { border: "border-l-rose-500", dot: "bg-rose-500", label: "Apotheke" },
  sanitaetshaus: {
    border: "border-l-amber-500",
    dot: "bg-amber-500",
    label: "Sanitätshaus",
  },
  sonstiges: { border: "border-l-slate-400", dot: "bg-slate-400", label: "Sonstiges" },
};
const katColor = (kategorie: string | null | undefined) =>
  KAT_COLORS[kategorie ?? "sonstiges"] ?? KAT_COLORS.sonstiges;

function recareOf(t: CrmTargetRow): boolean | null {
  if (t.recare_partner != null) return t.recare_partner;
  if (t.note?.includes("Recare-Partner")) return true;
  return null;
}

function stageOf(t: CrmTargetRow, today: string): Stage {
  const s = crmStatus(t, today);
  return s === "erstbesuch" ? "neu" : s === "faellig" ? "faellig" : "kontakt";
}

/**
 * CRM-Pipeline als Kanban: Karten wandern automatisch, sobald die PDLs
 * Kontakte loggen (Erstkontakt → In Kontakt, Fälligkeit per Datum) oder
 * Recare bestätigt wird — die Spalten spiegeln echte Aktivität wider.
 */
export function CrmKanban({
  targets,
  hubs,
}: {
  targets: CrmTargetRow[];
  hubs: { id: string; name: string }[];
}) {
  const [hubFilter, setHubFilter] = useState<string>(HUB_ALL);
  const [query, setQuery] = useState("");
  const [openCard, setOpenCard] = useState<string | null>(null);

  const today = todayIso();
  const hubName = (id: string | null) =>
    hubs.find((h) => h.id === id)?.name ?? "Nicht zugeteilt";
  const hubItems = {
    [HUB_ALL]: "Alle Standorte",
    ...Object.fromEntries(hubs.map((h) => [h.id, h.name])),
  };

  const q = query.trim().toLowerCase();
  const filtered = targets.filter((t) => {
    if (hubFilter !== HUB_ALL && t.hub_id !== hubFilter) return false;
    if (q) {
      const hay = `${t.name} ${t.ort ?? ""} ${t.ansprechpartner ?? ""}`.toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });

  const byStage = new Map<Stage, CrmTargetRow[]>();
  for (const s of STAGES) byStage.set(s.key, []);
  for (const t of filtered) byStage.get(stageOf(t, today))!.push(t);
  for (const [, list] of byStage) {
    list.sort(
      (a, b) =>
        (relevanzOf(a) ?? 9) - (relevanzOf(b) ?? 9) ||
        a.name.localeCompare(b.name, "de"),
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <Select
          items={hubItems}
          value={hubFilter}
          onValueChange={(v) => setHubFilter(v ?? HUB_ALL)}
        >
          <SelectTrigger className="w-56">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {Object.entries(hubItems).map(([value, label]) => (
              <SelectItem key={value} value={value}>
                {label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Suchen…"
          className="min-w-48 flex-1 sm:max-w-xs"
          autoComplete="off"
        />
        <span className="ml-auto text-xs text-muted-foreground">
          Karten wandern automatisch, sobald PDLs Kontakte loggen.
        </span>
      </div>

      {/* Farb-Legende der Kategorien */}
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
        {Object.values(KAT_COLORS).map((k) => (
          <span key={k.label} className="flex items-center gap-1.5">
            <span className={cn("size-2.5 rounded-full", k.dot)} />
            {k.label}
          </span>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
        {STAGES.map((stage) => {
          const list = byStage.get(stage.key) ?? [];
          return (
            <section
              key={stage.key}
              className={cn(
                "flex min-w-0 flex-col rounded-xl border border-t-4 bg-muted/30",
                stage.accent,
              )}
            >
              <div className="px-3 pt-2.5 pb-1.5">
                <p className="flex items-baseline gap-1.5 text-sm font-semibold">
                  {stage.title}
                  <span className="font-normal text-muted-foreground tabular-nums">
                    {list.length}
                  </span>
                </p>
                <p className="text-xs text-muted-foreground">{stage.hint}</p>
              </div>
              <div className="flex max-h-[32rem] flex-col gap-1.5 overflow-y-auto p-2">
                {list.length === 0 && (
                  <p className="px-1 py-3 text-center text-xs text-muted-foreground">
                    Keine Orte
                  </p>
                )}
                {list.slice(0, CARD_CAP).map((t) => {
                  const rel = relevanzOf(t);
                  const open = openCard === t.id;
                  return (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => setOpenCard(open ? null : t.id)}
                      className={cn(
                        "flex flex-col gap-0.5 rounded-lg border border-l-4 bg-card p-2.5 text-left text-sm shadow-sm transition-colors hover:bg-accent/40",
                        katColor(t.kategorie).border,
                      )}
                    >
                      <span className="flex items-start justify-between gap-1.5">
                        <span className="min-w-0 leading-tight font-medium">
                          {t.name}
                        </span>
                        {rel != null && (
                          <span
                            className={cn(
                              "shrink-0 rounded-full px-1.5 py-0.5 text-[0.6rem] font-semibold",
                              rel === 1
                                ? "bg-primary text-primary-foreground"
                                : rel === 2
                                  ? "bg-primary/10 text-primary"
                                  : "bg-muted text-muted-foreground",
                            )}
                          >
                            P{rel}
                          </span>
                        )}
                      </span>
                      <span className="flex items-center gap-1 text-xs text-muted-foreground">
                        <MapPin className="size-3 shrink-0" />
                        <span className="truncate">
                          {[
                            hubFilter === HUB_ALL ? hubName(t.hub_id) : null,
                            t.kategorie ? placeKindLabel(t.kategorie) : null,
                            t.ort,
                          ]
                            .filter(Boolean)
                            .join(" · ")}
                        </span>
                      </span>
                      {t.letzter_besuch ? (
                        <span className="flex items-center gap-1 text-xs text-muted-foreground">
                          <CalendarClock className="size-3 shrink-0" />
                          {kontaktArtLabel(t.letzte_kontakt_art) || "Kontakt"} am{" "}
                          {formatIsoDate(t.letzter_besuch)}
                          {stage.key === "kontakt" && t.naechster_besuch
                            ? ` · wieder ab ${formatIsoDate(t.naechster_besuch)}`
                            : ""}
                        </span>
                      ) : (
                        planLabel(t.plan) && (
                          <span className="text-xs text-muted-foreground">
                            To-do: {planLabel(t.plan)}
                          </span>
                        )
                      )}

                      {open && (
                        <span className="mt-1 flex flex-col gap-0.5 border-t pt-1 text-xs text-muted-foreground">
                          {t.adresse && <span>{t.adresse}</span>}
                          {t.ansprechpartner && (
                            <span className="flex items-center gap-1">
                              <Users className="size-3" />
                              {t.ansprechpartner}
                            </span>
                          )}
                          {t.besuchs_notiz && <span>„{t.besuchs_notiz}“</span>}
                          {recareOf(t) === true && (
                            <span className="text-chart-4">
                              ✓ Recare-Partner
                            </span>
                          )}
                          {recareOf(t) === false && (
                            <span className="text-destructive">
                              arbeitet nicht mit Recare
                            </span>
                          )}
                          <span className="flex items-center gap-1">
                            <Phone className="size-3" />
                            Follow-up alle {t.intervall_wochen} Wochen
                          </span>
                          {/Von der PDL/i.test(t.note ?? "") && (
                            <Badge
                              variant="outline"
                              className="w-fit border-chart-4/40 bg-chart-4/10 text-chart-4"
                            >
                              von PDL eingetragen
                            </Badge>
                          )}
                        </span>
                      )}
                    </button>
                  );
                })}
                {list.length > CARD_CAP && (
                  <p className="px-1 py-1.5 text-center text-xs text-muted-foreground">
                    + {list.length - CARD_CAP} weitere — Standort wählen oder
                    suchen, um einzugrenzen
                  </p>
                )}
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}
