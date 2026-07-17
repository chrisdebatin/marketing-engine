"use server";

import { revalidatePath } from "next/cache";
import { requireSession } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";

type Result = { ok: true } | { ok: false; error: string };

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
  return { ok: true };
}
