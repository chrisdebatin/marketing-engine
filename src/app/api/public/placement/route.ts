import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";

// Public, token-gated. The share_token IS the access capability — no login.
export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as {
    token?: string;
    standort_name?: string;
    menge?: number | string | null;
  };

  const token = (body.token ?? "").trim();
  const standort = (body.standort_name ?? "").trim();
  if (!token || !standort) {
    return NextResponse.json(
      { error: "Token oder Ort fehlt." },
      { status: 400 },
    );
  }

  const admin = createAdminClient();

  const { data: delivery, error: findErr } = await admin
    .from("deliveries")
    .select("id, hub_id")
    .eq("share_token", token)
    .single();

  if (findErr || !delivery) {
    return NextResponse.json({ error: "Ungültiger Link." }, { status: 404 });
  }

  const mengeNum =
    body.menge === "" || body.menge == null
      ? null
      : Math.max(0, Math.trunc(Number(body.menge) || 0)) || null;

  const { data: inserted, error: insErr } = await admin
    .from("delivery_placements")
    .insert({
      hub_id: delivery.hub_id,
      delivery_id: delivery.id,
      standort_name: standort,
      menge: mengeNum,
    })
    .select("id, standort_name, menge, created_at")
    .single();

  if (insErr) {
    return NextResponse.json({ error: insErr.message }, { status: 500 });
  }

  return NextResponse.json({ placement: inserted });
}

// Eingetragenen Ort bearbeiten (Name/Anzahl). Der Eintrag muss zur Lieferung
// des Tokens gehören — sonst wie "nicht vorhanden".
export async function PUT(req: Request) {
  const body = (await req.json().catch(() => ({}))) as {
    token?: string;
    id?: string;
    standort_name?: string;
    menge?: number | string | null;
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

  const { data: delivery, error: findErr } = await admin
    .from("deliveries")
    .select("id")
    .eq("share_token", token)
    .single();

  if (findErr || !delivery) {
    return NextResponse.json({ error: "Ungültiger Link." }, { status: 404 });
  }

  const { data: existing } = await admin
    .from("delivery_placements")
    .select("id, delivery_id")
    .eq("id", id)
    .maybeSingle();

  if (!existing || existing.delivery_id !== delivery.id) {
    return NextResponse.json(
      { error: "Eintrag nicht gefunden." },
      { status: 404 },
    );
  }

  const mengeNum =
    body.menge === "" || body.menge == null
      ? null
      : Math.max(0, Math.trunc(Number(body.menge) || 0)) || null;

  const { data: updated, error: updErr } = await admin
    .from("delivery_placements")
    .update({ standort_name: standort, menge: mengeNum })
    .eq("id", id)
    .select("id, standort_name, menge, created_at")
    .single();

  if (updErr || !updated) {
    return NextResponse.json(
      { error: "Speichern fehlgeschlagen." },
      { status: 500 },
    );
  }

  return NextResponse.json({ placement: updated });
}
