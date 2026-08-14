import { deliverMail } from "@/lib/mailer";

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
    `<p>Neue Mitarbeiter-Anfrage über eine Meta-Anzeige:</p>` +
    `<table cellpadding="4" style="border-collapse:collapse">` +
    rows
      .map(
        ([k, v]) =>
          `<tr><td style="color:#666;padding-right:12px;vertical-align:top">${k}</td><td><strong>${v}</strong></td></tr>`,
      )
      .join("") +
    `</table>` +
    `<p style="color:#888;font-size:12px">Automatisch weitergeleitet von der Marketing-Engine (Lead ${esc(lead.id)}).</p>`;

  return deliverMail({
    to: FORWARD_TO,
    subject: `Neue Mitarbeiter-Anfrage: ${name}${lead.campaign_name ? ` (${lead.campaign_name})` : ""}`,
    html,
  });
}
