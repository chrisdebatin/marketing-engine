import { NextResponse } from "next/server";
import { requireSession } from "@/lib/auth";
import { authUrl, outlookConfigured } from "@/lib/outlook";

export const runtime = "nodejs";

// Startet den OAuth-Flow (nur Admin): Weiterleitung zur Microsoft-Anmeldung.
export async function GET() {
  const session = await requireSession();
  if (!session.isAdmin) {
    return NextResponse.json({ error: "Nur für Admins." }, { status: 403 });
  }
  if (!outlookConfigured()) {
    return NextResponse.json(
      {
        error:
          "MS_CLIENT_ID/MS_CLIENT_SECRET fehlen — siehe .env.example (App-Registrierung im Microsoft-365-Portal).",
      },
      { status: 503 },
    );
  }
  return NextResponse.redirect(authUrl("connect"));
}
