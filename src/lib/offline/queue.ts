"use client";

import { getDB, type QueuedActivity } from "./db";
import { createClient } from "@/lib/supabase/client";
import type { ActivityInput } from "@/lib/schemas";
import type { Database } from "@/lib/types";

type ActivityInsert = Database["public"]["Tables"]["activities"]["Insert"];

function newId(): string {
  return crypto.randomUUID();
}

/** Map a validated form payload to a Supabase activities row (id included). */
function toRow(id: string, p: ActivityInput): ActivityInsert {
  return {
    id,
    hub_id: p.hub_id,
    standort_name: p.standort_name.trim(),
    type: p.type,
    occurred_on: p.occurred_on,
    note: p.note && p.note.trim() ? p.note.trim() : null,
    details: p.details,
  };
}

/** Notify listeners (e.g. sync badge) that the queue changed. */
function emitChange() {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event("queue-changed"));
  }
}

export async function enqueueCreate(payload: ActivityInput): Promise<string> {
  const id = newId();
  await getDB().queue.put({
    id,
    payload,
    op: "create",
    createdAt: Date.now(),
  });
  emitChange();
  void syncQueue();
  return id;
}

export async function enqueueUpdate(
  id: string,
  payload: ActivityInput,
): Promise<void> {
  await getDB().queue.put({
    id,
    payload,
    op: "update",
    createdAt: Date.now(),
  });
  emitChange();
  void syncQueue();
}

export async function enqueueDelete(id: string): Promise<void> {
  await getDB().queue.put({
    id,
    op: "delete",
    createdAt: Date.now(),
  });
  emitChange();
  void syncQueue();
}

let syncing = false;

/** Flush the queue to Supabase in insertion order. Safe to call repeatedly. */
export async function syncQueue(): Promise<{ synced: number; failed: number }> {
  if (syncing || (typeof navigator !== "undefined" && !navigator.onLine)) {
    return { synced: 0, failed: 0 };
  }
  syncing = true;
  const supabase = createClient();
  const db = getDB();
  let synced = 0;
  let failed = 0;

  try {
    const items = await db.queue.orderBy("createdAt").toArray();
    for (const item of items) {
      try {
        await pushItem(supabase, item);
        await db.queue.delete(item.id);
        synced++;
      } catch (err) {
        failed++;
        await db.queue.update(item.id, {
          error: err instanceof Error ? err.message : String(err),
        });
        // keep order: stop on first failure so retries stay sequential
        break;
      }
    }
  } finally {
    syncing = false;
    if (synced > 0 || failed > 0) emitChange();
  }

  return { synced, failed };
}

async function pushItem(
  supabase: ReturnType<typeof createClient>,
  item: QueuedActivity,
): Promise<void> {
  if (item.op === "delete") {
    const { error } = await supabase.from("activities").delete().eq("id", item.id);
    if (error) throw new Error(error.message);
    return;
  }
  if (!item.payload) return;
  // create + update are both idempotent upserts on the client-supplied id
  const { error } = await supabase
    .from("activities")
    .upsert(toRow(item.id, item.payload), { onConflict: "id" });
  if (error) throw new Error(error.message);
}

/** Count of not-yet-synced items. */
export async function pendingCount(): Promise<number> {
  return getDB().queue.count();
}
