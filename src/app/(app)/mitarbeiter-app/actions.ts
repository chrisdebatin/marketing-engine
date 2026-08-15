"use server";

import { revalidatePath } from "next/cache";
import { requireSession } from "@/lib/auth";
import { empDb } from "@/lib/employee/db";
import {
  issueActivationCode,
  resetStaffAccess,
} from "@/lib/employee/admin";
import { announcementSchema } from "@/lib/employee/schemas";

/**
 * Admin-Aktionen der Mitarbeiter-App.
 *
 * WICHTIG: requireSession() liefert im Open-Access-Modus (0008_open_access.sql)
 * fuer ANONYME Besucher isAdmin=true. Ein blosses `if (!session.isAdmin)`
 * waere hier also wirkungslos — und diese Seite kann mehr als das uebrige
 * CRM: sie erzeugt Aktivierungscodes im Klartext. Wer daran kaeme, koennte
 * sich als beliebiger Mitarbeiter aktivieren.
 *
 * Deshalb wird hier zusaetzlich `loggedIn` verlangt: eine ECHTE
 * Supabase-Session. Das ist unabhaengig davon, ob der Open-Access-Modus
 * spaeter abgeschaltet wird, und macht diese Seite nicht davon abhaengig.
 */
export async function requireEmployeeAppAdmin() {
  const session = await requireSession();
  if (!session.loggedIn || !session.isAdmin) {
    throw new Error(
      "Nur fuer angemeldete Admins. Bitte ueber /login anmelden.",
    );
  }
  return session;
}

const requireAdmin = requireEmployeeAppAdmin;

/* ---------------- Meldungen ---------------- */

export async function saveAnnouncement(formData: FormData) {
  const session = await requireAdmin();

  const parsed = announcementSchema.safeParse({
    titel: String(formData.get("titel") ?? "").trim(),
    body: String(formData.get("body") ?? "").trim(),
    image_url: String(formData.get("image_url") ?? "").trim(),
    status: String(formData.get("status") ?? "draft"),
    prioritaet: String(formData.get("prioritaet") ?? "normal"),
  });
  if (!parsed.success) throw new Error(parsed.error.issues[0]?.message);

  const id = String(formData.get("id") ?? "").trim();
  const values = {
    titel: parsed.data.titel,
    body: parsed.data.body,
    image_url: parsed.data.image_url ?? null,
    status: parsed.data.status,
    prioritaet: parsed.data.prioritaet,
    // publish_at wird mitgeschrieben, sonst waere eine geplante
    // Veroeffentlichung in der UI wirkungslos.
    ...(parsed.data.publish_at ? { publish_at: parsed.data.publish_at } : {}),
    created_by: session.profile.name ?? "Admin",
  };

  if (id) {
    await empDb().from("announcements").update(values).eq("id", id);
  } else {
    await empDb().from("announcements").insert(values);
  }

  revalidatePath("/mitarbeiter-app");
}

export async function setAnnouncementStatus(formData: FormData) {
  await requireAdmin();
  const id = String(formData.get("id") ?? "").trim();
  const status = String(formData.get("status") ?? "");
  if (!id || !["draft", "published", "archived"].includes(status)) return;

  await empDb()
    .from("announcements")
    .update({ status: status as "draft" | "published" | "archived" })
    .eq("id", id);

  revalidatePath("/mitarbeiter-app");
}

/* ---------------- Mitarbeiter & Codes ---------------- */

export async function createStaff(formData: FormData) {
  await requireAdmin();

  const vorname = String(formData.get("vorname") ?? "").trim();
  const nachname = String(formData.get("nachname") ?? "").trim();
  const hubId = String(formData.get("hub_id") ?? "").trim();
  if (!vorname || !nachname) throw new Error("Vor- und Nachname sind noetig.");

  await empDb().from("staff").insert({
    vorname,
    nachname,
    hub_id: hubId || null,
    personalnr: String(formData.get("personalnr") ?? "").trim() || null,
  });

  revalidatePath("/mitarbeiter-app");
}

/**
 * Erzeugt einen Aktivierungscode und gibt ihn EINMALIG im Klartext zurueck.
 * Der Rueckgabewert wird in der UI angezeigt und nirgends gespeichert.
 */
export async function generateCode(staffId: string): Promise<string> {
  const session = await requireAdmin();
  const code = await issueActivationCode(
    staffId,
    session.profile.name ?? "Admin",
  );
  revalidatePath("/mitarbeiter-app");
  return code;
}

export async function resetAccess(formData: FormData) {
  await requireAdmin();
  const staffId = String(formData.get("staff_id") ?? "").trim();
  if (!staffId) return;
  await resetStaffAccess(staffId, "admin_reset");
  revalidatePath("/mitarbeiter-app");
}

export async function setStaffStatus(formData: FormData) {
  await requireAdmin();
  const staffId = String(formData.get("staff_id") ?? "").trim();
  const status = String(formData.get("status") ?? "");
  if (!staffId) return;
  if (!["eingeladen", "aktiv", "gesperrt", "ausgeschieden"].includes(status)) {
    return;
  }

  await empDb()
    .from("staff")
    .update({ status: status as "eingeladen" | "aktiv" | "gesperrt" | "ausgeschieden" })
    .eq("id", staffId);

  // Gesperrte oder ausgeschiedene Mitarbeiter verlieren sofort den Zugang.
  if (status === "gesperrt" || status === "ausgeschieden") {
    await resetStaffAccess(staffId, `status_${status}`);
  }

  revalidatePath("/mitarbeiter-app");
}

/* ---------------- Empfehlungen ---------------- */

export async function setReferralStatus(formData: FormData) {
  await requireAdmin();
  const id = String(formData.get("id") ?? "").trim();
  const art = String(formData.get("art") ?? "");
  const status = String(formData.get("status") ?? "").trim();
  if (!id || !status) return;

  const table = art === "ma" ? "ma_referrals" : "customer_referrals";
  await empDb()
    .from(table)
    // Der Wert ist durch den check-Constraint der Tabelle abgesichert.
    .update({ status: status as never })
    .eq("id", id);

  revalidatePath("/mitarbeiter-app");
}
