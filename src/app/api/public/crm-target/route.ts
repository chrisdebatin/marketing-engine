import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isPlaceKind } from "@/lib/places";
import { checkCrossHubVisit, flagCrossHubVisit } from "@/lib/crm-log";

export const runtime = "nodejs";

// Public, token-gated: Die PDL fügt ihrer Besuchs-Liste selbst einen Ort
// hinzu (zusätzlich zu den zentral vorgegebenen). Gleiches Follow-up-Prinzip.
export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as {
    token?: string;
    name?: string;
    kategorie?: string;
    adresse?: string;
    ort?: string;
    info?: string;
  };

  const token = (body.token ?? "").trim();
  const name = (body.name ?? "").trim();
  if (!token) {
    return NextResponse.json({ error: "Token fehlt." }, { status: 400 });
  }
  if (!name) {
    return NextResponse.json({ error: "Name angeben." }, { status: 400 });
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

  const kategorie = (body.kategorie ?? "").trim();
  const info = (body.info ?? "").trim().slice(0, 500);
  const { data: inserted, error: insErr } = await admin
    .from("crm_targets")
    .insert({
      hub_id: hub.id,
      name: name.slice(0, 200),
      kategorie: kategorie && isPlaceKind(kategorie) ? kategorie : null,
      adresse: (body.adresse ?? "").trim().slice(0, 200) || null,
      ort: (body.ort ?? "").trim().slice(0, 120) || null,
      intervall_wochen: 4,
      note: (info ? info + " · " : "") + "Von der PDL selbst hinzugefügt",
    })
    .select(
      "id, name, kategorie, adresse, ort, note, intervall_wochen, letzter_besuch, naechster_besuch, besuchs_notiz",
    )
    .single();

  if (insErr || !inserted) {
    return NextResponse.json(
      { error: "Speichern fehlgeschlagen." },
      { status: 500 },
    );
  }

  // Doppel-Check: War eine andere PDL an diesem Ort schon?
  let warnung: string | null = null;
  const match = await checkCrossHubVisit(
    hub.id,
    name,
    (body.ort ?? "").trim() || null,
  );
  if (match) {
    warnung = await flagCrossHubVisit(inserted.id, match);
    const { data: fresh } = await admin
      .from("crm_targets")
      .select("*")
      .eq("id", inserted.id)
      .single();
    return NextResponse.json({ target: fresh ?? inserted, warnung });
  }
  return NextResponse.json({ target: inserted, warnung });
}
