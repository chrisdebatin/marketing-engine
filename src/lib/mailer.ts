import nodemailer from "nodemailer";
import { getAccessToken, outlookConfigured, sendMail as sendGraphMail } from "@/lib/outlook";

/**
 * Mail-Versand mit zwei Wegen, automatisch gewählt:
 * 1. Outlook/Graph, wenn ein Konto verbunden ist (Azure-App-Registrierung).
 * 2. SMTP (z. B. Gmail mit App-Passwort) — der einfache Weg ohne Azure:
 *    SMTP_HOST / SMTP_PORT / SMTP_USER / SMTP_PASS / SMTP_FROM in den
 *    Env-Variablen setzen (siehe .env.example).
 *
 * Gelesen (Postfach-Seite) wird weiterhin nur über Outlook/Graph.
 */

export function smtpConfigured(): boolean {
  return Boolean(
    process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS,
  );
}

/** Ist irgendein Versandweg eingerichtet (Outlook-App oder SMTP)? */
export function mailConfigured(): boolean {
  return outlookConfigured() || smtpConfigured();
}

/** Dateianhang — content ist base64-kodiert (wie von Graph erwartet). */
export interface MailAttachment {
  filename: string;
  contentType: string;
  /** base64 */
  content: string;
}

async function sendViaSmtp(input: {
  to: string[];
  subject: string;
  html: string;
  attachments?: MailAttachment[];
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const port = Number(process.env.SMTP_PORT || 465);
  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port,
    secure: port === 465,
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });
  try {
    await transporter.sendMail({
      from: process.env.SMTP_FROM || process.env.SMTP_USER,
      to: input.to.join(", "),
      subject: input.subject,
      html: input.html,
      ...(input.attachments?.length
        ? {
            attachments: input.attachments.map((a) => ({
              filename: a.filename,
              content: Buffer.from(a.content, "base64"),
              contentType: a.contentType,
            })),
          }
        : {}),
    });
    return { ok: true };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "SMTP-Fehler";
    console.error("mailer: SMTP-Versand fehlgeschlagen:", msg);
    return { ok: false, error: `SMTP-Versand fehlgeschlagen: ${msg.slice(0, 120)}` };
  }
}

/**
 * Mail senden — bevorzugt über das verbundene Outlook-Konto, sonst SMTP.
 */
export async function deliverMail(input: {
  to: string[];
  subject: string;
  html: string;
  attachments?: MailAttachment[];
}): Promise<{ ok: true; via: "outlook" | "smtp" } | { ok: false; error: string }> {
  if (outlookConfigured() && (await getAccessToken())) {
    const res = await sendGraphMail(input);
    if (res.ok) return { ok: true, via: "outlook" };
    // Outlook kaputt, aber SMTP da → durchfallen und SMTP versuchen.
    if (!smtpConfigured()) return res;
  }
  if (smtpConfigured()) {
    const res = await sendViaSmtp(input);
    return res.ok ? { ok: true, via: "smtp" } : res;
  }
  return {
    ok: false,
    error:
      "Kein Versandweg eingerichtet — Outlook verbinden oder SMTP-Zugangsdaten setzen.",
  };
}
