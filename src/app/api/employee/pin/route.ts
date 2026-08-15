import { NextResponse } from "next/server";
import {
  SESSION_COOKIE,
  SESSION_COOKIE_DAYS,
  cookieOptions,
  readDeviceSecret,
  setPinForDevice,
} from "@/lib/employee/auth";
import { firstError, pinSchema } from "@/lib/employee/schemas";

export const runtime = "nodejs";

/**
 * PIN erstmalig setzen. Nur moeglich mit einem gueltigen Geraete-Cookie aus
 * der Aktivierung — es gibt keinen Weg, hier eine fremde Kennung anzugeben.
 */
export async function POST(req: Request) {
  const deviceSecret = await readDeviceSecret();
  if (!deviceSecret) {
    return NextResponse.json(
      { error: "Dieses Geraet ist nicht aktiviert." },
      { status: 401 },
    );
  }

  const body = await req.json().catch(() => null);
  const parsed = pinSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: firstError(parsed.error) }, { status: 400 });
  }

  const result = await setPinForDevice(deviceSecret, parsed.data.pin);

  if (!result.ok && result.reason === "weak") {
    return NextResponse.json(
      {
        error:
          "Diese PIN ist zu leicht zu erraten. Bitte waehle eine andere — " +
          "keine Folgen wie 123456 und kein Geburtsdatum.",
      },
      { status: 400 },
    );
  }
  if (!result.ok) {
    return NextResponse.json(
      { error: "Dieses Geraet ist nicht aktiviert." },
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
