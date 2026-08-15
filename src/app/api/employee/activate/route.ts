import { NextResponse } from "next/server";
import {
  DEVICE_COOKIE,
  DEVICE_COOKIE_DAYS,
  activateWithCode,
  clientIp,
  cookieOptions,
} from "@/lib/employee/auth";
import { hashIp } from "@/lib/employee/crypto";
import {
  ACTIVATION_IP_RULE,
  isRateLimited,
  recordAttempt,
} from "@/lib/employee/rate-limit";
import { activationSchema, firstError } from "@/lib/employee/schemas";

export const runtime = "nodejs";

/**
 * Aktivierung: Einmal-Code einloesen und Geraet binden.
 *
 * Antwortet bei JEDEM Fehlschlag identisch ("Dieser Code ist nicht gueltig"),
 * damit sich nicht unterscheiden laesst, ob ein Code existiert, bereits
 * benutzt oder abgelaufen ist.
 */
export async function POST(req: Request) {
  const ipHash = hashIp(await clientIp());
  const bucket = `activation_ip:${ipHash ?? "unknown"}`;

  if (ipHash && (await isRateLimited(bucket, "activation", ACTIVATION_IP_RULE))) {
    return NextResponse.json(
      { error: "Zu viele Versuche. Bitte versuche es spaeter noch einmal." },
      { status: 429 },
    );
  }

  const body = await req.json().catch(() => null);
  const parsed = activationSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: firstError(parsed.error) }, { status: 400 });
  }

  const result = await activateWithCode(parsed.data.code);
  if (ipHash) await recordAttempt(bucket, "activation", result.ok);

  if (!result.ok) {
    return NextResponse.json(
      { error: "Dieser Code ist nicht gueltig. Bitte pruefe die Eingabe." },
      { status: 400 },
    );
  }

  // Das Geraete-Secret verlaesst den Server genau einmal — danach nur noch
  // als Hash in der DB. httpOnly: kein Zugriff aus JavaScript.
  const res = NextResponse.json({ ok: true });
  res.cookies.set(
    DEVICE_COOKIE,
    result.deviceSecret,
    cookieOptions(DEVICE_COOKIE_DAYS),
  );
  return res;
}
