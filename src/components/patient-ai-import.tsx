"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Sparkles, Trash2, AlertTriangle, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { importParsedPatients } from "@/app/(app)/patienten/actions";

interface HubOption {
  id: string;
  name: string;
}

interface Row {
  hub_id: string; // "" = nicht zugeordnet
  hub_input: string;
  display_name: string;
  reference_id: string;
}

/**
 * KI-Import: zentrale Patientendaten formlos einfügen — Claude extrahiert
 * Name + Referenz-ID und ordnet jeden Patienten dem passenden Hub zu.
 * Vor dem Übernehmen ist alles in einer Vorschau editierbar.
 */
export function PatientAiImport({ hubs }: { hubs: HubOption[] }) {
  const [text, setText] = useState("");
  const [period, setPeriod] = useState("");
  const [rows, setRows] = useState<Row[] | null>(null);
  const [parsing, setParsing] = useState(false);
  const [pending, startTransition] = useTransition();

  const hubItems = Object.fromEntries(hubs.map((h) => [h.id, h.name]));

  async function parse() {
    if (parsing || !text.trim()) return;
    setParsing(true);
    try {
      const res = await fetch("/api/patients/parse", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        error?: string;
        patients?: Array<{
          hub_id: string | null;
          hub_input: string;
          display_name: string;
          reference_id: string;
        }>;
      };
      if (!res.ok) {
        toast.error(data.error ?? "Zuordnung fehlgeschlagen.");
        return;
      }
      const parsed = (data.patients ?? []).map((p) => ({
        hub_id: p.hub_id ?? "",
        hub_input: p.hub_input,
        display_name: p.display_name,
        reference_id: p.reference_id,
      }));
      if (parsed.length === 0) {
        toast.error("Keine Patienten im Text erkannt.");
        return;
      }
      setRows(parsed);
      const unmatched = parsed.filter((r) => !r.hub_id).length;
      toast.success(
        unmatched > 0
          ? `${parsed.length} Patienten erkannt — ${unmatched} ohne eindeutigen Hub, bitte zuordnen.`
          : `${parsed.length} Patienten erkannt und zugeordnet.`,
      );
    } catch {
      toast.error("Netzwerkfehler. Bitte erneut versuchen.");
    } finally {
      setParsing(false);
    }
  }

  function update(i: number, patch: Partial<Row>) {
    setRows((prev) =>
      prev ? prev.map((r, idx) => (idx === i ? { ...r, ...patch } : r)) : prev,
    );
  }

  function remove(i: number) {
    setRows((prev) => (prev ? prev.filter((_, idx) => idx !== i) : prev));
  }

  const unmatchedCount = (rows ?? []).filter((r) => !r.hub_id).length;
  const canImport =
    !!rows &&
    rows.length > 0 &&
    unmatchedCount === 0 &&
    /^\d{4}-\d{2}$/.test(period) &&
    rows.every((r) => r.display_name.trim());

  function doImport() {
    if (!rows || !canImport || pending) return;
    startTransition(async () => {
      const res = await importParsedPatients({
        period,
        entries: rows.map((r) => ({
          hub_id: r.hub_id,
          display_name: r.display_name.trim(),
          reference_id: r.reference_id.trim() || undefined,
        })),
      });
      if (res.ok) {
        toast.success(`${res.created ?? rows.length} Patienten übernommen`);
        setRows(null);
        setText("");
      } else {
        toast.error(res.error);
      }
    });
  }

  // Zusammenfassung je Hub für die Übernahme-Zeile
  const hubCounts = new Map<string, number>();
  for (const r of rows ?? []) {
    if (r.hub_id) hubCounts.set(r.hub_id, (hubCounts.get(r.hub_id) ?? 0) + 1);
  }

  return (
    <div className="flex flex-col gap-4 rounded-xl border border-primary/25 bg-primary/[0.03] p-5">
      <div>
        <h2 className="flex items-center gap-2 font-semibold">
          <Sparkles className="size-4 text-primary" />
          Patienten einfügen — Claude ordnet sie den Hubs zu
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Kopiere deine zentralen Daten einfach hier hinein — egal in welchem
          Format (Tabelle, Liste, mit Hub-Überschriften …). Claude erkennt
          Namen, Referenznummern und den passenden Hub. Vor dem Speichern
          kannst du alles prüfen und korrigieren.
        </p>
      </div>

      <Textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={6}
        placeholder={
          "z. B.\nDorsten: Müller, Anna (REF-123); Schmidt, Peter\nBad Nenndorf\n  Weber, Klara – 4711\n  Braun, Otto"
        }
        className="font-mono text-sm"
      />

      <div className="flex flex-wrap items-end gap-3">
        <div className="flex flex-col gap-2">
          <Label htmlFor="ai_period">Monat</Label>
          <Input
            id="ai_period"
            type="month"
            value={period}
            onChange={(e) => setPeriod(e.target.value)}
            className="w-44"
          />
        </div>
        <Button
          type="button"
          onClick={parse}
          disabled={parsing || !text.trim()}
        >
          <Sparkles className="size-4" />
          {parsing ? "Claude ordnet zu…" : "Zuordnen lassen"}
        </Button>
      </div>

      {rows && (
        <div className="flex flex-col gap-3 border-t pt-4">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-sm font-medium">
              Vorschau ({rows.length} Patienten)
            </h3>
            {unmatchedCount > 0 && (
              <Badge variant="outline" className="border-destructive/50 text-destructive">
                <AlertTriangle className="size-3" />
                {unmatchedCount} ohne Hub
              </Badge>
            )}
          </div>

          <ul className="flex flex-col gap-2">
            {rows.map((r, i) => (
              <li
                key={i}
                className={cn(
                  "flex flex-col gap-2 rounded-lg border bg-background p-2.5 sm:flex-row sm:items-center",
                  !r.hub_id && "border-destructive/50",
                )}
              >
                <div className="sm:w-56">
                  <Select
                    items={hubItems}
                    value={r.hub_id}
                    onValueChange={(v) => update(i, { hub_id: v ?? "" })}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue
                        placeholder={
                          r.hub_input
                            ? `Hub wählen („${r.hub_input}“?)`
                            : "Hub wählen"
                        }
                      />
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
                <Input
                  value={r.display_name}
                  onChange={(e) => update(i, { display_name: e.target.value })}
                  placeholder="Name"
                  className="sm:flex-1"
                  maxLength={200}
                />
                <Input
                  value={r.reference_id}
                  onChange={(e) => update(i, { reference_id: e.target.value })}
                  placeholder="Referenz-Nr."
                  className="sm:w-40"
                  maxLength={100}
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="size-8 shrink-0 self-end text-muted-foreground hover:text-destructive sm:self-auto"
                  onClick={() => remove(i)}
                  aria-label="Zeile entfernen"
                >
                  <Trash2 className="size-4" />
                </Button>
              </li>
            ))}
          </ul>

          <div className="flex flex-wrap items-center gap-2">
            <Button type="button" disabled={!canImport || pending} onClick={doImport}>
              <Check className="size-4" />
              {pending
                ? "Übernehme…"
                : `${rows.length} Patienten in ${hubCounts.size} Hub${hubCounts.size === 1 ? "" : "s"} übernehmen`}
            </Button>
            <Button
              type="button"
              variant="ghost"
              disabled={pending}
              onClick={() => setRows(null)}
            >
              Verwerfen
            </Button>
            {!/^\d{4}-\d{2}$/.test(period) && (
              <span className="text-sm text-muted-foreground">
                Bitte oben den Monat wählen.
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
