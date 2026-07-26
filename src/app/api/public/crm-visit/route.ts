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

  // "Box vorbeigebracht" zählt automatisch als Box-Liefer-Ort — kein
  // doppeltes Loggen im Auslage-Tab nötig (Karte/Statistik stimmen mit).
  let placementCreated = false;
  if (kontaktArt === "box") {
    const { data: full } = await admin
      .from("crm_targets")
      .select("name, kategorie, adresse, ort")
      .eq("id", id)
      .single();
    if (full) {
      const { error: plErr } = await admin.from("delivery_placements").insert({
        hub_id: hub.id,
        delivery_id: null,
        standort_name: full.name,
        menge: null,
        kind: "box",
        place_kind: full.kategorie ?? "krankenhaus",
        adresse: full.adresse ?? null,
        ort: full.ort ?? null,
      });
      placementCreated = !plErr;
    }
  }

  return NextResponse.json({ target: updated, placementCreated });
}

// Letzten geloggten Kontakt wieder löschen (Versehen/Test). Der Eintrag
// springt auf den vorherigen Kontakt zurück — oder auf "Erstkontakt
// ausstehend", wenn es keinen gab. Das Kontakt-Log wird mitbereinigt.
export async function DELETE(req: Request) {
  const body = (await req.json().catch(() => ({}))) as {
    token?: string;
    id?: string;
  };

  const token = (body.token ?? "").trim();
  const id = (body.id ?? "").trim();
  if (!token || !id) {
    return NextResponse.json(
      { error: "Token oder Ziel-Ort fehlt." },
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
    .select("id, hub_id, intervall_wochen, letzter_besuch")
    .eq("id", id)
    .maybeSingle();
  if (!target || target.hub_id !== hub.id) {
    return NextResponse.json(
      { error: "Ziel-Ort nicht gefunden." },
      { status: 404 },
    );
  }
  if (!target.letzter_besuch) {
    return NextResponse.json(
      { error: "Kein geloggter Kontakt vorhanden." },
      { status: 400 },
    );
  }

  // Letzten + vorletzten Kontakt aus dem Log holen (0027 evtl. noch nicht da).
  const { data: contacts, error: logErr } = await admin
    .from("crm_contacts")
    .select("id, kontakt_art, ansprechpartner, note, contact_date, created_at")
    .eq("target_id", target.id)
    .order("contact_date", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(2);

  const last = !logErr ? (contacts ?? [])[0] : undefined;
  const prev = !logErr ? (contacts ?? [])[1] : undefined;
  let deletedDate = target.letzter_besuch;

  if (last) {
    const { error: delErr } = await admin
      .from("crm_contacts")
      .delete()
      .eq("id", last.id);
    if (delErr) {
      return NextResponse.json(
        { error: "Löschen fehlgeschlagen." },
        { status: 500 },
      );
    }
    deletedDate = last.contact_date;
  }

  // Ziel auf den vorherigen Stand zurücksetzen.
  let base: {
    letzter_besuch: string | null;
    naechster_besuch: string | null;
    besuchs_notiz: string | null;
  };
  let extra: { letzte_kontakt_art: string | null; ansprechpartner?: string | null };
  if (prev) {
    const next = new Date(prev.contact_date + "T12:00:00");
    next.setDate(next.getDate() + (target.intervall_wochen || 4) * 7);
    base = {
      letzter_besuch: prev.contact_date,
      naechster_besuch: next.toISOString().slice(0, 10),
      besuchs_notiz: prev.note ?? null,
    };
    extra = {
      letzte_kontakt_art: prev.kontakt_art ?? null,
      ansprechpartner: prev.ansprechpartner ?? null,
    };
  } else {
    base = { letzter_besuch: null, naechster_besuch: null, besuchs_notiz: null };
    extra = { letzte_kontakt_art: null };
  }

  const selectCols =
    "id, name, kategorie, adresse, ort, note, intervall_wochen, letzter_besuch, naechster_besuch, besuchs_notiz";
  let { data: updated, error: updErr } = await admin
    .from("crm_targets")
    .update({ ...base, ...extra })
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
      { error: "Löschen fehlgeschlagen." },
      { status: 500 },
    );
  }
  return NextResponse.json({ target: updated, deletedDate });
}

// Klinik-Eintrag korrigieren (Name/Adresse/Ort/Ansprechpartner/Recare/Info).
// Der Eintrag muss zum Hub des Tokens gehören.
export async function PUT(req: Request) {
  const body = (await req.json().catch(() => ({}))) as {
    token?: string;
    id?: string;
    name?: string;
    adresse?: string;
    ort?: string;
    ansprechpartner?: string;
    recare?: string;
    info?: string;
  };

  const token = (body.token ?? "").trim();
  const id = (body.id ?? "").trim();
  const name = (body.name ?? "").trim();
  if (!token || !id) {
    return NextResponse.json(
      { error: "Token oder Ziel-Ort fehlt." },
      { status: 400 },
    );
  }
  if (!name) {
    return NextResponse.json({ error: "Name angeben." }, { status: 400 });
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
    .select("id, hub_id")
    .eq("id", id)
    .maybeSingle();
  if (!target || target.hub_id !== hub.id) {
    return NextResponse.json(
      { error: "Ziel-Ort nicht gefunden." },
      { status: 404 },
    );
  }

  const recare = (body.recare ?? "").trim();
  const base = {
    name: name.slice(0, 200),
    adresse: (body.adresse ?? "").trim().slice(0, 200) || null,
    ort: (body.ort ?? "").trim().slice(0, 120) || null,
    note: (body.info ?? "").trim().slice(0, 1000) || null,
  };
  const extra = {
    ansprechpartner:
      (body.ansprechpartner ?? "").trim().slice(0, 200) || null,
    ...(recare === "ja"
      ? { recare_partner: true }
      : recare === "nein"
        ? { recare_partner: false }
        : {}),
  };

  const selectCols =
    "id, name, kategorie, adresse, ort, note, intervall_wochen, letzter_besuch, naechster_besuch, besuchs_notiz";
  let { data: updated, error: updErr } = await admin
    .from("crm_targets")
    .update({ ...base, ...extra })
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
  return NextResponse.json({ target: updated });
}
