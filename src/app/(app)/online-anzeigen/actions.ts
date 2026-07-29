"use server";

import { revalidatePath } from "next/cache";
import { requireSession } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";

const KEYS = {
  laeuft: "online_ads_freitext",
  soll: "online_ads_soll",
} as const;

export type FreitextKey = keyof typeof KEYS;

/** Freitext speichern: "Was läuft gerade?" bzw. "Was soll laufen?". */
export async function saveOnlineAdsFreitext(
  key: FreitextKey,
  text: string,
): Promise<{ ok: boolean; error?: string; updatedAt?: string }> {
  const session = await requireSession();
  if (!session.isAdmin) return { ok: false, error: "Nur für Admins." };
  if (!(key in KEYS)) return { ok: false, error: "Unbekanntes Feld." };

  const updatedAt = new Date().toISOString();
  const admin = createAdminClient();
  const { error } = await admin.from("app_settings").upsert({
    key: KEYS[key],
    value: { text: (text ?? "").slice(0, 5000), updated_at: updatedAt },
    updated_at: updatedAt,
  });
  if (error) {
    if (error.code === "PGRST205" || error.code === "42P01") {
      return {
        ok: false,
        error:
          "Tabelle app_settings fehlt — bitte supabase/apply_all_pending.sql ausführen.",
      };
    }
    return { ok: false, error: "Speichern fehlgeschlagen." };
  }
  revalidatePath("/online-anzeigen");
  return { ok: true, updatedAt };
}

/** Freitext laden. */
export async function loadOnlineAdsFreitext(
  key: FreitextKey,
): Promise<{ text: string; updatedAt: string | null }> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("app_settings")
    .select("value")
    .eq("key", KEYS[key])
    .maybeSingle();
  const v = (data?.value ?? {}) as { text?: string; updated_at?: string };
  return { text: v.text ?? "", updatedAt: v.updated_at ?? null };
}
