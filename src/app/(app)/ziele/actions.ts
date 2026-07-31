"use server";

import { revalidatePath } from "next/cache";
import { requireSession } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { isPlaceKind, PLACE_KINDS } from "@/lib/places";
import { deriveGeoTag, normalizeGeoTag } from "@/lib/geo-tags";
import { normName } from "@/lib/crm-log";
import { todayIso } from "@/lib/crm";
import { getFollowupWeeks } from "@/lib/settings";

type Result = { ok: true } | { ok: false; error: string };

function revalidate() {
  revalidatePath("/ziele");
  revalidatePath("/hubs/[id]", "page");
  revalidatePath("/f/[token]", "page");
}

/** `crm_targets` fehlt bis Migration 0026 — dann klare Meldung statt 500. */
function missingTableError(code?: string): { ok: false; error: string } | null {
  if (code === "PGRST205" || code === "42P01") {
    return {
      ok: false,
      error:
        "Die Tabelle crm_targets fehlt noch — bitte supabase/apply_all_pending.sql im Supabase SQL-Editor ausführen.",
    };
  }
  return null;
}

const PLAN_KEYS = ["box", "flyer", "besuch", "anruf"] as const;

function cleanTarget(input: {
  name?: string;
  kategorie?: string;
  adresse?: string;
  ort?: string;
  note?: string;
  plan?: string;
  relevanz?: number | string;
  intervall_wochen?: number | string;
  geo_tag?: string;
}):
  | {
      ok: true;
      row: {
        name: string;
        kategorie: string | null;
        adresse: string | null;
        ort: string | null;
        note: string | null;
        plan: string | null;
        relevanz: number | null;
        intervall_wochen: number;
        geo_tag: string | null;
      };
    }
  | { ok: false; error: string } {
  const name = (input.name ?? "").trim();
  if (!name) return { ok: false, error: "Name des Ziel-Ortes angeben." };
  if (name.length > 200) {
    return { ok: false, error: "Name zu lang (max. 200 Zeichen)." };
  }
  const intervall = Math.trunc(Number(input.intervall_wochen ?? 3)) || 3;
  if (intervall < 1 || intervall > 52) {
    return { ok: false, error: "Intervall zwischen 1 und 52 Wochen." };
  }
  const kategorie = (input.kategorie ?? "").trim();
  const ort = (input.ort ?? "").trim().slice(0, 120) || null;
  return {
    ok: true,
    row: {
      name,
      kategorie: kategorie && isPlaceKind(kategorie) ? kategorie : null,
      adresse: (input.adresse ?? "").trim().slice(0, 200) || null,
      ort,
      note: (input.note ?? "").trim().slice(0, 1000) || null,
      plan: PLAN_KEYS.includes((input.plan ?? "").trim() as (typeof PLAN_KEYS)[number])
        ? (input.plan ?? "").trim()
        : null,
      relevanz: [1, 2, 3].includes(Math.trunc(Number(input.relevanz)))
        ? Math.trunc(Number(input.relevanz))
        : null,
      intervall_wochen: intervall,
      geo_tag: normalizeGeoTag(input.geo_tag) ?? deriveGeoTag({ ort }),
    },
  };
}

/** Spalte plan fehlt bis Migration 0029 — dann ohne sie erneut versuchen. */
function isMissingColumn(code?: string): boolean {
  return code === "PGRST204" || code === "42703";
}

