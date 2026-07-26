import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { todayIso } from "@/lib/crm";

export const runtime = "nodejs";

// Public, token-gated: Die PDL hakt einen Besuch bei einem Ziel-Ort ab.
// letzter_besuch = heute; naechster_besuch = heute + intervall_wochen —
// so entsteht automatisch das Follow-up ("in 3 Wochen wieder").
export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as {
    token?: string;
    id?: string;
    note?: string;
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
  next.setDate(next.getDate() + (target.intervall_wochen || 3) * 7);
  const naechster = next.toISOString().slice(0, 10);

  const { data: updated, error: updErr } = await admin
    .from("crm_targets")
    .update({
      letzter_besuch: today,
      naechster_besuch: naechster,
      besuchs_notiz: (body.note ?? "").trim().slice(0, 500) || null,
    })
    .eq("id", id)
    .select(
      "id, name, kategorie, adresse, ort, intervall_wochen, letzter_besuch, naechster_besuch, besuchs_notiz",
    )
    .single();

  if (updErr || !updated) {
    return NextResponse.json(
      { error: "Speichern fehlgeschlagen." },
      { status: 500 },
    );
  }

  return NextResponse.json({ target: updated });
}
