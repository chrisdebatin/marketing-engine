import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { patientAddSchema } from "@/lib/schemas-shop";

export const runtime = "nodejs";

// Public, token-gated: Die PDL ergänzt einen Patienten, der in der zentralen
// Monatsliste fehlt. Eintrag entsteht mit source='pdl' und status='bestaetigt'
// (die PDL fügt ihn ja hinzu, WEIL er da ist). DSGVO: keine Patientendaten in
// Fehlermeldungen oder Logs.
export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as {
    token?: string;
    batch_id?: string;
    display_name?: string;
    reference_id?: string;
  };

  const token = (body.token ?? "").trim();
  if (!token) {
    return NextResponse.json({ error: "Token fehlt." }, { status: 400 });
  }

  const parsed = patientAddSchema.safeParse({
    batch_id: body.batch_id,
    display_name: body.display_name,
    reference_id: body.reference_id,
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

  // Die Liste muss zum Hub des Tokens gehören — sonst wie "nicht vorhanden".
  const { data: batch, error: batchErr } = await admin
    .from("patient_batches")
    .select("id, hub_id")
    .eq("id", parsed.data.batch_id)
    .maybeSingle();

  if (batchErr || !batch || batch.hub_id !== hub.id) {
    return NextResponse.json(
      { error: "Liste nicht gefunden." },
      { status: 404 },
    );
  }

  const { data: inserted, error: insErr } = await admin
    .from("patient_records")
    .insert({
      batch_id: batch.id,
      hub_id: hub.id,
      display_name: parsed.data.display_name,
      reference_id: parsed.data.reference_id || null,
      status: "bestaetigt",
      source: "pdl",
      verified_at: new Date().toISOString(),
    })
    .select("id, display_name, reference_id, status, source, note")
    .single();

  if (insErr || !inserted) {
    console.error("patient-add: insert failed:", insErr?.code);
    return NextResponse.json(
      { error: "Speichern fehlgeschlagen. Bitte später erneut versuchen." },
      { status: 500 },
    );
  }

  return NextResponse.json({ record: inserted });
}
