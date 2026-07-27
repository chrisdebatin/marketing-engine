import { NextResponse } from "next/server";
import { mailConfigured } from "@/lib/mailer";
import { sendMdUpdates, sendPdlReminders } from "@/lib/weekly-mails";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 120;

/**
 * Wochen-Cron (Montagmorgen, siehe vercel.json): verschickt die MD-Updates
 * und die PDL-Reminder über das verbundene Outlook-Konto.
 *
 * Vercel ruft die Route mit `Authorization: Bearer $CRON_SECRET` auf,
 * sobald die Env-Variable CRON_SECRET gesetzt ist.
 */
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return NextResponse.json(
      { error: "CRON_SECRET ist nicht gesetzt — Cron deaktiviert." },
      { status: 503 },
    );
  }
  if (req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Nicht erlaubt." }, { status: 401 });
  }
  if (!mailConfigured()) {
    return NextResponse.json(
      { error: "Kein Mail-Versandweg eingerichtet (Outlook oder SMTP)." },
      { status: 503 },
    );
  }

  const md = await sendMdUpdates();
  const pdl = await sendPdlReminders();
  return NextResponse.json({ md, pdl });
}
