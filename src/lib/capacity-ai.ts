import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { z } from "zod";

/**
 * KI-Auswertung einer Freitext-Kapazitätsmeldung ("Dorsten hat 5 freie
 * Plätze, 2 davon Beatmung, Aufnahme ab Montag; Velbert 3 Plätze …"):
 * Claude ordnet die Angaben den Standorten zu, der Server trägt sie in
 * den Wochen-Report ein.
 */

const capacitySchema = z.object({
  meldungen: z.array(
    z.object({
      standort: z
        .string()
        .describe(
          "Der Standort-Name EXAKT wie in der übergebenen Liste geschrieben. " +
            "„Dorsten“ ohne Zusatz meint den Standort „Dorsten“, nicht Tagespflege/Alltagshilfe.",
        ),
      freie_plaetze: z
        .number()
        .nullable()
        .describe("Freie Plätze gesamt; null wenn nicht genannt."),
      beatmung_plaetze: z
        .number()
        .nullable()
        .describe("Davon Beatmungs-Plätze; null wenn nicht genannt."),
      wg_plaetze: z
        .number()
        .nullable()
        .describe("Davon WG-Plätze; null wenn nicht genannt."),
      kinder_moeglich: z
        .boolean()
        .nullable()
        .describe("Kinder-Versorgung möglich? null wenn nicht genannt."),
      aufnahme_ab: z
        .string()
        .nullable()
        .describe(
          "Frühester Aufnahmetermin als JJJJ-MM-TT, relative Angaben " +
            "(„ab Montag“, „nächste Woche“) zum genannten heutigen Datum auflösen. Sonst null.",
        ),
      notiz: z
        .string()
        .nullable()
        .describe("Sonstige relevante Anmerkung zu diesem Standort, sonst null."),
    }),
  ),
});

export type CapacityExtraction = z.infer<typeof capacitySchema>;

const MODEL = process.env.ANTHROPIC_MODEL || "claude-opus-5";

/** Gibt null zurück, wenn kein API-Key gesetzt ist oder die Auswertung scheitert. */
export async function extractCapacityFromText(
  text: string,
  hubNames: string[],
): Promise<CapacityExtraction | null> {
  const cleaned = (text ?? "").trim();
  if (!cleaned || !process.env.ANTHROPIC_API_KEY) return null;

  const heute = new Date();
  const heuteIso = heute.toISOString().slice(0, 10);
  const wochentag = heute.toLocaleDateString("de-DE", { weekday: "long" });

  try {
    const client = new Anthropic();
    const response = await client.messages.parse({
      model: MODEL,
      max_tokens: 4096,
      output_config: {
        effort: "low",
        format: zodOutputFormat(capacitySchema),
      },
      system:
        "Du wertest Kapazitätsmeldungen eines Pflegedienstes aus. Der Text nennt " +
        "je Standort freie Plätze (gesamt), davon Beatmung, davon WG, ob Kinder möglich sind " +
        "und ab wann aufgenommen werden kann. Ordne jede Angabe genau einem Standort aus der " +
        "Liste zu (Name exakt übernehmen). Standorte, die im Text nicht vorkommen, lässt du weg. " +
        "Nichts erfinden — nicht genannte Werte bleiben null.",
      messages: [
        {
          role: "user",
          content:
            `Heute ist ${wochentag}, der ${heuteIso}.\n` +
            `Gültige Standorte:\n${hubNames.map((n) => `- ${n}`).join("\n")}\n\n` +
            `Meldung:\n${cleaned.slice(0, 4000)}`,
        },
      ],
    });
    return response.parsed_output ?? null;
  } catch (err) {
    console.error(
      "capacity-ai: Auswertung fehlgeschlagen:",
      err instanceof Error ? err.message : err,
    );
    return null;
  }
}
