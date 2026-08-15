import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Zugriff auf das Schema `employee_app`.
 *
 * Warum Service-Role: Die Tabellen der Mitarbeiter-App haben RLS aktiviert und
 * KEINE Policies, und anon/authenticated haben keinerlei Grants (0064). Der
 * oeffentliche anon-Key kommt hier also nicht heran — anders als bei den
 * bestehenden CRM-Tabellen in `public`.
 *
 * Damit liegt die gesamte Autorisierung im Server-Code. Die eiserne Regel:
 *
 *   staff_id kommt IMMER aus der Session (requireEmployee()),
 *   NIEMALS aus Request-Body, Query-String oder Header.
 *
 * Wer diese Regel bricht, oeffnet sofort eine vollstaendige IDOR — der
 * Service-Role-Client hat keinerlei Zeilenschutz.
 *
 * Voraussetzung: "employee_app" muss im Supabase-Dashboard unter
 * Settings -> API -> Exposed schemas eingetragen sein. Fehlt der Eintrag,
 * antwortet PostgREST mit PGRST106 — auch fuer Service-Role.
 */
export function empDb() {
  return createAdminClient().schema("employee_app");
}

/** Wird geworfen, wenn das Schema nicht freigegeben ist — mit klarer Anleitung. */
export function explainSchemaError(error: { code?: string; message?: string }): string {
  if (error?.code === "PGRST106") {
    return (
      'Das Schema "employee_app" ist in Supabase nicht freigegeben. ' +
      "Bitte einmalig unter Settings -> API -> Exposed schemas ergaenzen."
    );
  }
  return error?.message ?? "Unbekannter Datenbankfehler";
}
