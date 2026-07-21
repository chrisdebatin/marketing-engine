"use server";

import { revalidatePath } from "next/cache";
import { requireSession } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";

type Result = { ok: true } | { ok: false; error: string };

/**
 * Neue Lieferung für einen Hub anlegen (z. B. direkt aus dem Inventar auf
 * der Hub-Detailseite). MD-Scoping wie überall.
 */
export async function createDelivery(input: {
  hub_id: string;
  flyer_count: number | string;
  aufsteller_count: number | string;
  box_count: number | string;
  note?: string;
}): Promise<Result> {
  const hubId = (input.hub_id ?? "").trim();
  if (!hubId) return { ok: false, error: "Hub fehlt." };

  const toCount = (v: number | string): number | null => {
    if (v === "" || v == null) return 0;
    const n = Math.trunc(Number(v));
    if (!Number.isFinite(n) || n < 0 || n > 99999) return null;
    return n;
  };
  const flyer = toCount(input.flyer_count);
  const aufsteller = toCount(input.aufsteller_count);
  const boxes = toCount(input.box_count);
  if (flyer == null || aufsteller == null || boxes == null) {
    return { ok: false, error: "Mengen müssen zwischen 0 und 99999 liegen." };
  }
  if (flyer + aufsteller + boxes === 0) {
    return { ok: false, error: "Mindestens eine Menge größer 0 angeben." };
  }

  const session = await requireSession();
  const canAccess =
    session.isAdmin || session.hubs.some((h) => h.id === hubId);
  if (!canAccess) return { ok: false, error: "Kein Zugriff auf diesen Hub." };

  const admin = createAdminClient();
  const { error } = await admin.from("deliveries").insert({
    hub_id: hubId,
    flyer_count: flyer,
    aufsteller_count: aufsteller,
    box_count: boxes,
    note: (input.note ?? "").trim() || null,
    share_token: crypto.randomUUID(),
  });
  if (error) return { ok: false, error: "Speichern fehlgeschlagen." };

  revalidatePath("/lieferungen");
  revalidatePath("/hubs");
  revalidatePath("/hubs/[id]", "page");
  revalidatePath("/");
  return { ok: true };
}

/**
 * Erfasste Lieferung löschen (Falscheingabe). Zugehörige Auslage-Orte werden
 * per Cascade mitgelöscht. Stammt die Lieferung aus einer erledigten
 * Bestellung ("[Bestellung #…]"-Marker), wird diese wieder auf "offen"
 * gesetzt und taucht im Planer auf.
 */
export async function deleteDelivery(id: string): Promise<Result> {
  const cleanId = (id ?? "").trim();
  if (!cleanId) return { ok: false, error: "Lieferung fehlt." };

  const session = await requireSession();
  const admin = createAdminClient();

  const { data: delivery } = await admin
    .from("deliveries")
    .select("id, hub_id, note")
    .eq("id", cleanId)
    .maybeSingle();
  if (!delivery) return { ok: false, error: "Lieferung nicht gefunden." };

  const canAccess =
    session.isAdmin || session.hubs.some((h) => h.id === delivery.hub_id);
  if (!canAccess) {
    return { ok: false, error: "Kein Zugriff auf diese Lieferung." };
  }

  const { error } = await admin
    .from("deliveries")
    .delete()
    .eq("id", cleanId);
  if (error) return { ok: false, error: "Löschen fehlgeschlagen." };

  // Verknüpfte Bestellung (falls vorhanden) zurück auf "offen".
  const prefix = /\[Bestellung #([0-9a-f]{8})\]/.exec(delivery.note ?? "")?.[1];
  if (prefix) {
    const { data: orders } = await admin
      .from("orders")
      .select("id")
      .eq("status", "erledigt")
      .eq("hub_id", delivery.hub_id);
    const order = (orders ?? []).find((o) => o.id.startsWith(prefix));
    if (order) {
      await admin.from("orders").update({ status: "neu" }).eq("id", order.id);
    }
  }

  revalidatePath("/lieferungen");
  revalidatePath("/hubs");
  revalidatePath("/hubs/[id]", "page");
  return { ok: true };
}

/**
 * Erfasste Lieferung korrigieren (Mengen + Notiz). MD-Scoping: nur Admins
 * oder Nutzer mit Zugriff auf den Hub der Lieferung.
 */
export async function updateDelivery(input: {
  id: string;
  flyer_count: number | string;
  aufsteller_count: number | string;
  box_count: number | string;
  note?: string;
}): Promise<Result> {
  const id = (input.id ?? "").trim();
  if (!id) return { ok: false, error: "Lieferung fehlt." };

  const toCount = (v: number | string): number | null => {
    if (v === "" || v == null) return 0;
    const n = Math.trunc(Number(v));
    if (!Number.isFinite(n) || n < 0 || n > 99999) return null;
    return n;
  };
  const flyer = toCount(input.flyer_count);
  const aufsteller = toCount(input.aufsteller_count);
  const boxes = toCount(input.box_count);
  if (flyer == null || aufsteller == null || boxes == null) {
    return { ok: false, error: "Mengen müssen zwischen 0 und 99999 liegen." };
  }

  const session = await requireSession();
  const admin = createAdminClient();

  const { data: delivery } = await admin
    .from("deliveries")
    .select("id, hub_id")
    .eq("id", id)
    .maybeSingle();
  if (!delivery) return { ok: false, error: "Lieferung nicht gefunden." };

  const canAccess =
    session.isAdmin || session.hubs.some((h) => h.id === delivery.hub_id);
  if (!canAccess) {
    return { ok: false, error: "Kein Zugriff auf diese Lieferung." };
  }

  const { error } = await admin
    .from("deliveries")
    .update({
      flyer_count: flyer,
      aufsteller_count: aufsteller,
      box_count: boxes,
      note: (input.note ?? "").trim() || null,
    })
    .eq("id", id);
  if (error) {
    return { ok: false, error: "Speichern fehlgeschlagen." };
  }

  revalidatePath("/lieferungen");
  revalidatePath("/hubs");
  revalidatePath("/hubs/[id]", "page");
  return { ok: true };
}