export async function createCrmTarget(input: {
  hub_id?: string;
  name?: string;
  kategorie?: string;
  adresse?: string;
  ort?: string;
  note?: string;
  plan?: string;
  relevanz?: number | string;
  intervall_wochen?: number | string;
  geo_tag?: string;
}): Promise<Result> {
  const session = await requireSession();
  const parsed = cleanTarget(input);
  if (!parsed.ok) return parsed;

  const admin = createAdminClient();
  const hubId = (input.hub_id ?? "").trim() || null;
  const row = {
    ...parsed.row,
    hub_id: hubId,
    geo_tag:
      parsed.row.geo_tag ??
      deriveGeoTag({
        hubName: session.hubs.find((h) => h.id === hubId)?.name ?? null,
      }),
  };
  let { error } = await admin.from("crm_targets").insert(row);
  if (error && isMissingColumn(error.code)) {
    ({ error } = await admin
      .from("crm_targets")
      .insert({ ...row, plan: undefined, relevanz: undefined, geo_tag: undefined }));
  }
  if (error) {
    return (
      missingTableError(error.code) ?? {
        ok: false,
        error: "Speichern fehlgeschlagen.",
      }
    );
  }
  revalidate();
  return { ok: true };
}

/**
 * Bulk-Import: eine Zeile pro Ziel-Ort im Format
 * "Name; Adresse; Ort" (Adresse/Ort optional; auch Tab als Trenner).
 */
export async function importCrmTargets(input: {
  hub_id?: string;
  text: string;
  intervall_wochen?: number | string;
}): Promise<Result & { created?: number }> {
  await requireSession();
  const hubId = (input.hub_id ?? "").trim() || null;
  const intervall = Math.trunc(Number(input.intervall_wochen ?? 3)) || 3;

  const rows: {
    hub_id: string | null;
    name: string;
    adresse: string | null;
    ort: string | null;
    intervall_wochen: number;
    geo_tag: string | null;
  }[] = [];
  for (const raw of (input.text ?? "").split(/\r?\n/)) {
    const line = raw.trim();
    if (!line) continue;
    const parts = line.split(/;|\t/).map((s) => s.trim());
    const name = parts[0];
    if (!name) continue;
    const ort = (parts[2] ?? "").slice(0, 120) || null;
    rows.push({
      hub_id: hubId,
      name: name.slice(0, 200),
      adresse: (parts[1] ?? "").slice(0, 200) || null,
      ort,
      intervall_wochen: Math.min(Math.max(intervall, 1), 52),
      geo_tag: deriveGeoTag({ ort }),
    });
  }
  if (rows.length === 0) {
    return { ok: false, error: "Keine Zeilen erkannt." };
  }
  if (rows.length > 500) {
    return { ok: false, error: "Zu viele Zeilen (max. 500 pro Import)." };
  }

  const admin = createAdminClient();
  let { error } = await admin.from("crm_targets").insert(rows);
  if (error && isMissingColumn(error.code)) {
    ({ error } = await admin
      .from("crm_targets")
      .insert(rows.map((r) => ({ ...r, geo_tag: undefined }))));
  }
  if (error) {
    return (
      missingTableError(error.code) ?? {
        ok: false,
        error: "Import fehlgeschlagen.",
      }
    );
  }
  revalidate();
  return { ok: true, created: rows.length };
}

export async function updateCrmTarget(
  id: string,
  input: {
    hub_id?: string;
    name?: string;
    kategorie?: string;
    adresse?: string;
    ort?: string;
    note?: string;
    plan?: string;
    relevanz?: number | string;
    intervall_wochen?: number | string;
    geo_tag?: string;
  },
): Promise<Result> {
  await requireSession();
  const cleanId = (id ?? "").trim();
  if (!cleanId) return { ok: false, error: "Ziel-Ort fehlt." };
  const parsed = cleanTarget(input);
  if (!parsed.ok) return parsed;

  const admin = createAdminClient();
  const row = { ...parsed.row, hub_id: (input.hub_id ?? "").trim() || null };
  let { error } = await admin.from("crm_targets").update(row).eq("id", cleanId);
  if (error && isMissingColumn(error.code)) {
    ({ error } = await admin
      .from("crm_targets")
      .update({ ...row, plan: undefined, relevanz: undefined, geo_tag: undefined })
      .eq("id", cleanId));
  }
  if (error) return { ok: false, error: "Speichern fehlgeschlagen." };
  revalidate();
  return { ok: true };
}

