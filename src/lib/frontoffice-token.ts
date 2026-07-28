import { randomUUID } from "crypto";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Ein gemeinsamer Zugangs-Token für den Callcenter-Link (/f/<token>) —
 * liegt in app_settings und wird beim ersten Aufruf der internen
 * Frontoffice-Seite erzeugt.
 */

const KEY = "frontoffice_token";

export async function getFrontofficeToken(): Promise<string | null> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("app_settings")
    .select("value")
    .eq("key", KEY)
    .maybeSingle();
  if (error) return null; // Tabelle fehlt (0031) — Link gibt es dann noch nicht.

  const current =
    typeof data?.value === "string" ? data.value.trim() : "";
  if (current.length >= 16) return current;

  const token = randomUUID().replace(/-/g, "");
  const { error: upErr } = await admin.from("app_settings").upsert({
    key: KEY,
    value: token,
    updated_at: new Date().toISOString(),
  });
  return upErr ? null : token;
}

/** Prüft den Callcenter-Token. */
export async function isFrontofficeToken(token: string): Promise<boolean> {
  const clean = (token ?? "").trim();
  if (clean.length < 16) return false;
  const admin = createAdminClient();
  const { data } = await admin
    .from("app_settings")
    .select("value")
    .eq("key", KEY)
    .maybeSingle();
  return typeof data?.value === "string" && data.value === clean;
}
