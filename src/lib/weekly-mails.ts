import { createAdminClient } from "@/lib/supabase/admin";
import { deliverMail } from "@/lib/mailer";
import { crmStatus, formatIsoDate, relevanzOf, todayIso } from "@/lib/crm";
import { splitPdlEmails } from "@/lib/pdl";
import type { Hub } from "@/lib/types";

/**
 * Wöchentliche Mails über das verbundene Outlook-Konto:
 * - MD-Update: Marketing-Aktivität der letzten 7 Tage je Standort, gebündelt
 *   pro MD (Adresse in hubs.md_email, im Admin pflegbar).
 * - PDL-Reminder: welche Orte der To-do-Liste diese Woche dran sind, mit
 *   Link auf das Standort-Dashboard.
 *
 * Aufgerufen vom Wochen-Cron (/api/cron/weekly) und manuell aus dem Admin.
 */

export interface MailRunResult {
  sent: string[];
  skipped: string[];
  errors: string[];
}

function appUrl(): string {
  return (
    process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"
  ).replace(/\/$/, "");
}

function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function isoDaysAgo(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString().slice(0, 10);
}

const MAIL_STYLE =
  'font-family:Segoe UI,Arial,sans-serif;font-size:14px;color:#1f2430;line-height:1.5';
const TD = 'padding:6px 10px;border:1px solid #dfe3ec;text-align:left';
const TH = `${TD};background:#f2f4fa;font-weight:600`;

/** Aktivität der letzten 7 Tage je Hub einsammeln (fehlertolerant). */
async function weeklyStats() {
  const admin = createAdminClient();
  const cutoff = isoDaysAgo(7);

  const contacts = new Map<string, number>();
  const boxContacts = new Map<string, number>();
  const placements = new Map<string, number>();
  const orderCounts = new Map<string, number>();
  const bump = (map: Map<string, number>, hubId: string | null, by = 1) => {
    if (!hubId) return;
    map.set(hubId, (map.get(hubId) ?? 0) + by);
  };

  // Kontakt-Log kann fehlen (Migration 0027) — dann bleibt die Map leer.
  const { data: contactRows } = await admin
    .from("crm_contacts")
    .select("hub_id, kontakt_art")
    .gte("contact_date", cutoff);
  for (const c of contactRows ?? []) {
    bump(contacts, c.hub_id);
    if (c.kontakt_art === "box") bump(boxContacts, c.hub_id);
  }

  const { data: placementRows } = await admin
    .from("delivery_placements")
    .select("hub_id, created_at")
    .gte("created_at", cutoff);
  for (const p of placementRows ?? []) bump(placements, p.hub_id);

  const { data: orderRows } = await admin
    .from("orders")
    .select("hub_id, created_at")
    .gte("created_at", cutoff);
  for (const o of orderRows ?? []) bump(orderCounts, o.hub_id);

  return { cutoff, contacts, boxContacts, placements, orderCounts };
}

