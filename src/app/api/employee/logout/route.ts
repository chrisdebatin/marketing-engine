import { NextResponse } from "next/server";
import {
  SESSION_COOKIE,
  requireEmployee,
  revokeSession,
} from "@/lib/employee/auth";

export const runtime = "nodejs";

/**
 * Abmelden. Die Session wird serverseitig entwertet — ein abgefangenes
 * Cookie ist danach wertlos (deshalb opake Tokens statt JWT).
 * Das Geraete-Cookie bleibt: der Mitarbeiter meldet sich wieder per PIN an.
 */
export async function POST() {
  const ctx = await requireEmployee();
  if (ctx) await revokeSession(ctx.sessionId);

  const res = NextResponse.json({ ok: true });
  res.cookies.set(SESSION_COOKIE, "", { path: "/", maxAge: 0 });
  return res;
}
