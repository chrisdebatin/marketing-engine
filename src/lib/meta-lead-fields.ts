/** Gemeinsame Feld-Extraktion aus meta_leads.field_data (Instant-Formulare). */

interface Field {
  name?: string;
  values?: string[];
}

function fields(fd: unknown): Field[] {
  return Array.isArray(fd) ? (fd as Field[]) : [];
}

export function leadEmail(fd: unknown): string | null {
  const f = fields(fd).find((x) => x.name?.toLowerCase().includes("mail"));
  return f?.values?.[0]?.trim() ?? null;
}

export function leadPhone(fd: unknown): string | null {
  const f = fields(fd).find(
    (x) => x.name?.toLowerCase().includes("phone") || x.name?.toLowerCase().includes("telefon"),
  );
  return f?.values?.[0]?.trim() ?? null;
}

function capitalize(s: string): string {
  return s.replace(/(^|[\s-])(\p{L})/gu, (m, sep: string, ch: string) => sep + ch.toUpperCase());
}

export function leadFirstName(fd: unknown): string | null {
  const list = fields(fd);
  const f =
    list.find((x) => ["first_name", "vorname"].includes(x.name?.toLowerCase() ?? "")) ??
    list.find((x) => x.name?.toLowerCase().includes("name"));
  return f?.values?.[0] ?? null;
}

/** Vollständiger Name (full_name, sonst Vorname + Nachname, sonst Namensfeld). */
export function leadFullName(fd: unknown): string | null {
  const list = fields(fd);
  const exact = (n: string) => list.find((x) => x.name?.toLowerCase() === n)?.values?.[0];
  const full = exact("full_name") ?? exact("voller_name");
  if (full) return capitalize(full);
  const first = exact("first_name") ?? exact("vorname");
  const last = exact("last_name") ?? exact("nachname");
  if (first || last) return capitalize([first, last].filter(Boolean).join(" "));
  const any = list.find((x) => x.name?.toLowerCase().includes("name"))?.values?.[0];
  return any ? capitalize(any) : null;
}

/**
 * Ort aus dem Kampagnennamen ("Mitarbeiter-Lüdenscheid-Fachkraft-2026-08" →
 * "Lüdenscheid"). Konvention: zweites Segment, sofern nicht numerisch.
 */
export function cityFromCampaign(campaignName: string | null): string | null {
  if (!campaignName) return null;
  const part = campaignName.split("-")[1]?.trim();
  if (!part || /^\d/.test(part)) return null;
  return part;
}
