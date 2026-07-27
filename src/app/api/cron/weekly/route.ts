import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Automatischer Wochen-Versand ist DEAKTIVIERT — alle Mails (MD-Updates,
 * PDL-Wochen-Plan, Gruppen-Report) werden manuell im Kommunikations-Tab
 * geprüft und freigegeben. Der Endpoint bleibt als Hinweis bestehen,
 * falls noch ein alter Vercel-Cron konfiguriert ist.
 */
export async function GET() {
  return NextResponse.json({
    status: "deaktiviert",
    hinweis:
      "Kein automatischer Versand — Mails werden unter /kommunikation manuell freigegeben.",
  });
}
