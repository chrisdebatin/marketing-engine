import { NextResponse } from "next/server";
import { mailConfigured } from "@/lib/mailer";
import { sendGroupReport, sendPdlReminders } from "@/lib/weekly-mails";

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

  // MD-Updates werden NICHT automatisch versendet — sie liegen als Entwürfe
  // im Kommunikations-Tab und gehen erst nach Freigabe raus.
  const pdl = await sendPdlReminders();
  const gruppe = await sendGroupReport();
  return NextResponse.json({
    md: "Entwürfe unter /kommunikation — Versand nur nach Freigabe.",
    pdl,
    gruppe,
  });
}