/** Wochen-Update an alle MDs mit hinterlegter E-Mail. */
export async function sendMdUpdates(): Promise<MailRunResult> {
  const admin = createAdminClient();
  const result: MailRunResult = { sent: [], skipped: [], errors: [] };

  // select("*"): tolerant, falls md_email (0028) noch fehlt.
  const { data: hubRows, error } = await admin.from("hubs").select("*");
  if (error || !hubRows) {
    result.errors.push("Hubs konnten nicht geladen werden.");
    return result;
  }
  const hubs = hubRows as Hub[];
  const stats = await weeklyStats();

  const byMd = new Map<string, Hub[]>();
  for (const h of hubs) {
    const md = (h.responsible_md ?? "").trim();
    if (!md) continue;
    const arr = byMd.get(md) ?? [];
    arr.push(h);
    byMd.set(md, arr);
  }

  const from = formatIsoDate(stats.cutoff);
  const to = formatIsoDate(todayIso());

  for (const [md, mdHubs] of byMd) {
    const email = mdHubs
      .map((h) => (h.md_email ?? "").trim())
      .find((e) => e.includes("@"));
    if (!email) {
      result.skipped.push(`${md}: keine MD-E-Mail hinterlegt`);
      continue;
    }

    const rows = mdHubs
      .sort((a, b) => a.name.localeCompare(b.name, "de"))
      .map((h) => {
        const kontakte = stats.contacts.get(h.id) ?? 0;
        const boxen = stats.boxContacts.get(h.id) ?? 0;
        const auslagen = stats.placements.get(h.id) ?? 0;
        const bestellungen = stats.orderCounts.get(h.id) ?? 0;
        return `<tr><td style="${TD}">${esc(h.name)}</td><td style="${TD}">${kontakte}${boxen ? ` (davon ${boxen} Box${boxen === 1 ? "" : "en"})` : ""}</td><td style="${TD}">${auslagen}</td><td style="${TD}">${bestellungen}</td></tr>`;
      })
      .join("");
    const totals = mdHubs.reduce(
      (acc, h) => ({
        kontakte: acc.kontakte + (stats.contacts.get(h.id) ?? 0),
        auslagen: acc.auslagen + (stats.placements.get(h.id) ?? 0),
        bestellungen: acc.bestellungen + (stats.orderCounts.get(h.id) ?? 0),
      }),
      { kontakte: 0, auslagen: 0, bestellungen: 0 },
    );

    const html = `<div style="${MAIL_STYLE}">
<p>Guten Morgen,</p>
<p>hier das wöchentliche Marketing-Update für Ihre Standorte
(${esc(from)} – ${esc(to)}):</p>
<table style="border-collapse:collapse">
<tr><th style="${TH}">Standort</th><th style="${TH}">Klinik-Kontakte</th><th style="${TH}">Flyer-/Box-Auslagen</th><th style="${TH}">Bestellungen</th></tr>
${rows}
<tr><td style="${TH}">Gesamt</td><td style="${TH}">${totals.kontakte}</td><td style="${TH}">${totals.auslagen}</td><td style="${TH}">${totals.bestellungen}</td></tr>
</table>
<p>Details im Dashboard: <a href="${appUrl()}/hubs">${appUrl()}/hubs</a></p>
<p>Viele Grüße<br>Ihr Marketing-Team<br>
Tel. 0177 2988 173 · <a href="mailto:marketing@igs-holding.de">marketing@igs-holding.de</a></p>
<p style="color:#8a90a3;font-size:12px">Diese Mail wird automatisch jeden Montag versendet.</p>
</div>`;

    const res = await deliverMail({
      to: [email],
      subject: `Marketing-Update Ihrer Standorte (${from} – ${to})`,
      html,
    });
    if (res.ok) result.sent.push(`${md} <${email}>`);
    else result.errors.push(`${md} <${email}>: ${res.error}`);
  }

  if (byMd.size === 0) result.skipped.push("Keine Hubs mit MD gefunden.");
  return result;
}

