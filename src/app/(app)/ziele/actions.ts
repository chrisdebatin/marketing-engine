"use server";

import { revalidatePath } from "next/cache";
import { requireSession } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { isPlaceKind } from "@/lib/places";

type Result = { ok: true } | { ok: false; error: string };

function revalidate() {
  revalidatePath("/ziele");
  revalidatePath("/hubs/[id]", "page");
}

/** `crm_targets` fehlt bis Migration 0026 — dann klare Meldung statt 500. */
function missingTableError(code?: string): Result | null {
  if (code === "PGRST205" || code === "42P01") {
    return {
      ok: false,
      error:
        "Die Tabelle crm_targets fehlt noch — bitte supabase/apply_all_pending.sql im Supabase SQL-Editor ausführen.",
    };
  }
  return null;
}

const PLAN_KEYS = ["box", "flyer", "besuch", "anruf"] as const;

function cleanTarget(input: {
  name?: string;
  kategorie?: string;
  adresse?: string;
  ort?: string;
  note?: string;
  plan?: string;
  intervall_wochen?: number | string;
}):
  | {
      ok: true;
      row: {
        name: string;
        kategorie: string | null;
        adresse: string | null;
        ort: string | null;
        note: string | null;
        plan: string | null;
        intervall_wochen: number;
      };
    }
  | { ok: false; error: string } {
  const name = (input.name ?? "").trim();
  if (!name) return { ok: false, error: "Name des Ziel-Ortes angeben." };
  if (name.length > 200) {
    return { ok: false, error: "Name zu lang (max. 200 Zeichen)." };
  }
  const intervall = Math.trunc(Number(input.intervall_wochen ?? 3)) || 3;
  if (intervall < 1 || intervall > 52) {
    return { ok: false, error: "Intervall zwischen 1 und 52 Wochen." };
  }
  const kategorie = (input.kategorie ?? "").trim();
  return {
    ok: true,
    row: {
      name,
      kategorie: kategorie && isPlaceKind(kategorie) ? kategorie : null,
      adresse: (input.adresse ?? "").trim().slice(0, 200) || null,
      ort: (input.ort ?? "").trim().slice(0, 120) || null,
      note: (input.note ?? "").trim().slice(0, 1000) || null,
      plan: PLAN_KEYS.includes((input.plan ?? "").trim() as (typeof PLAN_KEYS)[number])
        ? (input.plan ?? "").trim()
        : null,
      intervall_wochen: intervall,
    },
  };
}

/** Spalte plan fehlt bis Migration 0029 — dann ohne sie erneut versuchen. */
function isMissingColumn(code?: string): boolean {
  return code === "PGRST204" || code === "42703";
}

export async function createCrmTarget(input: {
  hub_id?: string;
  name?: string;
  kategorie?: string;
  adresse?: string;
  ort?: string;
  note?: string;
  plan?: string;
  intervall_wochen?: number | string;
}): Promise<Result> {
  await requireSession();
  const parsed = cleanTarget(input);
  if (!parsed.ok) return parsed;

  const admin = createAdminClient();
  const row = { ...parsed.row, hub_id: (input.hub_id ?? "").trim() || null };
  let { error } = await admin.from("crm_targets").insert(row);
  if (error && isMissingColumn(error.code)) {
    ({ error } = await admin
      .from("crm_targets")
      .insert({ ...row, plan: undefined }));
  }
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

/**
 * Bulk-Import: eine Zeile pro Ziel-Ort im Format
 * "Name; Adresse; Ort" (Adresse/Ort optional; auch Tab als Trenner).
 */
export async function importCrmTargets(input: {
  hub_id?: string;
  text: string;
  intervall_wochen?: number | string;
}): Promise<Result & { created?: number }> {
  await requireSession();
  const hubId = (input.hub_id ?? "").trim() || null;
  const intervall = Math.trunc(Number(input.intervall_wochen ?? 3)) || 3;

  const rows: {
    hub_id: string | null;
    name: string;
    adresse: string | null;
    ort: string | null;
    intervall_wochen: number;
  }[] = [];
  for (const raw of (input.text ?? "").split(/\r?\n/)) {
    const line = raw.trim();
    if (!line) continue;
    const parts = line.split(/;|\t/).map((s) => s.trim());
    const name = parts[0];
    if (!name) continue;
    rows.push({
      hub_id: hubId,
      name: name.slice(0, 200),
      adresse: (parts[1] ?? "").slice(0, 200) || null,
      ort: (parts[2] ?? "").slice(0, 120) || null,
      intervall_wochen: Math.min(Math.max(intervall, 1), 52),
    });
  }
  if (rows.length === 0) {
    return { ok: false, error: "Keine Zeilen erkannt." };
  }
  if (rows.length > 500) {
    return { ok: false, error: "Zu viele Zeilen (max. 500 pro Import)." };
  }

  const admin = createAdminClient();
  const { error } = await admin.from("crm_targets").insert(rows);
  if (error) {
    return (
      missingTableError(error.code) ?? {
        ok: false,
        error: "Import fehlgeschlagen.",
      }
    );
  }
  revalidate();
  return { ok: true, created: rows.length };
}

export async function updateCrmTarget(
  id: string,
  input: {
    hub_id?: string;
    name?: string;
    kategorie?: string;
    adresse?: string;
    ort?: string;
    note?: string;
    plan?: string;
    intervall_wochen?: number | string;
  },
): Promise<Result> {
  await requireSession();
  const cleanId = (id ?? "").trim();
  if (!cleanId) return { ok: false, error: "Ziel-Ort fehlt." };
  const parsed = cleanTarget(input);
  if (!parsed.ok) return parsed;

  const admin = createAdminClient();
  const row = { ...parsed.row, hub_id: (input.hub_id ?? "").trim() || null };
  let { error } = await admin.from("crm_targets").update(row).eq("id", cleanId);
  if (error && isMissingColumn(error.code)) {
    ({ error } = await admin
      .from("crm_targets")
      .update({ ...row, plan: undefined })
      .eq("id", cleanId));
  }
  if (error) return { ok: false, error: "Speichern fehlgeschlagen." };
  revalidate();
  return { ok: true };
}

export async function deleteCrmTarget(id: string): Promise<Result> {
  await requireSession();
  const cleanId = (id ?? "").trim();
  if (!cleanId) return { ok: false, error: "Ziel-Ort fehlt." };

  const admin = createAdminClient();
  const { error } = await admin
    .from("crm_targets")
    .delete()
    .eq("id", cleanId);
  if (error) return { ok: false, error: "Löschen fehlgeschlagen." };
  revalidate();
  return { ok: true };
}
