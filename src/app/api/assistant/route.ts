import Anthropic from "@anthropic-ai/sdk";
import { NextResponse } from "next/server";
import { requireSession } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import type { Activity, ActivityType } from "@/lib/types";

export const runtime = "nodejs";
export const maxDuration = 60;

const MODEL = process.env.ANTHROPIC_MODEL || "claude-opus-4-8";

// ---- Tool definitions (read-only, RLS-scoped to the logged-in user) --------

const tools: Anthropic.Tool[] = [
  {
    name: "list_hubs",
    description:
      "Listet alle Hubs auf, die der aktuelle Nutzer sehen darf (mit Name und Region).",
    input_schema: { type: "object", properties: {}, additionalProperties: false },
  },
  {
    name: "aggregate_activities",
    description:
      "Aggregiert erfasste Aktivitäten. Gruppiert nach hub, type, material, month oder standort und summiert eine Kennzahl. Nutze dies für alle Auswertungen ('wie viele Flyer', 'Boxen pro Hub', 'Verlauf pro Monat').",
    input_schema: {
      type: "object",
      properties: {
        group_by: {
          type: "string",
          enum: ["hub", "type", "material", "month", "standort"],
          description: "Feld, nach dem gruppiert wird.",
        },
        metric: {
          type: "string",
          enum: ["count", "menge", "anzahl_boxen"],
          description:
            "count = Anzahl Einträge; menge = Summe Flyer/Aufsteller-Menge; anzahl_boxen = Summe Boxen.",
        },
        type: {
          type: "string",
          enum: ["flyer", "box"],
          description: "Optional: nur diesen Aktivitätstyp berücksichtigen.",
        },
        date_from: {
          type: "string",
          description: "Optional: Startdatum (inklusive) im Format JJJJ-MM-TT.",
        },
        date_to: {
          type: "string",
          description: "Optional: Enddatum (inklusive) im Format JJJJ-MM-TT.",
        },
      },
      required: ["group_by", "metric"],
      additionalProperties: false,
    },
  },
  {
    name: "list_recent_activities",
    description:
      "Listet einzelne, zuletzt erfasste Aktivitäten (Datum, Ort, Typ, Details). Für Detailfragen, nicht für Summen.",
    input_schema: {
      type: "object",
      properties: {
        limit: { type: "integer", description: "Max. Anzahl (Standard 20, max 50)." },
        type: { type: "string", enum: ["flyer", "box"] },
      },
      additionalProperties: false,
    },
  },
];

// ---- Tool execution --------------------------------------------------------

type Supa = Awaited<ReturnType<typeof createClient>>;

async function loadMaps(supabase: Supa) {
  const [{ data: hubs }, { data: materials }] = await Promise.all([
    supabase.from("hubs").select("id, name, region"),
    supabase.from("material_types").select("id, name"),
  ]);
  const hubMap = new Map((hubs ?? []).map((h) => [h.id, h.name]));
  const materialMap = new Map((materials ?? []).map((m) => [m.id, m.name]));
  return { hubMap, materialMap };
}

function monthKey(iso: string): string {
  return iso.slice(0, 7); // JJJJ-MM
}

