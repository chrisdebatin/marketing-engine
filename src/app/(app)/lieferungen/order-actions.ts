"use server";

import { revalidatePath } from "next/cache";
import { requireSession, type SessionContext } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { ORDER_STATUS_KEYS, orderInputSchema } from "@/lib/orders";

type Result = { ok: true } | { ok: false; error: string };

function revalidate() {
  revalidatePath("/lieferungen");
  revalidatePath("/");
}

/** MD-Scoping: darf die Session auf diesen Hub zugreifen? (Admin: immer.) */
function canAccessHub(session: SessionContext, hubId: string | null): boolean {
  if (session.isAdmin) return true;
  if (!hubId) return false; // Bestellungen ohne Hub sind Admin-Sache.
  return session.hubs.some((h) => h.id === hubId);
}

/** Lädt die Bestellung und prüft, ob die Session sie bearbeiten darf. */
async function checkOrderAccess(
  session: SessionContext,
  orderId: string,
): Promise<Result> {
  const admin = createAdminClient();
  const { data: order } = await admin
    .from("orders")
    .select("id, hub_id")
    .eq("id", orderId)
    .maybeSingle();
  if (!order) return { ok: false, error: "Bestellung nicht gefunden." };
  if (!canAccessHub(session, order.hub_id)) {
    return { ok: false, error: "Kein Zugriff auf diese Bestellung." };
  }
  return { ok: true };
}

/**
 * Bestellung nachträglich korrigieren: Menge/Material/Notiz bei
 * Einzel-Bestellungen, Positions-Mengen bei Warenkorb-Bestellungen.
 */
export async function updateOrder(input: {
  id: string;
  material?: string;
  quantity?: number | string;
  note?: string;
  items?: { material_key: string; quantity: number | string }[];
}): Promise<Result> {
  const id = (input.id ?? "").trim();
  if (!id) return { ok: false, error: "Bestellung fehlt." };

  const session = await requireSession();
  const access = await checkOrderAccess(session, id);
  if (!access.ok) return access;

  const toQty = (v: number | string): number | null => {
    const n = Math.trunc(Number(v));
    return Number.isFinite(n) && n >= 1 && n <= 9999 ? n : null;
  };

  const admin = createAdminClient();

  // Warenkorb-Positionen: Mengen je material_key aktualisieren.
  if (input.items && input.items.length > 0) {
    for (const it of input.items) {
      if (toQty(it.quantity) == null) {
        return { ok: false, error: "Mengen müssen zwischen 1 und 9999 liegen." };
      }
    }
    for (const it of input.items) {
      const { error } = await admin
        .from("order_items")
        .update({ quantity: toQty(it.quantity)! })
        .eq("order_id", id)
        .eq("material_key", it.material_key);
      if (error) {
        return { ok: false, error: "Speichern fehlgeschlagen." };
      }
    }
  }

  // Kopfzeile: Menge/Material/Notiz.
  const patch: { quantity?: number; material?: string; note?: string | null } =
    {};
  if (input.quantity !== undefined) {
    const q = toQty(input.quantity);
    if (q == null) {
      return { ok: false, error: "Menge muss zwischen 1 und 9999 liegen." };
    }
    patch.quantity = q;
  }
  if (input.material !== undefined) {
    const m = (input.material ?? "").trim();
    if (!m || m.length > 200) {
      return { ok: false, error: "Material angeben (max. 200 Zeichen)." };
    }
    patch.material = m;
  }
  if (input.note !== undefined) {
    const n = (input.note ?? "").trim();
    if (n.length > 500) {
      return { ok: false, error: "Notiz zu lang (max. 500 Zeichen)." };
    }
    patch.note = n || null;
  }
  if (Object.keys(patch).length > 0) {
    const { error } = await admin.from("orders").update(patch).eq("id", id);
    if (error) return { ok: false, error: "Speichern fehlgeschlagen." };
  }

  revalidate();
  return { ok: true };
}

