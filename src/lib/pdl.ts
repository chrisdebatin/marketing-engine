/**
 * Mehrere PDLs/Standortleitungen pro Hub — ohne DB-Änderung: Die bestehenden
 * Textfelder (pdl_name, pdl_email, pdl_phone) dürfen mehrere Werte enthalten,
 * mit Komma/Semikolon/"&" getrennt. Diese Helfer zerlegen sie für die Anzeige.
 */

/** "Anna Müller & Petra Schmidt" | "Anna, Petra" → ["Anna Müller", "Petra Schmidt"]. */
export function splitPdlNames(value: string | null): string[] {
  if (!value) return [];
  return value
    .split(/[,;&/+]|\bund\b/gi)
    .map((s) => s.trim())
    .filter(Boolean);
}

/** "a@x.de, b@y.de" → ["a@x.de", "b@y.de"]. */
export function splitPdlEmails(value: string | null): string[] {
  if (!value) return [];
  return value
    .split(/[,;\s]+/)
    .map((s) => s.trim())
    .filter((s) => s.includes("@"));
}

/** "0171 123, 0172 456" → ["0171 123", "0172 456"] (Komma/Semikolon/Slash). */
export function splitPdlPhones(value: string | null): string[] {
  if (!value) return [];
  return value
    .split(/[,;/]+/)
    .map((s) => s.trim())
    .filter(Boolean);
}
