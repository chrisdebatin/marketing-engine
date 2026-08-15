import "server-only";

import { empDb } from "@/lib/employee/db";
import type { Announcement, Staff } from "@/lib/types";

/**
 * Lesezugriff auf Ankuendigungen.
 *
 * Sichtbarkeitsregel an EINER Stelle, damit Feed, Startseite und Detailseite
 * nicht auseinanderlaufen: nur `published` und `publish_at <= jetzt`.
 * Entwuerfe und archivierte Meldungen verlassen den Server nie.
 */

export interface AnnouncementFeedItem extends Announcement {
  gelesen: boolean;
}

/**
 * Zielgruppen-Filter. V1 schreibt immer scope='all'; die uebrigen Zweige sind
 * bereits implementiert, damit spaeteres Targeting nur noch die Admin-UI
 * braucht und nicht die Leselogik.
 */
function matchesStaff(a: Announcement, staff: Staff, region: string | null) {
  switch (a.target_scope) {
    case "all":
      return true;
    case "hub":
      return staff.hub_id ? a.target_hub_ids.includes(staff.hub_id) : false;
    case "region":
      return region ? a.target_regions.includes(region) : false;
    case "rolle":
      return a.target_rollen.includes(staff.rolle);
    default:
      return false;
  }
}

export async function listAnnouncements(
  staff: Staff,
  limit = 30,
): Promise<AnnouncementFeedItem[]> {
  const db = empDb();
  const nowIso = new Date().toISOString();

  const { data: rows } = await db
    .from("announcements")
    .select("*")
    .eq("status", "published")
    .lte("publish_at", nowIso)
    .order("publish_at", { ascending: false })
    .limit(limit);

  const list = (rows ?? []) as Announcement[];
  if (list.length === 0) return [];

  // Region des Mitarbeiters aus public.hubs — zweite einfache Query statt
  // Embedded Select (schemauebergreifend ohnehin nicht moeglich).
  let region: string | null = null;
  if (staff.hub_id) {
    const { createAdminClient } = await import("@/lib/supabase/admin");
    const { data: hub } = await createAdminClient()
      .from("hubs")
      .select("region")
      .eq("id", staff.hub_id)
      .maybeSingle();
    region = hub?.region ?? null;
  }

  const visible = list.filter((a) => matchesStaff(a, staff, region));
  if (visible.length === 0) return [];

  const { data: reads } = await db
    .from("announcement_reads")
    .select("announcement_id")
    .eq("staff_id", staff.id)
    .in(
      "announcement_id",
      visible.map((a) => a.id),
    );

  const readSet = new Set((reads ?? []).map((r) => r.announcement_id));

  // Wichtige Meldungen zuerst, danach nach Datum.
  return visible
    .map((a) => ({ ...a, gelesen: readSet.has(a.id) }))
    .sort((a, b) => {
      if (a.prioritaet !== b.prioritaet) {
        return a.prioritaet === "wichtig" ? -1 : 1;
      }
      return b.publish_at.localeCompare(a.publish_at);
    });
}

/** Einzelne Meldung — mit derselben Sichtbarkeitsregel. */
export async function getAnnouncement(
  id: string,
  staff: Staff,
): Promise<Announcement | null> {
  const { data } = await empDb()
    .from("announcements")
    .select("*")
    .eq("id", id)
    .eq("status", "published")
    .lte("publish_at", new Date().toISOString())
    .maybeSingle();

  if (!data) return null;

  let region: string | null = null;
  if (staff.hub_id) {
    const { createAdminClient } = await import("@/lib/supabase/admin");
    const { data: hub } = await createAdminClient()
      .from("hubs")
      .select("region")
      .eq("id", staff.hub_id)
      .maybeSingle();
    region = hub?.region ?? null;
  }

  return matchesStaff(data as Announcement, staff, region)
    ? (data as Announcement)
    : null;
}

export async function markAnnouncementRead(
  announcementId: string,
  staffId: string,
): Promise<void> {
  await empDb()
    .from("announcement_reads")
    .upsert(
      { announcement_id: announcementId, staff_id: staffId },
      { onConflict: "announcement_id,staff_id" },
    );
}

export async function countUnread(staff: Staff): Promise<number> {
  const list = await listAnnouncements(staff, 50);
  return list.filter((a) => !a.gelesen).length;
}
