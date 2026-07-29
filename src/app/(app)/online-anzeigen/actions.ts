"use server";

import { revalidatePath } from "next/cache";
import { requireSession } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";

const KEY = "online_ads_freitext";

/** Freitext "Was läuft gerade?" speichern (app_settings). */
export async function saveOnlineAdsFreitext(
  text: string,
): Promise<{ ok: boolean; error?: string; updatedAt?: string }> {
  const session = await requireSession();
  if (!session.isAdmin) return { ok: false, error: "Nur für Admins." };

  const updatedAt = new Date().toISOString();
  const admin = createAdminClient();
  const { error } = await admin.from("app_settings").upsert({
    key: KEY,
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
export async function loadOnlineAdsFreitext(): Promise<{
  text: string;
  updatedAt: string | null;
}> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("app_settings")
    .select("value")
    .eq("key", KEY)
    .maybeSingle();
  const v = (data?.value ?? {}) as { text?: string; updated_at?: string };
  return { text: v.text ?? "", updatedAt: v.updated_at ?? null };
}
