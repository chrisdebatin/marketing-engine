import Anthropic from "@anthropic-ai/sdk";
import { NextResponse } from "next/server";
import { requireSession } from "@/lib/auth";

export const runtime = "nodejs";
export const maxDuration = 30;

const MODEL = process.env.ANTHROPIC_MODEL || "claude-opus-4-8";

interface ParsedDelivery {
  hub_input: string;
  hub_id: string | null;
  hub_name: string | null;
  flyer_count: number;
  box_count: number;
  aufsteller_count: number;
  note: string;
}

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

  const hubNames = session.hubs.map((h) => h.name);

  const client = new Anthropic();
  try {
    const response = await client.messages.create({
      model: MODEL,
      max_tokens: 1024,
      system: `Du extrahierst Liefer-Angaben aus freiem Text. Der Nutzer beschreibt, wie viele Flyer, Flyeraufsteller und/oder Boxen er an welche Hubs geliefert hat.
Erlaubte Hubs (nutze exakt diese Namen im Feld "hub"): ${hubNames.join(", ")}.
Regeln:
- Ordne jede genannte Location dem am besten passenden Hub-Namen aus der Liste zu. Wenn unklar, nimm den Text so wie genannt.
- flyer_count / box_count / aufsteller_count: ganze Zahlen, 0 wenn nicht genannt.
- "Aufsteller" oder "Flyeraufsteller" zählen zu aufsteller_count, nicht zu flyer_count.
- Wenn mehrere Hubs im Text vorkommen, gib mehrere Einträge zurück.
- note: nur wenn zusätzliche Info genannt wird, sonst leer.`,
      tools: [
        {
          name: "record_deliveries",
          description: "Erfasst die geparsten Lieferungen.",
          input_schema: {
            type: "object",
            properties: {
              deliveries: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    hub: { type: "string" },
                    flyer_count: { type: "integer" },
                    box_count: { type: "integer" },
                    aufsteller_count: { type: "integer" },
                    note: { type: "string" },
                  },
                  required: ["hub", "flyer_count", "box_count", "aufsteller_count"],
                },
              },
            },
            required: ["deliveries"],
          },
        },
      ],
      tool_choice: { type: "tool", name: "record_deliveries" },
      messages: [{ role: "user", content: input }],
    });

    const toolUse = response.content.find(
      (b): b is Anthropic.ToolUseBlock => b.type === "tool_use",
    );
    const raw = (toolUse?.input ?? {}) as {
      deliveries?: Array<{
        hub?: string;
        flyer_count?: number;
        box_count?: number;
        aufsteller_count?: number;
        note?: string;
      }>;
    };

    // match hub text -> hub_id (exact, then case-insensitive contains)
    const parsed: ParsedDelivery[] = (raw.deliveries ?? []).map((d) => {
      const hubInput = (d.hub ?? "").trim();
      const lc = hubInput.toLowerCase();
      const match =
        session.hubs.find((h) => h.name.toLowerCase() === lc) ??
        session.hubs.find(
          (h) =>
            h.name.toLowerCase().includes(lc) ||
            lc.includes(h.name.toLowerCase()),
        );
      return {
        hub_input: hubInput,
        hub_id: match?.id ?? null,
        hub_name: match?.name ?? null,
        flyer_count: Math.max(0, Math.trunc(Number(d.flyer_count) || 0)),
        box_count: Math.max(0, Math.trunc(Number(d.box_count) || 0)),
        aufsteller_count: Math.max(0, Math.trunc(Number(d.aufsteller_count) || 0)),
        note: (d.note ?? "").trim(),
      };
    });

    return NextResponse.json({ deliveries: parsed });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Parse-Fehler" },
      { status: 500 },
    );
  }
}
