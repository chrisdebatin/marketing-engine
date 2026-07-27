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
  /** Id des Log-Eintrags (null, solange crm_contacts fehlt/alt ist). */
  contactId: string | null;
}

/**
 * Ziel-Ort nach Log-Änderung (Kontakt editiert/gelöscht) neu ableiten:
 * letzter/nächster Termin, Notiz und Kontakt-Art kommen vom neuesten
 * verbliebenen Log-Eintrag — ohne Einträge zurück auf "Erstkontakt".
 */
export async function resyncTargetFromLog(
  hubId: string,
  targetId: string,
): Promise<Record<string, unknown> | null> {
  const admin = createAdminClient();
  const { data: target } = await admin
    .from("crm_targets")
    .select("id, hub_id, intervall_wochen")
    .eq("id", targetId)
    .maybeSingle();
  if (!target || target.hub_id !== hubId) return null;

  const { data: contacts } = await admin
    .from("crm_contacts")
    .select("kontakt_art, ansprechpartner, note, contact_date")
    .eq("target_id", targetId)
    .order("contact_date", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(1);
  const newest = (contacts ?? [])[0];

  let base: {
    letzter_besuch: string | null;
    naechster_besuch: string | null;
    besuchs_notiz: string | null;
  };
  let extra: { letzte_kontakt_art: string | null; ansprechpartner?: string | null };
  if (newest) {
    const next = new Date(newest.contact_date + "T12:00:00");
    next.setDate(next.getDate() + (target.intervall_wochen || 4) * 7);
    base = {
      letzter_besuch: newest.contact_date,
      naechster_besuch: next.toISOString().slice(0, 10),
      besuchs_notiz: newest.note ?? null,
    };
    extra = {
      letzte_kontakt_art: newest.kontakt_art ?? null,
      ansprechpartner: newest.ansprechpartner ?? null,
    };
  } else {
    base = { letzter_besuch: null, naechster_besuch: null, besuchs_notiz: null };
    extra = { letzte_kontakt_art: null };
  }

  let { data: updated } = await admin
    .from("crm_targets")
    .update({ ...base, ...extra })
    .eq("id", targetId)
    .select(`${TARGET_COLS}, ansprechpartner, letzte_kontakt_art, recare_partner, plan`)
    .single();
  if (!updated) {
    ({ data: updated } = await admin
      .from("crm_targets")
      .update(base)
      .eq("id", targetId)
      .select(TARGET_COLS)
      .single());
  }
  return (updated as Record<string, unknown>) ?? null;
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
  const { data: contactRow } = await admin
    .from("crm_contacts")
    .insert({
      target_id: target.id,
      hub_id: input.hubId,
      kontakt_art: input.kontaktArt,
      ansprechpartner: ansprechpartner || null,
      note: note || null,
      contact_date: today,
    })
    .select("id")
    .single();

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
    data: {
      target: updated as Record<string, unknown>,
      placementCreated,
      contactId: contactRow?.id ?? null,
    },
  };
}

/** Namens-Normalisierung für den Abgleich Auslage-Ort ↔ CRM-Ziel. */
function normName(s: string): string {
  return s
    .toLowerCase()
    .replace(/\(.*?\)/g, "")
    .replace(/[^a-zäöüß0-9]+/g, " ")
    .replace(
      /\b(krankenhaus|klinikum|kliniken|klinik|hospital|st|sankt|ev|evangelisches|agaplesion|helios|sana)\b/g,
      "",
    )
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Auslage (delivery_placements) ins CRM übernehmen: passenden Ziel-Ort
 * suchen (fuzzy), sonst anlegen; Kontakt loggen und den Ziel-Ort neu
 * ableiten. Fehlertolerant — eine Auslage darf nie am CRM scheitern.
 */
export async function syncPlacementToCrm(input: {
  hubId: string;
  name: string;
  kind: string; // box | flyer
  placeKind?: string | null;
  adresse?: string | null;
  ort?: string | null;
}): Promise<void> {
  try {
    const admin = createAdminClient();
    const { data: targets } = await admin
      .from("crm_targets")
      .select("id, name")
      .eq("hub_id", input.hubId);
    const n = normName(input.name);
    let target = (targets ?? []).find((t) => {
      const h = normName(t.name);
      return (
        h === n ||
        (h.includes(n) && n.length >= 10) ||
        (n.includes(h) && h.length >= 10)
      );
    });

    if (!target) {
      const { data: created } = await admin
        .from("crm_targets")
        .insert({
          hub_id: input.hubId,
          name: input.name.slice(0, 200),
          kategorie: input.placeKind ?? null,
          adresse: input.adresse ?? null,
          ort: input.ort ?? null,
          intervall_wochen: 4,
          note: "Von der PDL erfasst (Auslage)",
        })
        .select("id, name")
        .single();
      if (!created) return;
      target = created;
    }

    await admin.from("crm_contacts").insert({
      target_id: target.id,
      hub_id: input.hubId,
      kontakt_art: input.kind === "box" ? "box" : "flyer",
      contact_date: todayIso(),
    });
    await resyncTargetFromLog(input.hubId, target.id);
  } catch (err) {
    console.error("syncPlacementToCrm fehlgeschlagen:", err);
  }
}
