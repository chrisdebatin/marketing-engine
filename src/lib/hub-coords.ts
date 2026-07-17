// Approximate coordinates (lat, lng) per hub, keyed by exact hub name.
// Hubs without a mappable location resolve to null (shown in a list, not the map).
export const HUB_COORDS: Record<string, [number, number] | null> = {
  Dorsten: [51.66, 6.964],
  Alverdissen: [51.983, 9.083],
  "Bad Oeynhausen": [52.203, 8.804],
  Rinteln: [52.187, 9.078],
  "Hessisch-Oldendorf": [52.174, 9.248],
  "Bad Nenndorf": [52.336, 9.379],
  Hameln: [52.104, 9.356],
  "Bad Pyrmont": [51.986, 9.253],
  "Tagespflege Dorsten": [51.66, 6.964],
  "Alltagshilfe Dorsten": [51.66, 6.964],
  "Alltagshilfe Duisburg": [51.435, 6.762],
  "Alltagshilfe Düsseldorf": [51.228, 6.773],
  "Alltagshilfe Neuenrade": [51.283, 7.783],
  "Alltagshilfe Iserlohn": [51.374, 7.697],
  Düsseldorf: [51.228, 6.773],
  Kerpen: [50.871, 6.696],
  Velbert: [51.338, 7.043],
  Gevelsberg: [51.318, 7.338],
  "Pflegeunion Intensiv": null,
  Duisburg: [51.435, 6.762],
  Iserlohn: [51.374, 7.697],
  Neuenrade: [51.283, 7.783],
  Attendorn: [51.126, 7.903],
  "Tagespflgege Duisburg": [51.435, 6.762],
};

export function hubCoords(name: string): [number, number] | null {
  return HUB_COORDS[name] ?? null;
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
