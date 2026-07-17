import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { patientClaimSchema } from "@/lib/schemas-shop";

export const runtime = "nodejs";

// Public, token-gated: Die PDL ordnet einen Namen aus dem Monats-Pool ihrem
// Hub zu. Der Eintrag wird VERSCHOBEN (verschwindet beim bisherigen Hub) und
// gilt als bestätigt mit source='pdl' — die PDL ordnet ihn ja zu, WEIL er zu
// ihrem Standort gehört. DSGVO: keine Patientendaten in Fehlern/Logs.
export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as {
    token?: string;
    record_id?: string;
  };

  const token = (body.token ?? "").trim();
  if (!token) {
    return NextResponse.json({ error: "Token fehlt." }, { status: 400 });
  }

  const parsed = patientClaimSchema.safeParse({ record_id: body.record_id });
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

  const { data: record } = await admin
    .from("patient_records")
    .select("id, hub_id, batch_id")
    .eq("id", parsed.data.record_id)
    .maybeSingle();

  if (!record) {
    return NextResponse.json(
      { error: "Eintrag nicht gefunden — evtl. wurde er gerade von einem anderen Standort übernommen." },
      { status: 404 },
    );
  }
  if (record.hub_id === hub.id) {
    return NextResponse.json(
      { error: "Dieser Eintrag gehört bereits zu Ihrem Standort." },
      { status: 409 },
    );
  }

  // Monat des Quell-Batches — der Eintrag wandert in die eigene Liste
  // desselben Monats (Batch wird bei Bedarf angelegt).
  const { data: sourceBatch } = await admin
    .from("patient_batches")
    .select("id, period")
    .eq("id", record.batch_id)
    .maybeSingle();

  if (!sourceBatch) {
    return NextResponse.json(
      { error: "Liste nicht gefunden." },
      { status: 404 },
    );
  }

  const { data: ownBatch } = await admin
    .from("patient_batches")
    .select("id")
    .eq("hub_id", hub.id)
    .eq("period", sourceBatch.period)
    .maybeSingle();

  let targetBatchId = ownBatch?.id ?? null;
  if (!targetBatchId) {
    const { data: created, error: batchErr } = await admin
      .from("patient_batches")
      .insert({ hub_id: hub.id, period: sourceBatch.period })
      .select("id")
      .single();
    if (batchErr || !created) {
      return NextResponse.json(
        { error: "Speichern fehlgeschlagen. Bitte später erneut versuchen." },
        { status: 500 },
      );
    }
    targetBatchId = created.id;
  }

  // Verschieben + direkt bestätigen; alte Notiz/Entscheidung gehört zum
  // bisherigen Hub und wird zurückgesetzt.
  const { data: moved, error: moveErr } = await admin
    .from("patient_records")
    .update({
      hub_id: hub.id,
      batch_id: targetBatchId,
      status: "bestaetigt",
      source: "pdl",
      note: null,
      verified_at: new Date().toISOString(),
    })
    .eq("id", record.id)
    .select("id, display_name, reference_id, status, source, note")
    .single();

  if (moveErr || !moved) {
    console.error("patient-claim: move failed:", moveErr?.code);
    return NextResponse.json(
      { error: "Speichern fehlgeschlagen. Bitte später erneut versuchen." },
      { status: 500 },
    );
  }

  return NextResponse.json({ record: moved, period: sourceBatch.period });
}
