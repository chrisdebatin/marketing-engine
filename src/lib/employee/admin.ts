import "server-only";

import { empDb } from "@/lib/employee/db";
import {
  activationCodeHint,
  formatActivationCode,
  generateActivationCode,
  hashActivationCode,
  normalizeActivationCode,
} from "@/lib/employee/crypto";
import { revokeAllSessions } from "@/lib/employee/auth";
import type { Announcement, CustomerReferral, MaReferral, Staff } from "@/lib/types";

/**
 * Server-Funktionen der Admin-Seite. Aufrufer ist immer die bestehende
 * Marketing-Engine (Route-Group (app)) — die Zugangskontrolle dort gilt.
 */

/* ---------------- Mitarbeiter & Codes ---------------- */

export interface StaffWithHub extends Staff {
  hub_name: string | null;
  has_pin: boolean;
  open_code_hint: string | null;
}

export async function listStaff(): Promise<StaffWithHub[]> {
  const db = empDb();
  const { data: staff } = await db
    .from("staff")
    .select("*")
    .order("nachname");

  const rows = (staff ?? []) as Staff[];
  if (rows.length === 0) return [];

  // Zwei einfache Queries statt Embedded Select (Hand-getippte Typen,
  // schemauebergreifend ohnehin nicht moeglich).
  const { createAdminClient } = await import("@/lib/supabase/admin");
  const { data: hubs } = await createAdminClient().from("hubs").select("id, name");
  const hubMap = new Map((hubs ?? []).map((h) => [h.id, h.name]));

  const ids = rows.map((r) => r.id);
  const { data: devices } = await db
    .from("devices")
    .select("staff_id, pin_hash")
    .in("staff_id", ids)
    .is("revoked_at", null);
  const withPin = new Set(
    (devices ?? []).filter((d) => d.pin_hash).map((d) => d.staff_id),
  );

  const { data: codes } = await db
    .from("activation_codes")
    .select("staff_id, code_hint")
    .in("staff_id", ids)
    .is("used_at", null);
  const codeMap = new Map((codes ?? []).map((c) => [c.staff_id, c.code_hint]));

  return rows.map((r) => ({
    ...r,
    hub_name: r.hub_id ? (hubMap.get(r.hub_id) ?? null) : null,
    has_pin: withPin.has(r.id),
    open_code_hint: codeMap.get(r.id) ?? null,
  }));
}

/**
 * Erzeugt einen neuen Aktivierungscode. Gibt den Klartext EINMALIG zurueck —
 * danach existiert nur noch der Hash. Ein bestehender offener Code wird
 * ersetzt (Unique-Index erlaubt nur einen offenen Code je Mitarbeiter).
 */
export async function issueActivationCode(
  staffId: string,
  createdBy: string,
): Promise<string> {
  const db = empDb();

  await db
    .from("activation_codes")
    .delete()
    .eq("staff_id", staffId)
    .is("used_at", null);

  const code = generateActivationCode();
  const normalized = normalizeActivationCode(code);

  await db.from("activation_codes").insert({
    staff_id: staffId,
    code_hash: hashActivationCode(normalized),
    code_hint: activationCodeHint(normalized),
    created_by: createdBy,
  });

  return formatActivationCode(normalized);
}

/**
 * Zugang zuruecksetzen: alle Geraete und Sessions entwerten. Der Mitarbeiter
 * braucht danach einen neuen Aktivierungscode (bewusst kein Self-Service).
 */
export async function resetStaffAccess(
  staffId: string,
  reason: string,
): Promise<void> {
  const db = empDb();
  await db
    .from("devices")
    .update({ revoked_at: new Date().toISOString(), revoked_reason: reason })
    .eq("staff_id", staffId)
    .is("revoked_at", null);
  await revokeAllSessions(staffId, reason);
}

/* ---------------- Meldungen ---------------- */

export async function listAllAnnouncements(): Promise<Announcement[]> {
  const { data } = await empDb()
    .from("announcements")
    .select("*")
    .order("publish_at", { ascending: false })
    .limit(200);
  return (data ?? []) as Announcement[];
}

/* ---------------- Empfehlungen ---------------- */

export interface ReferralWithStaff {
  id: string;
  name: string;
  status: string;
  created_at: string;
  staff_name: string;
  hub_name: string | null;
  telefon: string | null;
  email: string | null;
  ort: string | null;
  beziehung: string | null;
  notiz: string | null;
}

async function decorate(
  rows: (CustomerReferral | MaReferral)[],
  nameOf: (r: CustomerReferral | MaReferral) => string,
): Promise<ReferralWithStaff[]> {
  if (rows.length === 0) return [];

  const db = empDb();
  const { data: staff } = await db
    .from("staff")
    .select("id, vorname, nachname")
    .in("id", [...new Set(rows.map((r) => r.staff_id))]);
  const staffMap = new Map(
    (staff ?? []).map((s) => [s.id, `${s.vorname} ${s.nachname}`]),
  );

  const hubIds = [...new Set(rows.map((r) => r.hub_id).filter(Boolean))] as string[];
  let hubMap = new Map<string, string>();
  if (hubIds.length > 0) {
    const { createAdminClient } = await import("@/lib/supabase/admin");
    const { data: hubs } = await createAdminClient()
      .from("hubs")
      .select("id, name")
      .in("id", hubIds);
    hubMap = new Map((hubs ?? []).map((h) => [h.id, h.name]));
  }

  return rows.map((r) => ({
    id: r.id,
    name: nameOf(r),
    status: r.status,
    created_at: r.created_at,
    staff_name: staffMap.get(r.staff_id) ?? "Unbekannt",
    hub_name: r.hub_id ? (hubMap.get(r.hub_id) ?? null) : null,
    telefon: r.telefon,
    email: r.email,
    ort: r.ort,
    beziehung: r.beziehung,
    notiz: r.notiz,
  }));
}

export async function listCustomerReferrals(): Promise<ReferralWithStaff[]> {
  const { data } = await empDb()
    .from("customer_referrals")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(300);
  return decorate((data ?? []) as CustomerReferral[], (r) =>
    (r as CustomerReferral).kunde_name,
  );
}

export async function listMaReferrals(): Promise<ReferralWithStaff[]> {
  const { data } = await empDb()
    .from("ma_referrals")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(300);
  return decorate((data ?? []) as MaReferral[], (r) =>
    (r as MaReferral).firma_name,
  );
}
