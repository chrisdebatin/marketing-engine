import Anthropic from "@anthropic-ai/sdk";

const MODEL = process.env.ANTHROPIC_MODEL || "claude-opus-4-8";

export interface OutboundNoteReading {
  /** Vereinbarter nächster Kontakt aus der Notiz (JJJJ-MM-TT) oder null. */
  wiedervorlage: string | null;
  /** Konkrete Aufgabe aus der Notiz ("Flyer schicken") oder null. */
  todo: string | null;
  /**
   * Auftrag, den eine PDL vor Ort erledigen muss (Flyer vorbeibringen,
   * CM-Box liefern, persönlich vorstellen) — wird dem MA zur Bestätigung
   * vorgeschlagen, bevor er an den Standort rausgeht. null = kein
   * Vor-Ort-Auftrag.
   */
  pdlAuftrag: string | null;
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
        "todo: Wenn aus dem Gespräch eine konkrete Aufgabe für uns entsteht ('Unterlagen mailen', 'Ansprechpartner X erfragen'), formuliere sie als kurzen To-do-Text (max. 1 Satz), sonst leerer String. " +
        "pdl_auftrag: Wenn die Aufgabe VOR ORT von der Pflegedienstleitung (PDL) des zuständigen Standorts erledigt werden muss — Flyer/Material vorbeibringen, Case-Management-Box liefern, persönlich vorbeikommen und sich vorstellen, Aufsteller aufstellen —, formuliere sie hier als kurzen Auftrag im Imperativ (z. B. 'Flyer vorbeibringen', 'CM-Box liefern und Sozialdienst vorstellen'), sonst leerer String. " +
        "Wichtig: Ein Vor-Ort-Auftrag gehört NUR in pdl_auftrag, nicht zusätzlich in todo — sonst steht dieselbe Aufgabe doppelt im System.",
      tools: [
        {
          name: "einsortieren",
          description: "Nächster Schritt aus der Anruf-Notiz.",
          input_schema: {
            type: "object",
            properties: {
              wiedervorlage_datum: { type: "string" },
              todo: { type: "string" },
              pdl_auftrag: { type: "string" },
            },
            required: ["wiedervorlage_datum", "todo", "pdl_auftrag"],
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
    const input = tu.input as {
      wiedervorlage_datum?: string;
      todo?: string;
      pdl_auftrag?: string;
    };
    const datum = (input.wiedervorlage_datum ?? "").trim();
    const gueltig = /^\d{4}-\d{2}-\d{2}$/.test(datum) && datum > today;
    return {
      wiedervorlage: gueltig ? datum : null,
      todo: (input.todo ?? "").trim().slice(0, 300) || null,
      pdlAuftrag: (input.pdl_auftrag ?? "").trim().slice(0, 300) || null,
    };
  } catch {
    return null;
  }
}