/** Wochen-Reminder an alle PDLs mit fälligen Orten auf der To-do-Liste. */
export async function sendPdlReminders(): Promise<MailRunResult> {
  const admin = createAdminClient();
  const result: MailRunResult = { sent: [], skipped: [], errors: [] };

  const [{ data: hubRows, error }, { data: targetRows }] = await Promise.all([
    admin.from("hubs").select("*"),
    admin.from("crm_targets").select("*").not("hub_id", "is", null),
  ]);
  if (error || !hubRows) {
    result.errors.push("Hubs konnten nicht geladen werden.");
    return result;
  }
  const hubs = hubRows as Hub[];
  const today = todayIso();

  const targetsByHub = new Map<
    string,
    { name: string; status: "erstbesuch" | "faellig"; prio: number }[]
  >();
  for (const t of (targetRows ?? []) as {
    hub_id: string | null;
    name: string;
    intervall_wochen: number;
    letzter_besuch: string | null;
    naechster_besuch: string | null;
    relevanz?: number | null;
    note?: string | null;
  }[]) {
    if (!t.hub_id) continue;
    const status = crmStatus(t, today);
    if (status === "geplant") continue;
    const arr = targetsByHub.get(t.hub_id) ?? [];
    arr.push({ name: t.name, status, prio: relevanzOf(t) ?? 9 });
    targetsByHub.set(t.hub_id, arr);
  }

  for (const h of hubs.sort((a, b) => a.name.localeCompare(b.name, "de"))) {
    const emails = splitPdlEmails(h.pdl_email);
    const due = targetsByHub.get(h.id) ?? [];
    if (due.length === 0) continue;
    if (emails.length === 0) {
      result.skipped.push(`${h.name}: ${due.length} fällig, keine PDL-E-Mail`);
      continue;
    }

    // Wochen-Plan statt Zahlenberg: Fällige zuerst, dann Top-Vorschläge
    // nach Priorität — maximal 6 konkrete Empfehlungen.
    const faellig = due.filter((d) => d.status === "faellig");
    const vorschlaege = due
      .filter((d) => d.status === "erstbesuch")
      .sort((a, b) => a.prio - b.prio);
    const shown = [...faellig, ...vorschlaege].slice(0, 6);
    const items = shown
      .map(
        (d) =>
          `<li>${esc(d.name)} <span style="color:#8a90a3">(${d.status === "erstbesuch" ? "Vorschlag — noch nie besucht" : "Follow-up fällig"})</span></li>`,
      )
      .join("");
    const link = `${appUrl()}/h/${h.share_token}`;

    const html = `<div style="${MAIL_STYLE}">
<p>Guten Morgen,</p>
<p>Ihr Wochen-Plan für <strong>${esc(h.name)}</strong>${faellig.length > 0 ? ` — ${faellig.length === 1 ? "1 Follow-up ist" : `${faellig.length} Follow-ups sind`} fällig` : ""}. Unsere Empfehlung für diese Woche:</p>
<ul>${items}</ul>
<p><a href="${link}" style="display:inline-block;background:#5b5bd6;color:#fff;padding:10px 18px;border-radius:8px;text-decoration:none;font-weight:600">Zur Liste — Kontakt loggen</a></p>
<p>Bitte jeden Kontakt direkt auf der Seite loggen (Schnell-Log) — jede
Aktion zählt für das Standort-Ranking, und der nächste Termin wird
automatisch gesetzt.</p>
<p>Viele Grüße<br>Ihr Marketing-Team<br>
Tel. 0177 2988 173 · <a href="mailto:marketing@igs-holding.de">marketing@igs-holding.de</a></p>
<p style="color:#8a90a3;font-size:12px">Diese Erinnerung wird automatisch jeden Montag versendet.</p>
</div>`;

    const res = await deliverMail({
      to: emails,
      subject:
        faellig.length > 0
          ? `Wochen-Plan ${h.name}: ${faellig.length === 1 ? "1 Follow-up fällig" : `${faellig.length} Follow-ups fällig`} + Empfehlungen`
          : `Wochen-Plan ${h.name}: Ihre ${Math.min(shown.length, 6)} empfohlenen Orte`,
      html,
    });
    if (res.ok) result.sent.push(`${h.name} <${emails.join(", ")}>`);
    else result.errors.push(`${h.name}: ${res.error}`);
  }

  return result;
}

// ── Gruppen-Report (Geschäftsführung): eine Mail über alle Standorte ──

export interface HubActivity {
  hubId: string;
  name: string;
  box: number;
  besuch: number;
  anruf: number;
  flyer: number;
  auslagen: number;
  bestellungen: number;
  score: number;
}

export interface GroupWeekly {
  from: string;
  to: string;
  hubs: HubActivity[];
  totals: {
    kontakte: number;
    box: number;
    besuch: number;
    anruf: number;
    auslagen: number;
    bestellungen: number;
  };
  placements: { hub: string; ort: string; kind: string }[];
}

