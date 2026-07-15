"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Check, CheckCircle2, Users, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

/**
 * Ein Patienten-Eintrag, wie ihn die PDL-Ansicht braucht
 * (DSGVO-minimiert: nur Anzeigename + optionale Referenz-ID).
 */
export interface VerificationRecord {
  id: string;
  display_name: string;
  reference_id: string | null;
  status: string; // 'offen' | 'bestaetigt' | 'nicht_da'
  note: string | null;
}

/** Eine Monatsliste (Batch) des Hubs. `period` im Format 'JJJJ-MM'. */
export interface VerificationBatch {
  id: string;
  period: string;
  records: VerificationRecord[];
}

/**
 * PDL-Patienten-Verifizierung für die öffentliche Hub-Seite (/h/[token]).
 *
 * Props-Contract für die Integration:
 * - `token`: hubs.share_token des Hubs, zu dem der Link gehört.
 * - `batches`: patient_batches DIESES Hubs (neuester Monat zuerst), je Batch
 *   die zugehörigen patient_records als {id, display_name, reference_id,
 *   status, note}. Laden via createAdminClient in zwei Queries + JS-Join.
 *
 * Schreibzugriffe gehen an POST /api/public/patient-verify mit
 * {token, record_id, status: 'bestaetigt' | 'nicht_da', note?} —
 * der Server prüft, dass der Eintrag zum Hub des Tokens gehört.
 */
export function PatientVerification({
  token,
  batches,
}: {
  token: string;
  batches: VerificationBatch[];
}) {
  const [data, setData] = useState<VerificationBatch[]>(batches);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [noteFor, setNoteFor] = useState<string | null>(null);
  const [noteText, setNoteText] = useState("");

  function patchRecord(id: string, patch: Partial<VerificationRecord>) {
    setData((prev) =>
      prev.map((b) => ({
        ...b,
        records: b.records.map((r) => (r.id === id ? { ...r, ...patch } : r)),
      })),
    );
  }

  async function send(
    record: VerificationRecord,
    status: "bestaetigt" | "nicht_da",
    note?: string,
  ) {
    if (savingId) return;
    setSavingId(record.id);
    const prev = { status: record.status, note: record.note };
    // Optimistisch aktualisieren, bei Fehler zurückrollen.
    patchRecord(record.id, { status, note: note?.trim() || null });
    setNoteFor(null);
    setNoteText("");
    try {
      const res = await fetch("/api/public/patient-verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, record_id: record.id, status, note }),
      });
      const body = (await res.json().catch(() => ({}))) as {
        error?: string;
        record?: { status?: string; note?: string | null };
      };
      if (!res.ok) {
        patchRecord(record.id, prev);
        toast.error(body.error ?? "Speichern fehlgeschlagen.");
        return;
      }
      toast.success(
        status === "bestaetigt"
          ? "Patient bestätigt"
          : "Patient als nicht da vermerkt",
      );
    } catch {
      patchRecord(record.id, prev);
      toast.error("Netzwerkfehler. Bitte erneut versuchen.");
    } finally {
      setSavingId(null);
    }
  }

  function formatPeriod(period: string): string {
    const d = new Date(`${period}-01T00:00:00`);
    if (Number.isNaN(d.getTime())) return period;
    return d.toLocaleDateString("de-DE", { month: "long", year: "numeric" });
  }

  if (data.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        Aktuell liegt keine Patientenliste zur Prüfung vor.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-5">
      {data.map((batch) => {
        const total = batch.records.length;
        const checked = batch.records.filter(
          (r) => r.status !== "offen",
        ).length;
        const allDone = total > 0 && checked >= total;
        const pct = total > 0 ? Math.round((checked / total) * 100) : 0;

        return (
          <section
            key={batch.id}
            className="flex flex-col gap-4 rounded-xl border bg-card p-5 shadow-sm"
          >
            <div className="flex items-center gap-2">
              <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <Users className="size-4" />
              </span>
              <h2 className="font-semibold">
                Patienten-Prüfung {formatPeriod(batch.period)}
              </h2>
            </div>

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
                    allDone ? "bg-chart-4" : "bg-primary",
                  )}
                  style={{ width: `${pct}%` }}
                />
              </div>
            </div>

            {allDone ? (
              <div className="flex items-center gap-2.5 rounded-lg border border-chart-4/30 bg-chart-4/10 px-3 py-2.5 text-sm font-medium text-chart-4">
                <CheckCircle2 className="size-4.5 shrink-0" />
                Alle Patienten für diesen Monat geprüft — danke!
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                Bitte bestätigen Sie für jeden Patienten, ob er weiterhin von
                Ihnen versorgt wird.
              </p>
            )}

            <ul className="flex flex-col gap-2">
              {batch.records.map((r) => {
                const open = r.status === "offen";
                const confirmed = r.status === "bestaetigt";
                const noteOpen = noteFor === r.id;

                return (
                  <li
                    key={r.id}
                    className={cn(
                      "flex flex-col gap-2.5 rounded-lg border bg-background px-3 py-2.5",
                      !open && "opacity-60",
                    )}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium">
                          {r.display_name}
                        </p>
                        {r.reference_id && (
                          <p className="truncate text-xs text-muted-foreground">
                            {r.reference_id}
                          </p>
                        )}
                        {!open && r.note && (
                          <p className="mt-0.5 truncate text-xs text-muted-foreground">
                            „{r.note}&rdquo;
                          </p>
                        )}
                      </div>

                      {open ? (
                        <div className="flex shrink-0 items-center gap-2">
                          <Button
                            type="button"
                            size="sm"
                            disabled={savingId != null}
                            onClick={() => send(r, "bestaetigt")}
                          >
                            <Check className="size-4" />
                            Ist da
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            className="text-destructive hover:text-destructive"
                            disabled={savingId != null}
                            onClick={() => {
                              setNoteFor(noteOpen ? null : r.id);
                              setNoteText("");
                            }}
                          >
                            <X className="size-4" />
                            Nicht da
                          </Button>
                        </div>
                      ) : (
                        <span
                          className={cn(
                            "shrink-0 rounded-full px-2 py-0.5 text-xs font-medium",
                            confirmed
                              ? "bg-chart-4/15 text-chart-4"
                              : "bg-destructive/15 text-destructive",
                          )}
                        >
                          {confirmed ? "bestätigt" : "nicht da"}
                        </span>
                      )}
                    </div>

                    {open && noteOpen && (
                      <div className="flex flex-col gap-2 border-t pt-2.5 sm:flex-row sm:items-center">
                        <Input
                          value={noteText}
                          onChange={(e) => setNoteText(e.target.value)}
                          placeholder="Notiz (optional), z. B. verzogen"
                          autoComplete="off"
                          className="sm:flex-1"
                        />
                        <Button
                          type="button"
                          size="sm"
                          variant="destructive"
                          className="shrink-0"
                          disabled={savingId != null}
                          onClick={() => send(r, "nicht_da", noteText)}
                        >
                          Als „nicht da&rdquo; speichern
                        </Button>
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          </section>
        );
      })}
    </div>
  );
}
