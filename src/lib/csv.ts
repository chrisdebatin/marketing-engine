/**
 * Kleiner, quote-fähiger CSV-Parser für den Institutionen-Import
 * (Client-seitig; Excel-Exporte mit ; oder Tab funktionieren genauso).
 */

/** Trennzeichen raten: was in der ersten Zeile am häufigsten vorkommt. */
export function detectDelimiter(text: string): string {
  const firstLine = text.slice(0, text.indexOf("\n") + 1 || text.length);
  const candidates: [string, number][] = [";", ",", "\t"].map((d) => [
    d,
    firstLine.split(d).length - 1,
  ]);
  candidates.sort((a, b) => b[1] - a[1]);
  return candidates[0][1] > 0 ? candidates[0][0] : ";";
}

/** CSV in Zeilen/Zellen zerlegen; doppelte Anführungszeichen werden entwertet. */
export function parseCsv(text: string, delimiter?: string): string[][] {
  const delim = delimiter ?? detectDelimiter(text);
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let inQuotes = false;

  const pushCell = () => {
    row.push(cell.trim());
    cell = "";
  };
  const pushRow = () => {
    pushCell();
    if (row.some((c) => c !== "")) rows.push(row);
    row = [];
  };

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          cell += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        cell += ch;
      }
    } else if (ch === '"' && cell === "") {
      inQuotes = true;
    } else if (ch === delim) {
      pushCell();
    } else if (ch === "\n") {
      pushRow();
    } else if (ch !== "\r") {
      cell += ch;
    }
  }
  if (cell !== "" || row.length > 0) pushRow();
  return rows;
}