export async function deleteCrmTarget(id: string): Promise<Result> {
  await requireSession();
  const cleanId = (id ?? "").trim();
  if (!cleanId) return { ok: false, error: "Ziel-Ort fehlt." };

  const admin = createAdminClient();
  const { error } = await admin
    .from("crm_targets")
    .delete()
    .eq("id", cleanId);
  if (error) return { ok: false, error: "Löschen fehlgeschlagen." };
  revalidate();
  return { ok: true };
}

/** `crm_persons` fehlt bis Migration 0041 — dann klare Meldung statt 500. */
function missingPersonsError(
  code?: string,
): { ok: false; error: string } | null {
  if (code === "PGRST205" || code === "42P01") {
    return {
      ok: false,
      error:
        "Die Tabelle crm_persons fehlt noch — bitte supabase/apply_all_pending.sql im Supabase SQL-Editor ausführen.",
    };
  }
  return null;
}

function cleanPerson(input: {
  name?: string;
  funktion?: string;
  telefon?: string;
  email?: string;
  notiz?: string;
}):
  | {
      ok: true;
      row: {
        name: string;
        funktion: string | null;
        telefon: string | null;
        email: string | null;
        notiz: string | null;
      };
    }
  | { ok: false; error: string } {
  const name = (input.name ?? "").trim().slice(0, 200);
  if (!name) return { ok: false, error: "Name des Ansprechpartners angeben." };
  return {
    ok: true,
    row: {
      name,
      funktion: (input.funktion ?? "").trim().slice(0, 120) || null,
      telefon: (input.telefon ?? "").trim().slice(0, 60) || null,
      email: (input.email ?? "").trim().slice(0, 200) || null,
      notiz: (input.notiz ?? "").trim().slice(0, 500) || null,
    },
  };
}

/** Ansprechpartner an einem Ziel-Ort anlegen. */
export async function createCrmPerson(input: {
  target_id?: string;
  name?: string;
  funktion?: string;
  telefon?: string;
  email?: string;
  notiz?: string;
}): Promise<Result> {
  await requireSession();
  const targetId = (input.target_id ?? "").trim();
  if (!targetId) return { ok: false, error: "Ziel-Ort fehlt." };
  const parsed = cleanPerson(input);
  if (!parsed.ok) return parsed;

  const admin = createAdminClient();
  const { error } = await admin
    .from("crm_persons")
    .insert({ ...parsed.row, target_id: targetId });
  if (error) {
    return (
      missingPersonsError(error.code) ?? {
        ok: false,
        error: "Speichern fehlgeschlagen.",
      }
    );
  }
  revalidate();
  return { ok: true };
}

export async function updateCrmPerson(
  id: string,
  input: {
    name?: string;
    funktion?: string;
    telefon?: string;
    email?: string;
    notiz?: string;
  },
): Promise<Result> {
  await requireSession();
  const cleanId = (id ?? "").trim();
  if (!cleanId) return { ok: false, error: "Ansprechpartner fehlt." };
  const parsed = cleanPerson(input);
  if (!parsed.ok) return parsed;

  const admin = createAdminClient();
  const { error } = await admin
    .from("crm_persons")
    .update(parsed.row)
    .eq("id", cleanId);
  if (error) return { ok: false, error: "Speichern fehlgeschlagen." };
  revalidate();
  return { ok: true };
}

export async function deleteCrmPerson(id: string): Promise<Result> {
  await requireSession();
  const cleanId = (id ?? "").trim();
  if (!cleanId) return { ok: false, error: "Ansprechpartner fehlt." };

  const admin = createAdminClient();
  const { error } = await admin.from("crm_persons").delete().eq("id", cleanId);
  if (error) return { ok: false, error: "Löschen fehlgeschlagen." };
  revalidate();
  return { ok: true };
}

/** Eine Zeile aus der CSV-Datei, bereits auf Felder gemappt (Client). */
export interface CsvTargetRow {
  name?: string;
  adresse?: string;
  ort?: string;
  kategorie?: string;
  geo_tag?: string;
  ansprechpartner?: string;
  funktion?: string;
  telefon?: string;
  email?: string;
  status?: string;
  letzter_kontakt?: string;
  notiz?: string;
}

