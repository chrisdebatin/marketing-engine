import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { KONTAKT_ARTEN, todayIso } from "@/lib/crm";

export const runtime = "nodejs";

// Spalten/Tabellen aus 0027 fehlen evtl. noch — dann ohne sie weitermachen.
function isMissingColumn(err: { code?: string } | null): boolean {
  return (
    err?.code === "PGRST204" || err?.code === "42703" || err?.code === "PGRST205"
  );
}

// Public, token-gated: Die PDL loggt einen Kontakt (Box/Besuch/Anruf) mit
// Ansprechpartner und Gesprächsnotiz. letzter_besuch = heute;
// naechster_besuch = heute + intervall_wochen (Standard 4) — das nächste
// Gespräch wird automatisch terminiert. Jeder Kontakt landet im Log.
export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as {
    token?: string;
    id?: string;
    kontakt_art?: string;
    ansprechpartner?: string;
    note?: string;
    recare?: string;
  };

  const token = (body.token ?? "").trim();
  const id = (body.id ?? "").trim();
  const kontaktArt = (body.kontakt_art ?? "").trim();
  if (!token || !id) {
    return NextResponse.json(
      { error: "Token oder Ziel-Ort fehlt." },
      { status: 400 },
    );
  }
  if (!KONTAKT_ARTEN.some((k) => k.key === kontaktArt)) {
    return NextResponse.json(
      { error: "Bitte wählen: Box, Besuch oder Anruf." },
      { status: 400 },
    );
  }

  const admin = createAdminClient();

  const { data: hub, error: findErr } = await admin
    .from("hubs")
    .select("id")
    .eq("share_token", token)
    .single();

  if (findErr || !hub) {
    return NextResponse.json({ error: "Ungültiger Link." }, { status: 404 });
  }

  const { data: target } = await admin
    .from("crm_targets")
    .select("id, hub_id, intervall_wochen")
    .eq("id", id)
    .maybeSingle();

  if (!target || target.hub_id !== hub.id) {
    return NextResponse.json(
      { error: "Ziel-Ort nicht gefunden." },
      { status: 404 },
    );
  }

  const today = todayIso();
  const next = new Date();
  next.setDate(next.getDate() + (target.intervall_wochen || 4) * 7);
  const naechster = next.toISOString().slice(0, 10);
  const ansprechpartner = (body.ansprechpartner ?? "").trim().slice(0, 200);
  const note = (body.note ?? "").trim().slice(0, 1000);

  const base = {
    letzter_besuch: today,
    naechster_besuch: naechster,
    besuchs_notiz: note || null,
  };
  // Recare-Antwort der PDL ("ja"/"nein"; leer = keine Änderung).
  const recare = (body.recare ?? "").trim();
  const recarePatch =
    recare === "ja"
      ? { recare_partner: true }
      : recare === "nein"
        ? { recare_partner: false }
        : {};

  const selectCols =
    "id, name, kategorie, adresse, ort, note, intervall_wochen, letzter_besuch, naechster_besuch, besuchs_notiz";
  let { data: updated, error: updErr } = await admin
    .from("crm_targets")
    .update({
      ...base,
      ...recarePatch,
      ansprechpartner: ansprechpartner || null,
      letzte_kontakt_art: kontaktArt,
    })
    .eq("id", id)
    .select(`${selectCols}, ansprechpartner, letzte_kontakt_art, recare_partner`)
    .single();
  if (updErr && isMissingColumn(updErr)) {
    ({ data: updated, error: updErr } = await admin
      .from("crm_targets")
      .update(base)
      .eq("id", id)
      .select(selectCols)
      .single());
  }

  if (updErr || !updated) {
    return NextResponse.json(
      { error: "Speichern fehlgeschlagen." },
      { status: 500 },
    );
  }

  // Kontakt-Log (Wochenziel-Zählung); tolerant, falls 0027 noch fehlt.
  await admin.from("crm_contacts").insert({
    target_id: target.id,
    hub_id: hub.id,
    kontakt_art: kontaktArt,
    ansprechpartner: ansprechpartner || null,
    note: note || null,
    contact_date: today,
  });

  return NextResponse.json({ target: updated });
}
