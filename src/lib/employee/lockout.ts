/**
 * Sperr-Logik der PIN-Eingabe — bewusst OHNE "server-only" und ohne
 * DB-Zugriff, damit sie direkt testbar ist (siehe lockout.test.ts).
 * Die Anwendung dieser Regeln passiert in src/lib/employee/auth.ts.
 */

/** Fehlversuche bis zur Sperre. */
export const DEVICE_MAX_FAILURES = 5;

/**
 * Sperrdauer in Minuten, gestaffelt nach der Anzahl bisheriger SPERREN
 * (nicht Fehlversuche). Beim ersten Mal kurz — Vertipper sollen niemanden
 * aus dem Arbeitsalltag werfen —, danach schnell unattraktiv fuers Raten.
 *
 *   1. Sperre:  5 Minuten
 *   2. Sperre: 60 Minuten
 *   ab der 3.: 24 Stunden
 *
 * Wichtig: Die Staffel darf NICHT aus der Gesamtzahl der Fehlversuche
 * abgeleitet werden. Sonst genuegt nach der ersten Sperre ein einzelner
 * weiterer Fehlversuch fuer die naechste — und die Dauer stiege praktisch
 * nie an (siehe Regressionstest).
 */
export function lockoutMinutes(lockCount: number): number {
  if (lockCount <= 1) return 5;
  if (lockCount === 2) return 60;
  return 24 * 60;
}
