"use server";

import { revalidatePath } from "next/cache";
import { requireSession } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";

type Result = { ok: true } | { ok: false; error: string };

function revalidate() {
  revalidatePath("/meta-ads");
  revalidatePath("/hubs/[id]", "page");
}

function missingTableError(code?: string): Result | null {
  if (code === "PGRST205" || code === "42P01") {
    return {
      ok: false,
      error:
        "Die Tabelle meta_ads fehlt noch — bitte supabase/apply_all_pending.sql im Supabase SQL-Editor ausführen.",
    };
  }
  return null;
}

/** Meta-Kampagne anlegen (allgemein oder lokal je Hub). */
export async function createMetaAd(input: {
  name?: string;
  typ?: string;
  hub_id?: string;
  start_date?: string;
  end_date?: string;
  budget?: string;
  ziel?: string;
  link?: string;
  notiz?: string;
}): Promise<Result> {
  const session = await requireSession();
  if (!session.isAdmin) return { ok: false, error: "Nur für Admins." };

  const name = (input.name ?? "").trim();
  if (!name) return { ok: false, error: "Kampagnen-Name eingeben." };
  const typ = input.typ === "lokal" ? "lokal" : "allgemein";
  const hubId = (input.hub_id ?? "").trim();
  if (typ === "lokal" && !hubId) {
    return { ok: false, error: "Bei lokalen Kampagnen den Standort wählen." };
  }
  const isDate = (v: string) => /^\d{4}-\d{2}-\d{2}$/.test(v);
  const start = (input.start_date ?? "").trim();
  const end = (input.end_date ?? "").trim();

  const admin = createAdminClient();
  const { error } = await admin.from("meta_ads").insert({
    name: name.slice(0, 200),
    typ,
    hub_id: typ === "lokal" ? hubId : null,
    start_date: isDate(start) ? start : undefined,
    end_date: isDate(end) ? end : null,
    budget: (input.budget ?? "").trim().slice(0, 100) || null,
    ziel: (input.ziel ?? "").trim().slice(0, 200) || null,
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

/** Kampagne beenden (end_date = heute). */
export async function endMetaAd(id: string): Promise<Result> {
  const session = await requireSession();
  if (!session.isAdmin) return { ok: false, error: "Nur für Admins." };
  const cleanId = (id ?? "").trim();
  if (!cleanId) return { ok: false, error: "Kampagne fehlt." };

  const admin = createAdminClient();
  const { error } = await admin
    .from("meta_ads")
    .update({ end_date: new Date().toISOString().slice(0, 10) })
    .eq("id", cleanId);
  if (error) return { ok: false, error: "Speichern fehlgeschlagen." };
  revalidate();
  return { ok: true };
}

/** Kampagne löschen. */
export async function deleteMetaAd(id: string): Promise<Result> {
  const session = await requireSession();
  if (!session.isAdmin) return { ok: false, error: "Nur für Admins." };
  const cleanId = (id ?? "").trim();
  if (!cleanId) return { ok: false, error: "Kampagne fehlt." };

  const admin = createAdminClient();
  const { error } = await admin.from("meta_ads").delete().eq("id", cleanId);
  if (error) return { ok: false, error: "Löschen fehlgeschlagen." };
  revalidate();
  return { ok: true };
}
