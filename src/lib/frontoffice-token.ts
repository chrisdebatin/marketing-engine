import { randomUUID } from "crypto";
import { createAdminClient } from "@/lib/supabase/admin";
import { LEAD_BEREICHE, type LeadBereich } from "@/lib/leads";

/**
 * Zugangs-Tokens für die Callcenter-Links (/f/<token>) — je Bereich einer.
 * Liegen in app_settings und werden beim ersten Aufruf der internen
 * Frontoffice-Seite erzeugt.
 */

const KEY = "frontoffice_tokens";

export async function getFrontofficeTokens(): Promise<Record<
  LeadBereich,
  string
> | null> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("app_settings")
    .select("value")
    .eq("key", KEY)
    .maybeSingle();
  if (error) return null; // Tabelle fehlt (0031) — Links gibt es dann noch nicht.

  const current = (data?.value ?? {}) as Partial<Record<LeadBereich, string>>;
  let changed = false;
  const tokens = {} as Record<LeadBereich, string>;
  for (const b of LEAD_BEREICHE) {
    const existing = (current[b.key] ?? "").trim();
    if (existing.length >= 16) {
      tokens[b.key] = existing;
    } else {
      tokens[b.key] = randomUUID().replace(/-/g, "");
      changed = true;
    }
  }
  if (changed) {
    const { error: upErr } = await admin.from("app_settings").upsert({
      key: KEY,
      value: tokens,
      updated_at: new Date().toISOString(),
    });
    if (upErr) return null;
  }
  return tokens;
}

/** Token → Bereich (oder null, wenn unbekannt). */
export async function resolveFrontofficeToken(
  token: string,
): Promise<LeadBereich | null> {
  const clean = (token ?? "").trim();
  if (clean.length < 16) return null;
  const admin = createAdminClient();
  const { data } = await admin
    .from("app_settings")
    .select("value")
    .eq("key", KEY)
    .maybeSingle();
  const tokens = (data?.value ?? {}) as Partial<Record<LeadBereich, string>>;
  for (const b of LEAD_BEREICHE) {
    if (tokens[b.key] === clean) return b.key;
  }
  return null;
}
