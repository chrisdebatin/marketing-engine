import "server-only";

import { cookies, headers } from "next/headers";
import { empDb } from "@/lib/employee/db";
import {
  DEVICE_MAX_FAILURES,
  lockoutMinutes,
  recordAttempt,
} from "@/lib/employee/rate-limit";
import {
  generateToken,
  hashActivationCode,
  hashIp,
  hashPin,
  hashToken,
  isWeakPin,
  isWellFormedActivationCode,
  normalizeActivationCode,
  verifyPin,
} from "@/lib/employee/crypto";
import type { Staff } from "@/lib/types";

/**
 * Authentifizierung der Mitarbeiter-App.
 *
 * Modell (bewusst nicht Supabase Auth — Mitarbeiter haben keine E-Mail):
 *
 *   1. Aktivierung: Einmal-Code (von der Hubleitung) -> bindet ein GERAET.
 *      Das Geraet erhaelt ein 32-Byte-Secret (nur als Hash gespeichert).
 *   2. PIN: entsperrt NUR dieses Geraet. Es gibt keinen Endpunkt, der
 *      (Mitarbeiter-Kennung + PIN) akzeptiert — deshalb kann niemand aus der
 *      Ferne PINs gegen fremde Konten raten. Das ist der Kern des Modells:
 *      6 Ziffern waeren als globales Passwort viel zu schwach.
 *   3. Session: opakes Token, nur als Hash in der DB, im httpOnly-Cookie.
 *
 * Wiederherstellung (Geraet verloren / PIN vergessen): NUR ueber einen neuen
 * Aktivierungscode der Hubleitung. Ein Self-Service-Reset ueber eine
 * Mitarbeiter-Kennung wuerde exakt die Luecke wieder oeffnen, die die
 * Geraetebindung schliesst.
 */

export const DEVICE_COOKIE = "emp_device";
export const SESSION_COOKIE = "emp_session";

const SESSION_DAYS = 30;
const DEVICE_DAYS = 365;

export interface EmployeeContext {
  staff: Staff;
  staffId: string;
  deviceId: string;
  sessionId: string;
}

/* ------------------------------------------------------------------
 * Aktivierung
 * ------------------------------------------------------------------ */

export type ActivationResult =
  | { ok: true; staffId: string; deviceSecret: string }
  | { ok: false; reason: "invalid" | "rate_limited" };

/**
 * Loest einen Aktivierungscode ein und bindet ein neues Geraet.
 *
 * Wichtig: Der Code wird per bedingtem UPDATE entwertet
 * (`.is("used_at", null)`), nicht per read-then-write. Zwei Geraete, die
 * gleichzeitig denselben Code einloesen, koennen so nicht beide gewinnen —
 * die Datenbank entscheidet, nicht die Anwendung.
 *
 * Alle Fehlerfaelle liefern denselben Grund ("invalid"), damit der Aufrufer
 * keine Rueckschluesse ermoeglicht (existiert der Code? ist er schon benutzt?
 * ist der Mitarbeiter gesperrt?).
 */
export async function activateWithCode(
  rawCode: string,
): Promise<ActivationResult> {
  const normalized = normalizeActivationCode(rawCode);
  if (!isWellFormedActivationCode(normalized)) {
    return { ok: false, reason: "invalid" };
  }

  const db = empDb();
  const codeHash = hashActivationCode(normalized);

  // Atomar entwerten: nur wenn noch unbenutzt und nicht abgelaufen.
  const { data: claimed } = await db
    .from("activation_codes")
    .update({ used_at: new Date().toISOString() })
    .eq("code_hash", codeHash)
    .is("used_at", null)
    .gt("expires_at", new Date().toISOString())
    .select("id, staff_id");

  const row = claimed?.[0];
  if (!row) return { ok: false, reason: "invalid" };

  // Mitarbeiter muss aktivierbar sein.
  const { data: staff } = await db
    .from("staff")
    .select("id, status")
    .eq("id", row.staff_id)
    .maybeSingle();

  if (!staff || staff.status === "gesperrt" || staff.status === "ausgeschieden") {
    return { ok: false, reason: "invalid" };
  }

  // Geraet anlegen. Das Secret verlaesst den Server genau einmal.
  const deviceSecret = generateToken();
  const { data: device } = await db
    .from("devices")
    .insert({
      staff_id: staff.id,
      secret_hash: hashToken(deviceSecret),
      label: await deviceLabel(),
    })
    .select("id")
    .single();

  if (!device) {
    // Der Code ist oben bereits entwertet. Schlaegt das Anlegen des Geraets
    // fehl, waere der Mitarbeiter sonst dauerhaft ausgesperrt und braeuchte
    // einen Admin — deshalb die Entwertung zuruecknehmen.
    await db
      .from("activation_codes")
      .update({ used_at: null })
      .eq("id", row.id);
    return { ok: false, reason: "invalid" };
  }

  await db
    .from("staff")
    .update({ status: "aktiv" })
    .eq("id", staff.id)
    .eq("status", "eingeladen");

  await logAudit(staff.id, "activation_used", { ziel_id: device.id });
  return { ok: true, staffId: staff.id, deviceSecret };
}

