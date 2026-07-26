import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { KONTAKT_ARTEN } from "@/lib/crm";
import {
  isMissingColumn,
  logContactOnTarget,
  TARGET_COLS,
} from "@/lib/crm-log";

export const runtime = "nodejs";

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
      { error: "Bitte wählen: Box, Flyer, Besuch oder Anruf." },
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

  const result = await logContactOnTarget({
    hubId: hub.id,
    targetId: id,
    kontaktArt,
    ansprechpartner: body.ansprechpartner,
    note: body.note,
    recare: body.recare,
  });
  if (!result.ok) {
    return NextResponse.json(
      { error: result.error },
      { status: result.error === "Ziel-Ort nicht gefunden." ? 404 : 500 },
    );
  }
  return NextResponse.json({
    target: result.data.target,
    placementCreated: result.data.placementCreated,
  });
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

  const selectCols = TARGET_COLS;
  let { data: updated, error: updErr } = await admin
    .from("crm_targets")
    .update({ ...base, ...extra })
    .eq("id", id)
    .select(`${selectCols}, ansprechpartner, letzte_kontakt_art, recare_partner, plan`)
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

  const selectCols = TARGET_COLS;
  let { data: updated, error: updErr } = await admin
    .from("crm_targets")
    .update({ ...base, ...extra })
    .eq("id", id)
    .select(`${selectCols}, ansprechpartner, letzte_kontakt_art, recare_partner, plan`)
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
