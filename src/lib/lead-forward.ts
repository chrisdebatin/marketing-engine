import { deliverMail } from "@/lib/mailer";
import { buildPdf, type PdfZeile } from "@/lib/pdf";
import { bewerteBewerbung, rolleAusKampagne, SCORE_LABEL } from "@/lib/bewerber";

/**
 * Weiterleitung von Mitarbeiter-Leads (Recruiting) per E-Mail. SERVER ONLY.
 * Ziel-Postfach über LEAD_FORWARD_TO konfigurierbar; eine Mail pro Lead,
 * Idempotenz über meta_leads.forwarded_at (setzt der Aufrufer).
 */

/** Empfänger, kommagetrennt konfigurierbar (LEAD_FORWARD_TO). */
export const FORWARD_TO = (process.env.LEAD_FORWARD_TO || "recruiting@igsg.de")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

/**
 * Ziel für Bewerbungen über das Website-Kontaktformular (KI-erkannt) —
 * eigenes Postfach, konfigurierbar über RECRUITING_FORWARD_TO.
 */
export const RECRUITING_TO = (
  process.env.RECRUITING_FORWARD_TO || "recruiting@pflegeunion.de"
)
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

/** Mitarbeiter-Anfrage? Erkennung über den Kampagnennamen. */
export function isRecruitingLead(campaignName: string | null): boolean {
  if (!campaignName) return false;
  return /mitarbeiter|fachkraft|recruiting|stellen/i.test(campaignName);
}

interface Field {
  name?: string;
  values?: string[];
}

const esc = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

export async function forwardLead(lead: {
  id: string;
  campaign_name: string | null;
  ad_name: string | null;
  created_time: string | null;
  field_data: unknown;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const fields = Array.isArray(lead.field_data) ? (lead.field_data as Field[]) : [];
  const get = (needle: string) =>
    fields.find((f) => f.name?.toLowerCase().includes(needle))?.values?.[0] ?? null;
  const name = get("vorname") ?? get("name") ?? "(ohne Name)";
  const phone = get("telefon") ?? get("phone");
  const email = get("mail");

  const rows = [
    ["Name", esc(name)],
    ["Telefon", phone ? `<a href="tel:${esc(phone)}">${esc(phone)}</a>` : "–"],
    ["E-Mail", email ? `<a href="mailto:${esc(email)}">${esc(email)}</a>` : "–"],
    ["Kampagne", esc(lead.campaign_name ?? "–")],
    ["Anzeige", esc(lead.ad_name ?? "–")],
    [
      "Eingegangen",
      lead.created_time
        ? new Date(lead.created_time).toLocaleString("de-DE", {
            dateStyle: "medium",
            timeStyle: "short",
          })
        : "–",
    ],
    ...fields
      .filter((f) => !["name", "phone", "telefon", "mail"].some((k) => f.name?.toLowerCase().includes(k)))
      .map((f) => [esc(f.name?.replace(/_/g, " ") ?? "?"), esc(f.values?.join(", ") ?? "")]),
  ];

  const html =
    `<p>Neue Mitarbeiter-Anfrage über eine Meta-Anzeige — die Bewerbung liegt als PDF im Anhang.</p>` +
    `<table cellpadding="4" style="border-collapse:collapse">` +
    rows
      .map(
        ([k, v]) =>
          `<tr><td style="color:#666;padding-right:12px;vertical-align:top">${k}</td><td><strong>${v}</strong></td></tr>`,
      )
      .join("") +
    `</table>` +
    `<p style="color:#888;font-size:12px">Automatisch weitergeleitet von der Marketing-Engine (Lead ${esc(lead.id)}).</p>`;

  // PDF-Anhang: dieselben Daten als Dokument, damit die Bewerbung abgelegt
  // und weitergereicht werden kann, ohne im Tool nachzuschauen.
  const rolle = rolleAusKampagne(lead.campaign_name);
  const { score, grund } = bewerteBewerbung({ telefon: phone, email, rolle });
  const eingang = lead.created_time
    ? new Date(lead.created_time).toLocaleString("de-DE", {
        dateStyle: "medium",
        timeStyle: "short",
      })
    : "unbekannt";
  const zeilen: PdfZeile[] = [
    { text: "Bewerbung", art: "h1" },
    { text: name, art: "h2" },
    { text: "Kontaktdaten", art: "h2" },
    { text: "Name", art: "kv", wert: name },
    { text: "Telefon", art: "kv", wert: phone ?? "–" },
    { text: "E-Mail", art: "kv", wert: email ?? "–" },
    { text: "Herkunft", art: "h2" },
    { text: "Quelle", art: "kv", wert: "Meta-Anzeige" },
    { text: "Kampagne", art: "kv", wert: lead.campaign_name ?? "–" },
    { text: "Anzeige", art: "kv", wert: lead.ad_name ?? "–" },
    { text: "Beworbene Stelle", art: "kv", wert: rolle ?? "nicht erkennbar" },
    { text: "Eingegangen", art: "kv", wert: eingang },
    { text: "Vorsortierung", art: "h2" },
    { text: `${SCORE_LABEL[score]} — ${grund}` },
    {
      text:
        "Die Einstufung beruht ausschließlich auf den vorliegenden Daten " +
        "(Erreichbarkeit und beworbene Stelle). Das Meta-Formular liefert " +
        "keine Angaben zu Erfahrung oder Qualifikation — die Einstufung " +
        "ersetzt daher kein Gespräch.",
      art: "klein",
    },
  ];
  // Weitere Formularfelder anhängen, falls das Formular erweitert wurde.
  for (const f of fields) {
    const key = f.name?.toLowerCase() ?? "";
    if (["name", "phone", "telefon", "mail"].some((k) => key.includes(k))) continue;
    zeilen.push({
      text: (f.name ?? "?").replace(/_/g, " "),
      art: "kv",
      wert: f.values?.join(", ") ?? "",
    });
  }
  zeilen.push({
    text: `Lead-ID ${lead.id} · erzeugt von der Marketing-Engine`,
    art: "klein",
  });

  const dateiName = `Bewerbung_${name.replace(/[^\p{L}\p{N}]+/gu, "_").slice(0, 40)}.pdf`;

  return deliverMail({
    to: FORWARD_TO,
    subject: `Neue Mitarbeiter-Anfrage: ${name}${lead.campaign_name ? ` (${lead.campaign_name})` : ""}`,
    html,
    attachments: [
      {
        filename: dateiName,
        contentType: "application/pdf",
        content: buildPdf(zeilen),
      },
    ],
  });
}
