import { NextResponse } from "next/server";
import {
  getAnnouncement,
  listAnnouncements,
  markAnnouncementRead,
} from "@/lib/employee/announcements";
import { requireEmployee } from "@/lib/employee/auth";

export const runtime = "nodejs";

/** Feed der sichtbaren Meldungen. Entwuerfe werden serverseitig gefiltert. */
export async function GET() {
  const ctx = await requireEmployee();
  if (!ctx) {
    return NextResponse.json({ error: "Nicht angemeldet." }, { status: 401 });
  }

  const announcements = await listAnnouncements(ctx.staff);
  return NextResponse.json({ announcements });
}

/** Meldung als gelesen markieren. */
export async function POST(req: Request) {
  const ctx = await requireEmployee();
  if (!ctx) {
    return NextResponse.json({ error: "Nicht angemeldet." }, { status: 401 });
  }

  const body = (await req.json().catch(() => ({}))) as { id?: unknown };
  const id = typeof body.id === "string" ? body.id : "";
  // UUID-Form pruefen, sonst erzeugt der Insert nur einen Cast-Fehler.
  if (!/^[0-9a-f-]{36}$/i.test(id)) {
    return NextResponse.json({ error: "Meldung fehlt." }, { status: 400 });
  }

  // Nur sichtbare Meldungen duerfen als gelesen markiert werden — sonst
  // liessen sich Entwuerfe vorab "weglesen" und der Ungelesen-Punkt
  // unterdruecken, bevor die Meldung ueberhaupt erscheint.
  const announcement = await getAnnouncement(id, ctx.staff);
  if (!announcement) {
    return NextResponse.json({ error: "Nicht gefunden." }, { status: 404 });
  }

  // staff_id kommt aus der Session, nicht aus dem Body.
  await markAnnouncementRead(id, ctx.staffId);
  return NextResponse.json({ ok: true });
}