/* ------------------------------------------------------------------
 * PIN setzen / pruefen
 * ------------------------------------------------------------------ */

export type SetPinResult =
  | { ok: true; sessionToken: string }
  | { ok: false; reason: "weak" | "no_device" };

/** Setzt die PIN fuer das per Cookie identifizierte Geraet. */
export async function setPinForDevice(
  deviceSecret: string,
  pin: string,
): Promise<SetPinResult> {
  if (isWeakPin(pin)) return { ok: false, reason: "weak" };

  const db = empDb();
  const { data: device } = await db
    .from("devices")
    .select("id, staff_id, revoked_at")
    .eq("secret_hash", hashToken(deviceSecret))
    .is("revoked_at", null)
    .maybeSingle();

  if (!device) return { ok: false, reason: "no_device" };

  await db
    .from("devices")
    .update({
      pin_hash: hashPin(pin),
      pin_set_at: new Date().toISOString(),
      failed_count: 0,
      locked_until: null,
    })
    .eq("id", device.id);

  await logAudit(device.staff_id, "pin_set", { ziel_id: device.id });

  const sessionToken = await createSession(device.staff_id, device.id);
  return { ok: true, sessionToken };
}

export type LoginResult =
  | { ok: true; sessionToken: string }
  | { ok: false; reason: "invalid" }
  | { ok: false; reason: "locked"; until: string }
  | { ok: false; reason: "no_device" };

/**
 * Prueft die PIN gegen das gebundene Geraet.
 *
 * Der Mitarbeiter wird ueber das Geraete-Secret identifiziert, nicht ueber
 * eine Kennung im Request. Ohne gueltiges Geraet gibt es keinen Login-Pfad.
 */
export async function verifyPinLogin(
  deviceSecret: string,
  pin: string,
  ipHash: string | null,
): Promise<LoginResult> {
  const db = empDb();
  const { data: device } = await db
    .from("devices")
    .select(
      "id, staff_id, pin_hash, failed_count, lock_count, locked_until, revoked_at",
    )
    .eq("secret_hash", hashToken(deviceSecret))
    .is("revoked_at", null)
    .maybeSingle();

  if (!device || !device.pin_hash) return { ok: false, reason: "no_device" };

  // Lockout aktiv? Auch die RICHTIGE PIN wird waehrend der Sperre abgelehnt.
  if (device.locked_until && new Date(device.locked_until) > new Date()) {
    return { ok: false, reason: "locked", until: device.locked_until };
  }

  // Mitarbeiter zwischenzeitlich gesperrt/ausgeschieden?
  const { data: staff } = await db
    .from("staff")
    .select("status")
    .eq("id", device.staff_id)
    .maybeSingle();
  if (!staff || staff.status === "gesperrt" || staff.status === "ausgeschieden") {
    return { ok: false, reason: "invalid" };
  }

  const good = verifyPin(pin, device.pin_hash);

  if (ipHash) await recordAttempt(`ip:${ipHash}`, "pin", good);

  if (!good) {
    const failed = device.failed_count + 1;

    if (failed >= DEVICE_MAX_FAILURES) {
      // Sperren: failed_count zurueck auf 0, lock_count hoch. Die Dauer
      // richtet sich nach der Anzahl der SPERREN, nicht nach der Anzahl der
      // Fehlversuche — sonst braeuchte es nach der ersten Sperre nur noch
      // einen einzigen Fehlversuch fuer die naechste (gleich kurze) Sperre.
      const lockCount = device.lock_count + 1;
      const until = new Date(
        Date.now() + lockoutMinutes(lockCount) * 60_000,
      ).toISOString();
      await db
        .from("devices")
        .update({ failed_count: 0, lock_count: lockCount, locked_until: until })
        .eq("id", device.id);
      await logAudit(device.staff_id, "pin_locked", {
        ziel_id: device.id,
        meta: { lock_count: lockCount },
      });
      return { ok: false, reason: "locked", until };
    }

    await db
      .from("devices")
      .update({ failed_count: failed })
      .eq("id", device.id);
    await logAudit(device.staff_id, "login_fail", { ziel_id: device.id });
    return { ok: false, reason: "invalid" };
  }

  // Erfolg: Zaehler UND Sperrhistorie zuruecksetzen.
  await db
    .from("devices")
    .update({
      failed_count: 0,
      lock_count: 0,
      locked_until: null,
      last_seen_at: new Date().toISOString(),
    })
    .eq("id", device.id);

  await logAudit(device.staff_id, "login_ok", { ziel_id: device.id });
  const sessionToken = await createSession(device.staff_id, device.id);
  return { ok: true, sessionToken };
}