/** Kategorie aus der CSV: Key oder deutsches Label ("Krankenhaus") erlaubt. */
function csvKategorie(raw: string | undefined): string | null {
  const s = (raw ?? "").trim().toLowerCase();
  if (!s) return null;
  const hit = PLACE_KINDS.find(
    (p) => p.key === s || p.label.toLowerCase() === s,
  );
  if (hit) return hit.key;
  if (/klinik|krankenhaus|hospital/.test(s)) return "krankenhaus";
  if (/praxis|arzt|ärzt/.test(s)) return "praxis";
  if (/apotheke/.test(s)) return "apotheke";
  if (/pflege|heim|senioren/.test(s)) return "pflegeeinrichtung";
  if (/sanität|sanitaet/.test(s)) return "sanitaetshaus";
  return "sonstiges";
}

/** "kontaktiert"-Erkennung: alles andere gilt als offen. */
function csvKontaktiert(raw: string | undefined): boolean {
  return /kontaktiert|erledigt|erreicht|bereits|done|ja|yes|x/i.test(
    (raw ?? "").trim(),
  );
}

/** Datum aus der CSV: ISO oder deutsches Format (31.07.2026 / 31.7.26). */
function csvDatum(raw: string | undefined): string | null {
  const s = (raw ?? "").trim();
  if (!s) return null;
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
  const m = s.match(/^(\d{1,2})\.(\d{1,2})\.(\d{2,4})/);
  if (!m) return null;
  const jahr = m[3].length === 2 ? `20${m[3]}` : m[3];
  return `${jahr}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`;
}

/**
 * CSV-Import: gemappte Zeilen als neue Ziel-Orte anlegen. Duplikate zu
 * bestehenden Zielen (normalisierter Name + Ort) werden übersprungen,
 * bekommen aber trotzdem neue Ansprechpartner und einen Geo-Tag, falls
 * dort noch keiner steht. "Bereits kontaktiert" landet als Anruf im
 * Kontakt-Log, damit Follow-ups korrekt terminiert werden.
 */
export async function importCrmTargetsCsv(input: {
  hub_id?: string;
  intervall_wochen?: number | string;
  rows: CsvTargetRow[];
}): Promise<
  | {
      ok: true;
      created: number;
      uebersprungen: number;
      personen: number;
      kontakte: number;
      hinweis?: string;
    }
  | { ok: false; error: string }
