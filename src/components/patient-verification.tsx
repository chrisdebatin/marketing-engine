"use client";

import { useState } from "react";
import { toast } from "sonner";
import {
  Check,
  CheckCircle2,
  Users,
  X,
  Plus,
  Undo2,
  ListChecks,
} from "lucide-react";
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
  source?: string; // 'zentral' | 'pdl'
  note: string | null;
}

/** Eine Monatsliste (Batch) des Hubs. `period` im Format 'JJJJ-MM'. */
export interface VerificationBatch {
  id: string;
  period: string;
  records: VerificationRecord[];
}

/**
 * PDL-Patienten-Check für die öffentliche Hub-Seite (/h/[token]).
 *
 * Die PDL kann: (1) jeden Patienten bestätigen oder streichen ("nicht da"),
 * (2) eine Entscheidung korrigieren (zurück auf offen), (3) fehlende
 * Patienten selbst ergänzen (source='pdl').
 *
 * APIs: POST /api/public/patient-verify {token, record_id, status, note?}
 *       POST /api/public/patient-add {token, batch_id, display_name, reference_id?}
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
  // Formular "Patient ergänzen" je Batch
  const [addFor, setAddFor] = useState<string | null>(null);
  const [addName, setAddName] = useState("");
  const [addRef, setAddRef] = useState("");
  const [adding, setAdding] = useState(false);

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
    status: "bestaetigt" | "nicht_da" | "offen",
    note?: string,
  ) {
    if (savingId) return;
    setSavingId(record.id);
    const prev = { status: record.status, note: record.note };
    // Optimistisch aktualisieren, bei Fehler zurückrollen.
    patchRecord(record.id, {
      status,
      note: status === "offen" ? null : note?.trim() || null,
    });
    setNoteFor(null);
    setNoteText("");
    try {
      const res = await fetch("/api/public/patient-verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, record_id: record.id, status, note }),
      });
      const body = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        patchRecord(record.id, prev);
        toast.error(body.error ?? "Speichern fehlgeschlagen.");
        return;
      }
      toast.success(
        status === "bestaetigt"
          ? "Patient bestätigt"
          : status === "nicht_da"
            ? "Patient gestrichen"
            : "Zurückgesetzt — bitte neu entscheiden",
      );
    } catch {
      patchRecord(record.id, prev);
      toast.error("Netzwerkfehler. Bitte erneut versuchen.");
    } finally {
      setSavingId(null);
    }
  }

  async function addPatient(batchId: string) {
    const name = addName.trim();
    if (!name || adding) return;
    setAdding(true);
    try {
      const res = await fetch("/api/public/patient-add", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          token,
          batch_id: batchId,
          display_name: name,
          reference_id: addRef,
        }),
      });
      const body = (await res.json().catch(() => ({}))) as {
        error?: string;
        record?: VerificationRecord;
      };
      if (!res.ok || !body.record) {
        toast.error(body.error ?? "Speichern fehlgeschlagen.");
        return;
      }
      setData((prev) =>
        prev.map((b) =>
          b.id === batchId
            ? { ...b, records: [...b.records, body.record!] }
            : b,
        ),
      );
      setAddName("");
      setAddRef("");
      setAddFor(null);
      toast.success("Patient ergänzt — danke!");
    } catch {
      toast.error("Netzwerkfehler. Bitte erneut versuchen.");
    } finally {
      setAdding(false);
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
      {/* Einfache Anleitung für die PDL */}
      <div className="flex flex-col gap-2 rounded-xl border border-primary/20 bg-primary/[0.04] p-4 text-sm">
        <p className="flex items-center gap-2 font-semibold">
          <ListChecks className="size-4 text-primary" />
          So funktioniert der Patienten-Check:
        </p>
        <ol className="ml-5 flex list-decimal flex-col gap-1 text-muted-foreground">
          <li>
            Unten steht unsere Liste der <strong>neuen Patienten</strong> für
            Ihren Standort.
          </li>
          <li>
            Klicken Sie bei jedem Patienten auf{" "}
            <strong className="text-foreground">„Ist da&rdquo;</strong>, wenn
            er von Ihnen versorgt wird — oder auf{" "}
            <strong className="text-foreground">„Nicht da&rdquo;</strong>,
            wenn nicht (er wird dann aus unserer Liste gestrichen).
          </li>
          <li>
            <strong className="text-foreground">Fehlt ein Patient?</strong>{" "}
            Über „Patient ergänzen&rdquo; können Sie ihn selbst hinzufügen.
          </li>
        </ol>
        <p className="text-xs text-muted-foreground">
          Falsch geklickt? Über „Ändern&rdquo; können Sie jede Entscheidung
          korrigieren. Ihre Angaben gehen direkt an das Marketing-Team.
        </p>
      </div>

      {data.map((batch) => {
        const total = batch.records.length;
        const checked = batch.records.filter(
          (r) => r.status !== "offen",
        ).length;
        const allDone = total > 0 && checked >= total;
        const pct = total > 0 ? Math.round((checked / total) * 100) : 0;
        const addOpen = addFor === batch.id;

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
                Patienten-Check {formatPeriod(batch.period)}
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

            {allDone && (
              <div className="flex items-center gap-2.5 rounded-lg border border-chart-4/30 bg-chart-4/10 px-3 py-2.5 text-sm font-medium text-chart-4">
                <CheckCircle2 className="size-4.5 shrink-0" />
                Alle Patienten für diesen Monat geprüft — vielen Dank!
              </div>
            )}

            <ul className="flex flex-col gap-2">
              {batch.records.map((r) => {
                const open = r.status === "offen";
                const confirmed = r.status === "bestaetigt";
                const fromPdl = r.source === "pdl";
                const noteOpen = noteFor === r.id;

                return (
                  <li
                    key={r.id}
                    className={cn(
                      "flex flex-col gap-2.5 rounded-lg border bg-background px-3 py-2.5",
                      !open && "opacity-70",
                    )}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <p
                          className={cn(
                            "truncate text-sm font-medium",
                            r.status === "nicht_da" && "line-through",
                          )}
                        >
                          {r.display_name}
                          {fromPdl && (
                            <span className="ml-2 rounded-full bg-primary/10 px-1.5 py-0.5 text-[0.65rem] font-medium text-primary no-underline">
                              von Ihnen ergänzt
                            </span>
                          )}
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
                        <div className="flex shrink-0 items-center gap-2">
                          <span
                            className={cn(
                              "rounded-full px-2 py-0.5 text-xs font-medium",
                              confirmed
                                ? "bg-chart-4/15 text-chart-4"
                                : "bg-destructive/15 text-destructive",
                            )}
                          >
                            {confirmed ? "bestätigt" : "gestrichen"}
                          </span>
                          <Button
                            type="button"
                            size="sm"
                            variant="ghost"
                            className="text-muted-foreground"
                            disabled={savingId != null}
                            onClick={() => send(r, "offen")}
                            title="Entscheidung korrigieren"
                          >
                            <Undo2 className="size-3.5" />
                            Ändern
                          </Button>
                        </div>
                      )}
                    </div>

                    {open && noteOpen && (
                      <div className="flex flex-col gap-2 border-t pt-2.5 sm:flex-row sm:items-center">
                        <Input
                          value={noteText}
                          onChange={(e) => setNoteText(e.target.value)}
                          placeholder="Grund (optional), z. B. verzogen, verstorben, nie betreut"
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
                          Streichen bestätigen
                        </Button>
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>

            {/* Fehlenden Patienten ergänzen */}
            {addOpen ? (
              <div className="flex flex-col gap-2 rounded-lg border bg-background p-3">
                <p className="text-sm font-medium">
                  Patient ergänzen, der in der Liste fehlt
                </p>
                <div className="flex flex-col gap-2 sm:flex-row">
                  <Input
                    value={addName}
                    onChange={(e) => setAddName(e.target.value)}
                    placeholder="Name, z. B. Müller, Anna"
                    autoComplete="off"
                    className="sm:flex-1"
                    maxLength={200}
                  />
                  <Input
                    value={addRef}
                    onChange={(e) => setAddRef(e.target.value)}
                    placeholder="Referenz-Nr. (optional)"
                    autoComplete="off"
                    className="sm:w-48"
                    maxLength={100}
                  />
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    size="sm"
                    disabled={adding || !addName.trim()}
                    onClick={() => addPatient(batch.id)}
                  >
                    {adding ? "Speichere…" : "Hinzufügen"}
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    disabled={adding}
                    onClick={() => setAddFor(null)}
                  >
                    Abbrechen
                  </Button>
                </div>
              </div>
            ) : (
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="self-start"
                onClick={() => {
                  setAddFor(batch.id);
                  setAddName("");
                  setAddRef("");
                }}
              >
                <Plus className="size-4" />
                Patient ergänzen (fehlt in der Liste)
              </Button>
            )}
          </section>
        );
      })}
    </div>
  );
}
