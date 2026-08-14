import { NextResponse } from "next/server";
import { requireSession } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { bewerteBewerbung } from "@/lib/bewerber";

export const runtime = "nodejs";

/**
 * Bewerbung an einen Standort weiterleiten (nur eingeloggte Nutzer). Die PDL
 * sieht sie danach unter "Meine Bewerber". Idempotent über
 * (quelle, quelle_id) — doppeltes Weiterleiten aktualisiert nur den Standort.
 */
export async function POST(req: Request) {
  const session = await requireSession().catch(() => null);
  if (!session) {
    return NextResponse.json({ error: "Nicht angemeldet." }, { status: 401 });
  }

  const body = (await req.json().catch(() => ({}))) as {
    quelle?: string;
    quelle_id?: string;
    name?: string;
    telefon?: string | null;
    email?: string | null;
    rolle?: string | null;
    kampagne?: string | null;
    hub_id?: string;
  };

  const quelle = (body.quelle ?? "").trim();
  const quelleId = (body.quelle_id ?? "").trim();
  const hubId = (body.hub_id ?? "").trim();
  const name = (body.name ?? "").trim();
  if (!["meta", "website"].includes(quelle) || !quelleId || !hubId || !name) {
    return NextResponse.json({ error: "Ungültige Angaben." }, { status: 400 });
  }

  const admin = createAdminClient();
  const { data: hub } = await admin
    .from("hubs")
    .select("id, name")
    .eq("id", hubId)
    .maybeSingle();
  if (!hub) {
    return NextResponse.json({ error: "Standort nicht gefunden." }, { status: 404 });
  }

  const telefon = (body.telefon ?? "")?.trim() || null;
  const email = (body.email ?? "")?.trim() || null;
  const rolle = (body.rolle ?? "")?.trim() || null;
  const { score, grund } = bewerteBewerbung({ telefon, email, rolle });

  const { error } = await admin.from("bewerber").upsert(
    {
      quelle,
      quelle_id: quelleId,
      name: name.slice(0, 200),
      telefon,
      email,
      rolle,
      kampagne: (body.kampagne ?? "")?.trim() || null,
      hub_id: hub.id,
      score,
      score_grund: grund,
      weitergeleitet_von: session.profile?.name?.trim() || "Admin",
      zugewiesen_at: new Date().toISOString(),
    },
    { onConflict: "quelle,quelle_id" },
  );
  if (error) {
    return NextResponse.json(
      {
        error:
          "Weiterleiten fehlgeschlagen — fehlt die Tabelle bewerber? (supabase/apply_all_pending.sql ausführen)",
      },
      { status: 500 },
    );
  }

  return NextResponse.json({ ok: true, hub: hub.name, score });
}
