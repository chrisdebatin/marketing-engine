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
  const { error } = await supabase
    .from("orders")
    .update({ status })
    .eq("id", id);
  if (error) return { ok: false, error: error.message };
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
