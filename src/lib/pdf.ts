/**
 * Minimaler PDF-Generator (SERVER ONLY) — erzeugt einspaltige Text-PDFs
 * ohne externe Abhängigkeit. Bewusst klein gehalten: Wir brauchen nur
 * Überschriften, Fließtext und Schlüssel-Wert-Zeilen für Bewerbungs-PDFs.
 *
 * Bewusste Grenzen: eine Seite pro Dokument (bei sehr vielen Zeilen wird
 * umbrochen und weitergeschrieben), Standard-Font Helvetica, keine Bilder.
 */

export interface PdfZeile {
  text: string;
  /** "h1" = Titel, "h2" = Zwischenüberschrift, "kv" = Label/Wert, sonst Text. */
  art?: "h1" | "h2" | "kv" | "text" | "klein";
  /** Nur bei art "kv": Wert rechts vom Label. */
  wert?: string;
}

/** WinAnsi-Escapes + Umlaute, die im Standard-Font darstellbar sind. */
function escapeText(s: string): string {
  return s
    .replace(/\\/g, "\\\\")
    .replace(/\(/g, "\\(")
    .replace(/\)/g, "\\)")
    // Zeichen außerhalb WinAnsi durch Näherung ersetzen
    .replace(/[–—]/g, "-")
    .replace(/[„“”]/g, '"')
    .replace(/[‘’]/g, "'")
    .replace(/ /g, " ");
}

/** Umlaute nach WinAnsi-Oktalcodes (sonst zeigt der Reader Kästchen). */
function toWinAnsi(s: string): string {
  const map: Record<string, string> = {
    "ä": "\\344", "ö": "\\366", "ü": "\\374",
    "Ä": "\\304", "Ö": "\\326", "Ü": "\\334",
    "ß": "\\337", "é": "\\351", "è": "\\350", "à": "\\340",
    "°": "\\260", "€": "\\200",
  };
  return s.replace(/[äöüÄÖÜßéèà°€]/g, (c) => map[c] ?? c);
}

/**
 * Helvetica-Zeichenbreiten (1/1000 em) für die gängigen Zeichen. Damit
 * wird die Textbreite tatsächlich berechnet statt geschätzt — sonst laufen
 * Zeilen über den Seitenrand.
 */
const BREITEN: Record<string, number> = {
  " ": 278, "!": 278, '"': 355, "#": 556, "$": 556, "%": 889, "&": 667,
  "'": 191, "(": 333, ")": 333, "*": 389, "+": 584, ",": 278, "-": 333,
  ".": 278, "/": 278, ":": 278, ";": 278, "<": 584, "=": 584, ">": 584,
  "?": 556, "@": 1015, "[": 278, "\\": 278, "]": 278, "_": 556, "·": 333,
  "a": 556, "b": 556, "c": 500, "d": 556, "e": 556, "f": 278, "g": 556,
  "h": 556, "i": 222, "j": 222, "k": 500, "l": 222, "m": 833, "n": 556,
  "o": 556, "p": 556, "q": 556, "r": 333, "s": 500, "t": 278, "u": 556,
  "v": 500, "w": 722, "x": 500, "y": 500, "z": 500,
  "A": 667, "B": 667, "C": 722, "D": 722, "E": 667, "F": 611, "G": 778,
  "H": 722, "I": 278, "J": 500, "K": 667, "L": 556, "M": 833, "N": 722,
  "O": 778, "P": 667, "Q": 778, "R": 722, "S": 667, "T": 611, "U": 722,
  "V": 667, "W": 944, "X": 667, "Y": 667, "Z": 611,
  "0": 556, "1": 556, "2": 556, "3": 556, "4": 556, "5": 556, "6": 556,
  "7": 556, "8": 556, "9": 556,
  "ä": 556, "ö": 556, "ü": 556, "Ä": 667, "Ö": 778, "Ü": 722, "ß": 556,
};

/**
 * Textbreite in pt für Helvetica. Unbekannte Zeichen werden mit der
 * breitesten gängigen Glyphe (833) angesetzt statt mit einem Mittelwert —
 * lieber zu früh umbrechen als über den Rand hinauslaufen.
 */
function textBreite(text: string, size: number): number {
  let summe = 0;
  for (const c of text) summe += BREITEN[c] ?? 833;
  return (summe / 1000) * size;
}

