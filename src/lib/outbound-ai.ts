import Anthropic from "@anthropic-ai/sdk";

const MODEL = process.env.ANTHROPIC_MODEL || "claude-opus-4-8";

export interface OutboundNoteReading {
  /** Vereinbarter nächster Kontakt aus der Notiz (JJJJ-MM-TT) oder null. */
  wiedervorlage: string | null;
  /** Konkrete Aufgabe aus der Notiz ("Flyer schicken") oder null. */
  todo: string | null;
}

/**
 * KI liest die Notiz eines Outbound-Anrufs: "ruf in 1 Woche zurück" wird zum
 * Wiedervorlage-Datum, "Unterlagen mailen" zum To-do. Fehlertolerant — ohne
 * API-Key oder bei Ausfall entscheidet der Standard-Rhythmus.
 */
export async function readOutboundNote(
  note: string,
  today: string,
): Promise<OutboundNoteReading | null> {
  if (!process.env.ANTHROPIC_API_KEY || !note.trim()) return null;
  try {
    const client = new Anthropic();
    const response = await client.messages.create({
      model: MODEL,
      max_tokens: 300,
      system:
        "Du liest die Notiz zu einem Outbound-Anruf eines Pflegedienstes bei einer Institution (Krankenhaus, Arztpraxis) und sortierst den nächsten Schritt ein. " +
        "wiedervorlage_datum: Wenn ein Rückruf oder nächster Kontakt zu einem Zeitpunkt vereinbart wurde ('in 1 Woche zurückrufen', 'nächsten Dienstag', 'Anfang September', 'meldet sich nach dem Urlaub Mitte …'), rechne das konkrete Datum ausgehend vom heutigen Datum aus (Format JJJJ-MM-TT). Steht kein Zeitpunkt in der Notiz, leerer String — nichts erfinden. " +
        "todo: Wenn aus dem Gespräch eine konkrete Aufgabe für uns entsteht ('Flyer vorbeibringen', 'Unterlagen mailen', 'Ansprechpartner X erfragen'), formuliere sie als kurzen To-do-Text (max. 1 Satz), sonst leerer String.",
      tools: [
        {
          name: "einsortieren",
          description: "Nächster Schritt aus der Anruf-Notiz.",
          input_schema: {
            type: "object",
            properties: {
              wiedervorlage_datum: { type: "string" },
              todo: { type: "string" },
            },
            required: ["wiedervorlage_datum", "todo"],
            additionalProperties: false,
          },
        },
      ],
      tool_choice: { type: "tool", name: "einsortieren" },
      messages: [
        {
          role: "user",
          content: `Heute ist ${today}. Notiz zum Anruf:\n\n${note.slice(0, 2000)}`,
        },
      ],
    });
    const tu = response.content.find(
      (b): b is Anthropic.ToolUseBlock => b.type === "tool_use",
    );
    if (!tu) return null;
    const input = tu.input as { wiedervorlage_datum?: string; todo?: string };
    const datum = (input.wiedervorlage_datum ?? "").trim();
    const gueltig = /^\d{4}-\d{2}-\d{2}$/.test(datum) && datum > today;
    return {
      wiedervorlage: gueltig ? datum : null,
      todo: (input.todo ?? "").trim().slice(0, 300) || null,
    };
  } catch {
    return null;
  }
}
