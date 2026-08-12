import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getFollowupWeeks } from "@/lib/settings";
import { todayIso } from "@/lib/crm";

export const runtime = "nodejs";

/**
 * Aktionen der persönlichen Team-Seiten (/t/<token>, token-gated):
 * - claim:        Lead übernehmen (bearbeiter = Name des Mitglieds)
 * - lead-status:  B2C-Funnel-Status setzen
 * - outbound-log: Anruf an einer Institution loggen (Kontakt + Wiedervorlage)
 */

const LEAD_STATUS = new Set([
  "offen",
  "kontaktiert",
  "erstgespraech",
  "aufgenommen",
  "verloren",
]);

export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as {
    token?: string;
    action?: string;
    kind?: string;
    id?: string;
    status?: string;
    target_id?: string;
    ansprechpartner?: string;
    notiz?: string;
  };
  const token = (body.token ?? "").trim();
  if (!token) return NextResponse.json({ error: "Token fehlt." }, { status: 400 });

  const admin = createAdminClient();
  const { data: member } = await admin
    .from("team_members")
    .select("id, name, team, active")
    .eq("token", token)
    .maybeSingle();
  if (!member || !member.active) {
    return NextResponse.json({ error: "Ungültiger Link." }, { status: 404 });
  }

  const action = body.action ?? "";
  const kind = body.kind === "meta" ? "meta" : "call";
  const table = kind === "meta" ? "meta_leads" : "lead_calls";

  if (action === "claim") {
    const id = (body.id ?? "").trim();
    if (!id) return NextResponse.json({ error: "Lead fehlt." }, { status: 400 });
    const { error } = await admin
      .from(table)
      .update({ bearbeiter: member.name })
      .eq("id", id);
    if (error) return NextResponse.json({ error: "Speichern fehlgeschlagen." }, { status: 500 });
    return NextResponse.json({ ok: true, bearbeiter: member.name });
  }

  if (action === "lead-status") {
    const id = (body.id ?? "").trim();
    const status = (body.status ?? "").trim();
    if (!id || !LEAD_STATUS.has(status)) {
      return NextResponse.json({ error: "Ungültiger Status." }, { status: 400 });
    }
    // Statuswechsel gilt als Bearbeitung → Claim implizit mitsetzen.
    const { error } = await admin
      .from(table)
      .update({ status, bearbeiter: member.name })
      .eq("id", id);
    if (error) {
      const constraint = error.code === "23514";
      return NextResponse.json(
        {
          error: constraint
            ? "Status-Werte fehlen noch — bitte supabase/apply_all_pending.sql ausführen."
            : "Speichern fehlgeschlagen.",
        },
        { status: 500 },
      );
    }
    return NextResponse.json({ ok: true });
  }

  if (action === "outbound-log") {
    const targetId = (body.target_id ?? "").trim();
    if (!targetId) return NextResponse.json({ error: "Ziel fehlt." }, { status: 400 });
    const { data: target } = await admin
      .from("crm_targets")
      .select("id, hub_id, intervall_wochen")
      .eq("id", targetId)
      .maybeSingle();
    if (!target) return NextResponse.json({ error: "Ziel nicht gefunden." }, { status: 404 });

    const today = todayIso();
    const followup = await getFollowupWeeks();
    const weeks = followup.anruf ?? target.intervall_wochen ?? 6;
    const next = new Date();
    next.setDate(next.getDate() + weeks * 7);
    const naechster = next.toISOString().slice(0, 10);
    const note = (body.notiz ?? "").trim().slice(0, 1000);
    const ansprechpartner = (body.ansprechpartner ?? "").trim().slice(0, 200);

    const { error: cErr } = await admin.from("crm_contacts").insert({
      target_id: target.id,
      hub_id: target.hub_id,
      kontakt_art: "anruf",
      ansprechpartner: ansprechpartner || null,
      note: note || null,
      contact_date: today,
      bearbeiter: member.name,
    });
    if (cErr) return NextResponse.json({ error: "Loggen fehlgeschlagen." }, { status: 500 });

    await admin
      .from("crm_targets")
      .update({
        letzter_besuch: today,
        letzte_kontakt_art: "anruf",
        naechster_besuch: naechster,
        besuchs_notiz: note || null,
      })
      .eq("id", target.id);

    return NextResponse.json({
      ok: true,
      letzter_besuch: today,
      naechster_besuch: naechster,
      bearbeiter: member.name,
    });
  }

  return NextResponse.json({ error: "Unbekannte Aktion." }, { status: 400 });
}
