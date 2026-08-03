import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { z } from "zod";

/**
 * KI-Auswertung von Call-Center-Gesprächsnotizen: Claude extrahiert
 * konkrete Aufgaben für den zuständigen Standort ("PDL vorbeischicken",
 * "Box vorbeibringen" …) plus eine Kurzfassung des Besprochenen.
 * Nice-to-have: Fehler oder ein fehlender API-Key dürfen das Loggen des
 * Anrufs nie blockieren — dann kommt einfach null zurück.
 */

const extractionSchema = z.object({
  zusammenfassung: z
    .string()
    .describe(
      "Was wurde besprochen? 1–2 Sätze auf Deutsch, für die PDL als Kontext.",
    ),
  todos: z.array(
    z.object({
      art: z
        .enum(["besuch", "box", "flyer", "anruf", "sonstiges"])
        .describe(
          "besuch = PDL soll persönlich vorbeigehen; box = Box/Material vorbeibringen; flyer = Flyer auslegen; anruf = Rückruf nötig; sonstiges = alles andere.",
        ),
      aufgabe: z
        .string()
        .describe(
          "Die Aufgabe als kurzer Imperativ-Satz auf Deutsch, z. B. „Persönlich beim Sozialdienst vorstellen und Box mitbringen“.",
        ),
    }),
  ),
});

export type ExtractedTodos = z.infer<typeof extractionSchema>;

const MODEL = process.env.ANTHROPIC_MODEL || "claude-opus-5";

/**
 * Liest eine Gesprächsnotiz aus. Gibt null zurück, wenn kein API-Key
 * gesetzt ist, die Notiz leer ist oder die Extraktion fehlschlägt.
 */
export async function extractTodosFromCallNote(input: {
  note: string;
  targetName?: string | null;
  ansprechpartner?: string | null;
}): Promise<ExtractedTodos | null> {
  const note = (input.note ?? "").trim();
  if (!note || !process.env.ANTHROPIC_API_KEY) return null;

  try {
    const client = new Anthropic();
    const response = await client.messages.parse({
      model: MODEL,
      max_tokens: 2048,
      output_config: {
        effort: "low",
        format: zodOutputFormat(extractionSchema),
      },
      system:
        "Du wertest Gesprächsnotizen eines Pflegedienst-Call-Centers aus. " +
        "Das Call-Center ruft Kliniken/Sozialdienste an; vor Ort gibt es je Region eine Pflegedienstleitung (PDL). " +
        "Extrahiere NUR Aufgaben, die aus der Notiz klar hervorgehen und die der Standort/die PDL vor Ort erledigen soll " +
        "(z. B. „PDL vorbeischicken“ → besuch, „Infomaterial/Box zusenden/vorbeibringen“ → box/flyer, „Rückruf gewünscht“ → anruf). " +
        "Keine Aufgaben erfinden — reine Info-Notizen ergeben eine leere Liste. " +
        "Die Zusammenfassung ist der Kontext für die PDL: mit wem gesprochen, was vereinbart.",
      messages: [
        {
          role: "user",
          content: [
            input.targetName ? `Institution: ${input.targetName}` : null,
            input.ansprechpartner
              ? `Gesprächspartner: ${input.ansprechpartner}`
              : null,
            `Gesprächsnotiz: ${note.slice(0, 2000)}`,
          ]
            .filter(Boolean)
            .join("\n"),
        },
      ],
    });
    return response.parsed_output ?? null;
  } catch (err) {
    console.error(
      "crm-todos-ai: Extraktion fehlgeschlagen:",
      err instanceof Error ? err.message : err,
    );
    return null;
  }
}