> {
  const session = await requireSession();
  const hubId = (input.hub_id ?? "").trim() || null;
  const hubName = session.hubs.find((h) => h.id === hubId)?.name ?? null;
  const intervallRaw = Math.trunc(Number(input.intervall_wochen ?? 4)) || 4;
  const intervall = Math.min(Math.max(intervallRaw, 1), 52);
  const followup = await getFollowupWeeks();
  const anrufWochen = followup.anruf ?? intervall;

  const rows = (input.rows ?? [])
    .map((r) => ({
      name: (r.name ?? "").trim().slice(0, 200),
      adresse: (r.adresse ?? "").trim().slice(0, 200) || null,
      ort: (r.ort ?? "").trim().slice(0, 120) || null,
      kategorie: csvKategorie(r.kategorie),
      geo_tag: normalizeGeoTag(r.geo_tag),
      ansprechpartner: (r.ansprechpartner ?? "").trim().slice(0, 200),
      funktion: (r.funktion ?? "").trim().slice(0, 120),
      telefon: (r.telefon ?? "").trim().slice(0, 60),
      email: (r.email ?? "").trim().slice(0, 200),
      kontaktiert: csvKontaktiert(r.status),
      letzter_kontakt: csvDatum(r.letzter_kontakt),
      notiz: (r.notiz ?? "").trim().slice(0, 1000) || null,
    }))
    .filter((r) => r.name);
  if (rows.length === 0) {
    return { ok: false, error: "Keine Zeilen mit Namen erkannt." };
  }
  if (rows.length > 500) {
    return { ok: false, error: "Zu viele Zeilen (max. 500 pro Import)." };
  }

  const admin = createAdminClient();
  const { data: existing, error: exErr } = await admin
    .from("crm_targets")
    .select("id, name, ort, geo_tag");
  if (exErr) {
    return (
      missingTableError(exErr.code) ?? {
        ok: false,
        error: "Bestehende Ziel-Orte konnten nicht geladen werden.",
      }
    );
  }
  const existingNorm = (existing ?? []).map((t) => ({
    id: t.id,
    norm: normName(t.name),
    ort: (t.ort ?? "").trim().toLowerCase(),
    geo_tag: (t.geo_tag ?? "").trim(),
  }));

  const findDuplicate = (name: string, ort: string | null) => {
    const n = normName(name);
    if (!n) return null;
    const city = (ort ?? "").trim().toLowerCase();
    return (
      existingNorm.find((e) => {
        const nameMatch =
          e.norm === n ||
          (e.norm.includes(n) && n.length >= 10) ||
          (n.includes(e.norm) && e.norm.length >= 10);
        if (!nameMatch) return false;
        return !city || !e.ort || city === e.ort;
      }) ?? null
    );
  };

  // Zeilen in "neu" und "Duplikat zu bestehendem Ziel" trennen.
  const neu: typeof rows = [];
  const dupes: { row: (typeof rows)[number]; targetId: string }[] = [];
  for (const r of rows) {
    const dupe = findDuplicate(r.name, r.ort);
    if (dupe) dupes.push({ row: r, targetId: dupe.id });
    else neu.push(r);
  }

  let hinweis: string | undefined;

  // Neue Ziel-Orte anlegen (inkl. Kontakt-Status aus der CSV).
  const today = todayIso();
  const inserts = neu.map((r) => {
    const letzter = r.kontaktiert ? (r.letzter_kontakt ?? null) : null;
    const naechster = letzter
      ? (() => {
          const d = new Date(`${letzter}T12:00:00`);
          d.setDate(d.getDate() + anrufWochen * 7);
          return d.toISOString().slice(0, 10);
        })()
      : null;
    const notizTeile = [
      r.notiz,
      r.kontaktiert && !letzter ? "Bereits kontaktiert (Datum unbekannt)" : null,
    ].filter(Boolean);
    return {
      hub_id: hubId,
      name: r.name,
      kategorie: r.kategorie,
      adresse: r.adresse,
      ort: r.ort,
      note: notizTeile.join(" · ").slice(0, 1000) || null,
      intervall_wochen: intervall,
      geo_tag: r.geo_tag ?? deriveGeoTag({ ort: r.ort, hubName }),
      ansprechpartner: r.ansprechpartner || null,
      letzter_besuch: letzter,
      naechster_besuch: naechster,
      letzte_kontakt_art: letzter ? "anruf" : null,
    };
  });

  let created: { id: string; name: string }[] = [];
  if (inserts.length > 0) {
    let { data, error } = await admin
      .from("crm_targets")
      .insert(inserts)
      .select("id, name");
    if (error && isMissingColumn(error.code)) {
      hinweis =
        "Migration 0041 fehlt — Geo-Tags/Ansprechpartner wurden nicht gespeichert (supabase/apply_all_pending.sql ausführen).";
      ({ data, error } = await admin
        .from("crm_targets")
        .insert(inserts.map((r) => ({ ...r, geo_tag: undefined })))
        .select("id, name"));
    }
    if (error) {
      return (
        missingTableError(error.code) ?? {
          ok: false,
          error: "Import fehlgeschlagen.",
        }
      );
    }
    created = data ?? [];
  }

  // Ansprechpartner anlegen: für neue Ziele und für Duplikate (ohne Doppel).
  const personInserts: {
    target_id: string;
    name: string;
    funktion: string | null;
    telefon: string | null;
    email: string | null;
  }[] = [];
  neu.forEach((r, i) => {
    const targetId = created[i]?.id;
    if (!targetId) return;
    if (!r.ansprechpartner && !r.telefon && !r.email) return;
    personInserts.push({
      target_id: targetId,
      name: r.ansprechpartner || "Ansprechpartner",
      funktion: r.funktion || null,
      telefon: r.telefon || null,
      email: r.email || null,
    });
  });
  if (dupes.length > 0) {
    const dupeIds = [...new Set(dupes.map((d) => d.targetId))];
    const { data: dupePersons } = await admin
      .from("crm_persons")
      .select("target_id, name")
      .in("target_id", dupeIds);
    const known = new Set(
      (dupePersons ?? []).map(
        (p) => `${p.target_id}:${p.name.trim().toLowerCase()}`,
      ),
    );
    for (const { row: r, targetId } of dupes) {
      if (!r.ansprechpartner && !r.telefon && !r.email) continue;
      const name = r.ansprechpartner || "Ansprechpartner";
      const key = `${targetId}:${name.trim().toLowerCase()}`;
      if (known.has(key)) continue;
      known.add(key);
      personInserts.push({
        target_id: targetId,
        name,
        funktion: r.funktion || null,
        telefon: r.telefon || null,
        email: r.email || null,
      });
    }
    // Geo-Tag bei bestehenden Zielen nachtragen, wenn dort noch keiner steht.
    for (const { row: r, targetId } of dupes) {
      const ex = existingNorm.find((e) => e.id === targetId);
      const tag = r.geo_tag ?? deriveGeoTag({ ort: r.ort, hubName });
      if (ex && !ex.geo_tag && tag) {
        ex.geo_tag = tag;
        await admin
          .from("crm_targets")
          .update({ geo_tag: tag })
          .eq("id", targetId);
      }
    }
  }

  let personen = 0;
  if (personInserts.length > 0) {
    const { error: pErr } = await admin.from("crm_persons").insert(personInserts);
    if (pErr) {
      hinweis =
        missingPersonsError(pErr.code)?.error ??
        "Ansprechpartner konnten nicht gespeichert werden.";
    } else {
      personen = personInserts.length;
    }
  }

  // Kontakt-Log für importierte "bereits kontaktiert"-Zeilen mit Datum.
  const contactInserts: {
    target_id: string;
    hub_id: string | null;
    kontakt_art: string;
    ansprechpartner: string | null;
    note: string | null;
    contact_date: string;
  }[] = [];
  neu.forEach((r, i) => {
    const targetId = created[i]?.id;
    if (!targetId || !r.kontaktiert || !r.letzter_kontakt) return;
    contactInserts.push({
      target_id: targetId,
      hub_id: hubId,
      kontakt_art: "anruf",
      ansprechpartner: r.ansprechpartner || null,
      note: "Aus CSV-Import übernommen",
      contact_date: r.letzter_kontakt <= today ? r.letzter_kontakt : today,
    });
  });
  let kontakte = 0;
  if (contactInserts.length > 0) {
    const { error: cErr } = await admin
      .from("crm_contacts")
      .insert(contactInserts);
    if (!cErr) kontakte = contactInserts.length;
  }

  revalidate();
  return {
    ok: true,
    created: created.length,
    uebersprungen: dupes.length,
    personen,
    kontakte,
    hinweis,
  };
}

/** Follow-up-Rhythmus je Kontakt-Art speichern (global, app_settings). */
export async function updateFollowupWeeks(input: {
  box?: number | string;
  flyer?: number | string;
  besuch?: number | string;
  anruf?: number | string;
}): Promise<Result> {
  const session = await requireSession();
  if (!session.isAdmin) return { ok: false, error: "Nur für Admins." };

  const { saveFollowupWeeks } = await import("@/lib/settings");
  const res = await saveFollowupWeeks({
    box: Number(input.box),
    flyer: Number(input.flyer),
    besuch: Number(input.besuch),
    anruf: Number(input.anruf),
  });
  if (!res.ok) return res;
  revalidate();
  return { ok: true };
}
