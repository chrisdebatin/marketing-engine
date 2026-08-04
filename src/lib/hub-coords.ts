// Approximate coordinates (lat, lng) per city. Hub names resolve over this
// list, after stripping the service prefix ("Alltagshilfe X" → "X") — a new
// hub in a bekannter Stadt landet damit automatisch auf der Karte.
const CITY_COORDS: Record<string, [number, number]> = {
  Dorsten: [51.66, 6.964],
  Alverdissen: [51.983, 9.083],
  "Bad Oeynhausen": [52.203, 8.804],
  Rinteln: [52.187, 9.078],
  "Hessisch-Oldendorf": [52.174, 9.248],
  "Bad Nenndorf": [52.336, 9.379],
  Hameln: [52.104, 9.356],
  "Bad Pyrmont": [51.986, 9.253],
  Düsseldorf: [51.228, 6.773],
  Kerpen: [50.871, 6.696],
  Velbert: [51.338, 7.043],
  Gevelsberg: [51.318, 7.338],
  Duisburg: [51.435, 6.762],
  Iserlohn: [51.374, 7.697],
  Neuenrade: [51.283, 7.783],
  Attendorn: [51.126, 7.903],
  Lüdenscheid: [51.22, 7.628],
};

// Exakte Hub-Namen, die nicht über den Stadt-Namen auflösbar sind.
// null = bewusst nicht kartierbar (erscheint in der Liste, nicht auf der Karte).
export const HUB_COORDS: Record<string, [number, number] | null> = {
  "Pflegeunion Intensiv": null,
};

// Bundesland je Stadt — alles andere in CITY_COORDS liegt in NRW.
// (Alverdissen/Barntrup und Bad Oeynhausen gehören zu NRW.)
const NIEDERSACHSEN = new Set([
  "Rinteln",
  "Hessisch-Oldendorf",
  "Bad Nenndorf",
  "Hameln",
  "Bad Pyrmont",
]);

/** "NRW" | "Niedersachsen" — null, wenn die Stadt unbekannt ist. */
export function hubBundesland(name: string): "NRW" | "Niedersachsen" | null {
  if (hubCoords(name) == null) return null;
  const city = name
    .replace(/^(Alltagshilfe|Tagespflege|Tagespflgege|Intensivpflege|Pflegeunion)\s+/i, "")
    .trim();
  const key = CITY_COORDS[name] ? name : city;
  return NIEDERSACHSEN.has(key) ? "Niedersachsen" : "NRW";
}

export function hubCoords(name: string): [number, number] | null {
  if (name in HUB_COORDS) return HUB_COORDS[name];
  if (CITY_COORDS[name]) return CITY_COORDS[name];
  // "Alltagshilfe Duisburg", "Tagespflege Dorsten", "Tagespflgege Duisburg" …
  const city = name
    .replace(/^(Alltagshilfe|Tagespflege|Tagespflgege|Intensivpflege|Pflegeunion)\s+/i, "")
    .trim();
  return CITY_COORDS[city] ?? null;
}

// Deterministic colors per responsible MD.
const PALETTE = [
  "#4f46e5", // indigo
  "#059669", // emerald
  "#dc2626", // red
  "#d97706", // amber
  "#0891b2", // cyan
  "#7c3aed", // violet
  "#db2777", // pink
  "#65a30d", // lime
];

export function mdColor(md: string | null): string {
  if (!md) return "#6b7280"; // gray
  let hash = 0;
  for (let i = 0; i < md.length; i++) hash = (hash * 31 + md.charCodeAt(i)) >>> 0;
  return PALETTE[hash % PALETTE.length];
}

/** Short MD tag = first name (Ben, Sebastian, Melanie, Heiko, Marcel …). */
export function mdShort(md: string | null): string {
  if (!md) return "";
  return md.trim().split(/\s+/)[0];
}
