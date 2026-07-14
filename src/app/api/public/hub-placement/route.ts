import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";

// Public, token-gated per-hub placement (stable PDL link). No login.
export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as {
    token?: string;
    standort_name?: string;
    menge?: number | string | null;
    kind?: string;
  };

  const token = (body.token ?? "").trim();
  const standort = (body.standort_name ?? "").trim();
  const kind = body.kind === "box" ? "box" : "flyer";
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

  const { data: inserted, error: insErr } = await admin
    .from("delivery_placements")
    .insert({
      hub_id: hub.id,
      delivery_id: null,
      standort_name: standort,
      menge: mengeNum,
      kind,
    })
    .select("id, standort_name, menge, kind, created_at")
    .single();

  if (insErr) {
    return NextResponse.json({ error: insErr.message }, { status: 500 });
  }

  return NextResponse.json({ placement: inserted });
}