/** Verbleibende Versuche bis zur Sperre — nur fuer die UI-Anzeige. */
export async function remainingPinAttempts(
  deviceSecret: string,
): Promise<number | null> {
  const { data } = await empDb()
    .from("devices")
    .select("failed_count")
    .eq("secret_hash", hashToken(deviceSecret))
    .is("revoked_at", null)
    .maybeSingle();
  if (!data) return null;
  // failed_count wird beim Sperren auf 0 gesetzt, deshalb kein Modulo noetig.
  return Math.max(0, DEVICE_MAX_FAILURES - data.failed_count);
}

/* ------------------------------------------------------------------
 * Sessions
 * ------------------------------------------------------------------ */

async function createSession(
  staffId: string,
  deviceId: string,
): Promise<string> {
  const token = generateToken();
  await empDb()
    .from("sessions")
    .insert({
      staff_id: staffId,
      device_id: deviceId,
      token_hash: hashToken(token),
      expires_at: new Date(Date.now() + SESSION_DAYS * 86_400_000).toISOString(),
    });
  return token;
}

/**
 * Die EINZIGE Quelle fuer die Identitaet eines Mitarbeiters.
 *
 * Jede /api/employee/*-Route muss die staff_id hierueber beziehen. Wird sie
 * stattdessen aus dem Request gelesen, entsteht sofort eine vollstaendige
 * IDOR — der Service-Role-Client kennt keinen Zeilenschutz.
 *
 * Gibt null zurueck (nicht: wirft), damit Aufrufer bewusst 401 antworten.
 */
export async function requireEmployee(): Promise<EmployeeContext | null> {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (!token) return null;

  const db = empDb();
  const nowIso = new Date().toISOString();

  const { data: session } = await db
    .from("sessions")
    .select("id, staff_id, device_id, expires_at, revoked_at")
    .eq("token_hash", hashToken(token))
    .is("revoked_at", null)
    .gt("expires_at", nowIso)
    .maybeSingle();

  if (!session) return null;

  // Geraet muss weiterhin gueltig sein (Admin kann es widerrufen).
  const { data: device } = await db
    .from("devices")
    .select("id, revoked_at")
    .eq("id", session.device_id)
    .is("revoked_at", null)
    .maybeSingle();
  if (!device) return null;

  // Mitarbeiter muss weiterhin aktiv sein — greift beim NAECHSTEN Request,
  // nicht erst beim Ablauf der Session.
  const { data: staff } = await db
    .from("staff")
    .select("*")
    .eq("id", session.staff_id)
    .maybeSingle();

  if (!staff || staff.status === "gesperrt" || staff.status === "ausgeschieden") {
    return null;
  }

  // last_seen_at hoechstens alle 5 Minuten schreiben (spart einen Write
  // pro Request, ohne die Sitzungsverfolgung nennenswert zu verschlechtern).
  // Fehlerbehandlung explizit auch fuer den Reject-Pfad: ohne den zweiten
  // Callback wuerde ein Netzwerkfehler eine unbehandelte Promise-Rejection
  // erzeugen (und den Prozess je nach Node-Konfiguration beenden).
  void db
    .from("sessions")
    .update({ last_seen_at: nowIso })
    .eq("id", session.id)
    .lt("last_seen_at", new Date(Date.now() - 300_000).toISOString())
    .then(
      () => undefined,
      () => undefined,
    );

  return {
    staff: staff as Staff,
    staffId: staff.id,
    deviceId: session.device_id,
    sessionId: session.id,
  };
}

