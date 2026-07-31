"use client";

import { useRef, useState, useTransition } from "react";
import { toast } from "sonner";
import { FileSpreadsheet, Upload, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { parseCsv } from "@/lib/csv";
import {
  importCrmTargetsCsv,
  type CsvTargetRow,
} from "@/app/(app)/ziele/actions";

const NONE = "__none__";
const HUB_NONE = "__none__";

/** Zielfelder des Imports; guess ordnet Spalten anhand der Überschrift zu. */
const FIELDS = [
  { key: "name", label: "Name (Pflicht)", guess: /name|einrichtung|institution|klinik|krankenhaus|firma/i },
  { key: "adresse", label: "Adresse", guess: /adresse|stra(ß|ss)e|street/i },
  { key: "ort", label: "Ort/Stadt", guess: /^ort$|stadt|city/i },
  { key: "kategorie", label: "Kategorie", guess: /kategorie|^typ$|^art$/i },
  { key: "geo_tag", label: "Geo-Tag/Region", guess: /region|gebiet|geo|^tag$/i },
  { key: "status", label: "Status (offen/kontaktiert)", guess: /status|kontaktiert|offen/i },
  { key: "letzter_kontakt", label: "Letzter Kontakt (Datum)", guess: /letzt|zuletzt|datum|date/i },
  { key: "ansprechpartner", label: "Ansprechpartner", guess: /ansprech|person/i },
  { key: "funktion", label: "Funktion", guess: /funktion|position|rolle|abteilung/i },
  { key: "telefon", label: "Telefon", guess: /telefon|^tel|phone|durchwahl|mobil/i },
  { key: "email", label: "E-Mail", guess: /mail/i },
  { key: "notiz", label: "Notiz", guess: /notiz|bemerkung|kommentar|note|info/i },
] as const;

type FieldKey = (typeof FIELDS)[number]["key"];

/**
 * CSV-Import für Institutionen: Datei hochladen, Spalten zuordnen (mit
 * Vorschau), fertig. Duplikate zu bestehenden Zielen erkennt der Server;
 * "bereits kontaktiert" landet im Kontakt-Log.
 */
export function CrmCsvImport({
  hubs,
}: {
  hubs: { id: string; name: string }[];
}) {
  const [pending, startTransition] = useTransition();
  const fileRef = useRef<HTMLInputElement>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [rows, setRows] = useState<string[][]>([]);
  const [hasHeader, setHasHeader] = useState(true);
  const [mapping, setMapping] = useState<Record<FieldKey, number>>(
    Object.fromEntries(FIELDS.map((f) => [f.key, -1])) as Record<
      FieldKey,
      number
    >,
  );
  const [hubId, setHubId] = useState(HUB_NONE);

  const hubItems: Record<string, string> = {
    [HUB_NONE]: "Keinem Hub zuteilen",
    ...Object.fromEntries(hubs.map((h) => [h.id, h.name])),
  };

  async function onFile(file: File | undefined) {
    if (!file) return;
    const text = await file.text();
    const parsed = parseCsv(text);
    if (parsed.length === 0) {
      toast.error("Datei ist leer oder konnte nicht gelesen werden.");
      return;
    }
    setFileName(file.name);
    setRows(parsed);
    // Spalten anhand der Überschriften raten (jede Spalte nur einmal).
    const header = parsed[0];
    const next = Object.fromEntries(
      FIELDS.map((f) => [f.key, -1]),
    ) as Record<FieldKey, number>;
    const claimed = new Set<number>();
    for (const f of FIELDS) {
      const idx = header.findIndex(
        (h, i) => !claimed.has(i) && f.guess.test(h.trim()),
      );
      if (idx >= 0) {
        next[f.key] = idx;
        claimed.add(idx);
      }
    }
    // Ohne Treffer für den Namen: erste Spalte nehmen.
    if (next.name === -1) next.name = 0;
    setMapping(next);
    setHasHeader(header.some((h) => /[a-zäöü]/i.test(h)));
  }

  function reset() {
    setFileName(null);
    setRows([]);
    if (fileRef.current) fileRef.current.value = "";
  }

  const dataRows = hasHeader ? rows.slice(1) : rows;
  const columnLabel = (i: number) =>
    hasHeader && rows[0]?.[i]?.trim()
      ? `${rows[0][i].trim().slice(0, 30)} (Spalte ${i + 1})`
      : `Spalte ${i + 1}`;
  const columnCount = rows[0]?.length ?? 0;
  const columnItems: Record<string, string> = {
    [NONE]: "— nicht importieren —",
    ...Object.fromEntries(
      Array.from({ length: columnCount }, (_, i) => [String(i), columnLabel(i)]),
    ),
  };

  const mappedFields = FIELDS.filter((f) => mapping[f.key] >= 0);
  const preview = dataRows.slice(0, 5);

  function runImport() {
    if (mapping.name < 0) {
      toast.error("Bitte die Spalte mit dem Namen zuordnen.");
      return;
    }
    startTransition(async () => {
      const payload: CsvTargetRow[] = dataRows.map((r) => {
        const row: CsvTargetRow = {};
        for (const f of FIELDS) {
          const idx = mapping[f.key];
          if (idx >= 0) row[f.key] = r[idx] ?? "";
        }
        return row;
      });

      // In 500er-Blöcken importieren (Server-Limit pro Aufruf).
      let created = 0;
      let uebersprungen = 0;
      let personen = 0;
      let kontakte = 0;
      let hinweis: string | undefined;
      for (let i = 0; i < payload.length; i += 500) {
        const res = await importCrmTargetsCsv({
          hub_id: hubId === HUB_NONE ? "" : hubId,
          rows: payload.slice(i, i + 500),
        });
        if (!res.ok) {
          toast.error(res.error);
          return;
        }
        created += res.created;
        uebersprungen += res.uebersprungen;
        personen += res.personen;
        kontakte += res.kontakte;
        hinweis = res.hinweis ?? hinweis;
      }
      toast.success(
        `${created} Institutionen angelegt` +
          (uebersprungen > 0 ? `, ${uebersprungen} Duplikate übersprungen` : "") +
          (personen > 0 ? `, ${personen} Ansprechpartner` : "") +
          (kontakte > 0 ? `, ${kontakte} Kontakte übernommen` : ""),
      );
      if (hinweis) toast.warning(hinweis);
      reset();
    });
  }

  return (
    <div className="flex flex-col gap-3 rounded-lg border bg-background p-3">
      <p className="text-sm text-muted-foreground">
        CSV-Datei mit euren Institutionen hochladen (Export aus Excel mit
        Semikolon, Komma oder Tab). Danach die Spalten zuordnen — Duplikate zu
        bestehenden Zielen werden automatisch übersprungen, „bereits
        kontaktiert“ landet im Kontakt-Log.
      </p>

      <div className="flex flex-wrap items-center gap-2">
        <input
          ref={fileRef}
          type="file"
          accept=".csv,.txt,text/csv"
          onChange={(e) => onFile(e.target.files?.[0])}
          className="text-sm file:mr-3 file:cursor-pointer file:rounded-md file:border-0 file:bg-primary/10 file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-primary"
        />
        {fileName && (
          <span className="flex items-center gap-1.5 text-sm text-muted-foreground">
            <FileSpreadsheet className="size-4" />
            {fileName} · {dataRows.length} Zeilen
            <button
              type="button"
              onClick={reset}
              className="text-muted-foreground hover:text-destructive"
              aria-label="Datei entfernen"
            >
              <X className="size-3.5" />
            </button>
          </span>
        )}
      </div>

      {rows.length > 0 && (
        <>
          <label className="flex w-fit cursor-pointer items-center gap-1.5 text-sm select-none">
            <input
              type="checkbox"
              checked={hasHeader}
              onChange={(e) => setHasHeader(e.target.checked)}
              className="size-4 accent-primary"
            />
            Erste Zeile ist Überschrift
          </label>

          {/* Spalten-Zuordnung */}
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {FIELDS.map((f) => (
              <div key={f.key} className="flex flex-col gap-1">
                <span className="text-xs font-medium text-muted-foreground">
                  {f.label}
                </span>
                <Select
                  items={columnItems}
                  value={mapping[f.key] >= 0 ? String(mapping[f.key]) : NONE}
                  onValueChange={(v) =>
                    setMapping({
                      ...mapping,
                      [f.key]: !v || v === NONE ? -1 : Number(v),
                    })
                  }
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(columnItems).map(([value, label]) => (
                      <SelectItem key={value} value={value}>
                        {label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ))}
          </div>

          {/* Vorschau */}
          {mappedFields.length > 0 && preview.length > 0 && (
            <div className="overflow-x-auto rounded-lg border">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/50 text-left">
                    {mappedFields.map((f) => (
                      <th key={f.key} className="px-2.5 py-1.5 font-medium">
                        {f.label.replace(" (Pflicht)", "")}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {preview.map((r, i) => (
                    <tr key={i} className="border-b last:border-0">
                      {mappedFields.map((f) => (
                        <td
                          key={f.key}
                          className="max-w-56 truncate px-2.5 py-1.5"
                        >
                          {r[mapping[f.key]] ?? ""}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <div className="flex flex-wrap items-center gap-2">
            <Select
              items={hubItems}
              value={hubId}
              onValueChange={(v) => setHubId(v ?? HUB_NONE)}
            >
              <SelectTrigger className="w-full sm:w-72">
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
            <Button
              type="button"
              size="sm"
              disabled={pending || dataRows.length === 0}
              onClick={runImport}
            >
              <Upload className="size-4" />
              {pending
                ? "Importiere…"
                : `${dataRows.length} Zeilen importieren`}
            </Button>
          </div>
        </>
      )}
    </div>
  );
}
