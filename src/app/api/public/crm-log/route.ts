import Anthropic from "@anthropic-ai/sdk";
import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { logContactOnTarget } from "@/lib/crm-log";
import { kontaktArtLabel } from "@/lib/crm";
import { isPlaceKind } from "@/lib/places";

export const runtime = "nodejs";
export const maxDuration = 60;

const MODEL = process.env.ANTHROPIC_MODEL || "claude-opus-4-8";

/**
 * KI-Freitext-Log für die PDL: "War heute im Klinikum Lippe, Box abgegeben
 * bei Frau Weber vom Sozialdienst, arbeiten mit Recare. Danach Flyer in der
 * Apotheke am Markt ausgelegt." → die KI erkennt Orte, Aktionen,
 * Ansprechpartner und Recare-Status, ordnet bekannte Orte der Liste zu und
 * legt neue automatisch an. Jede Aktion wird wie ein normaler Kontakt
 * gebucht (Follow-up, Log, Auslage-Ort bei Box/Flyer).
 */

const AKTIONEN = ["box", "flyer", "besuch", "anruf"] as const;

interface ParsedAktion {
  ort_text: string;
  target_index: number;
  aktion: (typeof AKTIONEN)[number];
  kategorie?: string;
  ansprechpartner?: string;
  recare?: string;
  notiz?: string;
}

