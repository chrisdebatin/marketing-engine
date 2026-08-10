import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { z } from "zod";

/**
 * Erzeugt den E-Mail-Follow-up-Entwurf für einen Meta-Lead (SERVER ONLY).
 * Ziel laut Vorgabe: Anruf ankündigen — der Lead muss nichts tun, die Mail
 * wärmt für den Anruf vor. Versand erst nach 1-Klick-Freigabe im UI.
 *
 * Optional per Env anpassbar:
 * - FOLLOWUP_SIGNATURE  Grußformel/Absender (Default: "Ihr Recruiting-Team")
 * - FOLLOWUP_COMPANY    Firmenname im Text (Default: "unser Pflegedienst")
 */

const MODEL = process.env.ANTHROPIC_MODEL || "claude-opus-5";

const draftSchema = z.object({
  subject: z.string().describe("Betreffzeile, max. 60 Zeichen, ohne Emojis"),
  body: z
    .string()
    .describe(
      "Reiner Mailtext (kein HTML, kein Markdown), mit Anrede und Grußformel, Absätze durch Leerzeilen",
    ),
});

export interface FollowupInput {
  name: string | null;
  campaignName: string | null;
  adName: string | null;
}

export async function generateFollowupDraft(
  input: FollowupInput,
): Promise<{ subject: string; body: string } | null> {
  if (!process.env.ANTHROPIC_API_KEY) return null;
  const signature = process.env.FOLLOWUP_SIGNATURE || "Ihr Recruiting-Team";
  const company = process.env.FOLLOWUP_COMPANY || "unser Pflegedienst";

  try {
    const client = new Anthropic();
    const response = await client.messages.parse({
      model: MODEL,
      max_tokens: 2048,
      output_config: {
        effort: "low",
        format: zodOutputFormat(draftSchema),
      },
      system:
        "Du schreibst kurze, warme Follow-up-Mails an Menschen, die über eine " +
        `Facebook-/Instagram-Anzeige Interesse an einer Stelle bei ${company} gezeigt ` +
        "haben (Pflege/Betreuung). Zweck der Mail: bedanken, Interesse bestätigen und " +
        "ankündigen, dass wir in den nächsten 1–2 Werktagen TELEFONISCH anrufen — der " +
        "Empfänger muss nichts tun, darf aber gern antworten. Aus dem Kampagnennamen " +
        "kannst du oft Ort und Rolle ablesen (z. B. 'Mitarbeiter-Lüdenscheid-Fachkraft' " +
        "→ Pflegefachkraft in Lüdenscheid) — nutze das für einen konkreten Bezug, aber " +
        "erfinde nichts darüber hinaus (kein Gehalt, keine Vertragsdetails, keine " +
        "Firmengeschichte). Ton: menschlich, respektvoll, kurz — 60 bis 100 Wörter, " +
        "Sie-Form, keine Floskeln-Kaskaden, keine Ausrufezeichen-Häufung, keine Emojis. " +
        `Anrede mit Vornamen ("Hallo Karolin,"), Grußformel: "${signature}".`,
      messages: [
        {
          role: "user",
          content:
            `Vorname: ${input.name ?? "unbekannt"}\n` +
            `Kampagne: ${input.campaignName ?? "unbekannt"}\n` +
            `Anzeige: ${input.adName ?? "unbekannt"}`,
        },
      ],
    });
    const parsed = response.parsed_output;
    if (!parsed?.subject || !parsed?.body) return null;
    return { subject: parsed.subject.slice(0, 120), body: parsed.body };
  } catch (err) {
    console.error("followup-ai: Entwurf fehlgeschlagen:", err);
    return null;
  }
}

/** Reiner Text → minimales HTML für den Versand (Absätze + Zeilenumbrüche). */
export function bodyToHtml(body: string): string {
  const esc = body
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
  return esc
    .split(/\n{2,}/)
    .map((p) => `<p>${p.replace(/\n/g, "<br>")}</p>`)
    .join("\n");
}