/** Zeilenumbruch anhand der tatsächlichen Textbreite. */
function umbrechen(text: string, maxBreite: number, size: number): string[] {
  const worte = text.split(/\s+/);
  const zeilen: string[] = [];
  let aktuell = "";
  for (const w of worte) {
    const test = aktuell ? aktuell + " " + w : w;
    if (!aktuell || textBreite(test, size) <= maxBreite) aktuell = test;
    else {
      zeilen.push(aktuell);
      aktuell = w;
    }
  }
  if (aktuell) zeilen.push(aktuell);
  return zeilen.length ? zeilen : [""];
}

/**
 * Baut ein PDF aus Zeilen und gibt es base64-kodiert zurück (direkt als
 * Mail-Anhang verwendbar).
 */
export function buildPdf(zeilen: PdfZeile[]): string {
  const SEITE_H = 842; // A4 in pt
  const LINKS = 56;
  const OBEN = 790;
  const UNTEN = 56;

  // Inhalts-Stream zusammensetzen
  const teile: string[] = [];
  let y = OBEN;
  const seitenStreams: string[] = [];

  const neueSeite = () => {
    seitenStreams.push(teile.join("\n"));
    teile.length = 0;
    y = OBEN;
  };

  for (const z of zeilen) {
    const art = z.art ?? "text";
    const size = art === "h1" ? 18 : art === "h2" ? 13 : art === "klein" ? 8.5 : 10.5;
    const font = art === "h1" || art === "h2" || art === "kv" ? "F2" : "F1";
    const abstand = art === "h1" ? 26 : art === "h2" ? 20 : 15;

    if (y - abstand < UNTEN) neueSeite();

    if (art === "kv") {
      // Label grau links, Wert fett daneben
      const label = toWinAnsi(escapeText(z.text));
      const wert = toWinAnsi(escapeText(z.wert ?? ""));
      teile.push(
        `BT /F1 ${size} Tf 0.42 0.45 0.5 rg ${LINKS} ${y} Td (${label}) Tj ET`,
      );
      teile.push(
        `BT /F2 ${size} Tf 0 0 0 rg ${LINKS + 130} ${y} Td (${wert}) Tj ET`,
      );
      y -= abstand;
      continue;
    }

    // Breite echt messen statt schätzen — sonst laufen lange Zeilen über
    // den rechten Rand hinaus (Helvetica-Zeichen sind unterschiedlich breit).
    // 8pt Sicherheitsabstand, damit auch Grenzfälle nicht anstoßen.
    const maxBreite = 595 - LINKS * 2 - 8;
    for (const teil of umbrechen(z.text, maxBreite, size)) {
      if (y - abstand < UNTEN) neueSeite();
      const grau = art === "klein" ? "0.45 0.48 0.52 rg" : "0 0 0 rg";
      teile.push(
        `BT /${font} ${size} Tf ${grau} ${LINKS} ${y} Td (${toWinAnsi(escapeText(teil))}) Tj ET`,
      );
      y -= abstand;
    }
    if (art === "h1") y -= 6;
  }
  seitenStreams.push(teile.join("\n"));

  // PDF-Objekte
  const objekte: string[] = [];
  const seitenAnzahl = seitenStreams.length;
  const kids = Array.from(
    { length: seitenAnzahl },
    (_, i) => `${4 + i * 2} 0 R`,
  ).join(" ");

  objekte.push(`<< /Type /Catalog /Pages 2 0 R >>`);
  objekte.push(
    `<< /Type /Pages /Kids [${kids}] /Count ${seitenAnzahl} >>`,
  );
  objekte.push(
    `<< /Font << /F1 ${3 + seitenAnzahl * 2} 0 R /F2 ${4 + seitenAnzahl * 2} 0 R >> >>`,
  );
  for (const stream of seitenStreams) {
    const idx = objekte.length + 2; // Inhalts-Objekt folgt direkt
    objekte.push(
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 ${SEITE_H}] /Resources 3 0 R /Contents ${idx} 0 R >>`,
    );
    objekte.push(
      `<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`,
    );
  }
  objekte.push(
    `<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>`,
  );
  objekte.push(
    `<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>`,
  );

  // Datei zusammensetzen inkl. xref
  let pdf = "%PDF-1.4\n";
  const offsets: number[] = [];
  objekte.forEach((o, i) => {
    offsets.push(pdf.length);
    pdf += `${i + 1} 0 obj\n${o}\nendobj\n`;
  });
  const xrefStart = pdf.length;
  pdf += `xref\n0 ${objekte.length + 1}\n0000000000 65535 f \n`;
  for (const off of offsets) {
    pdf += `${String(off).padStart(10, "0")} 00000 n \n`;
  }
  pdf += `trailer\n<< /Size ${objekte.length + 1} /Root 1 0 R >>\nstartxref\n${xrefStart}\n%%EOF`;

  return Buffer.from(pdf, "latin1").toString("base64");
}