/** Aktivität aller Standorte der letzten 7 Tage — für Report-Seite und Mail. */
export async function collectGroupWeekly(): Promise<GroupWeekly> {
  const admin = createAdminClient();
  const cutoff = isoDaysAgo(7);

  const [{ data: hubRows }, { data: contactRows }, { data: placementRows }, { data: orderRows }] =
    await Promise.all([
      admin.from("hubs").select("id, name"),
      admin.from("crm_contacts").select("hub_id, kontakt_art").gte("contact_date", cutoff),
      admin
        .from("delivery_placements")
        .select("hub_id, standort_name, kind, created_at")
        .gte("created_at", cutoff)
        .order("created_at", { ascending: false }),
      admin.from("orders").select("hub_id, created_at").gte("created_at", cutoff),
    ]);

  const hubs = new Map<string, HubActivity>();
  for (const h of hubRows ?? []) {
    hubs.set(h.id, {
      hubId: h.id,
      name: h.name,
      box: 0,
      besuch: 0,
      anruf: 0,
      flyer: 0,
      auslagen: 0,
      bestellungen: 0,
      score: 0,
    });
  }
  for (const c of contactRows ?? []) {
    const h = c.hub_id ? hubs.get(c.hub_id) : undefined;
    if (!h) continue;
    if (c.kontakt_art === "box") h.box++;
    else if (c.kontakt_art === "anruf") h.anruf++;
    else if (c.kontakt_art === "flyer") h.flyer++;
    else h.besuch++;
  }
  const hubName = (id: string | null) =>
    (id && hubs.get(id)?.name) || "Unbekannt";
  const placements: GroupWeekly["placements"] = [];
  for (const p of placementRows ?? []) {
    const h = p.hub_id ? hubs.get(p.hub_id) : undefined;
    if (h) h.auslagen++;
    placements.push({
      hub: hubName(p.hub_id),
      ort: p.standort_name,
      kind: p.kind === "flyer" ? "Flyer" : "Box",
    });
  }
  for (const o of orderRows ?? []) {
    const h = o.hub_id ? hubs.get(o.hub_id) : undefined;
    if (h) h.bestellungen++;
  }

  const list = [...hubs.values()];
  for (const h of list) {
    h.score = h.box + h.besuch + h.anruf + h.flyer + h.auslagen;
  }
  list.sort((a, b) => b.score - a.score || a.name.localeCompare(b.name, "de"));

  const totals = list.reduce(
    (acc, h) => ({
      kontakte: acc.kontakte + h.box + h.besuch + h.anruf + h.flyer,
      box: acc.box + h.box,
      besuch: acc.besuch + h.besuch,
      anruf: acc.anruf + h.anruf,
      auslagen: acc.auslagen + h.auslagen,
      bestellungen: acc.bestellungen + h.bestellungen,
    }),
    { kontakte: 0, box: 0, besuch: 0, anruf: 0, auslagen: 0, bestellungen: 0 },
  );

  return {
    from: cutoff,
    to: todayIso(),
    hubs: list,
    totals,
    placements: placements.slice(0, 40),
  };
}

