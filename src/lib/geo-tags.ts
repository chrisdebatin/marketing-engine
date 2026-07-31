import { hubChip } from "@/lib/anfrage-tags";

/**
 * Geografische Tags für CRM-Ziel-Orte: beim Anlegen/Import automatisch aus
 * Ort bzw. Hub-Name abgeleitet, jederzeit manuell änderbar. Dient dem
 * Call-Center und der Ziel-Orte-Liste als Filter.
 */

/** Tag normalisieren: PLZ-Präfix weg, nur der erste Orts-Teil, gekürzt. */
export function normalizeGeoTag(raw: string | null | undefined): string | null {
  const s = (raw ?? "").trim();
  if (!s) return null;
  const cleaned = s
    .replace(/^\d{4,5}\s+/, "")
    .split(/[,/]/)[0]
    .trim();
  return cleaned ? cleaned.slice(0, 60) : null;
}

/** Geo-Tag ableiten: bevorzugt aus dem Ort, sonst aus dem Hub-Namen. */
export function deriveGeoTag(input: {
  ort?: string | null;
  hubName?: string | null;
}): string | null {
  const fromOrt = normalizeGeoTag(input.ort);
  if (fromOrt) return fromOrt;
  const hub = (input.hubName ?? "").trim();
  if (!hub) return null;
  const city = hub
    .replace(/^(Alltagshilfe|Tagespflege|Tagespflgege)\s+/i, "")
    .trim();
  // "Pflegeunion Intensiv" & Co. enthalten keinen Ort — dann lieber kein Tag.
  if (!city || /intensiv|pflegeunion/i.test(city)) return null;
  return city.slice(0, 60);
}

/** Stabile Chip-Farbe je Tag (gleicher Hash wie die Standort-Chips). */
export function geoChip(tag: string): string {
  return hubChip(tag.toLowerCase());
}

/** Vorkommende Tags samt Häufigkeit, absteigend sortiert (für Filter-Chips). */
export function collectGeoTags(
  rows: { geo_tag?: string | null }[],
): { tag: string; count: number }[] {
  const counts = new Map<string, number>();
  for (const r of rows) {
    const tag = (r.geo_tag ?? "").trim();
    if (!tag) continue;
    counts.set(tag, (counts.get(tag) ?? 0) + 1);
  }
  return [...counts.entries()]
    .map(([tag, count]) => ({ tag, count }))
    .sort((a, b) => b.count - a.count || a.tag.localeCompare(b.tag, "de"));
}
