import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  shopOrderInputSchema,
  shopCustomOrderSchema,
} from "@/lib/schemas-shop";

export const runtime = "nodejs";

// Public, token-gated cart order (PDL-Online-Shop) via the stable hub link.
// Header row goes to `orders` (material = null), positions to `order_items`.
// Custom orders (`custom` statt `items`) werden als eigene `orders`-Zeile mit
// Freitext-Material gespeichert — kein Katalog-/order_items-Bezug.
export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as {
    token?: string;
    items?: unknown;
    custom?: unknown;
    note?: string;
  };

  const token = (body.token ?? "").trim();
  if (!token) {
    return NextResponse.json({ error: "Token fehlt." }, { status: 400 });
  }

  const admin = createAdminClient();

  // Custom-Bestellung: Freitext + Menge, ohne Warenkorb.
  if (body.custom != null) {
    const parsedCustom = shopCustomOrderSchema.safeParse(body.custom);
    if (!parsedCustom.success) {
      return NextResponse.json(
        {
          error:
            parsedCustom.error.issues[0]?.message ?? "Ungültige Eingabe.",
        },
        { status: 400 },
      );
    }

    const { data: hub, error: findErr } = await admin
      .from("hubs")
      .select("id, name")
      .eq("share_token", token)
      .single();

    if (findErr || !hub) {
      return NextResponse.json({ error: "Ungültiger Link." }, { status: 404 });
    }

    const { data: order, error: insErr } = await admin
      .from("orders")
      .insert({
        hub_id: hub.id,
        hub_input: hub.name,
        material: parsedCustom.data.text,
        quantity: parsedCustom.data.quantity,
        note: parsedCustom.data.note || null,
        source: "pdl",
        status: "neu",
      })
      .select("id, material, quantity, status, note, created_at")
      .single();

    if (insErr || !order) {
      console.error("shop-order: custom insert failed:", insErr?.code);
      return NextResponse.json(
        { error: "Bestellung fehlgeschlagen. Bitte später erneut versuchen." },
        { status: 500 },
      );
    }

    return NextResponse.json({ order });
  }

  const parsed = shopOrderInputSchema.safeParse({
    items: body.items,
    note: body.note,
  });
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Ungültige Eingabe." },
      { status: 400 },
    );
  }

  const { data: hub, error: findErr } = await admin
    .from("hubs")
    .select("id, name")
    .eq("share_token", token)
    .single();

  if (findErr || !hub) {
    return NextResponse.json({ error: "Ungültiger Link." }, { status: 404 });
  }

  // Validate every material_key against the active catalog.
  const { data: catalog, error: catErr } = await admin
    .from("material_catalog")
    .select("key, name")
    .eq("active", true);

  if (catErr) {
    // Kein internes DB-Detail an den anonymen Aufrufer leaken.
    console.error("shop-order: catalog query failed:", catErr.code);
    return NextResponse.json(
      { error: "Bestellung fehlgeschlagen. Bitte später erneut versuchen." },
      { status: 500 },
    );
  }

  const nameByKey = new Map((catalog ?? []).map((c) => [c.key, c.name]));
  const invalid = parsed.data.items.filter(
    (i) => !nameByKey.has(i.material_key),
  );
  if (invalid.length > 0) {
    return NextResponse.json(
      {
        error: `Unbekanntes Material: ${invalid
          .map((i) => i.material_key)
          .join(", ")}. Bitte Seite neu laden.`,
      },
      { status: 400 },
    );
  }

  // Merge duplicate keys defensively (the UI already merges) — and re-check
  // the merged sum against the per-line cap, otherwise duplicates bypass it.
  const merged = new Map<string, number>();
  for (const i of parsed.data.items) {
    merged.set(i.material_key, (merged.get(i.material_key) ?? 0) + i.quantity);
  }
  for (const [key, quantity] of merged) {
    if (quantity > 9999) {
      return NextResponse.json(
        { error: `Menge zu groß für „${nameByKey.get(key) ?? key}“ (max. 9999).` },
        { status: 400 },
      );
    }
  }
  const items = [...merged.entries()].map(([material_key, quantity]) => ({
    material_key,
    quantity,
  }));

  const { data: order, error: insErr } = await admin
    .from("orders")
    .insert({
      hub_id: hub.id,
      hub_input: hub.name,
      material: null,
      quantity: null,
      note: parsed.data.note || null,
      source: "pdl",
      status: "neu",
    })
    .select("id, material, quantity, status, note, created_at")
    .single();

  if (insErr || !order) {
    console.error("shop-order: header insert failed:", insErr?.code);
    return NextResponse.json(
      { error: "Bestellung fehlgeschlagen. Bitte später erneut versuchen." },
      { status: 500 },
    );
  }

  const { error: itemsErr } = await admin
    .from("order_items")
    .insert(items.map((i) => ({ order_id: order.id, ...i })));

  if (itemsErr) {
    // Don't leave an empty header behind; log if even the cleanup fails.
    const { error: cleanupErr } = await admin
      .from("orders")
      .delete()
      .eq("id", order.id);
    console.error(
      "shop-order: items insert failed:",
      itemsErr.code,
      cleanupErr ? `cleanup failed: ${cleanupErr.code}` : "cleanup ok",
    );
    return NextResponse.json(
      { error: "Bestellung fehlgeschlagen. Bitte später erneut versuchen." },
      { status: 500 },
    );
  }

  return NextResponse.json({
    order: {
      ...order,
      items: items.map((i) => ({
        material_key: i.material_key,
        quantity: i.quantity,
        name: nameByKey.get(i.material_key) ?? i.material_key,
      })),
    },
  });
}
