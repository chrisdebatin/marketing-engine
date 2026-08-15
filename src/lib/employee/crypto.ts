/**
 * Krypto-Primitive der Mitarbeiter-App.
 *
 * Bewusst nur node:crypto — kein bcrypt/argon2. Begruendung:
 *  - Aktivierungscodes haben ~49,6 Bit Entropie. Gegen Offline-Angriffe hilft
 *    dort die Entropie, nicht eine langsame KDF. Wir brauchen den Code aber
 *    per Index nachschlagbar -> deterministischer HMAC mit serverseitigem
 *    Pepper (ein Zufalls-Salt-Hash waere nicht suchbar).
 *  - Die PIN ist mit 6 Ziffern schwach, aber sie ist an ein Geraet gebunden
 *    (siehe devices.secret_hash). Online-Versuche sind dadurch und durch das
 *    Lockout begrenzt; scrypt schuetzt zusaetzlich gegen einen DB-Dump.
 *  - Kein natives Modul = kein node-gyp-Risiko auf Vercel.
 *
 * Diese Datei ist rein funktional (keine DB, kein Request) und damit direkt
 * unit-testbar — siehe crypto.test.ts.
 */
import {
  createHmac,
  randomBytes,
  randomInt,
  scryptSync,
  timingSafeEqual,
} from "node:crypto";

/* ------------------------------------------------------------------
 * Aktivierungscodes
 * ------------------------------------------------------------------ */

/**
 * Alphabet ohne verwechselbare Zeichen: kein I, L, O, U, 0, 1.
 * (U ist raus, damit versehentlich keine unerwuenschten Woerter entstehen.)
 * 30 Zeichen ^ 10 Stellen  ->  ca. 49,1 Bit.
 */
export const CODE_ALPHABET = "ABCDEFGHJKMNPQRSTVWXYZ23456789";
export const CODE_LENGTH = 10;

/** Erzeugt einen Code in Gruppen zu 4: "ABCD-EFGH-JK". */
export function generateActivationCode(): string {
  let raw = "";
  for (let i = 0; i < CODE_LENGTH; i++) {
    // randomInt ist CSPRNG-basiert und modulo-bias-frei.
    raw += CODE_ALPHABET[randomInt(CODE_ALPHABET.length)];
  }
  return formatActivationCode(raw);
}

/** "ABCDEFGHJK" -> "ABCD-EFGH-JK" (nur Darstellung). */
export function formatActivationCode(raw: string): string {
  return (raw.match(/.{1,4}/g) ?? []).join("-");
}

/**
 * Normalisiert Nutzereingaben: Gross-/Kleinschreibung, Leerzeichen und
 * Bindestriche sind egal. Verwechselbare Zeichen werden auf das Alphabet
 * gemappt (0->O ist hier NICHT moeglich, da O nicht im Alphabet ist —
 * stattdessen 0->Q waere Raten. Wir mappen nur eindeutige Faelle:
 * I/L -> J und O -> Q waeren Raten, deshalb bewusst NICHT gemappt.)
 *
 * Es werden ausschliesslich Zeichen entfernt, die reine Formatierung sind.
 * Enthaelt die Eingabe echte Fremdzeichen, bleibt sie ungueltig und der
 * Aufrufer zeigt eine "bitte pruefen"-Meldung statt zu raten.
 */
export function normalizeActivationCode(input: string): string {
  return (input ?? "").toUpperCase().replace(/[\s-]/g, "");
}

/** Prueft nur die Form, nicht die Existenz. */
export function isWellFormedActivationCode(normalized: string): boolean {
  if (normalized.length !== CODE_LENGTH) return false;
  for (const ch of normalized) {
    if (!CODE_ALPHABET.includes(ch)) return false;
  }
  return true;
}

/**
 * Deterministischer, suchbarer Hash. Der Pepper liegt ausschliesslich in der
 * Umgebung — ein reiner DB-Dump ist damit wertlos.
 */
export function hashActivationCode(normalized: string): string {
  return createHmac("sha256", requireSecret("EMPLOYEE_CODE_PEPPER"))
    .update(normalized)
    .digest("hex");
}

/** Letzte zwei Zeichen — nur als Abgleichshilfe fuer den Admin am Telefon. */
export function activationCodeHint(normalized: string): string {
  return normalized.slice(-2);
}

/* ------------------------------------------------------------------
 * PIN (scrypt)
 * ------------------------------------------------------------------ */

const SCRYPT_N = 16384;
const SCRYPT_R = 8;
const SCRYPT_P = 1;
const SCRYPT_KEYLEN = 64;

/** Format: scrypt$<salt-hex>$<hash-hex>. Salt ist pro PIN zufaellig. */
export function hashPin(pin: string): string {
  const salt = randomBytes(16);
  const hash = scryptSync(pin.normalize("NFKC"), salt, SCRYPT_KEYLEN, {
    N: SCRYPT_N,
    r: SCRYPT_R,
    p: SCRYPT_P,
  });
  return `scrypt$${salt.toString("hex")}$${hash.toString("hex")}`;
}

