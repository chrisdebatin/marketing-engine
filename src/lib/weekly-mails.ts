import { createAdminClient } from "@/lib/supabase/admin";
import { sendMail } from "@/lib/outlook";
import { crmStatus, formatIsoDate, todayIso } from "@/lib/crm";
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

    const res = await sendMail({
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
    { name: string; status: "erstbesuch" | "faellig" }[]
  >();
  for (const t of (targetRows ?? []) as {
    hub_id: string | null;
    name: string;
    intervall_wochen: number;
    letzter_besuch: string | null;
    naechster_besuch: string | null;
  }[]) {
    if (!t.hub_id) continue;
    const status = crmStatus(t, today);
    if (status === "geplant") continue;
    const arr = targetsByHub.get(t.hub_id) ?? [];
    arr.push({ name: t.name, status });
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

    const shown = due.slice(0, 6);
    const items = shown
      .map(
        (d) =>
          `<li>${esc(d.name)} <span style="color:#8a90a3">(${d.status === "erstbesuch" ? "Erstkontakt ausstehend" : "Follow-up fällig"})</span></li>`,
      )
      .join("");
    const link = `${appUrl()}/h/${h.share_token}`;

    const html = `<div style="${MAIL_STYLE}">
<p>Guten Morgen,</p>
<p>kurze Wochen-Erinnerung: Auf Ihrer To-do-Liste für
<strong>${esc(h.name)}</strong> ${due.length === 1 ? "wartet 1 Ort" : `warten ${due.length} Orte`} auf einen Kontakt — Box vorbeibringen, persönlich besuchen oder anrufen:</p>
<ul>${items}</ul>
${due.length > shown.length ? `<p>… und ${due.length - shown.length} weitere.</p>` : ""}
<p><a href="${link}" style="display:inline-block;background:#5b5bd6;color:#fff;padding:10px 18px;border-radius:8px;text-decoration:none;font-weight:600">Zur Liste — Kontakt loggen</a></p>
<p>Bitte jeden Kontakt direkt auf der Seite loggen — jede Aktion zählt für
das Standort-Ranking, und das nächste Gespräch wird automatisch terminiert.</p>
<p>Viele Grüße<br>Ihr Marketing-Team<br>
Tel. 0177 2988 173 · <a href="mailto:marketing@igs-holding.de">marketing@igs-holding.de</a></p>
<p style="color:#8a90a3;font-size:12px">Diese Erinnerung wird automatisch jeden Montag versendet.</p>
</div>`;

    const res = await sendMail({
      to: emails,
      subject: `Erinnerung: ${due.length === 1 ? "1 Ort wartet" : `${due.length} Orte warten`} auf Ihren Besuch — ${h.name}`,
      html,
    });
    if (res.ok) result.sent.push(`${h.name} <${emails.join(", ")}>`);
    else result.errors.push(`${h.name}: ${res.error}`);
  }

  return result;
}
