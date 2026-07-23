"use server";

import { revalidatePath } from "next/cache";
import { requireSession } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";

type Result = { ok: true } | { ok: false; error: string };

function revalidate() {
  revalidatePath("/hubs");
  revalidatePath("/hubs/[id]", "page");
  revalidatePath("/themen");
}

/** MD-Scoping: Zugriff nur auf eigene Hubs (Admin: alle). */
async function checkHubAccess(hubId: string): Promise<Result> {
  const session = await requireSession();
  if (session.isAdmin || session.hubs.some((h) => h.id === hubId)) {
    return { ok: true };
  }
  return { ok: false, error: "Kein Zugriff auf diesen Hub." };
}

/** `hub_notes` fehlt bis Migration 0021 — dann klare Meldung statt 500. */
function missingTableError(code?: string): Result | null {
  if (code === "PGRST205" || code === "42P01") {
    return {
      ok: false,
      error:
        "Die Tabelle hub_notes fehlt noch — bitte supabase/apply_all_pending.sql im Supabase SQL-Editor ausführen.",
    };
  }
  return null;
}

/**
 * Thema per Titel auflösen; existiert es (case-insensitive) nicht, wird es
 * angelegt. Leerer Titel → null (allgemeine Notiz).
 */
async function resolveTopicId(
  title: string | undefined,
): Promise<{ ok: true; topicId: string | null } | { ok: false; error: string }> {
  const clean = (title ?? "").trim();
  if (!clean) return { ok: true, topicId: null };
  if (clean.length > 80) {
    return { ok: false, error: "Thema zu lang (max. 80 Zeichen)." };
  }
  const admin = createAdminClient();
  const { data: existing, error: findErr } = await admin
    .from("note_topics")
    .select("id, title")
    .ilike("title", clean)
    .maybeSingle();
  if (findErr) {
    return (
      (missingTableError(findErr.code) as { ok: false; error: string } | null) ?? {
        ok: false,
        error: "Thema konnte nicht geladen werden.",
      }
    );
  }
  if (existing) return { ok: true, topicId: existing.id };
  const { data: created, error: insErr } = await admin
    .from("note_topics")
    .insert({ title: clean })
    .select("id")
    .single();
  if (insErr || !created) {
    return { ok: false, error: "Thema konnte nicht angelegt werden." };
  }
  return { ok: true, topicId: created.id };
}

export async function createHubNote(input: {
  hub_id: string;
  text: string;
  is_todo: boolean;
  topic_title?: string;
}): Promise<Result> {
  const hubId = (input.hub_id ?? "").trim();
  const text = (input.text ?? "").trim();
  if (!hubId) return { ok: false, error: "Hub fehlt." };
  if (!text) return { ok: false, error: "Notiz eingeben." };
  if (text.length > 2000) {
    return { ok: false, error: "Notiz zu lang (max. 2000 Zeichen)." };
  }
  const access = await checkHubAccess(hubId);
  if (!access.ok) return access;

  const topic = await resolveTopicId(input.topic_title);
  if (!topic.ok) return topic;

  const admin = createAdminClient();
  const { error } = await admin.from("hub_notes").insert({
    hub_id: hubId,
    text,
    is_todo: Boolean(input.is_todo),
    topic_id: topic.topicId,
  });
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

async function loadNote(id: string) {
  const admin = createAdminClient();
  const { data } = await admin
    .from("hub_notes")
    .select("id, hub_id")
    .eq("id", id)
    .maybeSingle();
  return data;
}

export async function updateHubNote(
  id: string,
  input: { text?: string; is_todo?: boolean; done?: boolean },
): Promise<Result> {
  const cleanId = (id ?? "").trim();
  if (!cleanId) return { ok: false, error: "Notiz fehlt." };
  const note = await loadNote(cleanId);
  if (!note) return { ok: false, error: "Notiz nicht gefunden." };
  const access = await checkHubAccess(note.hub_id);
  if (!access.ok) return access;

  const patch: {
    text?: string;
    is_todo?: boolean;
    done_at?: string | null;
  } = {};
  if (input.text !== undefined) {
    const text = input.text.trim();
    if (!text) return { ok: false, error: "Notiz eingeben." };
    if (text.length > 2000) {
      return { ok: false, error: "Notiz zu lang (max. 2000 Zeichen)." };
    }
    patch.text = text;
  }
  if (input.is_todo !== undefined) {
    patch.is_todo = input.is_todo;
    // Beim Umwandeln in ein To-do startet es offen.
    if (input.is_todo) patch.done_at = null;
  }
  if (input.done !== undefined) {
    patch.done_at = input.done ? new Date().toISOString() : null;
  }
  if (Object.keys(patch).length === 0) return { ok: true };

  const admin = createAdminClient();
  const { error } = await admin
    .from("hub_notes")
    .update(patch)
    .eq("id", cleanId);
  if (error) return { ok: false, error: "Speichern fehlgeschlagen." };
  revalidate();
  return { ok: true };
}

export async function deleteHubNote(id: string): Promise<Result> {
  const cleanId = (id ?? "").trim();
  if (!cleanId) return { ok: false, error: "Notiz fehlt." };
  const note = await loadNote(cleanId);
  if (!note) return { ok: false, error: "Notiz nicht gefunden." };
  const access = await checkHubAccess(note.hub_id);
  if (!access.ok) return access;

  const admin = createAdminClient();
  const { error } = await admin.from("hub_notes").delete().eq("id", cleanId);
  if (error) return { ok: false, error: "Löschen fehlgeschlagen." };
  revalidate();
  return { ok: true };
}
