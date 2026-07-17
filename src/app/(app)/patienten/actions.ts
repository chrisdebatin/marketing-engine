"use server";

import { revalidatePath } from "next/cache";
import { requireSession, type SessionContext } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { patientBatchImportSchema } from "@/lib/schemas-shop";

type Result = { ok: true } | { ok: false; error: string };

const PATIENT_STATUSES = ["offen", "bestaetigt", "nicht_da"] as const;

function revalidate() {
  revalidatePath("/patienten");
}

/** MD-Scoping: darf die Session auf diesen Hub zugreifen? (Admin: immer.) */
function canAccessHub(session: SessionContext, hubId: string | null): boolean {
  if (session.isAdmin) return true;
  if (!hubId) return false;
  return session.hubs.some((h) => h.id === hubId);
}

/**
 * Parst die Textarea-Eingabe: eine Zeile pro Patient im Format
 * "Name" oder "Name; Referenz-ID" (auch Tab oder Komma als Trenner).
 * DSGVO — Datenminimierung: nur Anzeigename + optionale Referenz-ID.
 */
function parseEntries(
  text: string,
): { display_name: string; reference_id?: string }[] {
  const entries: { display_name: string; reference_id?: string }[] = [];
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line) continue;

    // Trenner-Priorität: Semikolon, dann Tab, dann Komma —
    // so bleibt "Müller, Anna; REF-123" als Name + Referenz erhalten.
    let sep = -1;
    for (const s of [";", "\t", ","]) {
      const i = line.indexOf(s);
      if (i !== -1) {
        sep = i;
        break;
      }
    }

    if (sep === -1) {
      entries.push({ display_name: line });
    } else {
      const name = line.slice(0, sep).trim();
      const ref = line.slice(sep + 1).trim();
      entries.push({
        display_name: name,
        reference_id: ref || undefined,
      });
    }
  }
  return entries;
}

/**
 * Legt eine monatliche Patientenliste (Batch) für einen Hub an und
 * importiert die Einträge aus der Textarea (Status 'offen').
 */
export async function createPatientBatch(input: {
  hub_id: string;
  period: string;
  entriesText: string;
}): Promise<Result> {
  const parsed = patientBatchImportSchema.safeParse({
    hub_id: (input.hub_id ?? "").trim(),
    period: (input.period ?? "").trim(),
    entries: parseEntries(input.entriesText ?? ""),
  });
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Ungültige Eingabe.",
    };
  }

  const session = await requireSession();
  if (!canAccessHub(session, parsed.data.hub_id)) {
    return { ok: false, error: "Kein Zugriff auf diesen Hub." };
  }

  const supabase = createAdminClient();

  const { data: batch, error: batchErr } = await supabase
    .from("patient_batches")
    .insert({ hub_id: parsed.data.hub_id, period: parsed.data.period })
    .select("id")
    .single();

  if (batchErr || !batch) {
    if (batchErr?.code === "23505") {
      return {
        ok: false,
        error: "Für diesen Hub existiert bereits eine Liste für diesen Monat.",
      };
    }
    // DSGVO: keine Detail-Fehler mit Eintragsdaten durchreichen.
    return { ok: false, error: "Liste konnte nicht angelegt werden." };
  }

  const rows = parsed.data.entries.map((e) => ({
    batch_id: batch.id,
    hub_id: parsed.data.hub_id,
    display_name: e.display_name,
    reference_id: e.reference_id ? e.reference_id : null,
    status: "offen",
  }));

  const { error: recErr } = await supabase
    .from("patient_records")
    .insert(rows);
  if (recErr) {
    // Aufräumen, damit kein leerer Batch den unique(hub, Monat) blockiert.
    await supabase.from("patient_batches").delete().eq("id", batch.id);
    return { ok: false, error: "Einträge konnten nicht gespeichert werden." };
  }

  revalidate();
  return { ok: true };
}

/** Löscht eine Monatsliste; die Einträge werden per Cascade mitgelöscht. */
export async function deletePatientBatch(id: string): Promise<Result> {
  const session = await requireSession();
  const supabase = createAdminClient();

  const { data: batch } = await supabase
    .from("patient_batches")
    .select("id, hub_id")
    .eq("id", id)
    .maybeSingle();
  if (!batch) return { ok: false, error: "Liste nicht gefunden." };
  if (!canAccessHub(session, batch.hub_id)) {
    return { ok: false, error: "Kein Zugriff auf diese Liste." };
  }

  const { error } = await supabase
    .from("patient_batches")
    .delete()
    .eq("id", id);
  if (error) {
    return { ok: false, error: "Liste konnte nicht gelöscht werden." };
  }
  revalidate();
  return { ok: true };
}

