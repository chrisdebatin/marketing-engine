import { NextResponse } from "next/server";
import {
  SESSION_COOKIE,
  SESSION_COOKIE_DAYS,
  clientIp,
  cookieOptions,
  readDeviceSecret,
  remainingPinAttempts,
  verifyPinLogin,
} from "@/lib/employee/auth";
import { hashIp } from "@/lib/employee/crypto";
import { PIN_IP_RULE, isRateLimited } from "@/lib/employee/rate-limit";
import { firstError, pinSchema } from "@/lib/employee/schemas";

export const runtime = "nodejs";

/**
 * PIN-Login. Der Mitarbeiter wird ueber das Geraete-Secret identifiziert,
 * NICHT ueber eine Kennung im Request — deshalb gibt es keinen Weg, PINs aus
 * der Ferne gegen fremde Konten zu raten.
 */
export async function POST(req: Request) {
  const deviceSecret = await readDeviceSecret();
  if (!deviceSecret) {
    return NextResponse.json(
      { error: "Dieses Geraet ist nicht aktiviert.", code: "no_device" },
      { status: 401 },
    );
  }

  const ipHash = hashIp(await clientIp());
  if (ipHash && (await isRateLimited(`ip:${ipHash}`, "pin", PIN_IP_RULE))) {
    return NextResponse.json(
      { error: "Zu viele Versuche. Bitte versuche es spaeter noch einmal." },
      { status: 429 },
    );
  }

  const body = await req.json().catch(() => null);
  const parsed = pinSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: firstError(parsed.error) }, { status: 400 });
  }

  const result = await verifyPinLogin(deviceSecret, parsed.data.pin, ipHash);

  if (!result.ok && result.reason === "locked") {
    const seconds = Math.max(
      0,
      Math.ceil((new Date(result.until).getTime() - Date.now()) / 1000),
    );
    return NextResponse.json(
      {
        error: "Zu viele Versuche.",
        code: "locked",
        retry_after: seconds,
      },
      { status: 423 },
    );
  }

  if (!result.ok && result.reason === "no_device") {
    return NextResponse.json(
      { error: "Dieses Geraet ist nicht aktiviert.", code: "no_device" },
      { status: 401 },
    );
  }

  if (!result.ok) {
    const left = await remainingPinAttempts(deviceSecret);
    return NextResponse.json(
      { error: "Falsche PIN.", code: "invalid", attempts_left: left },
      { status: 401 },
    );
  }

  const res = NextResponse.json({ ok: true });
  res.cookies.set(
    SESSION_COOKIE,
    result.sessionToken,
    cookieOptions(SESSION_COOKIE_DAYS),
  );
  return res;
}