async function runTool(
  supabase: Supa,
  name: string,
  input: Record<string, unknown>,
): Promise<unknown> {
  if (name === "list_hubs") {
    const { data } = await supabase
      .from("hubs")
      .select("id, name, region")
      .order("name");
    return data ?? [];
  }

  if (name === "list_recent_activities") {
    const limit = Math.min(Number(input.limit) || 20, 50);
    let q = supabase
      .from("activities")
      .select("hub_id, standort_name, type, occurred_on, note, details")
      .order("occurred_on", { ascending: false })
      .limit(limit);
    if (input.type) q = q.eq("type", String(input.type) as ActivityType);
    const { data } = await q;
    const { hubMap, materialMap } = await loadMaps(supabase);
    return (data ?? []).map((a) => ({
      datum: a.occurred_on,
      hub: hubMap.get(a.hub_id) ?? a.hub_id,
      ort: a.standort_name,
      typ: a.type,
      details:
        a.type === "flyer"
          ? {
              material:
                materialMap.get(
                  String((a.details as Record<string, unknown>)?.material_type_id),
                ) ?? "?",
              menge: (a.details as Record<string, unknown>)?.menge,
            }
          : { anzahl_boxen: (a.details as Record<string, unknown>)?.anzahl_boxen },
      notiz: a.note,
    }));
  }

  if (name === "aggregate_activities") {
    const groupBy = String(input.group_by);
    const metric = String(input.metric);

    let q = supabase
      .from("activities")
      .select("hub_id, type, occurred_on, details")
      .limit(5000);
    if (input.type) q = q.eq("type", String(input.type) as ActivityType);
    if (input.date_from) q = q.gte("occurred_on", String(input.date_from));
    if (input.date_to) q = q.lte("occurred_on", String(input.date_to));

    const { data } = await q;
    const rows = (data ?? []) as Pick<
      Activity,
      "hub_id" | "type" | "occurred_on" | "details"
    >[];
    const { hubMap, materialMap } = await loadMaps(supabase);

    const groups = new Map<string, number>();
    for (const r of rows) {
      const details = (r.details ?? {}) as Record<string, unknown>;

      // value to add for this row, per chosen metric
      let value = 0;
      if (metric === "count") value = 1;
      else if (metric === "menge")
        value = r.type === "flyer" ? Number(details.menge) || 0 : 0;
      else if (metric === "anzahl_boxen")
        value = r.type === "box" ? Number(details.anzahl_boxen) || 0 : 0;
      if (value === 0 && metric !== "count") continue;

      // group key
      let key: string;
      switch (groupBy) {
        case "hub":
          key = hubMap.get(r.hub_id) ?? r.hub_id;
          break;
        case "type":
          key = r.type === "flyer" ? "Flyer/Aufsteller" : "Box";
          break;
        case "material":
          key =
            r.type === "flyer"
              ? materialMap.get(String(details.material_type_id)) ?? "?"
              : "(Box)";
          break;
        case "month":
          key = monthKey(r.occurred_on);
          break;
        case "standort":
          key = "(siehe Einzelliste)";
          break;
        default:
          key = "?";
      }
      groups.set(key, (groups.get(key) ?? 0) + value);
    }

    const result = Array.from(groups.entries())
      .map(([gruppe, wert]) => ({ gruppe, wert }))
      .sort((a, b) => b.wert - a.wert);
    return { group_by: groupBy, metric, ergebnis: result, zeilen_gesamt: rows.length };
  }

  throw new Error(`Unbekanntes Tool: ${name}`);
}

// ---- Route -----------------------------------------------------------------

export async function POST(req: Request) {
  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json(
      {
        error:
          "Kein ANTHROPIC_API_KEY konfiguriert. Trage ihn in .env.local ein und starte den Dev-Server neu.",
      },
      { status: 503 },
    );
  }

  const session = await requireSession();
  const supabase = await createClient();

  const body = (await req.json().catch(() => ({}))) as { question?: string };
  const question = (body.question ?? "").trim();
  if (!question) {
    return NextResponse.json({ error: "Keine Frage übergeben." }, { status: 400 });
  }

  const today = new Date().toISOString().slice(0, 10);
  const system = `Du bist der Auswertungs-Assistent der Marketing-Engine.
Beantworte Fragen zu erfassten Marketing-Aktivitäten (Flyer/Aufsteller ausgelegt, Case-Management-Boxen beliefert) je Hub.
Heutiges Datum: ${today}. Rolle des Nutzers: ${session.isAdmin ? "Admin (sieht alle Hubs)" : "Mitarbeiter (sieht nur eigene Hubs)"}.
Nutze IMMER die bereitgestellten Tools, um an Zahlen zu kommen – rate nie. Die Tools respektieren automatisch die Zugriffsrechte des Nutzers.
Antworte knapp und auf Deutsch. Nenne konkrete Zahlen. Wenn keine Daten vorliegen, sag das klar.`;

  const client = new Anthropic();
  const messages: Anthropic.MessageParam[] = [
    { role: "user", content: question },
  ];

  try {
    for (let i = 0; i < 6; i++) {
      const response = await client.messages.create({
        model: MODEL,
        max_tokens: 2048,
        system,
        tools,
        messages,
      });

      if (response.stop_reason !== "tool_use") {
        const answer = response.content
          .filter((b): b is Anthropic.TextBlock => b.type === "text")
          .map((b) => b.text)
          .join("\n")
          .trim();
        return NextResponse.json({ answer });
      }

      messages.push({ role: "assistant", content: response.content });

      const toolResults: Anthropic.ToolResultBlockParam[] = [];
      for (const block of response.content) {
        if (block.type !== "tool_use") continue;
        try {
          const out = await runTool(
            supabase,
            block.name,
            (block.input ?? {}) as Record<string, unknown>,
          );
          toolResults.push({
            type: "tool_result",
            tool_use_id: block.id,
            content: JSON.stringify(out),
          });
        } catch (err) {
          toolResults.push({
            type: "tool_result",
            tool_use_id: block.id,
            content: err instanceof Error ? err.message : "Fehler",
            is_error: true,
          });
        }
      }
      messages.push({ role: "user", content: toolResults });
    }

    return NextResponse.json({
      answer:
        "Die Auswertung war zu komplex (zu viele Schritte). Bitte formuliere die Frage etwas konkreter.",
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Assistant-Fehler" },
      { status: 500 },
    );
  }
}
