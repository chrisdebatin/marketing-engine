import { randomUUID } from "crypto";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Gemeinsame Zugangs-Tokens für die Team-Links ohne Login — liegen in
 * app_settings und werden beim ersten Aufruf der internen Seite erzeugt:
 * - Frontoffice (/f/<token>): Inbound — nimmt Interessenten-Anrufe an.
 * - Call-Center (/c/<token>): Outbound — Institutionen anrufen + Recare.
 */

async function getTeamToken(key: string): Promise<string | null> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("app_settings")
    .select("value")
    .eq("key", key)
    .maybeSingle();
  if (error) return null; // Tabelle fehlt (0031) — Link gibt es dann noch nicht.

  const current = typeof data?.value === "string" ? data.value.trim() : "";
  if (current.length >= 16) return current;

  const token = randomUUID().replace(/-/g, "");
  const { error: upErr } = await admin.from("app_settings").upsert({
    key,
    value: token,
    updated_at: new Date().toISOString(),
  });
  return upErr ? null : token;
}

async function isTeamToken(key: string, token: string): Promise<boolean> {
  const clean = (token ?? "").trim();
  if (clean.length < 16) return false;
  const admin = createAdminClient();
  const { data } = await admin
    .from("app_settings")
    .select("value")
    .eq("key", key)
    .maybeSingle();
  return typeof data?.value === "string" && data.value === clean;
}

export async function getFrontofficeToken(): Promise<string | null> {
  return getTeamToken("frontoffice_token");
}

export async function isFrontofficeToken(token: string): Promise<boolean> {
  return isTeamToken("frontoffice_token", token);
}

export async function getCallcenterToken(): Promise<string | null> {
  return getTeamToken("callcenter_token");
}

export async function isCallcenterToken(token: string): Promise<boolean> {
  return isTeamToken("callcenter_token", token);
}
