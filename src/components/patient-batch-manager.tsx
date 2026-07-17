"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import {
  Building2,
  ChevronDown,
  ClipboardList,
  Plus,
  Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import {
  createPatientBatch,
  deletePatientBatch,
  setPatientStatus,
} from "@/app/(app)/patienten/actions";

export interface ManagerRecord {
  id: string;
  display_name: string;
  reference_id: string | null;
  status: string;
  source?: string; // 'zentral' | 'pdl'
  note: string | null;
  verified_at: string | null;
}

export interface ManagerBatch {
  id: string;
  hub_id: string;
  hub_name: string;
  period: string; // 'JJJJ-MM'
  note: string | null;
  created_at: string | null;
  records: ManagerRecord[];
}

interface HubOption {
  id: string;
  name: string;
}

const STATUS_META: Record<string, { label: string; pill: string }> = {
  offen: { label: "offen", pill: "bg-muted text-muted-foreground" },
  bestaetigt: { label: "bestätigt", pill: "bg-chart-4/15 text-chart-4" },
  nicht_da: { label: "nicht da", pill: "bg-destructive/15 text-destructive" },
};

const STATUS_OPTIONS = [
  { key: "offen", label: "Offen" },
  { key: "bestaetigt", label: "Bestätigt" },
  { key: "nicht_da", label: "Nicht da" },
] as const;

/** 'JJJJ-MM' → z. B. "Juli 2026". */
function formatPeriod(period: string): string {
  const d = new Date(`${period}-01T00:00:00`);
  if (Number.isNaN(d.getTime())) return period;
  return d.toLocaleDateString("de-DE", { month: "long", year: "numeric" });
}