/** Plan an outgoing delivery (open order) for a hub. source = 'plan'. */
export async function createPlannedOrder(input: {
  hub_id: string;
  material: string;
  quantity: number | string;
  note?: string;
}): Promise<Result> {
  const hubId = (input.hub_id ?? "").trim();
  if (!hubId) return { ok: false, error: "Hub wählen." };

  const session = await requireSession();
  if (!canAccessHub(session, hubId)) {
    return { ok: false, error: "Kein Zugriff auf diesen Hub." };
  }

  const parsed = orderInputSchema.safeParse({
    material: input.material,
    quantity: input.quantity,
    note: input.note,
  });
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Ungültige Eingabe.",
    };
  }

  const supabase = createAdminClient();

  const { data: hub } = await supabase
    .from("hubs")
    .select("name")
    .eq("id", hubId)
    .maybeSingle();

  const { error } = await supabase.from("orders").insert({
    hub_id: hubId,
    hub_input: hub?.name ?? null,
    material: parsed.data.material,
    quantity: parsed.data.quantity,
    note: parsed.data.note || null,
    source: "plan",
    status: "neu",
  });
  if (error) return { ok: false, error: error.message };
  revalidate();
  return { ok: true };
}

/** Set an order's workflow status (offen → in Bearbeitung → erledigt). */
export async function setOrderStatus(
  id: string,
  status: string,
): Promise<Result> {
  if (!(ORDER_STATUS_KEYS as readonly string[]).includes(status)) {
    return { ok: false, error: "Ungültiger Status." };
  }
  const session = await requireSession();
  const access = await checkOrderAccess(session, id);
  if (!access.ok) return access;

  const supabase = createAdminClient();
  const { data: order } = await supabase
    .from("orders")
    .select("id, hub_id, material, quantity, status, note")
    .eq("id", id)
    .maybeSingle();
  if (!order) return { ok: false, error: "Bestellung nicht gefunden." };

  const { error } = await supabase
    .from("orders")
    .update({ status })
    .eq("id", id);
  if (error) return { ok: false, error: error.message };

  // "Erledigt" = ausgeliefert: die Bestellung wird automatisch als erfasste
  // Lieferung übernommen (kein doppeltes Pflegen). Beim Zurücksetzen wird
  // die automatisch erzeugte Lieferung wieder entfernt. Dedupe/Verknüpfung
  // über einen Marker in der Notiz, da deliveries keine order_id-Spalte hat.
  const marker = `[Bestellung #${order.id.slice(0, 8)}]`;
  if (status === "erledigt" && order.status !== "erledigt" && order.hub_id) {
    const { data: existing } = await supabase
      .from("deliveries")
      .select("id")
      .like("note", `%${marker}%`)
      .maybeSingle();
    if (!existing) {
      // Mengen aus Kopfzeile bzw. Warenkorb-Positionen ableiten.
      const counts = { flyer: 0, aufsteller: 0, box: 0 };
      const rest: string[] = [];
      const bump = (key: string | null, qty: number | null) => {
        const q = qty ?? 0;
        if (key === "flyer") counts.flyer += q;
        else if (key === "aufsteller") counts.aufsteller += q;
        else if (key === "box") counts.box += q;
        else if (key) rest.push(`${q > 0 ? `${q}× ` : ""}${key}`);
      };
      const { data: items } = await supabase
        .from("order_items")
        .select("material_key, quantity")
        .eq("order_id", order.id);
      if (items && items.length > 0) {
        for (const it of items) bump(it.material_key, it.quantity);
      } else {
        bump(order.material, order.quantity);
      }

      const noteParts = [
        rest.length > 0 ? `inkl. ${rest.join(", ")}` : null,
        order.note,
        marker,
      ].filter(Boolean);
      const { error: delErr } = await supabase.from("deliveries").insert({
        hub_id: order.hub_id,
        flyer_count: counts.flyer,
        aufsteller_count: counts.aufsteller,
        box_count: counts.box,
        note: noteParts.join(" · "),
        share_token: crypto.randomUUID(),
      });
      if (delErr) {
        return {
          ok: false,
          error: "Status gesetzt, aber Lieferung konnte nicht erfasst werden.",
        };
      }
    }
  } else if (status !== "erledigt" && order.status === "erledigt") {
    // Auto-erzeugte Lieferung zurücknehmen (nur die mit passendem Marker).
    await supabase.from("deliveries").delete().like("note", `%${marker}%`);
  }

  revalidate();
  return { ok: true };
}

/** Remove an order. */
export async function deleteOrder(id: string): Promise<Result> {
  const session = await requireSession();
  const access = await checkOrderAccess(session, id);
  if (!access.ok) return access;

  const supabase = createAdminClient();
  const { error } = await supabase.from("orders").delete().eq("id", id);
  if (error) return { ok: false, error: error.message };
  revalidate();
  return { ok: true };
}
