import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { KONTAKT_ARTEN } from "@/lib/crm";
import { resyncTargetFromLog } from "@/lib/crm-log";

export const runtime = "nodejs";

/**
 * Log-Einträge (crm_contacts) auf der PDL-Seite bearbeiten/löschen —
 * token-gated. Nach jeder Änderung wird der zugehörige Ziel-Ort neu
 * abgeleitet (letzter/nächster Termin, Notiz, Kontakt-Art vom neuesten
 * verbliebenen Eintrag).
 */

async function findContact(token: string, id: string) {
  const admin = createAdminClient();
  const { data: hub } = await admin
    .from("hubs")
    .select("id")
    .eq("share_token", token)
    .single();
  if (!hub) return { error: "Ungültiger Link.", status: 404 as const };

  const { data: contact } = await admin
    .from("crm_contacts")
    .select("id, hub_id, target_id, contact_date")
    .eq("id", id)
    .maybeSingle();
  if (!contact || contact.hub_id !== hub.id) {
    return { error: "Log-Eintrag nicht gefunden.", status: 404 as const };
  }
  return { admin, hub, contact };
}

// Eintrag korrigieren: Aktion, Datum, Ansprechpartner, Notiz.
export async function PUT(req: Request) {
  const body = (await req.json().catch(() => ({}))) as {
    token?: string;
    id?: string;
    kontakt_art?: string;
    contact_date?: string;
    ansprechpartner?: string;
    note?: string;
  };
  const token = (body.token ?? "").trim();
  const id = (body.id ?? "").trim();
  if (!token || !id) {
    return NextResponse.json({ error: "Angaben fehlen." }, { status: 400 });
  }
  const kontaktArt = (body.kontakt_art ?? "").trim();
  if (!KONTAKT_ARTEN.some((k) => k.key === kontaktArt)) {
    return NextResponse.json(
      { error: "Bitte Aktion wählen: Box, Flyer, Besuch oder Anruf." },
      { status: 400 },
    );
  }
  const date = (body.contact_date ?? "").trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return NextResponse.json({ error: "Datum angeben." }, { status: 400 });
  }

  const found = await findContact(token, id);
  if ("error" in found) {
    return NextResponse.json({ error: found.error }, { status: found.status });
  }
  const { admin, contact } = found;

  const { data: updated, error } = await admin
    .from("crm_contacts")
    .update({
      kontakt_art: kontaktArt,
      contact_date: date,
      ansprechpartner: (body.ansprechpartner ?? "").trim().slice(0, 200) || null,
      note: (body.note ?? "").trim().slice(0, 1000) || null,
    })
    .eq("id", id)
    .select("id, kontakt_art, ansprechpartner, note, contact_date, target_id")
    .single();
  if (error || !updated) {
    return NextResponse.json(
      { error: "Speichern fehlgeschlagen." },
      { status: 500 },
    );
  }

  const target = await resyncTargetFromLog(found.hub.id, contact.target_id);
  return NextResponse.json({
    entry: {
      id: updated.id,
      date: updated.contact_date,
      art: updated.kontakt_art,
      notiz: updated.note,
      ansprechpartner: updated.ansprechpartner,
    },
    target,
  });
}

// Eintrag löschen (Versehen/Test).
export async function DELETE(req: Request) {
  const body = (await req.json().catch(() => ({}))) as {
    token?: string;
    id?: string;
  };
  const token = (body.token ?? "").trim();
  const id = (body.id ?? "").trim();
  if (!token || !id) {
    return NextResponse.json({ error: "Angaben fehlen." }, { status: 400 });
  }

  const found = await findContact(token, id);
  if ("error" in found) {
    return NextResponse.json({ error: found.error }, { status: found.status });
  }
  const { admin, contact } = found;

  const { error } = await admin.from("crm_contacts").delete().eq("id", id);
  if (error) {
    return NextResponse.json(
      { error: "Löschen fehlgeschlagen." },
      { status: 500 },
    );
  }

  const target = await resyncTargetFromLog(found.hub.id, contact.target_id);
  return NextResponse.json({ target, deletedDate: contact.contact_date });
}