/** Gruppen-Report als Mail-HTML (Geschäftsführung). */
export function groupReportHtml(g: GroupWeekly): { subject: string; html: string } {
  const from = formatIsoDate(g.from);
  const to = formatIsoDate(g.to);
  const active = g.hubs.filter((h) => h.score > 0);
  const inactive = g.hubs.length - active.length;
  const medals = ["🥇", "🥈", "🥉"];
  const top = active
    .slice(0, 3)
    .map((h, i) => `${medals[i]} ${esc(h.name)} (${h.score} Aktionen)`)
    .join(" · ");

  const rows = active
    .map(
      (h) =>
        `<tr><td style="${TD}">${esc(h.name)}</td><td style="${TD}">${h.box}</td><td style="${TD}">${h.besuch}</td><td style="${TD}">${h.anruf}</td><td style="${TD}">${h.auslagen}</td><td style="${TD}">${h.bestellungen}</td><td style="${TD}"><strong>${h.score}</strong></td></tr>`,
    )
    .join("");
  const placementRows = g.placements
    .map(
      (p) =>
        `<tr><td style="${TD}">${esc(p.hub)}</td><td style="${TD}">${esc(p.ort)}</td><td style="${TD}">${p.kind}</td></tr>`,
    )
    .join("");

  const html = `<div style="${MAIL_STYLE}">
<p>Guten Morgen,</p>
<p>hier das wöchentliche Marketing-Update der Gruppe (${esc(from)} – ${esc(to)}):</p>
<p><strong>${g.totals.kontakte} Klinik-Kontakte</strong> (${g.totals.box} Boxen, ${g.totals.besuch} Besuche, ${g.totals.anruf} Anrufe) ·
<strong>${g.totals.auslagen} Flyer-/Box-Auslagen</strong> · ${g.totals.bestellungen} Material-Bestellungen</p>
${top ? `<p><strong>Aktivste Standorte:</strong> ${top}</p>` : ""}
${
  active.length > 0
    ? `<table style="border-collapse:collapse">
<tr><th style="${TH}">Standort</th><th style="${TH}">Boxen</th><th style="${TH}">Besuche</th><th style="${TH}">Anrufe</th><th style="${TH}">Auslagen</th><th style="${TH}">Bestell.</th><th style="${TH}">Gesamt</th></tr>
${rows}
</table>`
    : "<p>Diese Woche wurden keine Aktivitäten geloggt.</p>"
}
${inactive > 0 ? `<p style="color:#8a90a3">${inactive} Standort${inactive === 1 ? "" : "e"} ohne geloggte Aktivität diese Woche.</p>` : ""}
${
  g.placements.length > 0
    ? `<p><strong>Wo ausgelegt/beliefert wurde:</strong></p>
<table style="border-collapse:collapse">
<tr><th style="${TH}">Standort</th><th style="${TH}">Ort</th><th style="${TH}">Art</th></tr>
${placementRows}
</table>`
    : ""
}
<p>Details im Dashboard: <a href="${appUrl()}/kommunikation">${appUrl()}/kommunikation</a></p>
<p>Viele Grüße<br>Ihr Marketing-Team<br>
Tel. 0177 2988 173 · <a href="mailto:marketing@igs-holding.de">marketing@igs-holding.de</a></p>
<p style="color:#8a90a3;font-size:12px">Automatischer Wochen-Report, jeden Montag. Demnächst zusätzlich: neue Patienten je Standort.</p>
</div>`;

  return {
    subject: `Marketing-Wochenreport der Gruppe (${from} – ${to})`,
    html,
  };
}

/** Gruppen-Report senden — an GF_EMAIL (Env) oder übergebene Adressen. */
export async function sendGroupReport(
  toOverride?: string[],
): Promise<MailRunResult> {
  const result: MailRunResult = { sent: [], skipped: [], errors: [] };
  const to =
    toOverride && toOverride.length > 0
      ? toOverride
      : (process.env.GF_EMAIL ?? "")
          .split(/[,;\s]+/)
          .map((s) => s.trim())
          .filter((s) => s.includes("@"));
  if (to.length === 0) {
    result.skipped.push(
      "Keine Geschäftsführungs-Adresse (GF_EMAIL) hinterlegt.",
    );
    return result;
  }
  const g = await collectGroupWeekly();
  const { subject, html } = groupReportHtml(g);
  const res = await deliverMail({ to, subject, html });
  if (res.ok) result.sent.push(`Geschäftsführung <${to.join(", ")}>`);
  else result.errors.push(`Geschäftsführung: ${res.error}`);
  return result;
}
