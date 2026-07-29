"use server";

import { revalidatePath } from "next/cache";
import { requireSession } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";

type Result = { ok: true } | { ok: false; error: string };

function revalidate() {
  revalidatePath("/personal-anzeigen");
  revalidatePath("/hubs");
  revalidatePath("/hubs/[id]", "page");
}

function missingTableError(code?: string): Result | null {
  if (code === "PGRST205" || code === "42P01") {
    return {
      ok: false,
      error:
        "Die Tabelle personal_ads fehlt noch — bitte supabase/apply_all_pending.sql im Supabase SQL-Editor ausführen.",
    };
  }
  return null;
}

/** Personal-Anzeige anlegen (je Hub oder für alle Standorte). */
export async function createPersonalAd(input: {
  titel?: string;
  plattform?: string;
  hub_id?: string;
  start_date?: string;
  end_date?: string;
  link?: string;
  notiz?: string;
}): Promise<Result> {
  const session = await requireSession();
  if (!session.isAdmin) return { ok: false, error: "Nur für Admins." };

  const titel = (input.titel ?? "").trim();
  if (!titel) return { ok: false, error: "Stellentitel eingeben." };
  const plattform = (input.plattform ?? "").trim().slice(0, 100);
  if (!plattform) return { ok: false, error: "Plattform wählen oder eintragen." };
  const isDate = (v: string) => /^\d{4}-\d{2}-\d{2}$/.test(v);
  const start = (input.start_date ?? "").trim();
  const end = (input.end_date ?? "").trim();

  const admin = createAdminClient();
  const { error } = await admin.from("personal_ads").insert({
    titel: titel.slice(0, 200),
    plattform,
    hub_id: (input.hub_id ?? "").trim() || null,
    start_date: isDate(start) ? start : undefined,
    end_date: isDate(end) ? end : null,
    link: (input.link ?? "").trim().slice(0, 500) || null,
    notiz: (input.notiz ?? "").trim().slice(0, 1000) || null,
  });
  if (error) {
    return (
      missingTableError(error.code) ?? {
        ok: false,
        error: "Speichern fehlgeschlagen.",
      }
    );
  }
  revalidate();
  return { ok: true };
}

/** Anzeige beenden (end_date = heute). */
export async function endPersonalAd(id: string): Promise<Result> {
  const session = await requireSession();
  if (!session.isAdmin) return { ok: false, error: "Nur für Admins." };
  const cleanId = (id ?? "").trim();
  if (!cleanId) return { ok: false, error: "Anzeige fehlt." };

  const admin = createAdminClient();
  const { error } = await admin
    .from("personal_ads")
    .update({ end_date: new Date().toISOString().slice(0, 10) })
    .eq("id", cleanId);
  if (error) return { ok: false, error: "Speichern fehlgeschlagen." };
  revalidate();
  return { ok: true };
}

/** Anzeige löschen. */
export async function deletePersonalAd(id: string): Promise<Result> {
  const session = await requireSession();
  if (!session.isAdmin) return { ok: false, error: "Nur für Admins." };
  const cleanId = (id ?? "").trim();
  if (!cleanId) return { ok: false, error: "Anzeige fehlt." };

  const admin = createAdminClient();
  const { error } = await admin.from("personal_ads").delete().eq("id", cleanId);
  if (error) return { ok: false, error: "Löschen fehlgeschlagen." };
  revalidate();
  return { ok: true };
}
