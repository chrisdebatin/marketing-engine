import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { CRM_WISSEN } from "@/lib/crm-wissen";

export const runtime = "nodejs";
export const maxDuration = 60;

const MODEL = process.env.ANTHROPIC_MODEL || "claude-opus-4-8";

/**
 * CRM-Hilfe: beantwortet Bedienungs-Fragen ("Was mache ich, wenn niemand
 * rangeht?") aus der Wissensbasis in lib/crm-wissen.ts. Bewusst OHNE
 * Datenbank-Zugriff — für Zahlen gibt es den Assistenten unter /assistant.
 *
 * Token-frei erreichbar, weil die Team-Seiten ebenfalls ohne Login laufen;
 * es werden keine Kundendaten verarbeitet, nur die Anleitung.
 */
export async function POST(req: Request) {
  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json(
      { error: "Die Hilfe ist nicht eingerichtet (ANTHROPIC_API_KEY fehlt)." },
      { status: 503 },
    );
  }

  const body = (await req.json().catch(() => ({}))) as {
    frage?: string;
    verlauf?: { rolle: "user" | "assistant"; text: string }[];
  };
  const frage = (body.frage ?? "").trim().slice(0, 1000);
  if (!frage) {
    return NextResponse.json({ error: "Keine Frage gestellt." }, { status: 400 });
  }

  const system = `Du bist die Bedienungs-Hilfe für das CRM der Pflegeunion und hilfst Belinda, Adeline und Devina bei der täglichen Arbeit.

Antworte AUSSCHLIESSLICH auf Basis der folgenden Anleitung. Steht etwas nicht drin, sage ehrlich "Das steht nicht in der Anleitung — frag bitte Chris" und rate NICHT.

Regeln für deine Antworten:
- Immer auf Deutsch, per "du".
- Kurz und konkret: sag, welchen Knopf man drückt und wo er steht.
- Bei Abläufen nummerierte Schritte, maximal 5.
- Keine Floskeln, keine Einleitung wie "Gerne!". Direkt zur Sache.
- Wenn die Frage Zahlen betrifft (z. B. "wie viele Leads hatten wir?"),
  verweise auf den Auswertungs-Assistenten bzw. CRM-Admin — du hast
  selbst keinen Zugriff auf die Daten.

ANLEITUNG:
${CRM_WISSEN}`;

  const verlauf = (body.verlauf ?? []).slice(-6);
  const messages: Anthropic.MessageParam[] = [
    ...verlauf.map((m) => ({
      role: m.rolle,
      content: m.text.slice(0, 2000),
    })),
    { role: "user" as const, content: frage },
  ];

  try {
    const client = new Anthropic();
    const res = await client.messages.create({
      model: MODEL,
      max_tokens: 1024,
      system,
      messages,
    });
    const antwort = res.content
      .filter((b): b is Anthropic.TextBlock => b.type === "text")
      .map((b) => b.text)
      .join("\n")
      .trim();
    return NextResponse.json({ antwort });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Unbekannter Fehler";
    return NextResponse.json(
      { error: `Die Hilfe konnte nicht antworten: ${msg.slice(0, 120)}` },
      { status: 500 },
    );
  }
}
