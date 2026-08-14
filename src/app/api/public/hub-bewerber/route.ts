import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";

const STATUS = new Set([
  "neu",
  "kontaktiert",
  "gespraech",
  "eingestellt",
  "abgesagt",
]);

/**
 * Rückmeldung der PDL zu einer Bewerbung (token-gated über den
 * Standort-Link): Status setzen und/oder Notiz hinterlassen.
 *
 * Der erste Statuswechsel weg von "neu" stempelt erstkontakt_at — daraus
 * entsteht die Liegezeit-Auswertung ("wie lange lag die Bewerbung, bevor
 * sich jemand gemeldet hat").
 */
export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as {
    token?: string;
    id?: string;
    status?: string;
    notiz?: string;
  };
  const token = (body.token ?? "").trim();
  const id = (body.id ?? "").trim();
  if (!token || !id) {
    return NextResponse.json({ error: "Ungültige Angaben." }, { status: 400 });
  }

  const admin = createAdminClient();
  const { data: hub } = await admin
    .from("hubs")
    .select("id")
    .eq("share_token", token)
    .maybeSingle();
  if (!hub) return NextResponse.json({ error: "Ungültiger Link." }, { status: 404 });

  const { data: row } = await admin
    .from("bewerber")
    .select("id, hub_id, status, erstkontakt_at")
    .eq("id", id)
    .maybeSingle();
  if (!row || row.hub_id !== hub.id) {
    return NextResponse.json({ error: "Bewerbung nicht gefunden." }, { status: 404 });
  }

  const status = (body.status ?? "").trim();
  const notiz = (body.notiz ?? "").trim().slice(0, 1000);
  const jetzt = new Date().toISOString();

  if (status && !STATUS.has(status)) {
    return NextResponse.json({ error: "Ungültiger Status." }, { status: 400 });
  }

  const { error } = await admin
    .from("bewerber")
    .update({
      ...(status ? { status } : {}),
      ...(body.notiz !== undefined ? { notiz: notiz || null } : {}),
      // Erste Reaktion nur einmal stempeln.
      ...(status && status !== "neu" && !row.erstkontakt_at
        ? { erstkontakt_at: jetzt }
        : {}),
      ...(status === "eingestellt" || status === "abgesagt"
        ? { abgeschlossen_at: jetzt }
        : {}),
    })
    .eq("id", id);
  if (error) {
    return NextResponse.json({ error: "Speichern fehlgeschlagen." }, { status: 500 });
  }

  return NextResponse.json({ ok: true, status: status || row.status });
}
