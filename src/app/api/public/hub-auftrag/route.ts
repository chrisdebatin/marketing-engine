import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";

/**
 * PDL hakt einen Vor-Ort-Auftrag ab, den das Call-Center im Telefonat
 * zugesagt hat (token-gated über den Standort-Link). Der Auftrag muss zum
 * Standort des Tokens gehören.
 */
export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as {
    token?: string;
    id?: string;
  };
  const token = (body.token ?? "").trim();
  const id = (body.id ?? "").trim();
  if (!token || !id) {
    return NextResponse.json({ error: "Ungültige Angaben." }, { status: 400 });
  }

  const admin = createAdminClient();
  const { data: hub } = await admin
    .from("hubs")
    .select("id, pdl_name, name")
    .eq("share_token", token)
    .maybeSingle();
  if (!hub) return NextResponse.json({ error: "Ungültiger Link." }, { status: 404 });

  const { data: auftrag } = await admin
    .from("pdl_auftraege")
    .select("id, hub_id")
    .eq("id", id)
    .maybeSingle();
  if (!auftrag || auftrag.hub_id !== hub.id) {
    return NextResponse.json({ error: "Auftrag nicht gefunden." }, { status: 404 });
  }

  const { error } = await admin
    .from("pdl_auftraege")
    .update({
      status: "erledigt",
      erledigt_at: new Date().toISOString(),
      erledigt_von: hub.pdl_name ?? hub.name,
    })
    .eq("id", id);
  if (error) {
    return NextResponse.json({ error: "Speichern fehlgeschlagen." }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
