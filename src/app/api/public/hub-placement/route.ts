import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isPlaceKind } from "@/lib/places";

export const runtime = "nodejs";

// place_kind/ort existieren erst nach Migration 0018/0020 — bis dahin schlagen
// Writes mit diesen Spalten fehl (PGRST204/42703); dann ohne sie wiederholen.
function isMissingColumn(err: { code?: string } | null): boolean {
  return err?.code === "PGRST204" || err?.code === "42703";
}

// Public, token-gated per-hub placement (stable PDL link). No login.
export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as {
    token?: string;
    standort_name?: string;
    menge?: number | string | null;
    kind?: string;
    place_kind?: string;
    ort?: string;
    adresse?: string;
  };

  const token = (body.token ?? "").trim();
  const standort = (body.standort_name ?? "").trim();
  const kind = body.kind === "box" ? "box" : "flyer";
  const placeKind =
    body.place_kind && isPlaceKind(body.place_kind)
      ? body.place_kind
      : "sonstiges";
  const ort = (body.ort ?? "").trim().slice(0, 120);
  const adresse = (body.adresse ?? "").trim().slice(0, 200);
  if (!token || !standort) {
    return NextResponse.json({ error: "Token oder Ort fehlt." }, { status: 400 });
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

  const mengeNum =
    body.menge === "" || body.menge == null
      ? null
      : Math.max(0, Math.trunc(Number(body.menge) || 0)) || null;

  const row = {
    hub_id: hub.id,
    delivery_id: null,
    standort_name: standort,
    menge: mengeNum,
    kind,
  };
  let { data: inserted, error: insErr } = await admin
    .from("delivery_placements")
    .insert({ ...row, place_kind: placeKind, ort: ort || null, adresse: adresse || null })
    .select("id, standort_name, menge, kind, place_kind, ort, adresse, created_at")
    .single();
  if (insErr && isMissingColumn(insErr)) {
    ({ data: inserted, error: insErr } = await admin
      .from("delivery_placements")
      .insert(row)
      .select("id, standort_name, menge, kind, created_at")
      .single());
  }

  if (insErr) {
    return NextResponse.json({ error: insErr.message }, { status: 500 });
  }

  return NextResponse.json({ placement: inserted });
}

// Eingetragenen Ort bearbeiten (Name/Anzahl). Der Eintrag muss zum Hub des
// Tokens gehören — sonst wie "nicht vorhanden".
export async function PUT(req: Request) {
  const body = (await req.json().catch(() => ({}))) as {
    token?: string;
    id?: string;
    standort_name?: string;
    menge?: number | string | null;
    place_kind?: string;
    ort?: string;
    adresse?: string;
  };

  const token = (body.token ?? "").trim();
  const id = (body.id ?? "").trim();
  const standort = (body.standort_name ?? "").trim();
  if (!token || !id || !standort) {
    return NextResponse.json(
      { error: "Token, Eintrag oder Ort fehlt." },
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

  const { data: existing } = await admin
    .from("delivery_placements")
    .select("id, hub_id")
    .eq("id", id)
    .maybeSingle();

  if (!existing || existing.hub_id !== hub.id) {
    return NextResponse.json(
      { error: "Eintrag nicht gefunden." },
      { status: 404 },
    );
  }

  const mengeNum =
    body.menge === "" || body.menge == null
      ? null
      : Math.max(0, Math.trunc(Number(body.menge) || 0)) || null;

  const patch: {
    standort_name: string;
    menge: number | null;
    place_kind?: string;
    ort?: string | null;
    adresse?: string | null;
  } = { standort_name: standort, menge: mengeNum };
  if (body.place_kind && isPlaceKind(body.place_kind)) {
    patch.place_kind = body.place_kind;
  }
  if (body.ort !== undefined) {
    patch.ort = (body.ort ?? "").trim().slice(0, 120) || null;
  }
  if (body.adresse !== undefined) {
    patch.adresse = (body.adresse ?? "").trim().slice(0, 200) || null;
  }
  let { data: updated, error: updErr } = await admin
    .from("delivery_placements")
    .update(patch)
    .eq("id", id)
    .select("id, standort_name, menge, kind, place_kind, ort, adresse, created_at")
    .single();
  if (updErr && isMissingColumn(updErr)) {
    ({ data: updated, error: updErr } = await admin
      .from("delivery_placements")
      .update({ standort_name: standort, menge: mengeNum })
      .eq("id", id)
      .select("id, standort_name, menge, kind, created_at")
      .single());
  }

  if (updErr || !updated) {
    return NextResponse.json(
      { error: "Speichern fehlgeschlagen." },
      { status: 500 },
    );
  }

  return NextResponse.json({ placement: updated });
}

// Eingetragenen Ort löschen. Der Eintrag muss zum Hub des Tokens gehören.
export async function DELETE(req: Request) {
  const body = (await req.json().catch(() => ({}))) as {
    token?: string;
    id?: string;
  };

  const token = (body.token ?? "").trim();
  const id = (body.id ?? "").trim();
  if (!token || !id) {
    return NextResponse.json(
      { error: "Token oder Eintrag fehlt." },
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

  const { data: existing } = await admin
    .from("delivery_placements")
    .select("id, hub_id")
    .eq("id", id)
    .maybeSingle();

  if (!existing || existing.hub_id !== hub.id) {
    return NextResponse.json(
      { error: "Eintrag nicht gefunden." },
      { status: 404 },
    );
  }

  const { error: delErr } = await admin
    .from("delivery_placements")
    .delete()
    .eq("id", id);

  if (delErr) {
    return NextResponse.json(
      { error: "Löschen fehlgeschlagen." },
      { status: 500 },
    );
  }

  return NextResponse.json({ ok: true });
}
