"use server";

import { revalidatePath } from "next/cache";
import { requireSession } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { parseCallReport } from "@/lib/call-import";

/**
 * CSV-Export der Telefonanlage einlesen. Dedupliziert über call_id —
 * dieselbe Datei (oder überlappende Zeiträume) mehrfach hochzuladen ist
 * unschädlich.
 */
export async function importCallReport(
  formData: FormData,
): Promise<{ ok: boolean; message: string }> {
  const session = await requireSession();
  if (!session.isAdmin) return { ok: false, message: "Nur für Admins." };

  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return { ok: false, message: "Bitte eine CSV-Datei auswählen." };
  }
  if (file.size > 20 * 1024 * 1024) {
    return { ok: false, message: "Datei zu groß (max. 20 MB)." };
  }

  const text = await file.text();
  const { calls, internalCount, error } = parseCallReport(text);
  if (error) return { ok: false, message: error };
  if (calls.length === 0) {
    return { ok: false, message: "Keine Anrufe in der Datei gefunden." };
  }

  const admin = createAdminClient();
  let inserted = 0;
  for (let i = 0; i < calls.length; i += 500) {
    const chunk = calls.slice(i, i + 500);
    const { data, error: insErr } = await admin
      .from("phone_calls")
      .upsert(chunk, { onConflict: "call_id", ignoreDuplicates: true })
      .select("call_id");
    if (insErr) {
      if (insErr.code === "PGRST205" || insErr.code === "42P01") {
        return {
          ok: false,
          message:
            "Tabelle phone_calls fehlt — bitte supabase/apply_all_pending.sql im SQL-Editor ausführen und erneut hochladen.",
        };
      }
      return { ok: false, message: "Import fehlgeschlagen: " + insErr.message };
    }
    inserted += (data ?? []).length;
  }

  const dup = calls.length - inserted;
  const times = calls.map((c) => c.call_time).sort();
  revalidatePath("/statistik");
  return {
    ok: true,
    message:
      `${inserted} Anrufe importiert` +
      (dup > 0 ? `, ${dup} waren schon vorhanden` : "") +
      (internalCount > 0 ? ` (${internalCount} interne übersprungen)` : "") +
      ` · Zeitraum ${times[0].slice(0, 10)} bis ${times[times.length - 1].slice(0, 10)}.`,
  };
}
