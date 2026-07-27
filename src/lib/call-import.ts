/**
 * Parser für den Anruf-Report der Telefonanlage (3CX-CSV-Export).
 *
 * Die CSV hat eine Zeile pro Anruf-Abschnitt (Leg); mehrere Zeilen teilen
 * sich eine Call ID. Wir verdichten je Call ID auf EINEN Anruf:
 * - Richtung: sobald ein Leg "Inbound" ist → eingehend (Weiterleitungen
 *   aufs Handy erzeugen zusätzlich Outbound-Legs, zählen aber nicht extra).
 * - Angenommen: Gesamt-Gesprächszeit > 0.
 * - Standort: aus dem Trunk-Namen ("Via trunk: Duisburg (MK VC …)"),
 *   sonst aus Namen in Von/An.
 */

export interface ParsedCall {
  call_id: string;
  call_time: string; // ISO
  hub_name: string | null;
  direction: "inbound" | "outbound" | "internal";
  answered: boolean;
  talking_seconds: number;
}

/** Trunk-/Namens-Muster → Hub-Name (Reihenfolge = Priorität). */
const HUB_PATTERNS: [RegExp, string][] = [
  [/tagespflege duisburg/i, "Tagespflege Duisburg"],
  [/tagespflege dorsten/i, "Tagespflege Dorsten"],
  [/duisburg/i, "Duisburg"],
  [/d(ü|Ã¼|u)sseldorf/i, "Düsseldorf"],
  [/dorsten/i, "Dorsten"],
  [/hameln/i, "Hameln"],
  [/rinteln/i, "Rinteln"],
  [/attendorn/i, "Attendorn"],
  [/velbert|wuppertal/i, "Velbert"],
  [/bad pyrmont/i, "Bad Pyrmont"],
  [/barntrup/i, "Alverdissen"],
  [/hess\.? ?oldendorf|hesssisch|hessisch/i, "Hessisch-Oldendorf"],
  [/bad nenndorf/i, "Bad Nenndorf"],
  [/bad oeynhausen/i, "Bad Oeynhausen"],
  [/kerpen/i, "Kerpen"],
  [/iserlohn/i, "Iserlohn"],
  [/l(ü|Ã¼|u)denscheid/i, "Lüdenscheid"],
  [/neuenrade/i, "Neuenrade"],
  [/gevelsberg|ennepe/i, "Gevelsberg"],
  [/m(ä|Ã¤|a)rkischer kreis/i, "Iserlohn"],
];

function hubOf(texts: string[]): string | null {
  // Trunk-Angaben zuerst — sie sind die verlässlichste Standort-Quelle.
  const trunks: string[] = [];
  for (const t of texts) {
    for (const m of t.matchAll(/Via trunk: ([^(]+)\(/g)) {
      trunks.push(m[1].trim());
    }
  }
  for (const source of [trunks.join(" · "), texts.join(" · ")]) {
    if (!source) continue;
    for (const [re, hub] of HUB_PATTERNS) {
      if (re.test(source)) return hub;
    }
  }
  return null;
}

function toSeconds(hms: string): number {
  const parts = hms.trim().split(":").map(Number);
  if (parts.length !== 3 || parts.some(Number.isNaN)) return 0;
  return parts[0] * 3600 + parts[1] * 60 + parts[2];
}

/** Einfacher CSV-Parser (Anführungszeichen + Kommas in Feldern). */
function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += c;
      }
    } else if (c === '"') {
      inQuotes = true;
    } else if (c === ",") {
      row.push(field);
      field = "";
    } else if (c === "\n" || c === "\r") {
      if (c === "\r" && text[i + 1] === "\n") i++;
      row.push(field);
      field = "";
      if (row.some((f) => f.trim() !== "")) rows.push(row);
      row = [];
    } else {
      field += c;
    }
  }
  row.push(field);
  if (row.some((f) => f.trim() !== "")) rows.push(row);
  return rows;
}

export function parseCallReport(csvText: string): {
  calls: ParsedCall[];
  internalCount: number;
  error?: string;
} {
  const text = csvText.replace(/^﻿|^ï»¿/, "");
  const rows = parseCsv(text);
  if (rows.length < 2) {
    return { calls: [], internalCount: 0, error: "CSV ist leer." };
  }

  const header = rows[0].map((h) => h.trim().toLowerCase());
  const col = (name: string) => header.indexOf(name);
  const iTime = col("call time");
  const iId = col("call id");
  const iFrom = col("from");
  const iTo = col("to");
  const iDir = col("direction");
  const iStatus = col("status");
  const iTalk = col("talking");
  const iDetails = col("call activity details");
  if (iTime < 0 || iId < 0 || iDir < 0) {
    return {
      calls: [],
      internalCount: 0,
      error:
        "Spalten nicht erkannt — bitte den Standard-Export (Call Time, Call ID, Direction, …) hochladen.",
    };
  }

  interface Group {
    times: string[];
    directions: string[];
    talking: number;
    texts: string[];
    answeredLeg: boolean;
  }
  const groups = new Map<string, Group>();
  for (const r of rows.slice(1)) {
    const id = (r[iId] ?? "").trim();
    const time = (r[iTime] ?? "").trim();
    // Summen-/Fußzeilen ("Totals,888,…") überspringen.
    if (!id || !time || !/^\d{4}-\d{2}-\d{2}T/.test(time)) continue;
    const g = groups.get(id) ?? {
      times: [],
      directions: [],
      talking: 0,
      texts: [],
      answeredLeg: false,
    };
    g.times.push(time);
    const dir = (r[iDir] ?? "").trim();
    g.directions.push(dir);
    const talk = toSeconds(r[iTalk] ?? "");
    g.talking += talk;
    if (
      (r[iStatus] ?? "").trim() === "Answered" &&
      talk > 0 &&
      dir !== "Inbound Queue"
    ) {
      g.answeredLeg = true;
    }
    for (const idx of [iFrom, iTo, iDetails]) {
      if (idx >= 0 && r[idx]) g.texts.push(r[idx]);
    }
    groups.set(id, g);
  }

  const calls: ParsedCall[] = [];
  let internalCount = 0;
  for (const [id, g] of groups) {
    const hasInbound = g.directions.some((d) => d.startsWith("Inbound"));
    const hasOutbound = g.directions.some((d) => d === "Outbound");
    const direction: ParsedCall["direction"] = hasInbound
      ? "inbound"
      : hasOutbound
        ? "outbound"
        : "internal";
    if (direction === "internal") {
      internalCount++;
      continue;
    }
    calls.push({
      call_id: id,
      call_time: g.times.sort()[0],
      hub_name: hubOf(g.texts),
      direction,
      answered: g.answeredLeg,
      talking_seconds: g.talking,
    });
  }

  return { calls, internalCount };
}
