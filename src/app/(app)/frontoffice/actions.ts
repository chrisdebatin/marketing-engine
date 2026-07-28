"use server";

import { revalidatePath } from "next/cache";
import { requireSession } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { LEAD_BEREICHE, LEAD_QUELLEN } from "@/lib/leads";

type Result = { ok: true } | { ok: false; error: string };

function missingTableError(code?: string): Result | null {
  if (code === "PGRST205" || code === "42P01") {
    return {
      ok: false,
      error:
        "Die Tabelle lead_calls fehlt noch — bitte supabase/apply_all_pending.sql im Supabase SQL-Editor ausführen.",
    };
  }
  return null;
}

/** Frontoffice: einen Interessenten-Anruf (Lead) loggen. */
export async function createLeadCall(input: {
  quelle?: string;
  bereich?: string;
  quelle_detail?: string;
  hub_id?: string;
  call_date?: string;
  notiz?: string;
}): Promise<Result> {
  await requireSession();

  const quelle = (input.quelle ?? "").trim();
  if (!LEAD_QUELLEN.some((q) => q.key === quelle)) {
    return { ok: false, error: "Bitte Quelle auswählen." };
  }
  const bereich = (input.bereich ?? "").trim();
  if (!LEAD_BEREICHE.some((b) => b.key === bereich)) {
    return { ok: false, error: "Bitte Bereich auswählen (Alltagshilfe/Ambulant/Intensiv)." };
  }
  const date = (input.call_date ?? "").trim();

  const admin = createAdminClient();
  const quelleDetail = (input.quelle_detail ?? "").trim().slice(0, 200) || null;
  let { error } = await admin.from("lead_calls").insert({
    quelle,
    bereich,
    quelle_detail: quelleDetail,
    hub_id: (input.hub_id ?? "").trim() || null,
    call_date: /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : undefined,
    notiz: (input.notiz ?? "").trim().slice(0, 500) || null,
  });
  // Spalte bereich fehlt bis 0035 — dann ohne sie speichern.
  if (error && (error.code === "PGRST204" || error.code === "42703")) {
    ({ error } = await admin.from("lead_calls").insert({
      quelle,
      hub_id: (input.hub_id ?? "").trim() || null,
      call_date: /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : undefined,
      notiz: (input.notiz ?? "").trim().slice(0, 500) || null,
    }));
  }
  if (error) {
    return (
      missingTableError(error.code) ?? {
        ok: false,
        error: "Speichern fehlgeschlagen.",
      }
    );
  }
  revalidatePath("/frontoffice");
  revalidatePath("/f/[token]", "page");
  return { ok: true };
}

/** Lead-Eintrag löschen (Vertipper). */
export async function deleteLeadCall(id: string): Promise<Result> {
  await requireSession();
  const cleanId = (id ?? "").trim();
  if (!cleanId) return { ok: false, error: "Eintrag fehlt." };

  const admin = createAdminClient();
  const { error } = await admin.from("lead_calls").delete().eq("id", cleanId);
  if (error) return { ok: false, error: "Löschen fehlgeschlagen." };
  revalidatePath("/frontoffice");
  return { ok: true };
}