/** Konstantzeit-Vergleich. Gibt bei kaputtem Hash-Format false zurueck. */
export function verifyPin(pin: string, stored: string | null): boolean {
  if (!stored) return false;
  const parts = stored.split("$");
  if (parts.length !== 3 || parts[0] !== "scrypt") return false;

  const salt = Buffer.from(parts[1], "hex");
  const expected = Buffer.from(parts[2], "hex");
  if (salt.length === 0 || expected.length !== SCRYPT_KEYLEN) return false;

  const actual = scryptSync(pin.normalize("NFKC"), salt, SCRYPT_KEYLEN, {
    N: SCRYPT_N,
    r: SCRYPT_R,
    p: SCRYPT_P,
  });
  return timingSafeEqual(actual, expected);
}

/**
 * Schwache PINs ablehnen. 6 Ziffern sind nur ~10^6 gross; die haeufigsten
 * Muster schrumpfen den real genutzten Raum auf wenige Tausend.
 */
export function isWeakPin(pin: string): boolean {
  if (!/^\d{6}$/.test(pin)) return true;

  // Alle Ziffern gleich: 000000, 111111, ...
  if (/^(\d)\1{5}$/.test(pin)) return true;

  // Auf- oder absteigende Folgen (auch mit Ueberlauf: 890123).
  const digits = pin.split("").map(Number);
  const ascending = digits.every(
    (d, i) => i === 0 || d === (digits[i - 1] + 1) % 10,
  );
  const descending = digits.every(
    (d, i) => i === 0 || d === (digits[i - 1] + 9) % 10,
  );
  if (ascending || descending) return true;

  // Wiederholte Paare/Tripel: 121212, 123123, 112233.
  if (/^(\d{2})\1{2}$/.test(pin)) return true;
  if (/^(\d{3})\1$/.test(pin)) return true;
  if (/^(\d)\1(\d)\2(\d)\3$/.test(pin)) return true;

  // Geburtsdaten. Zwei gaengige Schreibweisen:
  //   TTMMJJ  (241278 = 24.12.1978)  -> Tag + Monat plausibel
  //   TTMMJJJJ ist zu lang; stattdessen TT + 4-stelliges Jahr (011990)
  const tag = Number(pin.slice(0, 2));
  const monat = Number(pin.slice(2, 4));
  const tagOk = tag >= 1 && tag <= 31;
  const monatOk = monat >= 1 && monat <= 12;

  // TTMMJJ — jedes zweistellige Jahr ist plausibel.
  if (tagOk && monatOk) return true;

  // TTJJJJ / MMJJJJ — vierstelliges Jahr am Ende.
  const jahr4 = Number(pin.slice(2));
  if (tagOk && jahr4 >= 1940 && jahr4 <= 2015) return true;

  // JJJJMMTT (19781224 waere zu lang) bzw. MMTTJJ.
  const jahrVorn = Number(pin.slice(0, 4));
  if (jahrVorn >= 1940 && jahrVorn <= 2015) return true;

  // Explizite Denyliste der haeufigsten 6-stelligen PINs.
  if (COMMON_PINS.has(pin)) return true;

  return false;
}

const COMMON_PINS = new Set([
  "123456", "654321", "123123", "112233", "121212", "789456", "159753",
  "147258", "159357", "142536", "102030", "135790", "246810", "111222",
  "121314", "123321", "696969", "666666", "202020", "010203", "100000",
  "999999", "555555", "212121", "131313", "252525", "010101", "123654",
]);

/* ------------------------------------------------------------------
 * Tokens (Geraete-Secret, Session-Token)
 * ------------------------------------------------------------------ */

/** 32 zufaellige Bytes, base64url — als Klartext nur einmalig ausgeliefert. */
export function generateToken(): string {
  return randomBytes(32).toString("base64url");
}

/**
 * SHA-256 ueber den Token. Reicht hier, weil der Token selbst 256 Bit
 * Zufall traegt (im Gegensatz zu einer PIN ist er nicht ratbar).
 */
export function hashToken(token: string): string {
  return createHmac("sha256", requireSecret("EMPLOYEE_SESSION_PEPPER"))
    .update(token)
    .digest("hex");
}

/** IP-Adressen sind personenbezogen -> nur gehasht speichern (DSGVO). */
export function hashIp(ip: string | null): string | null {
  if (!ip) return null;
  return createHmac("sha256", requireSecret("EMPLOYEE_SESSION_PEPPER"))
    .update(ip)
    .digest("hex")
    .slice(0, 32);
}

/* ------------------------------------------------------------------ */

function requireSecret(name: string): string {
  const value = process.env[name];
  if (!value || value.length < 16) {
    throw new Error(
      `${name} fehlt oder ist zu kurz (mind. 16 Zeichen). ` +
        `Siehe .env.example — ohne diesen Wert ist die Mitarbeiter-App unsicher.`,
    );
  }
  return value;
}
