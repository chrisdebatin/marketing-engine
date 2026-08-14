"use client";

import { useState } from "react";
import { Copy, MapPin } from "lucide-react";
import { Button } from "@/components/ui/button";
import { leadShortId } from "@/lib/leads";
import { formatIsoDate } from "@/lib/crm";

export interface RueckweisungRow {
  id: string;
  name: string;
  eingang: string; // ISO
  ort: string | null;
  telefon: string | null;
  ergebnis: string | null; // enthält "(gemeldet TT.MM.JJJJ)"
}

/**
 * CRM-Admin: zurückgewiesene Agentur-Leads ("nicht im Einzugsbereich") —
 * Grundlage für die wöchentliche Reklamations-Mail an die Lead-Agentur,
 * damit diese Leads nicht in Rechnung gestellt werden. "Liste kopieren"
 * legt den fertigen Text für die E-Mail in die Zwischenablage.
 */
export function AgenturRueckweisungen({
  rows,
  recareCount,
}: {
  rows: RueckweisungRow[];
  recareCount: number;
}) {
  const [copied, setCopied] = useState(false);

  const gemeldetAm = (ergebnis: string | null) =>
    /gemeldet\s+([\d.]+)/.exec(ergebnis ?? "")?.[1] ?? null;

  const kopierText = rows
    .map(
      (r) =>
        `${leadShortId(r.id)} · ${r.name} · eingegangen ${formatIsoDate(r.eingang.slice(0, 10))}` +
        `${r.ort ? ` · ${r.ort}` : ""}${r.telefon ? ` · ${r.telefon}` : ""} — nicht im Einzugsbereich` +
        `${gemeldetAm(r.ergebnis) ? ` (markiert am ${gemeldetAm(r.ergebnis)})` : ""}`,
    )
    .join("\n");

  const woche = (() => {
    const d = new Date();
    d.setDate(d.getDate() - 7);
    const grenze = d.toISOString().slice(0, 10);
    return rows.filter((r) => {
      const g = gemeldetAm(r.ergebnis);
      if (g) {
        const [t, m, j] = g.split(".");
        return `${j}-${m?.padStart(2, "0")}-${t?.padStart(2, "0")}` >= grenze;
      }
      return r.eingang.slice(0, 10) >= grenze;
    }).length;
  })();

  return (
    <section className="rounded-xl border bg-card p-4 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h2 className="flex items-center gap-1.5 text-sm font-semibold">
            <MapPin className="size-4 text-red-600" />
            Zurückgewiesene Agentur-Leads ({rows.length})
          </h2>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Als „nicht im Einzugsbereich“ markiert — der Agentur melden, damit
            sie nicht berechnet werden. {woche} davon aus den letzten 7 Tagen.
            {recareCount > 0 &&
              ` (Zusätzlich ${recareCount} Recare-Lead${recareCount === 1 ? "" : "s"} außerhalb des Einzugsbereichs — nicht abrechnungsrelevant.)`}
          </p>
        </div>
        {rows.length > 0 && (
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => {
              void navigator.clipboard?.writeText(kopierText).catch(() => {});
              setCopied(true);
              setTimeout(() => setCopied(false), 2000);
            }}
          >
            <Copy className="size-3.5" />
            {copied ? "Kopiert ✓" : "Liste für E-Mail kopieren"}
          </Button>
        )}
      </div>
      {rows.length === 0 ? (
        <p className="mt-3 text-sm text-muted-foreground">
          Aktuell keine zurückgewiesenen Agentur-Leads. Der Button „Nicht im
          Einzugsbereich“ an Agentur-Lead-Karten legt sie hier ab.
        </p>
      ) : (
        <div className="mt-3 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-xs text-muted-foreground">
                <th className="py-1.5 pr-3 font-medium">Lead-ID</th>
                <th className="py-1.5 pr-3 font-medium">Name</th>
                <th className="py-1.5 pr-3 font-medium">Eingang</th>
                <th className="py-1.5 pr-3 font-medium">Ort</th>
                <th className="py-1.5 pr-3 font-medium">Telefon</th>
                <th className="py-1.5 font-medium">markiert am</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {rows.map((r) => (
                <tr key={r.id}>
                  <td className="py-1.5 pr-3 font-mono text-xs">{leadShortId(r.id)}</td>
                  <td className="py-1.5 pr-3 font-medium">{r.name}</td>
                  <td className="py-1.5 pr-3 whitespace-nowrap tabular-nums">
                    {formatIsoDate(r.eingang.slice(0, 10))}
                  </td>
                  <td className="py-1.5 pr-3">{r.ort ?? "—"}</td>
                  <td className="py-1.5 pr-3 whitespace-nowrap">{r.telefon ?? "—"}</td>
                  <td className="py-1.5 whitespace-nowrap tabular-nums">
                    {gemeldetAm(r.ergebnis) ?? "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
