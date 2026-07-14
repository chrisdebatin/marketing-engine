import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { orderInputSchema } from "@/lib/orders";

export const runtime = "nodejs";

// Public, token-gated material order via the stable PDL hub link. No login.
export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as {
    token?: string;
    material?: string;
    quantity?: number | string;
    note?: string;
  };

  const token = (body.token ?? "").trim();
  if (!token) {
    return NextResponse.json({ error: "Token fehlt." }, { status: 400 });
  }

  const parsed = orderInputSchema.safeParse({
    material: body.material,
    quantity: body.quantity,
    note: body.note,
  });
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Ungültige Eingabe." },
      { status: 400 },
    );
  }

  const admin = createAdminClient();

  const { data: hub, error: findErr } = await admin
    .from("hubs")
    .select("id, name")
    .eq("share_token", token)
    .single();

  if (findErr || !hub) {
    return NextResponse.json({ error: "Ungültiger Link." }, { status: 404 });
  }

  const { data: inserted, error: insErr } = await admin
    .from("orders")
    .insert({
      hub_id: hub.id,
      hub_input: hub.name,
      material: parsed.data.material,
      quantity: parsed.data.quantity,
      note: parsed.data.note || null,
      source: "pdl",
      status: "neu",
    })
    .select("id, material, quantity, status, note, created_at")
    .single();

  if (insErr) {
    return NextResponse.json({ error: insErr.message }, { status: 500 });
  }

  return NextResponse.json({ order: inserted });
}
