import { randomBytes } from "node:crypto";
import { NextResponse } from "next/server";
import { requireSession } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/lib/types";

export const runtime = "nodejs";

type DeliveryInsert = Database["public"]["Tables"]["deliveries"]["Insert"];

interface IncomingDelivery {
  hub_id: string;
  flyer_count: number;
  box_count: number;
  aufsteller_count: number;
  note?: string;
}

export async function POST(req: Request) {
  const session = await requireSession();
  const supabase = await createClient();

  const body = (await req.json().catch(() => ({}))) as {
    deliveries?: IncomingDelivery[];
  };
  const list = (body.deliveries ?? []).filter(
    (d) => d.hub_id && session.hubs.some((h) => h.id === d.hub_id),
  );
  if (list.length === 0) {
    return NextResponse.json(
      { error: "Keine gültigen Lieferungen (Hub fehlt oder nicht zugeordnet)." },
      { status: 400 },
    );
  }

  const rows: DeliveryInsert[] = list.map((d) => ({
    hub_id: d.hub_id,
    delivered_by: session.userId,
    flyer_count: Math.max(0, Math.trunc(Number(d.flyer_count) || 0)),
    box_count: Math.max(0, Math.trunc(Number(d.box_count) || 0)),
    aufsteller_count: Math.max(0, Math.trunc(Number(d.aufsteller_count) || 0)),
    note: d.note?.trim() ? d.note.trim() : null,
    share_token: randomBytes(12).toString("base64url"),
  }));

  const { data, error } = await supabase
    .from("deliveries")
    .insert(rows)
    .select("id, hub_id, flyer_count, box_count, aufsteller_count, share_token");

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // The PDL link is the hub's stable per-PDL link (/h/<hub share_token>),
  // not a per-delivery link — one delivery adds to the same PDL's board.
  return NextResponse.json({
    deliveries: (data ?? []).map((d) => {
      const hub = session.hubs.find((h) => h.id === d.hub_id);
      return {
        id: d.id,
        hub_name: hub?.name ?? d.hub_id,
        flyer_count: d.flyer_count,
        box_count: d.box_count,
        aufsteller_count: d.aufsteller_count,
        token: hub?.share_token ?? d.share_token,
      };
    }),
  });
}
