import { createAdminClient } from "@/lib/supabase/admin";

/**
 * App-Einstellungen (Key-Value in app_settings, RLS disabled →
 * Service-Role-only). Fehlt die Tabelle noch (Migration 0031), gelten
 * die Defaults.
 */

/** Follow-up-Rhythmus in Wochen je Kontakt-Art. */
export interface FollowupWeeks {
  box: number;
  flyer: number;
  besuch: number;
  anruf: number;
}

export const FOLLOWUP_DEFAULTS: FollowupWeeks = {
  box: 8,
  flyer: 8,
  besuch: 4,
  anruf: 4,
};

const FOLLOWUP_KEY = "followup_weeks";

function clampWeeks(v: unknown, fallback: number): number {
  const n = Math.trunc(Number(v));
  return Number.isFinite(n) && n >= 1 && n <= 52 ? n : fallback;
}

export async function getFollowupWeeks(): Promise<FollowupWeeks> {
  try {
    const admin = createAdminClient();
    const { data } = await admin
      .from("app_settings")
      .select("value")
      .eq("key", FOLLOWUP_KEY)
      .maybeSingle();
    const v = (data?.value ?? {}) as Partial<Record<keyof FollowupWeeks, unknown>>;
    return {
      box: clampWeeks(v.box, FOLLOWUP_DEFAULTS.box),
      flyer: clampWeeks(v.flyer, FOLLOWUP_DEFAULTS.flyer),
      besuch: clampWeeks(v.besuch, FOLLOWUP_DEFAULTS.besuch),
      anruf: clampWeeks(v.anruf, FOLLOWUP_DEFAULTS.anruf),
    };
  } catch {
    return { ...FOLLOWUP_DEFAULTS };
  }
}

export async function saveFollowupWeeks(
  input: Partial<FollowupWeeks>,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const value: FollowupWeeks = {
    box: clampWeeks(input.box, FOLLOWUP_DEFAULTS.box),
    flyer: clampWeeks(input.flyer, FOLLOWUP_DEFAULTS.flyer),
    besuch: clampWeeks(input.besuch, FOLLOWUP_DEFAULTS.besuch),
    anruf: clampWeeks(input.anruf, FOLLOWUP_DEFAULTS.anruf),
  };
  const admin = createAdminClient();
  const { error } = await admin.from("app_settings").upsert({
    key: FOLLOWUP_KEY,
    value,
    updated_at: new Date().toISOString(),
  });
  if (error) {
    if (error.code === "PGRST205" || error.code === "42P01") {
      return {
        ok: false,
        error:
          "Tabelle app_settings fehlt — bitte supabase/apply_all_pending.sql im SQL-Editor ausführen.",
      };
    }
    return { ok: false, error: "Speichern fehlgeschlagen." };
  }
  return { ok: true };
}
