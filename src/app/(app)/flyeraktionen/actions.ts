"use server";

import { revalidatePath } from "next/cache";
import { requireSession } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";

type Result = { ok: true } | { ok: false; error: string };

function revalidate() {
  revalidatePath("/flyeraktionen");
}

/** Eingaben prüfen und normalisieren (PLZ: mehrere, Komma-getrennt). */
function parseInput(input: {
  action_date?: string;
  anzahl?: number | string;
  plz?: string;
  inhalt?: string;
  note?: string;
}):
  | { ok: true; row: { action_date: string; anzahl: number; plz: string; inhalt: string; note: string | null } }
  | { ok: false; error: string } {
  const date = (input.action_date ?? "").trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return { ok: false, error: "Datum angeben." };
  }
  const anzahl = Math.trunc(Number(input.anzahl));
  if (!Number.isFinite(anzahl) || anzahl < 1 || anzahl > 1000000) {
    return { ok: false, error: "Anzahl zwischen 1 und 1.000.000 angeben." };
  }
  const plzList = (input.plz ?? "")
    .split(/[,;\s]+/)
    .map((s) => s.trim())
    .filter(Boolean);
  if (plzList.length === 0) {
    return { ok: false, error: "Mindestens eine PLZ angeben." };
  }
  if (plzList.some((p) => !/^\d{4,5}$/.test(p))) {
    return { ok: false, error: "PLZ bitte als 4–5-stellige Zahlen angeben." };
  }
  const inhalt = (input.inhalt ?? "").trim();
  if (!inhalt) return { ok: false, error: "Inhalt/Motiv angeben." };
  if (inhalt.length > 1000) {
    return { ok: false, error: "Inhalt zu lang (max. 1000 Zeichen)." };
  }
  const note = (input.note ?? "").trim();
  if (note.length > 1000) {
    return { ok: false, error: "Notiz zu lang (max. 1000 Zeichen)." };
  }
  return {
    ok: true,
    row: {
      action_date: date,
      anzahl,
      plz: plzList.join(", "),
      inhalt,
      note: note || null,
    },
  };
}

/** `flyer_actions` fehlt bis Migration 0019 — dann klare Meldung statt 500. */
function missingTableError(code?: string): Result | null {
  if (code === "PGRST205" || code === "42P01") {
    return {
      ok: false,
      error:
        "Die Tabelle flyer_actions fehlt noch — bitte supabase/apply_all_pending.sql im Supabase SQL-Editor ausführen.",
    };
  }
  return null;
}

export async function createFlyerAction(input: {
  action_date?: string;
  anzahl?: number | string;
  plz?: string;
  inhalt?: string;
  note?: string;
}): Promise<Result> {
  await requireSession();
  const parsed = parseInput(input);
  if (!parsed.ok) return parsed;

  const admin = createAdminClient();
  const { error } = await admin.from("flyer_actions").insert(parsed.row);
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

export async function updateFlyerAction(
  id: string,
  input: {
    action_date?: string;
    anzahl?: number | string;
    plz?: string;
    inhalt?: string;
    note?: string;
  },
): Promise<Result> {
  await requireSession();
  const cleanId = (id ?? "").trim();
  if (!cleanId) return { ok: false, error: "Aktion fehlt." };
  const parsed = parseInput(input);
  if (!parsed.ok) return parsed;

  const admin = createAdminClient();
  const { error } = await admin
    .from("flyer_actions")
    .update(parsed.row)
    .eq("id", cleanId);
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

export async function deleteFlyerAction(id: string): Promise<Result> {
  await requireSession();
  const cleanId = (id ?? "").trim();
  if (!cleanId) return { ok: false, error: "Aktion fehlt." };

  const admin = createAdminClient();
  const { error } = await admin
    .from("flyer_actions")
    .delete()
    .eq("id", cleanId);
  if (error) return { ok: false, error: "Löschen fehlgeschlagen." };
  revalidate();
  return { ok: true };
}
