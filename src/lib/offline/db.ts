"use client";

import Dexie, { type Table } from "dexie";
import type { ActivityInput } from "@/lib/schemas";

/** A queued activity write, persisted locally until synced to Supabase. */
export interface QueuedActivity {
  /** client-generated uuid, also used as the Supabase row id (idempotent sync) */
  id: string;
  /** present for create/update; omitted for delete */
  payload?: ActivityInput;
  /** 'create' | 'update' | 'delete' */
  op: "create" | "update" | "delete";
  createdAt: number;
  /** last sync error, if any */
  error?: string;
}

class OfflineDB extends Dexie {
  queue!: Table<QueuedActivity, string>;

  constructor() {
    super("marketing-engine");
    this.version(1).stores({
      queue: "id, op, createdAt",
    });
  }
}

let _db: OfflineDB | null = null;

/** Lazily create the Dexie instance (browser only). */
export function getDB(): OfflineDB {
  if (!_db) _db = new OfflineDB();
  return _db;
}