/** Meldet die aktuelle Session ab. */
export async function revokeSession(sessionId: string): Promise<void> {
  await empDb()
    .from("sessions")
    .update({ revoked_at: new Date().toISOString(), revoked_reason: "logout" })
    .eq("id", sessionId);
}

/** Meldet alle Sessions eines Mitarbeiters ab (z. B. bei Geraeteverlust). */
export async function revokeAllSessions(
  staffId: string,
  reason: string,
): Promise<void> {
  await empDb()
    .from("sessions")
    .update({ revoked_at: new Date().toISOString(), revoked_reason: reason })
    .eq("staff_id", staffId)
    .is("revoked_at", null);
}

/* ------------------------------------------------------------------
 * Cookies
 * ------------------------------------------------------------------ */

/**
 * Cookie-Optionen. SameSite=Lax + httpOnly; Secure nur in Produktion, damit
 * die lokale Entwicklung ueber http funktioniert.
 *
 * Fuer Capacitor: Das WebView laedt von der https-Origin, Cookies greifen
 * also. Zusaetzlich akzeptieren die Routen einen Authorization-Bearer —
 * siehe readDeviceSecret/readSessionToken.
 */
export function cookieOptions(maxAgeDays: number) {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    maxAge: maxAgeDays * 86_400,
  };
}

export const SESSION_COOKIE_DAYS = SESSION_DAYS;
export const DEVICE_COOKIE_DAYS = DEVICE_DAYS;

/**
 * Liest das Geraete-Secret — ausschliesslich aus dem httpOnly-Cookie.
 *
 * Bewusst KEIN Header-Fallback: ein `x-emp-device`-Header wuerde ein
 * cookie-gebundenes Geheimnis in einen frei setzbaren Request-Header
 * verwandeln (SameSite waere wirkungslos, Replay aus beliebigen Werkzeugen
 * moeglich). Fuer Capacitor wird das erst gebraucht, wenn WKWebView-Cookies
 * tatsaechlich Probleme machen — dann bitte bewusst und mit Origin-Pruefung
 * nachruesten, nicht auf Vorrat. Siehe docs/mitarbeiter-app.md.
 */
export async function readDeviceSecret(): Promise<string | null> {
  const jar = await cookies();
  return jar.get(DEVICE_COOKIE)?.value ?? null;
}

/* ------------------------------------------------------------------
 * Audit
 * ------------------------------------------------------------------ */

/**
 * Sicherheitsrelevante Ereignisse protokollieren.
 * DSGVO: niemals Codes, PINs, Tokens oder Roh-IPs hineinschreiben.
 */
export async function logAudit(
  staffId: string | null,
  art: string,
  extra: { ziel_art?: string; ziel_id?: string; meta?: Record<string, unknown> } = {},
): Promise<void> {
  try {
    const ip = await clientIp();
    await empDb().from("audit_events").insert({
      staff_id: staffId,
      art,
      ziel_art: extra.ziel_art ?? null,
      ziel_id: extra.ziel_id ?? null,
      ip_hash: hashIp(ip),
      meta: extra.meta ?? {},
    });
  } catch {
    // Audit darf den Hauptpfad nie blockieren.
  }
}

export async function clientIp(): Promise<string | null> {
  const h = await headers();
  const fwd = h.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0].trim();
  return h.get("x-real-ip");
}

async function deviceLabel(): Promise<string | null> {
  const h = await headers();
  const ua = h.get("user-agent") ?? "";
  if (/iPhone/i.test(ua)) return "iPhone";
  if (/iPad/i.test(ua)) return "iPad";
  if (/Android/i.test(ua)) return "Android";
  return "Smartphone";
}