export async function POST(req: Request) {
  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json(
      { error: "KI-Log ist derzeit nicht verfügbar (API-Key fehlt)." },
      { status: 503 },
    );
  }

  const body = (await req.json().catch(() => ({}))) as {
    token?: string;
    text?: string;
  };
  const token = (body.token ?? "").trim();
  const text = (body.text ?? "").trim().slice(0, 2000);
  if (!token) {
    return NextResponse.json({ error: "Token fehlt." }, { status: 400 });
  }
  if (text.length < 5) {
    return NextResponse.json(
      { error: "Bitte kurz beschreiben, was Sie gemacht haben." },
      { status: 400 },
    );
  }

  const admin = createAdminClient();
  const { data: hub, error: findErr } = await admin
    .from("hubs")
    .select("id")
    .eq("share_token", token)
    .single();
  if (findErr || !hub) {
    return NextResponse.json({ error: "Ungültiger Link." }, { status: 404 });
  }

  const { data: targetRows } = await admin
    .from("crm_targets")
    .select("*")
    .eq("hub_id", hub.id)
    .order("name");
  const targets = (targetRows ?? []) as { id: string; name: string; ort: string | null }[];
  const targetList = targets
    .map((t, i) => `${i}: ${t.name}${t.ort ? ` (${t.ort})` : ""}`)
    .join("\n");

  // --- KI: Freitext → strukturierte Aktionen (erzwungener Tool-Call) ---
  const client = new Anthropic();
  let aktionen: ParsedAktion[];
  try {
    const msg = await client.messages.create({
      model: MODEL,
      max_tokens: 1500,
      tool_choice: { type: "tool", name: "log_aktionen" },
      tools: [
        {
          name: "log_aktionen",
          description:
            "Strukturiert die im Freitext beschriebenen Marketing-Aktionen.",
          input_schema: {
            type: "object",
            properties: {
              aktionen: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    ort_text: {
                      type: "string",
                      description:
                        "Name des Ortes, wie er im Text steht (bereinigt).",
                    },
                    target_index: {
                      type: "integer",
                      description:
                        "Index aus der Orte-Liste, wenn der Ort eindeutig einem bekannten Eintrag entspricht (auch bei leicht anderer Schreibweise). Sonst -1 für einen neuen Ort.",
                    },
                    aktion: { type: "string", enum: [...AKTIONEN] },
                    kategorie: {
                      type: "string",
                      enum: [
                        "krankenhaus",
                        "praxis",
                        "apotheke",
                        "pflegeeinrichtung",
                        "sanitaetshaus",
                        "sonstiges",
                      ],
                      description: "Art des Ortes (nur bei neuen Orten nötig).",
                    },
                    ansprechpartner: {
                      type: "string",
                      description:
                        "Genannte Kontaktperson inkl. Rolle, z. B. 'Frau Weber, Sozialdienst'.",
                    },
                    recare: {
                      type: "string",
                      enum: ["ja", "nein", ""],
                      description:
                        "Nur setzen, wenn der Text klar sagt, ob der Ort mit Recare arbeitet.",
                    },
                    notiz: {
                      type: "string",
                      description:
                        "Kurze Gesprächsnotiz aus dem Text (was besprochen, Resonanz).",
                    },
                  },
                  required: ["ort_text", "target_index", "aktion"],
                },
              },
            },
            required: ["aktionen"],
          },
        },
      ],
      messages: [
        {
          role: "user",
          content: `Eine Pflegedienstleitung beschreibt frei, welche Marketing-Aktionen sie gemacht hat. Aktionen: box (Box vorbeigebracht/abgegeben), flyer (Flyer ausgelegt/verteilt), besuch (persönliches Gespräch vor Ort ohne Box), anruf (Telefonat). Wenn bei einem Besuch eine Box abgegeben wurde, zählt das als box.

Bekannte Orte der Liste (Index: Name):
${targetList || "(Liste ist leer)"}

Freitext der PDL:
"""
${text}
"""

Extrahiere jede beschriebene Aktion einzeln. Erfinde nichts, was nicht im Text steht.`,
        },
      ],
    });
    const toolUse = msg.content.find(
      (c): c is Anthropic.ToolUseBlock => c.type === "tool_use",
    );
    const input = (toolUse?.input ?? {}) as { aktionen?: ParsedAktion[] };
    aktionen = (input.aktionen ?? []).filter(
      (a) =>
        a &&
        typeof a.ort_text === "string" &&
        a.ort_text.trim() &&
        AKTIONEN.includes(a.aktion),
    );
  } catch (err) {
    console.error("crm-log: KI-Parsing fehlgeschlagen:", err);
    return NextResponse.json(
      { error: "KI konnte den Text gerade nicht verarbeiten — bitte erneut versuchen oder unten regulär loggen." },
      { status: 502 },
    );
  }

  if (aktionen.length === 0) {
    return NextResponse.json(
      { error: "Keine Aktion erkannt — bitte Ort und Aktion nennen (z. B. „Box im Klinikum X abgegeben“)." },
      { status: 422 },
    );
  }

  // --- Erkannte Aktionen buchen ---
  const results: { ort: string; aktion: string; neu: boolean }[] = [];
  for (const a of aktionen.slice(0, 10)) {
    let targetId: string | null = null;
    let neu = false;
    if (a.target_index >= 0 && a.target_index < targets.length) {
      targetId = targets[a.target_index].id;
    } else {
      const kategorie = (a.kategorie ?? "").trim();
      const { data: inserted } = await admin
        .from("crm_targets")
        .insert({
          hub_id: hub.id,
          name: a.ort_text.trim().slice(0, 200),
          kategorie: kategorie && isPlaceKind(kategorie) ? kategorie : null,
          intervall_wochen: 4,
          note: "Von der PDL selbst hinzugefügt (per Freitext-Log)",
        })
        .select("id")
        .single();
      if (!inserted) continue;
      targetId = inserted.id;
      neu = true;
    }

    const logged = await logContactOnTarget({
      hubId: hub.id,
      targetId,
      kontaktArt: a.aktion,
      ansprechpartner: a.ansprechpartner,
      note: a.notiz,
      recare: a.recare,
    });
    if (logged.ok) {
      results.push({
        ort:
          a.target_index >= 0 && a.target_index < targets.length
            ? targets[a.target_index].name
            : a.ort_text.trim(),
        aktion: kontaktArtLabel(a.aktion),
        neu,
      });
    }
  }

  if (results.length === 0) {
    return NextResponse.json(
      { error: "Aktionen erkannt, aber Buchen fehlgeschlagen — bitte erneut versuchen." },
      { status: 500 },
    );
  }

  // Frischen Stand der Liste zurückgeben, damit die Seite sofort stimmt.
  const { data: freshRows } = await admin
    .from("crm_targets")
    .select("*")
    .eq("hub_id", hub.id)
    .order("name");

  return NextResponse.json({ results, targets: freshRows ?? [] });
}
