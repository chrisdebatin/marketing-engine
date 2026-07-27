import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  checkCrossHubVisit,
  flagCrossHubVisit,
  logContactOnTarget,
} from "@/lib/crm-log";
import { KONTAKT_ARTEN, kontaktArtLabel } from "@/lib/crm";
import { isPlaceKind } from "@/lib/places";

export const runtime = "nodejs";

/**
 * Konsolidiertes Schnell-Log für die PDL: EIN Formular für alles.
 * Ort eintippen (bekannte Orte werden vorgeschlagen) + Aktion wählen —
 * bekannte Orte werden zugeordnet, unbekannte automatisch als neuer
 * Ziel-Ort angelegt. Danach läuft alles wie ein normaler Kontakt:
 * Follow-up-Termin, Kontakt-Log, Auslage-Ort bei Box/Flyer.
 */
export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as {
    token?: string;
    ort_name?: string;
    target_id?: string;
    aktion?: string;
    kategorie?: string;
    adresse?: string;
    ort?: string;
    ansprechpartner?: string;
    notiz?: string;
    recare?: string;
  };

  const token = (body.token ?? "").trim();
  const ortName = (body.ort_name ?? "").trim();
  const aktion = (body.aktion ?? "").trim();
  if (!token) {
    return NextResponse.json({ error: "Token fehlt." }, { status: 400 });
  }
  if (!ortName && !(body.target_id ?? "").trim()) {
    return NextResponse.json({ error: "Ort angeben." }, { status: 400 });
  }
  if (!KONTAKT_ARTEN.some((k) => k.key === aktion)) {
    return NextResponse.json(
      { error: "Bitte Aktion wählen: Box, Flyer, Besuch oder Anruf." },
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

  const { data: targetRows } = await admin
    .from("crm_targets")
    .select("id, name")
    .eq("hub_id", hub.id);
  const targets = targetRows ?? [];

  // Ort zuordnen: explizite Auswahl > exakter Name > eindeutiger Teiltreffer.
  let targetId = (body.target_id ?? "").trim() || null;
  let matchedName: string | null = null;
  if (targetId) {
    const hit = targets.find((t) => t.id === targetId);
    if (!hit) targetId = null;
    else matchedName = hit.name;
  }
  if (!targetId && ortName) {
    const q = ortName.toLowerCase();
    const exact = targets.filter((t) => t.name.toLowerCase() === q);
    const partial =
      exact.length > 0
        ? exact
        : targets.filter(
            (t) =>
              t.name.toLowerCase().includes(q) ||
              q.includes(t.name.toLowerCase()),
          );
    if (exact.length === 1) {
      targetId = exact[0].id;
      matchedName = exact[0].name;
    } else if (exact.length === 0 && partial.length === 1) {
      targetId = partial[0].id;
      matchedName = partial[0].name;
    }
  }

  // Unbekannter Ort → automatisch zur Liste hinzufügen.
  let neu = false;
  if (!targetId) {
    const kategorie = (body.kategorie ?? "").trim();
    const { data: inserted, error: insErr } = await admin
      .from("crm_targets")
      .insert({
        hub_id: hub.id,
        name: ortName.slice(0, 200),
        kategorie: kategorie && isPlaceKind(kategorie) ? kategorie : null,
        adresse: (body.adresse ?? "").trim().slice(0, 200) || null,
        ort: (body.ort ?? "").trim().slice(0, 120) || null,
        intervall_wochen: 4,
        note: "Von der PDL selbst hinzugefügt",
      })
      .select("id, name")
      .single();
    if (insErr || !inserted) {
      return NextResponse.json(
        { error: "Ort konnte nicht angelegt werden." },
        { status: 500 },
      );
    }
    targetId = inserted.id;
    matchedName = inserted.name;
    neu = true;
  }

  // Doppel-Check: War eine andere PDL an diesem (neuen) Ort schon?
  let warnung: string | null = null;
  if (neu && targetId) {
    const match = await checkCrossHubVisit(
      hub.id,
      matchedName ?? ortName,
      (body.ort ?? "").trim() || null,
    );
    if (match) warnung = await flagCrossHubVisit(targetId, match);
  }

  const logged = await logContactOnTarget({
    hubId: hub.id,
    targetId,
    kontaktArt: aktion,
    ansprechpartner: body.ansprechpartner,
    note: body.notiz,
    recare: body.recare,
  });
  if (!logged.ok) {
    return NextResponse.json({ error: logged.error }, { status: 500 });
  }

  // Frischer Stand der Liste, damit die Seite sofort stimmt.
  const { data: freshRows } = await admin
    .from("crm_targets")
    .select("*")
    .eq("hub_id", hub.id)
    .order("name");

  return NextResponse.json({
    result: {
      ort: matchedName ?? ortName,
      aktion: kontaktArtLabel(aktion),
      art: aktion,
      neu,
      contactId: logged.data.contactId,
      warnung,
    },
    targets: freshRows ?? [],
  });
}
