import { ImapFlow } from "imapflow";
import { simpleParser } from "mailparser";

/**
 * IMAP-Lead-Eingang (SERVER ONLY) — Alternative zum Outlook-Postfach, wenn
 * kein Microsoft-Admin-Zugang existiert: ein eigenes Gmail-Konto (z. B.
 * pflegeunion.leads@gmail.com) mit App-Passwort. Recare & Co. werden dorthin
 * weitergeleitet; die App holt ungelesene Mails ab und markiert sie gelesen.
 *
 * Env: LEADS_IMAP_USER (Gmail-Adresse), LEADS_IMAP_PASS (App-Passwort),
 * optional LEADS_IMAP_HOST (Default imap.gmail.com) und LEADS_IMAP_FOLDER
 * (Default INBOX) — mit einem Gmail-Filter "recare → Label leads" liest die
 * App NUR dieses Label und lässt den restlichen Posteingang unangetastet.
 */

export interface InboundMail {
  id: string;
  subject: string;
  fromAddress: string;
  receivedAt: string;
  text: string;
}

export function imapConfigured(): boolean {
  return Boolean(process.env.LEADS_IMAP_USER && process.env.LEADS_IMAP_PASS);
}

/** Ungelesene Mails abrufen und als gelesen markieren (idempotenter Eingang). */
export async function fetchUnseenMails(limit = 20): Promise<InboundMail[]> {
  const client = new ImapFlow({
    host: process.env.LEADS_IMAP_HOST || "imap.gmail.com",
    port: 993,
    secure: true,
    auth: {
      user: process.env.LEADS_IMAP_USER!,
      pass: process.env.LEADS_IMAP_PASS!,
    },
    logger: false,
  });

  const folder = process.env.LEADS_IMAP_FOLDER || "INBOX";
  const mails: InboundMail[] = [];
  await client.connect();
  try {
    const lock = await client.getMailboxLock(folder);
    try {
      const unseen = await client.search({ seen: false });
      const uids = (Array.isArray(unseen) ? unseen : []).slice(-limit);
      for (const uid of uids) {
        const msg = await client.fetchOne(uid, { source: true });
        if (!msg || !("source" in msg) || !msg.source) continue;
        const parsed = await simpleParser(msg.source);
        mails.push({
          id:
            parsed.messageId ??
            `${process.env.LEADS_IMAP_USER}-${uid}-${parsed.date?.toISOString() ?? ""}`,
          subject: parsed.subject ?? "(kein Betreff)",
          fromAddress: parsed.from?.value?.[0]?.address?.toLowerCase() ?? "",
          receivedAt: (parsed.date ?? new Date()).toISOString(),
          text: (parsed.text ?? parsed.html ?? "").toString().slice(0, 20000),
        });
        await client.messageFlagsAdd(uid, ["\\Seen"]);
      }
    } finally {
      lock.release();
    }
  } finally {
    await client.logout().catch(() => {});
  }
  return mails;
}