function currentMonth(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

/** Kleine Fortschrittsleiste: x von y Einträgen geprüft. */
function BatchProgress({ records }: { records: ManagerRecord[] }) {
  const total = records.length;
  const checked = records.filter((r) => r.status !== "offen").length;
  const pct = total > 0 ? Math.min(100, Math.round((checked / total) * 100)) : 0;
  const done = total > 0 && checked >= total;

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-baseline justify-between text-sm">
        <span className="text-muted-foreground">Geprüft</span>
        <span className="font-medium tabular-nums">
          {checked}
          <span className="text-muted-foreground"> / {total}</span>
        </span>
      </div>
      <div
        className="h-2 w-full overflow-hidden rounded-full bg-muted"
        role="progressbar"
        aria-valuenow={pct}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label="Patienten geprüft"
      >
        <div
          className={cn(
            "h-full rounded-full transition-all",
            done ? "bg-chart-4" : "bg-primary",
          )}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

/**
 * Interne Verwaltung der monatlichen Patientenlisten:
 * Import-Formular + Batches gruppiert nach Monat (neueste zuerst).
 */
export function PatientBatchManager({
  hubs,
  batches,
}: {
  hubs: HubOption[];
  batches: ManagerBatch[];
}) {
  const [pending, startTransition] = useTransition();

  const [hubId, setHubId] = useState(hubs[0]?.id ?? "");
  const [period, setPeriod] = useState(currentMonth());
  const [entriesText, setEntriesText] = useState("");
  const [creating, setCreating] = useState(false);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  function toggle(id: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function onCreate(e: React.FormEvent) {
    e.preventDefault();
    if (creating) return;
    setCreating(true);
    startTransition(async () => {
      const res = await createPatientBatch({
        hub_id: hubId,
        period,
        entriesText,
      });
      setCreating(false);
      if (res.ok) {
        toast.success("Monatsliste angelegt");
        setEntriesText("");
      } else {
        toast.error(res.error);
      }
    });
  }

  function changeStatus(recordId: string, status: string) {
    startTransition(async () => {
      const res = await setPatientStatus(recordId, status);
      if (!res.ok) toast.error(res.error);
    });
  }

  function removeBatch(b: ManagerBatch) {
    const ok = window.confirm(
      `Liste „${b.hub_name} · ${formatPeriod(b.period)}" wirklich löschen? Alle ${b.records.length} Einträge werden entfernt.`,
    );
    if (!ok) return;
    startTransition(async () => {
      const res = await deletePatientBatch(b.id);
      if (res.ok) toast.success("Liste gelöscht");
      else toast.error(res.error);
    });
  }

  // Nach Monat gruppieren, neueste zuerst.
  const byPeriod = new Map<string, ManagerBatch[]>();
  for (const b of batches) {
    const arr = byPeriod.get(b.period);
    if (arr) arr.push(b);
    else byPeriod.set(b.period, [b]);
  }
  const groups = [...byPeriod.entries()].sort((a, b) =>
    b[0].localeCompare(a[0]),
  );

  return (
    <div className="flex flex-col gap-4">
      <form
        onSubmit={onCreate}
        className="flex flex-col gap-4 rounded-xl border bg-card p-5 shadow-sm"
      >
        <h2 className="flex items-center gap-2 font-semibold">
          <Plus className="size-4 text-primary" />
          Neue Monatsliste
        </h2>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-2">
            <Label>Hub</Label>
            <Select
              items={Object.fromEntries(hubs.map((h) => [h.id, h.name]))}
              value={hubId}
              onValueChange={(v) => setHubId(v ?? "")}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Hub wählen" />
              </SelectTrigger>
              <SelectContent>
                {hubs.map((h) => (
                  <SelectItem key={h.id} value={h.id}>
                    {h.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="patient_period">Monat</Label>
            <Input
              id="patient_period"
              type="month"
              value={period}
              onChange={(e) => setPeriod(e.target.value)}
            />
          </div>
        </div>

        <div className="flex flex-col gap-2">
          <Label htmlFor="patient_entries">
            Patienten (eine Zeile pro Person)
          </Label>
          <Textarea
            id="patient_entries"
            value={entriesText}
            onChange={(e) => setEntriesText(e.target.value)}
            placeholder={"Müller, Anna; REF-123"}
            className="min-h-32"
          />
          <p className="text-xs text-muted-foreground">
            Format: Name oder Name; Referenz-ID. Datenminimierung: bitte nur
            Anzeigename und optionale Referenz-ID, keine weiteren Daten.
          </p>
        </div>

        <Button
          type="submit"
          className="self-start"
          disabled={creating || pending || !hubId || !period || !entriesText.trim()}
        >
          {creating ? "Lege an…" : "Liste anlegen"}
        </Button>
      </form>

      {groups.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Noch keine Patientenlisten angelegt.
        </p>
      ) : (
        groups.map(([groupPeriod, groupBatches]) => (
          <section key={groupPeriod} className="flex flex-col gap-3">
            <h2 className="text-sm font-medium text-muted-foreground">
              {formatPeriod(groupPeriod)}
            </h2>
            <ul className="flex flex-col gap-2.5">
              {groupBatches.map((b) => {
                const open = expanded.has(b.id);
                return (
                  <li
                    key={b.id}
                    className="flex flex-col gap-3 rounded-xl border bg-card p-4 shadow-sm"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex min-w-0 items-start gap-3">
                        <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                          <ClipboardList className="size-4.5" />
                        </span>
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <Building2 className="size-3.5 text-muted-foreground" />
                            <span className="font-medium">{b.hub_name}</span>
                            <Badge variant="outline">
                              {formatPeriod(b.period)}
                            </Badge>
                            <Badge variant="secondary">
                              {b.records.length}{" "}
                              {b.records.length === 1 ? "Eintrag" : "Einträge"}
                            </Badge>
                          </div>
                          {b.note && (
                            <p className="mt-0.5 truncate text-sm text-muted-foreground">
                              „{b.note}&rdquo;
                            </p>
                          )}
                        </div>
                      </div>
                      <div className="flex shrink-0 items-center gap-1">
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="size-8 text-muted-foreground hover:text-destructive"
                          disabled={pending}
                          onClick={() => removeBatch(b)}
                          aria-label="Liste löschen"
                        >
                          <Trash2 className="size-4" />
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="size-8 text-muted-foreground"
                          onClick={() => toggle(b.id)}
                          aria-label={
                            open ? "Einträge einklappen" : "Einträge anzeigen"
                          }
                          aria-expanded={open}
                        >
                          <ChevronDown
                            className={cn(
                              "size-4 transition-transform",
                              open && "rotate-180",
                            )}
                          />
                        </Button>
                      </div>
                    </div>

                    <BatchProgress records={b.records} />

                    {open && (
                      <ul className="flex flex-col gap-2 border-t pt-3">
                        {b.records.length === 0 ? (
                          <p className="text-sm text-muted-foreground">
                            Keine Einträge.
                          </p>
                        ) : (
                          b.records.map((r) => {
                            const meta =
                              STATUS_META[r.status] ?? STATUS_META.offen;
                            return (
                              <li
                                key={r.id}
                                className="flex flex-col gap-2 rounded-lg border bg-background px-3 py-2.5 sm:flex-row sm:items-center sm:justify-between"
                              >
                                <div className="min-w-0">
                                  <p className="flex flex-wrap items-center gap-2 text-sm">
                                    <span
                                      className={cn(
                                        "font-medium",
                                        r.status === "nicht_da" &&
                                          "line-through opacity-70",
                                      )}
                                    >
                                      {r.display_name}
                                    </span>
                                    {r.reference_id && (
                                      <span className="text-muted-foreground">
                                        {r.reference_id}
                                      </span>
                                    )}
                                    {r.source === "pdl" && (
                                      <span className="rounded-full bg-primary/10 px-1.5 py-0.5 text-[0.65rem] font-medium text-primary">
                                        von PDL ergänzt
                                      </span>
                                    )}
                                    <span
                                      className={cn(
                                        "rounded-full px-2 py-0.5 text-xs font-medium",
                                        meta.pill,
                                      )}
                                    >
                                      {meta.label}
                                    </span>
                                  </p>
                                  {r.note && (
                                    <p className="mt-0.5 text-xs text-muted-foreground">
                                      „{r.note}&rdquo;
                                    </p>
                                  )}
                                </div>
                                <div className="flex shrink-0 items-center gap-1 rounded-lg bg-muted p-1">
                                  {STATUS_OPTIONS.map((s) => (
                                    <button
                                      key={s.key}
                                      type="button"
                                      disabled={pending || r.status === s.key}
                                      onClick={() =>
                                        changeStatus(r.id, s.key)
                                      }
                                      className={cn(
                                        "rounded-md px-2.5 py-1 text-xs font-medium whitespace-nowrap transition-colors disabled:cursor-default",
                                        r.status === s.key
                                          ? (STATUS_META[s.key]?.pill ??
                                              "bg-background")
                                          : "text-muted-foreground hover:text-foreground",
                                      )}
                                    >
                                      {s.label}
                                    </button>
                                  ))}
                                </div>
                              </li>
                            );
                          })
                        )}
                      </ul>
                    )}
                  </li>
                );
              })}
            </ul>
          </section>
        ))
      )}
    </div>
  );
}
