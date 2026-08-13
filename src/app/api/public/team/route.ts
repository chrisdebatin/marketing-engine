import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getFollowupWeeks } from "@/lib/settings";
import { todayIso } from "@/lib/crm";
import { deliverMail } from "@/lib/mailer";
import { splitPdlEmails, splitPdlNames } from "@/lib/pdl";
import { leadEmail, leadFullName, leadPhone } from "@/lib/meta-lead-fields";

const APP_URL = (process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000").replace(/\/+$/, "");

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
    ergebnis?: string;
    telefon?: string;
    quelle?: string;
  };
  const token = (body.token ?? "").trim();
  const admin = createAdminClient();

  // Zwei Wege: Token der persönlichen Team-Seite ODER eingeloggte
  // Admin-Session (Bearbeitung direkt auf /crm — bearbeiter = Profilname).
  let member: { name: string };
  if (token) {
    const { data: tokenMember } = await admin
      .from("team_members")
      .select("id, name, team, active")
      .eq("token", token)
      .maybeSingle();
    if (!tokenMember || !tokenMember.active) {
      return NextResponse.json({ error: "Ungültiger Link." }, { status: 404 });
    }
    member = tokenMember;
  } else {
    const { requireSession } = await import("@/lib/auth");
    const session = await requireSession().catch(() => null);
    if (!session?.isAdmin) {
      return NextResponse.json({ error: "Nicht angemeldet." }, { status: 401 });
    }
    member = { name: session.profile?.name?.trim() || "Admin" };
  }

  const action = body.action ?? "";
  const kind = body.kind === "meta" ? "meta" : "call";
  const table = kind === "meta" ? "meta_leads" : "lead_calls";

  /** Erste Bearbeitung stempeln (nur wenn noch leer) — Basis der Admin-Auswertung. */
  async function markFirstTouch(id: string) {
    await admin
      .from(table)
      .update({ erstbearbeitet_at: new Date().toISOString() })
      .eq("id", id)
      .is("erstbearbeitet_at", null);
  }

  if (action === "claim") {
    const id = (body.id ?? "").trim();
    if (!id) return NextResponse.json({ error: "Lead fehlt." }, { status: 400 });
    const { error } = await admin
      .from(table)
      .update({ bearbeiter: member.name })
      .eq("id", id);
    if (error) return NextResponse.json({ error: "Speichern fehlgeschlagen." }, { status: 500 });
    await markFirstTouch(id).catch(() => {});
    return NextResponse.json({ ok: true, bearbeiter: member.name });
  }

  if (action === "lead-status") {
    const id = (body.id ?? "").trim();
    const status = (body.status ?? "").trim();
    if (!id || !LEAD_STATUS.has(status)) {
      return NextResponse.json({ error: "Ungültiger Status." }, { status: 400 });
    }
    // Optionaler Grund (v. a. bei "verloren": nicht erreicht / kein Interesse / Freitext)
    const ergebnis = (body.ergebnis ?? "").trim().slice(0, 300);
    // Statuswechsel gilt als Bearbeitung → Claim implizit mitsetzen.
    const { error } = await admin
      .from(table)
      .update({ status, bearbeiter: member.name, ...(ergebnis ? { ergebnis } : {}) })
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
    await markFirstTouch(id).catch(() => {});
    return NextResponse.json({ ok: true });
  }

  // Inbound-Anruf direkt aus der Leads-Ansicht loggen → erscheint sofort als
  // offener Lead mit denselben Optionen wie alle anderen.
  if (action === "log-inbound") {
    const name = (body.ansprechpartner ?? "").trim().slice(0, 200);
    const telefon = (body.telefon ?? "").trim().slice(0, 60);
    const quelle = (body.quelle ?? "").trim() || "telefon0800";
    const notiz = (body.notiz ?? "").trim().slice(0, 1000);
    if (!name && !telefon) {
      return NextResponse.json({ error: "Name oder Telefonnummer angeben." }, { status: 400 });
    }
    const now = new Date().toISOString();
    const values = {
      call_date: now.slice(0, 10),
      quelle,
      bereich: "pflege",
      lead_name: name || "Inbound-Anruf",
      telefon: telefon || null,
      notiz: notiz || null,
      status: "offen",
      bearbeiter: member.name,
    };
    let { data: row, error } = await admin
      .from("lead_calls")
      .insert({ ...values, erstbearbeitet_at: now })
      .select("id, created_at")
      .single();
    if (error && (error.code === "PGRST204" || error.code === "42703")) {
      // Migration 0055 noch nicht eingespielt — ohne Stempel loggen.
      ({ data: row, error } = await admin
        .from("lead_calls")
        .insert(values)
        .select("id, created_at")
        .single());
    }
    if (error || !row) {
      return NextResponse.json({ error: "Speichern fehlgeschlagen." }, { status: 500 });
    }
    return NextResponse.json({ ok: true, id: row.id, created_at: row.created_at ?? now });
  }

  // Übergabe an die PDL zurücknehmen (solange keine Bestätigung vorliegt).
  if (action === "unassign-hub") {
    const id = (body.id ?? "").trim();
    if (!id) return NextResponse.json({ error: "Lead fehlt." }, { status: 400 });
    const { error } = await admin
      .from(table)
      .update({
        zugewiesen_hub_id: null,
        zugewiesen_at: null,
        pdl_bestaetigt_at: null,
        pdl_ergebnis: null,
      })
      .eq("id", id);
    if (error) return NextResponse.json({ error: "Zurücknehmen fehlgeschlagen." }, { status: 500 });
    return NextResponse.json({ ok: true });
  }

  if (action === "lead-note") {
    const id = (body.id ?? "").trim();
    if (!id) return NextResponse.json({ error: "Lead fehlt." }, { status: 400 });
    const notiz = (body.notiz ?? "").trim().slice(0, 1000);
    const { error } = await admin
      .from(table)
      .update({ notiz: notiz || null })
      .eq("id", id);
    if (error) return NextResponse.json({ error: "Speichern fehlgeschlagen." }, { status: 500 });
    await markFirstTouch(id).catch(() => {});
    return NextResponse.json({ ok: true });
  }

  if (action === "assign-hub") {
    const id = (body.id ?? "").trim();
    const hubId = (body.target_id ?? "").trim(); // target_id = Hub bei dieser Aktion
    if (!id || !hubId) {
      return NextResponse.json({ error: "Lead/Standort fehlt." }, { status: 400 });
    }
    const { data: hub } = await admin
      .from("hubs")
      .select("id, name, pdl_name, pdl_email, share_token")
      .eq("id", hubId)
      .maybeSingle();
    if (!hub) return NextResponse.json({ error: "Standort nicht gefunden." }, { status: 404 });

    // Lead laden (Kontaktdaten für die PDL-Mail).
    let name = "(ohne Name)";
    let telefon: string | null = null;
    let email: string | null = null;
    let kontext: string | null = null;
    if (kind === "meta") {
      const { data: l } = await admin
        .from("meta_leads")
        .select("field_data, campaign_name")
        .eq("id", id)
        .maybeSingle();
      if (!l) return NextResponse.json({ error: "Lead nicht gefunden." }, { status: 404 });
      name = leadFullName(l.field_data) ?? name;
      telefon = leadPhone(l.field_data);
      email = leadEmail(l.field_data);
      kontext = l.campaign_name;
    } else {
      const { data: l } = await admin
        .from("lead_calls")
        .select("lead_name, telefon, email, quelle, quelle_detail, notiz")
        .eq("id", id)
        .maybeSingle();
      if (!l) return NextResponse.json({ error: "Lead nicht gefunden." }, { status: 404 });
      name = l.lead_name ?? name;
      telefon = l.telefon;
      email = l.email;
      kontext = [l.quelle === "recare" ? "Recare" : l.quelle, l.quelle_detail, l.notiz]
        .filter(Boolean)
        .join(" · ");
    }

    const now = new Date().toISOString();
    const { error: updErr } = await admin
      .from(table)
      .update({
        zugewiesen_hub_id: hub.id,
        zugewiesen_at: now,
        bearbeiter: member.name,
      })
      .eq("id", id);
    if (updErr) {
      const colMissing = updErr.code === "PGRST204" || updErr.code === "42703";
      return NextResponse.json(
        {
          error: colMissing
            ? "Zuweisungs-Felder fehlen noch — bitte supabase/apply_all_pending.sql ausführen."
            : "Speichern fehlgeschlagen.",
        },
        { status: 500 },
      );
    }

    // PDL-Mail mit Kontaktdaten + Link zur Standort-Seite (dort bestätigen).
    const emails = splitPdlEmails(hub.pdl_email);
    let mailInfo = "keine PDL-E-Mail hinterlegt — bitte telefonisch informieren";
    if (emails.length > 0) {
      const anrede = splitPdlNames(hub.pdl_name)[0] ?? "";
      const esc = (s: string) =>
        s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
      const link = `${APP_URL}/h/${hub.share_token}`;
      const res = await deliverMail({
        to: emails,
        subject: `Neuer Patient für ${hub.name}: ${name}`,
        html: `<div style="font-family:sans-serif;line-height:1.5">
<p>Guten Tag${anrede ? ` ${esc(anrede)}` : ""},</p>
<p>Ihnen wurde ein neuer Patient zugewiesen — bitte Kontakt aufnehmen und den
Versorgungsstart koordinieren:</p>
<table cellpadding="4" style="border-collapse:collapse">
<tr><td style="color:#666;padding-right:12px">Name</td><td><strong>${esc(name)}</strong></td></tr>
<tr><td style="color:#666;padding-right:12px">Telefon</td><td><strong>${telefon ? `<a href="tel:${esc(telefon)}">${esc(telefon)}</a>` : "–"}</strong></td></tr>
<tr><td style="color:#666;padding-right:12px">E-Mail</td><td>${email ? `<a href="mailto:${esc(email)}">${esc(email)}</a>` : "–"}</td></tr>
<tr><td style="color:#666;padding-right:12px">Kontext</td><td>${esc(kontext ?? "–")}</td></tr>
<tr><td style="color:#666;padding-right:12px">Übergeben von</td><td>${esc(member.name)}</td></tr>
</table>
<p>Sobald die Versorgung startet, bitte kurz auf Ihrer Standort-Seite
bestätigen (Reiter „Patienten&rdquo;):</p>
<p><a href="${link}" style="display:inline-block;background:#5b5bd6;color:#fff;padding:10px 18px;border-radius:8px;text-decoration:none;font-weight:600">Zur Standort-Seite</a></p>
<p>Viele Grüße<br>Ihr Marketing-Team</p>
</div>`,
      });
      mailInfo = res.ok
        ? `PDL per Mail informiert (${emails.join(", ")})`
        : `Mail-Versand fehlgeschlagen: ${res.error}`;
    }

    return NextResponse.json({
      ok: true,
      hub_name: hub.name,
      pdl_name: hub.pdl_name ?? null,
      zugewiesen_at: now,
      mail_info: mailInfo,
    });
  }

  if (action === "recare-ergebnis") {
    const id = (body.id ?? "").trim();
    const ergebnis = (body.ergebnis ?? "").trim().slice(0, 300);
    const status = (body.status ?? "").trim();
    if (!id || !ergebnis || !["aufgenommen", "verloren", "kontaktiert"].includes(status)) {
      return NextResponse.json({ error: "Ungültige Angaben." }, { status: 400 });
    }
    const { error } = await admin
      .from("lead_calls")
      .update({ ergebnis, status, bearbeiter: member.name })
      .eq("id", id);
    if (error) {
      const colMissing = error.code === "PGRST204" || error.code === "42703";
      return NextResponse.json(
        {
          error: colMissing
            ? "Spalte ergebnis fehlt noch — bitte supabase/apply_all_pending.sql ausführen."
            : "Speichern fehlgeschlagen.",
        },
        { status: 500 },
      );
    }
    await markFirstTouch(id).catch(() => {});
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
