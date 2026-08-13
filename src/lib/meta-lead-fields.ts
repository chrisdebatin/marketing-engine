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

/** Adresse/Ort aus dem Formular (city/ort/plz/street …), zu einer Zeile verbunden. */
export function leadAddress(fd: unknown): string | null {
  const keys = ["street", "strasse", "straße", "address", "adresse", "plz", "zip", "postal", "city", "stadt", "ort", "wohnort"];
  // "e-mail-adresse"/"phone" enthalten "adresse"/"ort"-Fragmente — vorher raus.
  const blocked = ["mail", "phone", "telefon", "name"];
  const parts = fields(fd)
    .filter((f) => {
      const n = f.name?.toLowerCase() ?? "";
      return !blocked.some((b) => n.includes(b)) && keys.some((k) => n.includes(k));
    })
    .map((f) => f.values?.[0]?.trim())
    .filter((v): v is string => !!v);
  return parts.length ? parts.join(", ") : null;
}

/** Zusatzfelder (z. B. Qualifikation) als "Label: Wert"-Liste — alles außer Name/Telefon/E-Mail. */
export function leadExtraFields(fd: unknown): string[] {
  const known = ["name", "phone", "telefon", "mail"];
  return fields(fd)
    .filter((f) => !known.some((k) => f.name?.toLowerCase().includes(k)))
    .map((f) => `${(f.name ?? "?").replace(/_/g, " ")}: ${f.values?.join(", ") ?? ""}`);
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
