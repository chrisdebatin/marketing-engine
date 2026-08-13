import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";

/**
 * PDL-Rückmeldung zu einem zugewiesenen Patienten (token-gated über den
 * Standort-Link): "in Versorgung aufgenommen" oder "nicht zustande
 * gekommen". Setzt pdl_bestaetigt_at — daraus entsteht die Response-Zeit
 * in der Admin-Auswertung.
 */
export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as {
    token?: string;
    kind?: string;
    id?: string;
    aktion?: string;
    notiz?: string;
  };
  const token = (body.token ?? "").trim();
  const id = (body.id ?? "").trim();
  const aktion = body.aktion ?? "";
  if (!token || !id || !["aufgenommen", "nicht_zustande"].includes(aktion)) {
    return NextResponse.json({ error: "Ungültige Angaben." }, { status: 400 });
  }

  const admin = createAdminClient();
  const { data: hub } = await admin
    .from("hubs")
    .select("id")
    .eq("share_token", token)
    .maybeSingle();
  if (!hub) return NextResponse.json({ error: "Ungültiger Link." }, { status: 404 });

  const table = body.kind === "meta" ? "meta_leads" : "lead_calls";
  const { data: lead } = await admin
    .from(table)
    .select("id, zugewiesen_hub_id")
    .eq("id", id)
    .maybeSingle();
  if (!lead || lead.zugewiesen_hub_id !== hub.id) {
    return NextResponse.json({ error: "Patient nicht gefunden." }, { status: 404 });
  }

  const notiz = (body.notiz ?? "").trim().slice(0, 300);
  const ergebnis =
    aktion === "aufgenommen"
      ? "in Versorgung aufgenommen"
      : `nicht zustande gekommen${notiz ? ` — ${notiz}` : ""}`;
  const { error } = await admin
    .from(table)
    .update({
      pdl_bestaetigt_at: new Date().toISOString(),
      pdl_ergebnis: ergebnis,
      status: aktion === "aufgenommen" ? "aufgenommen" : "verloren",
    })
    .eq("id", id);
  if (error) {
    return NextResponse.json({ error: "Speichern fehlgeschlagen." }, { status: 500 });
  }
  return NextResponse.json({ ok: true, ergebnis });
}
