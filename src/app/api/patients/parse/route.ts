import Anthropic from "@anthropic-ai/sdk";
import { NextResponse } from "next/server";
import { requireSession } from "@/lib/auth";

export const runtime = "nodejs";
export const maxDuration = 30;

const MODEL = process.env.ANTHROPIC_MODEL || "claude-opus-4-8";

interface ParsedPatient {
  hub_input: string;
  hub_id: string | null;
  hub_name: string | null;
  display_name: string;
  reference_id: string;
}

// Interner Endpoint (Session): parst Freitext mit zentralen Patientendaten
// und ordnet jeden Patienten per Claude dem passenden Hub zu.
// DSGVO: Es werden nur Name + optionale Referenz-ID extrahiert; der Text wird
// nicht gespeichert, keine Patientendaten in Logs.
export async function POST(req: Request) {
  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json(
      { error: "Kein ANTHROPIC_API_KEY konfiguriert." },
      { status: 503 },
    );
  }

  const session = await requireSession();
  if (session.hubs.length === 0) {
    return NextResponse.json(
      { error: "Dir ist kein Hub zugeordnet." },
      { status: 400 },
    );
  }

  const { text } = (await req.json().catch(() => ({}))) as { text?: string };
  const input = (text ?? "").trim();
  if (!input) {
    return NextResponse.json({ error: "Kein Text übergeben." }, { status: 400 });
  }
  if (input.length > 50_000) {
    return NextResponse.json(
      { error: "Text zu lang (max. 50.000 Zeichen)." },
      { status: 400 },
    );
  }

  const hubNames = session.hubs.map((h) => h.name);

  const client = new Anthropic();
  try {
    const response = await client.messages.create({
      model: MODEL,
      max_tokens: 16000,
      system: `Du extrahierst neue Patienten aus freiem Text (z. B. Export aus einem Verwaltungssystem, kopierte Tabelle, formlose Notizen) und ordnest jeden Patienten einem Pflege-Hub (Standort) zu.
Erlaubte Hubs (nutze exakt diese Namen im Feld "hub"): ${hubNames.join(", ")}.
Regeln:
- Der Text kann Überschriften/Abschnitte je Hub enthalten, Hub-Namen in einer Tabellenspalte, oder Ortsangaben, aus denen der Hub hervorgeht. Ordne jeden Patienten dem am besten passenden Hub-Namen aus der Liste zu. Ist kein Hub erkennbar, setze hub auf "".
- display_name: der Patientenname, möglichst im Format "Nachname, Vorname". Nur echte Personennamen — keine Überschriften, Hub-Namen, Datumsangaben oder Spaltentitel als Patienten aufnehmen.
- reference_id: Patienten-/Referenz-/Fallnummer, falls im Text vorhanden, sonst "".
- Übernimm KEINE weiteren Daten (keine Adressen, Geburtsdaten, Diagnosen) — nur Name und Referenznummer.
- Dedupliziere exakte Doppelungen innerhalb desselben Hubs.`,
      tools: [
        {
          name: "record_patients",
          description: "Erfasst die extrahierten Patienten mit Hub-Zuordnung.",
          input_schema: {
            type: "object",
            properties: {
              patients: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    hub: { type: "string" },
                    display_name: { type: "string" },
                    reference_id: { type: "string" },
                  },
                  required: ["hub", "display_name"],
                },
              },
            },
            required: ["patients"],
          },
        },
      ],
      tool_choice: { type: "tool", name: "record_patients" },
      messages: [{ role: "user", content: input }],
    });

    const toolUse = response.content.find(
      (b): b is Anthropic.ToolUseBlock => b.type === "tool_use",
    );
    const raw = (toolUse?.input ?? {}) as {
      patients?: Array<{
        hub?: string;
        display_name?: string;
        reference_id?: string;
      }>;
    };

    // Hub-Text -> hub_id (exakt, dann case-insensitive contains) — gleiches
    // Muster wie api/deliveries/parse.
    const parsed: ParsedPatient[] = (raw.patients ?? [])
      .map((p) => {
        const hubInput = (p.hub ?? "").trim();
        const lc = hubInput.toLowerCase();
        const match = lc
          ? (session.hubs.find((h) => h.name.toLowerCase() === lc) ??
            session.hubs.find(
              (h) =>
                h.name.toLowerCase().includes(lc) ||
                lc.includes(h.name.toLowerCase()),
            ))
          : undefined;
        return {
          hub_input: hubInput,
          hub_id: match?.id ?? null,
          hub_name: match?.name ?? null,
          display_name: (p.display_name ?? "").trim().slice(0, 200),
          reference_id: (p.reference_id ?? "").trim().slice(0, 100),
        };
      })
      .filter((p) => p.display_name.length > 0);

    return NextResponse.json({ patients: parsed });
  } catch (err) {
    // Keine Patientendaten in der Fehlermeldung/den Logs.
    console.error(
      "patients/parse failed:",
      err instanceof Error ? err.constructor.name : "unknown",
    );
    return NextResponse.json(
      { error: "Zuordnung fehlgeschlagen. Bitte erneut versuchen." },
      { status: 500 },
    );
  }
}
