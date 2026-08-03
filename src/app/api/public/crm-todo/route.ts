import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";

// Public, token-gated: Die PDL hakt ein Call-Center-To-do ab (oder holt es
// zurück). Das To-do muss zum Hub des Tokens gehören.
export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as {
    token?: string;
    id?: string;
    erledigt?: boolean;
  };

  const token = (body.token ?? "").trim();
  const id = (body.id ?? "").trim();
  if (!token || !id) {
    return NextResponse.json(
      { error: "Token oder To-do fehlt." },
      { status: 400 },
    );
  }

  const admin = createAdminClient();
  const { data: hub, error: findErr } = await admin
    .from("hubs")
    .select("id")
    .eq("share_token", token)
    .single();
  if (findErr || !hub) {
    return NextResponse.json({ error: "Ungültiger Link." }, { status: 404 });
  }

  const { data: todo } = await admin
    .from("crm_todos")
    .select("id, hub_id")
    .eq("id", id)
    .maybeSingle();
  if (!todo || todo.hub_id !== hub.id) {
    return NextResponse.json(
      { error: "To-do nicht gefunden." },
      { status: 404 },
    );
  }

  const erledigt = body.erledigt !== false;
  const { error: updErr } = await admin
    .from("crm_todos")
    .update({
      status: erledigt ? "erledigt" : "offen",
      done_at: erledigt ? new Date().toISOString() : null,
    })
    .eq("id", todo.id);
  if (updErr) {
    return NextResponse.json(
      { error: "Speichern fehlgeschlagen." },
      { status: 500 },
    );
  }
  return NextResponse.json({ ok: true });
}
