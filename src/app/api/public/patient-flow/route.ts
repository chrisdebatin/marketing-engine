import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { patientFlowSchema } from "@/lib/schemas-shop";
import { leistungenForHub } from "@/lib/leistungen";

export const runtime = "nodejs";

// Public, token-gated: Die PDL erfasst einen monatlichen Patienten-Zugang
// oder -Abgang je SGB-Leistungsart für ihren Hub. DSGVO: nur Anzeigename +
// optionale Referenz-ID, keine Patientendaten in Fehlern/Logs.
export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as {
    token?: string;
    period?: string;
    flow?: string;
    leistung?: string;
    display_name?: string;
    reference_id?: string;
  };

  const token = (body.token ?? "").trim();
  if (!token) {
    return NextResponse.json({ error: "Token fehlt." }, { status: 400 });
  }

  const parsed = patientFlowSchema.safeParse({
    period: body.period,
    flow: body.flow,
    leistung: body.leistung,
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
    .select("id, name")
    .eq("share_token", token)
    .single();

  if (findErr || !hub) {
    return NextResponse.json({ error: "Ungültiger Link." }, { status: 404 });
  }

  // Leistung muss zur Hub-Art passen (Pflege vs. Alltagshilfe).
  if (!leistungenForHub(hub.name).some((l) => l.key === parsed.data.leistung)) {
    return NextResponse.json({ error: "Leistung wählen." }, { status: 400 });
  }

  const { data: inserted, error: insErr } = await admin
    .from("patient_flows")
    .insert({
      hub_id: hub.id,
      period: parsed.data.period,
      flow: parsed.data.flow,
      leistung: parsed.data.leistung,
      display_name: parsed.data.display_name,
      reference_id: parsed.data.reference_id || null,
    })
    .select("id, period, flow, leistung, display_name, reference_id")
    .single();

  if (insErr || !inserted) {
    console.error("patient-flow: insert failed:", insErr?.code);
    return NextResponse.json(
      { error: "Speichern fehlgeschlagen. Bitte später erneut versuchen." },
      { status: 500 },
    );
  }

  return NextResponse.json({ entry: inserted });
}

// Eintrag wieder entfernen (Korrektur durch die PDL). Der Eintrag muss zum
// Hub des Tokens gehören — sonst wie "nicht vorhanden".
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
    .from("patient_flows")
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
    .from("patient_flows")
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