/**
 * Interne Status-Korrektur eines Patienten-Eintrags.
 * verified_at wird bei 'bestaetigt'/'nicht_da' gesetzt, bei 'offen' geleert.
 * `note` wird nur geändert, wenn explizit übergeben.
 */
export async function setPatientStatus(
  recordId: string,
  status: string,
  note?: string,
): Promise<Result> {
  if (!(PATIENT_STATUSES as readonly string[]).includes(status)) {
    return { ok: false, error: "Ungültiger Status." };
  }
  const session = await requireSession();
  const supabase = createAdminClient();

  const { data: record } = await supabase
    .from("patient_records")
    .select("id, hub_id")
    .eq("id", recordId)
    .maybeSingle();
  if (!record) return { ok: false, error: "Eintrag nicht gefunden." };
  if (!canAccessHub(session, record.hub_id)) {
    return { ok: false, error: "Kein Zugriff auf diesen Eintrag." };
  }

  const update: {
    status: string;
    verified_at: string | null;
    note?: string | null;
  } = {
    status,
    verified_at: status === "offen" ? null : new Date().toISOString(),
  };
  if (note !== undefined) update.note = note.trim() || null;

  const { error } = await supabase
    .from("patient_records")
    .update(update)
    .eq("id", recordId);
  if (error) {
    return { ok: false, error: "Status konnte nicht gespeichert werden." };
  }
  revalidate();
  return { ok: true };
}

/**
 * Übernimmt per KI zugeordnete Patienten (aus /api/patients/parse) in die
 * Monatslisten: gruppiert nach Hub, legt fehlende Batches (hub, period) an
 * und hängt die Einträge an bestehende Batches an. Status 'offen',
 * source 'zentral'.
 */
export async function importParsedPatients(input: {
  period: string;
  entries: { hub_id: string; display_name: string; reference_id?: string }[];
}): Promise<Result & { created?: number }> {
  const session = await requireSession();

  const period = (input.period ?? "").trim();
  if (!/^\d{4}-\d{2}$/.test(period)) {
    return { ok: false, error: "Zeitraum im Format JJJJ-MM angeben." };
  }
  const entries = input.entries ?? [];
  if (entries.length === 0) {
    return { ok: false, error: "Keine Einträge zum Übernehmen." };
  }
  if (entries.length > 500) {
    return { ok: false, error: "Zu viele Einträge (max. 500 pro Import)." };
  }

  // Nach Hub gruppieren; jede Gruppe gegen das bestehende Schema validieren.
  const byHub = new Map<string, { display_name: string; reference_id?: string }[]>();
  for (const e of entries) {
    const hubId = (e.hub_id ?? "").trim();
    if (!hubId) return { ok: false, error: "Jeder Eintrag braucht einen Hub." };
    const arr = byHub.get(hubId) ?? [];
    arr.push({
      display_name: (e.display_name ?? "").trim(),
      reference_id: (e.reference_id ?? "").trim() || undefined,
    });
    byHub.set(hubId, arr);
  }

  const supabase = createAdminClient();
  let created = 0;

  for (const [hubId, hubEntries] of byHub) {
    if (!canAccessHub(session, hubId)) {
      return { ok: false, error: "Kein Zugriff auf einen der Hubs." };
    }
    const parsed = patientBatchImportSchema.safeParse({
      hub_id: hubId,
      period,
      entries: hubEntries,
    });
    if (!parsed.success) {
      return {
        ok: false,
        error: parsed.error.issues[0]?.message ?? "Ungültige Eingabe.",
      };
    }

    // Batch holen oder anlegen (ein Batch je Hub+Monat).
    const { data: existing } = await supabase
      .from("patient_batches")
      .select("id")
      .eq("hub_id", hubId)
      .eq("period", period)
      .maybeSingle();

    let batchId = existing?.id ?? null;
    if (!batchId) {
      const { data: inserted, error: batchErr } = await supabase
        .from("patient_batches")
        .insert({ hub_id: hubId, period })
        .select("id")
        .single();
      if (batchErr || !inserted) {
        return { ok: false, error: "Liste konnte nicht angelegt werden." };
      }
      batchId = inserted.id;
    }

    // Bulk-Insert: alle Zeilen mit identischen Keys (PostgREST-Anforderung).
    const rows = parsed.data.entries.map((e) => ({
      batch_id: batchId,
      hub_id: hubId,
      display_name: e.display_name,
      reference_id: e.reference_id ? e.reference_id : null,
      status: "offen",
      source: "zentral",
    }));
    const { error: recErr } = await supabase
      .from("patient_records")
      .insert(rows);
    if (recErr) {
      return { ok: false, error: "Einträge konnten nicht gespeichert werden." };
    }
    created += rows.length;
  }

  revalidate();
  return { ok: true, created };
}
