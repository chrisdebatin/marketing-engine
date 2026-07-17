"use client";

import { useState } from "react";
import { toast } from "sonner";
import {
  UserPlus,
  UserMinus,
  Users,
  X,
  ListChecks,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { LEISTUNGEN, leistungLabel } from "@/lib/leistungen";

/** Ein erfasster Zu- oder Abgang (DSGVO-minimiert: Name + Referenz-ID). */
export interface FlowEntry {
  id: string;
  period: string;
  flow: string; // 'zugang' | 'abgang'
  leistung: string;
  display_name: string;
  reference_id: string | null;
}

/** Ein Monat, für den die PDL erfassen kann. */
export interface FlowMonth {
  period: string; // 'JJJJ-MM'
  entries: FlowEntry[];
}

/**
 * PDL-Erfassung der monatlichen Patienten-Zu- und -Abgänge je
 * SGB-Leistungsart (öffentliche Hub-Seite /h/[token]).
 *
 * APIs: POST/DELETE /api/public/patient-flow
 */
export function PatientFlowReport({
  token,
  months,
}: {
  token: string;
  months: FlowMonth[];
}) {
  const [data, setData] = useState<FlowMonth[]>(months);
  // Formular-Zustand je Monat (nur ein Formular aktiv nutzbar, aber Zustand
  // getrennt, damit Wechsel zwischen Monaten nichts verwirft).
  const [flow, setFlow] = useState<"zugang" | "abgang">("zugang");
  const [leistung, setLeistung] = useState<string>("");
  const [name, setName] = useState("");
  const [ref, setRef] = useState("");
  const [formFor, setFormFor] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  function openForm(period: string, f: "zugang" | "abgang") {
    setFormFor(period);
    setFlow(f);
  }

  async function add(period: string) {
    const n = name.trim();
    if (!n || !leistung || saving) return;
    setSaving(true);
    try {
      const res = await fetch("/api/public/patient-flow", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          token,
          period,
          flow,
          leistung,
          display_name: n,
          reference_id: ref,
        }),
      });
      const body = (await res.json().catch(() => ({}))) as {
        error?: string;
        entry?: FlowEntry;
      };
      if (!res.ok || !body.entry) {
        toast.error(body.error ?? "Speichern fehlgeschlagen.");
        return;
      }
      setData((prev) =>
        prev.map((m) =>
          m.period === period
            ? { ...m, entries: [...m.entries, body.entry!] }
            : m,
        ),
      );
      setName("");
      setRef("");
      toast.success(
        flow === "zugang" ? "Neuaufnahme gespeichert" : "Abgang gespeichert",
      );
    } catch {
      toast.error("Netzwerkfehler. Bitte erneut versuchen.");
    } finally {
      setSaving(false);
    }
  }

  async function remove(entry: FlowEntry) {
    if (deletingId) return;
    setDeletingId(entry.id);
    try {
      const res = await fetch("/api/public/patient-flow", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, id: entry.id }),
      });
      const body = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        toast.error(body.error ?? "Löschen fehlgeschlagen.");
        return;
      }
      setData((prev) =>
        prev.map((m) =>
          m.period === entry.period
            ? { ...m, entries: m.entries.filter((e) => e.id !== entry.id) }
            : m,
        ),
      );
      toast.success("Eintrag entfernt");
    } catch {
      toast.error("Netzwerkfehler. Bitte erneut versuchen.");
    } finally {
      setDeletingId(null);
    }
  }

  function formatPeriod(period: string): string {
    const d = new Date(`${period}-01T00:00:00`);
    if (Number.isNaN(d.getTime())) return period;
    return d.toLocaleDateString("de-DE", { month: "long", year: "numeric" });
  }

  return (
    <div className="flex flex-col gap-5">
      {/* Einfache Anleitung für die PDL */}
      <div className="flex flex-col gap-2 rounded-xl border border-primary/20 bg-primary/[0.04] p-4 text-sm">
        <p className="flex items-center gap-2 font-semibold">
          <ListChecks className="size-4 text-primary" />
          So funktioniert die monatliche Patienten-Meldung:
        </p>
        <ol className="ml-5 flex list-decimal flex-col gap-1 text-muted-foreground">
          <li>
            Tragen Sie jeden Monat Ihre{" "}
            <strong className="text-foreground">Neuaufnahmen</strong> und{" "}
            <strong className="text-foreground">Abgänge</strong> ein.
          </li>
          <li>
            Wählen Sie dabei die passende{" "}
            <strong className="text-foreground">Leistung</strong> (z. B.
            Pflegesachleistung, Behandlungspflege, Tagespflege).
          </li>
          <li>
            Falsch eingetragen? Über das{" "}
            <strong className="text-foreground">×</strong> am Eintrag können
            Sie ihn wieder entfernen.
          </li>
        </ol>
        <p className="text-xs text-muted-foreground">
          Ihre Angaben gehen direkt an das Marketing-Team. Bitte nur Name und
          ggf. interne Referenz-Nr. angeben — keine weiteren Patientendaten.
        </p>
      </div>

      {data.map((month) => {
        const zugaenge = month.entries.filter((e) => e.flow === "zugang");
        const abgaenge = month.entries.filter((e) => e.flow === "abgang");
        const formOpen = formFor === month.period;

        return (
          <section
            key={month.period}
            className="flex flex-col gap-4 rounded-xl border bg-card p-5 shadow-sm"
          >
            <div className="flex items-center gap-2">
              <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <Users className="size-4" />
              </span>
              <h2 className="font-semibold">
                Patienten-Meldung {formatPeriod(month.period)}
              </h2>
              <span className="ml-auto text-sm text-muted-foreground tabular-nums">
                {zugaenge.length} Zugänge · {abgaenge.length} Abgänge
              </span>
            </div>

            {/* Erfasste Einträge */}
            {(["zugang", "abgang"] as const).map((f) => {
              const list = f === "zugang" ? zugaenge : abgaenge;
              if (list.length === 0) return null;
              return (
                <div key={f} className="flex flex-col gap-1.5">
                  <p className="flex items-center gap-1.5 text-sm font-medium">
                    {f === "zugang" ? (
                      <UserPlus className="size-4 text-chart-4" />
                    ) : (
                      <UserMinus className="size-4 text-destructive" />
                    )}
                    {f === "zugang" ? "Neuaufnahmen" : "Abgänge"} ({list.length})
                  </p>
                  <ul className="flex flex-col gap-1.5">
                    {list.map((e) => (
                      <li
                        key={e.id}
                        className="flex items-center justify-between gap-3 rounded-lg border bg-background px-3 py-2 text-sm"
                      >
                        <span className="min-w-0">
                          <span className="block truncate font-medium">
                            {e.display_name}
                            {e.reference_id && (
                              <span className="ml-2 text-xs font-normal text-muted-foreground">
                                {e.reference_id}
                              </span>
                            )}
                          </span>
                          <span className="block truncate text-xs text-muted-foreground">
                            {leistungLabel(e.leistung)}
                          </span>
                        </span>
                        <button
                          type="button"
                          disabled={deletingId != null}
                          onClick={() => remove(e)}
                          className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-destructive disabled:opacity-60"
                          title="Eintrag entfernen"
                          aria-label={`${e.display_name} entfernen`}
                        >
                          <X className="size-3.5" />
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              );
            })}

            {month.entries.length === 0 && !formOpen && (
              <p className="text-sm text-muted-foreground">
                Für diesen Monat wurde noch nichts gemeldet.
              </p>
            )}

            {/* Formular */}
            {formOpen ? (
              <div className="flex flex-col gap-3 rounded-lg border bg-background p-3">
                <div className="grid grid-cols-2 gap-1 rounded-lg bg-muted p-1">
                  {(
                    [
                      { k: "zugang", label: "Neuaufnahme", Icon: UserPlus },
                      { k: "abgang", label: "Abgang", Icon: UserMinus },
                    ] as const
                  ).map(({ k, label, Icon }) => (
                    <button
                      key={k}
                      type="button"
                      onClick={() => setFlow(k)}
                      className={cn(
                        "flex items-center justify-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                        flow === k
                          ? "bg-background text-foreground shadow-sm"
                          : "text-muted-foreground hover:text-foreground",
                      )}
                    >
                      <Icon className="size-4" />
                      {label}
                    </button>
                  ))}
                </div>

                <div className="flex flex-col gap-2">
                  <Label>Leistung</Label>
                  <Select
                    value={leistung}
                    onValueChange={(v) => setLeistung(v ?? "")}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Leistung wählen…" />
                    </SelectTrigger>
                    <SelectContent>
                      {LEISTUNGEN.map((l) => (
                        <SelectItem key={l.key} value={l.key}>
                          {l.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="flex flex-col gap-2 sm:flex-row">
                  <Input
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Name, z. B. Müller, Anna"
                    autoComplete="off"
                    className="sm:flex-1"
                    maxLength={200}
                  />
                  <Input
                    value={ref}
                    onChange={(e) => setRef(e.target.value)}
                    placeholder="Referenz-Nr. (optional)"
                    autoComplete="off"
                    className="sm:w-44"
                    maxLength={100}
                  />
                </div>

                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    size="sm"
                    disabled={saving || !name.trim() || !leistung}
                    onClick={() => void add(month.period)}
                  >
                    {saving
                      ? "Speichere…"
                      : flow === "zugang"
                        ? "Neuaufnahme eintragen"
                        : "Abgang eintragen"}
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    disabled={saving}
                    onClick={() => setFormFor(null)}
                  >
                    Schließen
                  </Button>
                </div>
              </div>
            ) : (
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => openForm(month.period, "zugang")}
                >
                  <UserPlus className="size-4" />
                  Neuaufnahme eintragen
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => openForm(month.period, "abgang")}
                >
                  <UserMinus className="size-4" />
                  Abgang eintragen
                </Button>
              </div>
            )}
          </section>
        );
      })}
    </div>
  );
}
