import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { patientVerifySchema } from "@/lib/schemas-shop";

export const runtime = "nodejs";

// Public, token-gated monatliche Patienten-Verifizierung durch die PDL
// (stabiler Hub-Link, kein Login). DSGVO: Fehlermeldungen enthalten
// keine Patientendaten; es wird nur der Status/Notiz aktualisiert.
export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as {
    token?: string;
    record_id?: string;
    status?: string;
    note?: string;
  };

  const token = (body.token ?? "").trim();
  if (!token) {
    return NextResponse.json({ error: "Token fehlt." }, { status: 400 });
  }

  const parsed = patientVerifySchema.safeParse({
    record_id: body.record_id,
    status: body.status,
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
    .select("id")
    .eq("share_token", token)
    .single();

  if (findErr || !hub) {
    return NextResponse.json({ error: "Ungültiger Link." }, { status: 404 });
  }

  // Eintrag muss zum Hub des Tokens gehören — sonst wie "nicht vorhanden".
  const { data: record, error: recErr } = await admin
    .from("patient_records")
    .select("id, hub_id")
    .eq("id", parsed.data.record_id)
    .maybeSingle();

  if (recErr || !record || record.hub_id !== hub.id) {
    return NextResponse.json(
      { error: "Eintrag nicht gefunden." },
      { status: 404 },
    );
  }

  const note = (parsed.data.note ?? "").trim();

  const { data: updated, error: updErr } = await admin
    .from("patient_records")
    .update({
      status: parsed.data.status,
      note: note || null,
      verified_at: new Date().toISOString(),
    })
    .eq("id", record.id)
    .select("id, status, note, verified_at")
    .single();

  if (updErr || !updated) {
    return NextResponse.json(
      { error: "Speichern fehlgeschlagen." },
      { status: 500 },
    );
  }

  return NextResponse.json({ record: updated });
}
