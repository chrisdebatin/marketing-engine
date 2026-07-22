import { NextResponse } from "next/server";
import { requireSession } from "@/lib/auth";
import { exchangeCodeAndStore } from "@/lib/outlook";

export const runtime = "nodejs";

// OAuth-Callback: Code eintauschen, Refresh-Token speichern, zurück zum Admin.
export async function GET(req: Request) {
  const session = await requireSession();
  const url = new URL(req.url);
  const base = process.env.NEXT_PUBLIC_APP_URL ?? url.origin;

  if (!session.isAdmin) {
    return NextResponse.redirect(`${base}/admin?outlook=forbidden`);
  }

  const code = url.searchParams.get("code");
  if (!code) {
    return NextResponse.redirect(`${base}/admin?outlook=abgebrochen`);
  }

  const result = await exchangeCodeAndStore(code);
  if (!result.ok) {
    console.error("outlook callback:", result.error);
    return NextResponse.redirect(`${base}/admin?outlook=fehler`);
  }
  return NextResponse.redirect(`${base}/admin?outlook=verbunden`);
}
