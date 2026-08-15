import "server-only";

import { empDb } from "@/lib/employee/db";

/**
 * Brute-Force-Bremse, DB-gestuetzt.
 *
 * Warum nicht in-memory: Vercel betreibt viele isolierte Instanzen. Eine Map
 * auf Modulebene gaebe einem Angreifer das n-Fache des gedachten Budgets und
 * waere nach jedem Cold Start leer. Der Zustand muss geteilt sein -> Postgres.
 *
 * Die Limits sind absichtlich grosszuegig genug fuer echte Pflegekraefte, die
 * sich vertippen, und eng genug, um Rateangriffe unbrauchbar zu machen.
 */

export interface RateLimitRule {
  /** Zeitfenster in Minuten. */
  windowMinutes: number;
  /** Erlaubte Fehlversuche im Fenster. */
  maxFailures: number;
}

export const PIN_IP_RULE: RateLimitRule = { windowMinutes: 60, maxFailures: 30 };
export const ACTIVATION_IP_RULE: RateLimitRule = {
  windowMinutes: 60,
  maxFailures: 20,
};

// Reine Sperr-Logik lebt in lockout.ts (ohne server-only, damit testbar).
export { DEVICE_MAX_FAILURES, lockoutMinutes } from "@/lib/employee/lockout";

/** Protokolliert einen Versuch (fuer die IP-Fenster). */
export async function recordAttempt(
  bucket: string,
  kind: "pin" | "activation",
  ok: boolean,
): Promise<void> {
  await empDb().from("auth_attempts").insert({ bucket, kind, ok });
}

/**
 * Prueft, ob ein Bucket (typischerweise eine gehashte IP) sein Fehlbudget
 * ausgeschoepft hat. Zaehlt nur Fehlversuche im Zeitfenster.
 */
export async function isRateLimited(
  bucket: string,
  kind: "pin" | "activation",
  rule: RateLimitRule,
): Promise<boolean> {
  const since = new Date(
    Date.now() - rule.windowMinutes * 60_000,
  ).toISOString();

  const { count, error } = await empDb()
    .from("auth_attempts")
    .select("id", { count: "exact", head: true })
    .eq("bucket", bucket)
    .eq("kind", kind)
    .eq("ok", false)
    .gte("created_at", since);

  // Fail-closed waere hier zu hart (ein DB-Fehler wuerde alle aussperren),
  // fail-open zu weich. Kompromiss: Fehler -> nicht limitieren, aber der
  // Geraete-Lockout in verifyPinLogin greift ohnehin unabhaengig davon.
  if (error) return false;
  return (count ?? 0) >= rule.maxFailures;
}

/** Aufraeumen: alte Versuche loeschen (DSGVO-Minimierung + Tabellengroesse). */
export async function purgeOldAttempts(days = 30): Promise<number> {
  const cutoff = new Date(Date.now() - days * 86_400_000).toISOString();
  const { data } = await empDb()
    .from("auth_attempts")
    .delete()
    .lt("created_at", cutoff)
    .select("id");
  return data?.length ?? 0;
}
