"use server";

import { revalidatePath } from "next/cache";
import { requireSession } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";

type Result = { ok: true } | { ok: false; error: string };

function revalidate() {
  revalidatePath("/admin");
  revalidatePath("/hubs");
}

/**
 * Neue Hub-Aufgabe anlegen (z. B. "E-Mail mit PDL-Link verschickt").
 * Eine Aufgabe gilt für alle Hubs und wird pro Hub abgehakt.
 * `hub_tasks` hat RLS disabled — Zugriff nur über den Service-Role-Client.
 */
export async function createHubTask(input: {
  title: string;
  description?: string;
}): Promise<Result> {
  const session = await requireSession();
  if (!session.isAdmin) return { ok: false, error: "Nur für Admins." };

  const title = (input.title ?? "").trim();
  if (!title) return { ok: false, error: "Titel eingeben." };
  if (title.length > 120) {
    return { ok: false, error: "Titel zu lang (max. 120 Zeichen)." };
  }

  const admin = createAdminClient();
  const { error } = await admin.from("hub_tasks").insert({
    title,
    description: (input.description ?? "").trim() || null,
  });
  if (error) return { ok: false, error: "Aufgabe konnte nicht angelegt werden." };

  revalidate();
  return { ok: true };
}

/** Aufgabe löschen (entfernt via Cascade auch alle Hub-Häkchen). */
export async function deleteHubTask(id: string): Promise<Result> {
  const session = await requireSession();
  if (!session.isAdmin) return { ok: false, error: "Nur für Admins." };
  if (!id) return { ok: false, error: "Aufgabe fehlt." };

  const admin = createAdminClient();
  const { error } = await admin.from("hub_tasks").delete().eq("id", id);
  if (error) return { ok: false, error: "Löschen fehlgeschlagen." };

  revalidate();
  return { ok: true };
}

/**
 * Aufgabe für einen Hub abhaken bzw. das Häkchen entfernen.
 * done=true legt den Check-Eintrag an (idempotent), done=false löscht ihn.
 */
export async function setHubTaskDone(
  taskId: string,
  hubId: string,
  done: boolean,
): Promise<Result> {
  const session = await requireSession();
  if (!session.isAdmin && !session.hubs.some((h) => h.id === hubId)) {
    return { ok: false, error: "Kein Zugriff auf diesen Hub." };
  }
  if (!taskId || !hubId) return { ok: false, error: "Angaben unvollständig." };

  const admin = createAdminClient();
  if (done) {
    const { error } = await admin
      .from("hub_task_checks")
      .upsert(
        { task_id: taskId, hub_id: hubId },
        { onConflict: "task_id,hub_id" },
      );
    if (error) return { ok: false, error: "Speichern fehlgeschlagen." };
  } else {
    const { error } = await admin
      .from("hub_task_checks")
      .delete()
      .eq("task_id", taskId)
      .eq("hub_id", hubId);
    if (error) return { ok: false, error: "Speichern fehlgeschlagen." };
  }

  revalidate();
  return { ok: true };
}
