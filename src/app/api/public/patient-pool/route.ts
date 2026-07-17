import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { patientPoolSchema } from "@/lib/schemas-shop";

export const runtime = "nodejs";

// Public, token-gated: Namens-Pool eines Monats für die PDL — alle Namen,
// die aktuell auf Listen ANDERER Hubs stehen, damit die PDL Patienten
// findet, die eigentlich zu ihrem Hub gehören (Zuordnen via patient-claim).
// DSGVO — Datenminimierung: bewusst OHNE Hub-Zuordnung, nur Name + Referenz;
// Namen, die bereits auf der eigenen Liste stehen, werden herausgefiltert.
// POST statt GET, damit der Token nicht in URLs/Server-Logs landet.
export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as {
    token?: string;
    period?: string;
  };

  const token = (body.token ?? "").trim();
  if (!token) {
    return NextResponse.json({ error: "Token fehlt." }, { status: 400 });
  }

  const parsed = patientPoolSchema.safeParse({ period: body.period });
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

  // Alle Batches des Monats (über alle Hubs); Records dann in einer zweiten
  // einfachen Abfrage (keine Embedded-Relation-Selects, hand-written Types).
  const { data: batches } = await admin
    .from("patient_batches")
    .select("id, hub_id")
    .eq("period", parsed.data.period);

  const batchList = batches ?? [];
  const foreignBatchIds = batchList
    .filter((b) => b.hub_id !== hub.id)
    .map((b) => b.id);

  if (foreignBatchIds.length === 0) {
    return NextResponse.json({ names: [] });
  }

  const { data: records, error: recErr } = await admin
    .from("patient_records")
    .select("id, hub_id, display_name, reference_id")
    .in("batch_id", foreignBatchIds)
    .order("display_name");

  if (recErr) {
    return NextResponse.json(
      { error: "Laden fehlgeschlagen. Bitte später erneut versuchen." },
      { status: 500 },
    );
  }

  // Namen, die schon auf der eigenen Monatsliste stehen, nicht anbieten.
  const ownBatchIds = batchList
    .filter((b) => b.hub_id === hub.id)
    .map((b) => b.id);
  const ownNames = new Set<string>();
  if (ownBatchIds.length > 0) {
    const { data: ownRecords } = await admin
      .from("patient_records")
      .select("display_name")
      .in("batch_id", ownBatchIds);
    for (const r of ownRecords ?? []) {
      ownNames.add(r.display_name.trim().toLowerCase());
    }
  }

  const names = (records ?? [])
    .filter((r) => !ownNames.has(r.display_name.trim().toLowerCase()))
    .map((r) => ({
      id: r.id,
      display_name: r.display_name,
      reference_id: r.reference_id,
    }));

  return NextResponse.json({ names });
}
