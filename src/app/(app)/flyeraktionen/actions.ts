"use server";

import Anthropic from "@anthropic-ai/sdk";
import { revalidatePath } from "next/cache";
import { requireSession } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";

const MODEL = process.env.ANTHROPIC_MODEL || "claude-opus-4-8";

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

/**
 * Freitext-Erfassung: Claude zerlegt z. B. "Gestern 5000 Flyer in 40210 und
 * 40211 verteilt, Motiv Pflegeberatung" in die strukturierten Felder und
 * speichert direkt. Korrekturen danach über das Stift-Icon (strukturiert).
 */
export async function createFlyerActionFromText(
  text: string,
): Promise<
  | { ok: true; saved: { action_date: string; anzahl: number; plz: string; inhalt: string } }
  | { ok: false; error: string }
> {
  await requireSession();
  if (!process.env.ANTHROPIC_API_KEY) {
    return {
      ok: false,
      error: "Kein ANTHROPIC_API_KEY konfiguriert — KI-Auswertung nicht möglich.",
    };
  }
  const clean = (text ?? "").trim();
  if (clean.length < 5) return { ok: false, error: "Bitte die Aktion kurz beschreiben." };
  if (clean.length > 2000) return { ok: false, error: "Text zu lang (max. 2000 Zeichen)." };

  const today = new Date().toISOString().slice(0, 10);
  const client = new Anthropic();

  let extracted: Record<string, unknown>;
  try {
    const response = await client.messages.create({
      model: MODEL,
      max_tokens: 1024,
      system: `Du extrahierst aus einer Freitext-Beschreibung einer Flyer-Verteilaktion die strukturierten Felder. Heute ist ${today}. Relative Datumsangaben ("gestern", "letzten Samstag") auf konkrete Daten umrechnen; ohne Datumsangabe gilt heute. PLZ nur übernehmen, wenn sie ausdrücklich im Text stehen (4–5-stellige Zahlen) — NIE aus Ortsnamen raten. inhalt = was auf dem Flyer war / Motiv / Kampagne. note = alles Übrige Erwähnenswerte (Dienstleister, Rücklauf, Besonderheiten), sonst leer.`,
      tools: [
        {
          name: "flyeraktion_speichern",
          description: "Speichert die erkannte Flyeraktion.",
          input_schema: {
            type: "object",
            properties: {
              action_date: { type: "string", description: "Datum JJJJ-MM-TT." },
              anzahl: { type: "integer", description: "Anzahl verteilter Flyer." },
              plz: {
                type: "array",
                items: { type: "string" },
                description: "Alle ausdrücklich genannten PLZ. Leer, wenn keine im Text stehen.",
              },
              inhalt: { type: "string", description: "Inhalt/Motiv des Flyers." },
              note: { type: "string", description: "Optionale Notiz, sonst leerer String." },
            },
            required: ["action_date", "anzahl", "plz", "inhalt"],
            additionalProperties: false,
          },
        },
      ],
      tool_choice: { type: "tool", name: "flyeraktion_speichern" },
      messages: [{ role: "user", content: clean }],
    });
    const toolUse = response.content.find(
      (b): b is Anthropic.ToolUseBlock => b.type === "tool_use",
    );
    if (!toolUse) return { ok: false, error: "KI-Auswertung fehlgeschlagen." };
    extracted = (toolUse.input ?? {}) as Record<string, unknown>;
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? `KI-Auswertung fehlgeschlagen: ${err.message}` : "KI-Fehler",
    };
  }

  const plzList = Array.isArray(extracted.plz) ? extracted.plz.map(String) : [];
  if (plzList.length === 0) {
    return {
      ok: false,
      error:
        "Keine PLZ im Text erkannt — bitte die PLZ mit in die Beschreibung schreiben (z. B. „… in 40210 und 40211 verteilt“).",
    };
  }
  if (!extracted.anzahl) {
    return { ok: false, error: "Keine Flyer-Anzahl im Text erkannt — bitte ergänzen." };
  }

  const parsed = parseInput({
    action_date: String(extracted.action_date ?? ""),
    anzahl: Number(extracted.anzahl),
    plz: plzList.join(", "),
    inhalt: String(extracted.inhalt ?? "").trim() || "(kein Motiv angegeben)",
    note: String(extracted.note ?? "").trim(),
  });
  if (!parsed.ok) return parsed;

  const admin = createAdminClient();
  const { error } = await admin.from("flyer_actions").insert(parsed.row);
  if (error) {
    return (
      missingTableError(error.code) ?? { ok: false, error: "Speichern fehlgeschlagen." }
    );
  }
  revalidate();
  return {
    ok: true,
    saved: {
      action_date: parsed.row.action_date,
      anzahl: parsed.row.anzahl,
      plz: parsed.row.plz,
      inhalt: parsed.row.inhalt,
    },
  };
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
