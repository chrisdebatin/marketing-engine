import { createAdminClient } from "@/lib/supabase/admin";
import { todayIso } from "@/lib/crm";

/**
 * Gemeinsame Log-Logik für das PDL-CRM: Kontakt auf einen Ziel-Ort buchen.
 * Wird von /api/public/crm-visit (Formular) und /api/public/crm-log
 * (KI-Freitext) genutzt.
 *
 * - letzter_besuch = heute, naechster_besuch = heute + intervall_wochen
 * - Eintrag ins Kontakt-Log (fehlertolerant, solange 0027/0029 fehlen)
 * - Box/Flyer erzeugen zusätzlich einen Auslage-Ort (delivery_placements),
 *   damit Karte und Statistiken stimmen — kein doppeltes Loggen nötig.
 */

// Spalten/Tabellen späterer Migrationen fehlen evtl. — dann ohne sie weiter.
export function isMissingColumn(err: { code?: string } | null): boolean {
  return (
    err?.code === "PGRST204" || err?.code === "42703" || err?.code === "PGRST205"
  );
}

export const TARGET_COLS =
  "id, name, kategorie, adresse, ort, note, intervall_wochen, letzter_besuch, naechster_besuch, besuchs_notiz";

export interface LoggedContact {
  target: Record<string, unknown>;
  placementCreated: boolean;
}

export async function logContactOnTarget(input: {
  hubId: string;
  targetId: string;
  kontaktArt: string;
  ansprechpartner?: string;
  note?: string;
  recare?: string;
}): Promise<{ ok: true; data: LoggedContact } | { ok: false; error: string }> {
  const admin = createAdminClient();

  const { data: target } = await admin
    .from("crm_targets")
    .select("id, hub_id, intervall_wochen")
    .eq("id", input.targetId)
    .maybeSingle();
  if (!target || target.hub_id !== input.hubId) {
    return { ok: false, error: "Ziel-Ort nicht gefunden." };
  }

  const today = todayIso();
  const next = new Date();
  next.setDate(next.getDate() + (target.intervall_wochen || 4) * 7);
  const naechster = next.toISOString().slice(0, 10);
  const ansprechpartner = (input.ansprechpartner ?? "").trim().slice(0, 200);
  const note = (input.note ?? "").trim().slice(0, 1000);
  const recare = (input.recare ?? "").trim();

  const base = {
    letzter_besuch: today,
    naechster_besuch: naechster,
    besuchs_notiz: note || null,
  };
  const recarePatch =
    recare === "ja"
      ? { recare_partner: true }
      : recare === "nein"
        ? { recare_partner: false }
        : {};

  let { data: updated, error: updErr } = await admin
    .from("crm_targets")
    .update({
      ...base,
      ...recarePatch,
      ansprechpartner: ansprechpartner || null,
      letzte_kontakt_art: input.kontaktArt,
    })
    .eq("id", target.id)
    .select(`${TARGET_COLS}, ansprechpartner, letzte_kontakt_art, recare_partner, plan`)
    .single();
  if (updErr && isMissingColumn(updErr)) {
    ({ data: updated, error: updErr } = await admin
      .from("crm_targets")
      .update(base)
      .eq("id", target.id)
      .select(TARGET_COLS)
      .single());
  }
  if (updErr || !updated) {
    return { ok: false, error: "Speichern fehlgeschlagen." };
  }

  // Kontakt-Log; tolerant, falls Tabelle/Constraint noch alt ist (0027/0029).
  await admin.from("crm_contacts").insert({
    target_id: target.id,
    hub_id: input.hubId,
    kontakt_art: input.kontaktArt,
    ansprechpartner: ansprechpartner || null,
    note: note || null,
    contact_date: today,
  });

  // Box/Flyer zählen automatisch als Auslage-Ort.
  let placementCreated = false;
  if (input.kontaktArt === "box" || input.kontaktArt === "flyer") {
    const { data: full } = await admin
      .from("crm_targets")
      .select("name, kategorie, adresse, ort")
      .eq("id", target.id)
      .single();
    if (full) {
      const { error: plErr } = await admin.from("delivery_placements").insert({
        hub_id: input.hubId,
        delivery_id: null,
        standort_name: full.name,
        menge: null,
        kind: input.kontaktArt,
        place_kind: full.kategorie ?? "krankenhaus",
        adresse: full.adresse ?? null,
        ort: full.ort ?? null,
      });
      placementCreated = !plErr;
    }
  }

  return {
    ok: true,
    data: { target: updated as Record<string, unknown>, placementCreated },
  };
}
