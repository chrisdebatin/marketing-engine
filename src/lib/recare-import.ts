import Anthropic from "@anthropic-ai/sdk";
import { createAdminClient } from "@/lib/supabase/admin";
import { getAccessToken, inboxMails } from "@/lib/outlook";
import { normName } from "@/lib/crm-log";

/**
 * Recare-Mail-Import (SERVER ONLY): liest das angebundene Outlook-Postfach,
 * erkennt (weitergeleitete) Recare-Anfragen, extrahiert die Falldaten per
 * Claude und legt sie als lead_calls (quelle 'recare', status offen) an —
 * sie erscheinen damit automatisch in Davinas Anfragen-Liste. Zusätzlich
 * wird die Anfrage als Kontakt an der jeweiligen Klinik im CRM geloggt.
 * Idempotenz über gemerkte Mail-IDs in app_settings.
 */

const MODEL = process.env.ANTHROPIC_MODEL || "claude-opus-4-8";
const PROCESSED_KEY = "recare_processed_mail_ids";

export interface RecareSyncResult {
  imported: number;
  skipped: number;
  error: string | null;
}

type LeadMailKind = "recare" | "anruf" | "website" | "agentur";

/** Offensichtlicher System-Noise (Kontosicherheit, Bounces) — nie ein Lead. */
const NOISE_SENDERS =
  /accounts\.google\.com|mailer-daemon|postmaster@|noreply@google|no-reply@accounts/i;

/**
 * Mail-Klassifizierung: "Customer Call" im Betreff = verpasster 0800-Anruf
 * (Weiterleitung der Telefonanlage); "recare"/"nachversorgung" irgendwo im
 * GANZEN Text = Recare-Anfrage (Weiterleitungen tragen das Stichwort oft
 * erst tief im Mail-Body). Alles andere (außer System-Noise) sind
 * weitergeleitete Website-/Kontaktanfragen — die sortiert Claude fein.
 */
function classifyMail(m: {
  subject: string;
  fromAddress: string;
  preview: string;
  body?: string | null;
}): LeadMailKind | null {
  if (NOISE_SENDERS.test(m.fromAddress)) return null;
  if (m.subject.toLowerCase().includes("customer call")) return "anruf";
  const hay = `${m.subject} ${m.fromAddress} ${m.body ?? m.preview}`.toLowerCase();
  // Lead-Agentur "Pflegehilfe Direkt": zugewiesene Leads (meist als WG:
  // weitergeleitet — der Marker steht im Mail-Text, nicht im Absender).
  if (
    hay.includes("pflegehilfe direkt") ||
    hay.includes("pflege-hilfe-direkt") ||
    hay.includes("neuer lead zugewiesen")
  ) {
    return "agentur";
  }
  if (hay.includes("recare") || hay.includes("nachversorg")) return "recare";
  return "website";
}

/** HTML grob zu Text (Graph liefert meist HTML-Bodies). */
function htmlToText(html: string): string {
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|tr|li|h\d)>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

async function fetchBody(id: string): Promise<string | null> {
  const token = await getAccessToken();
  if (!token) return null;
  const res = await fetch(
    `https://graph.microsoft.com/v1.0/me/messages/${encodeURIComponent(id)}?$select=body`,
    { headers: { Authorization: `Bearer ${token}` } },
  );
  if (!res.ok) return null;
  const body = (await res.json()) as { body?: { content?: string; contentType?: string } };
  const content = body.body?.content ?? "";
  return body.body?.contentType === "html" ? htmlToText(content) : content;
}

interface Extracted {
  patient: string;
  klinik: string;
  ort: string;
  versorgung: string;
  telefon: string;
  zusammenfassung: string;
}

async function extract(text: string): Promise<Extracted | null> {
  if (!process.env.ANTHROPIC_API_KEY) return null;
  try {
    const client = new Anthropic();
    const response = await client.messages.create({
      model: MODEL,
      max_tokens: 1024,
      system:
        "Du extrahierst Falldaten aus einer (weitergeleiteten) Recare-Anfrage einer Klinik an einen Pflegedienst. Felder, die nicht im Text stehen, als leeren String lassen — nichts erfinden. patient = Name oder Kürzel des Patienten; klinik = anfragendes Krankenhaus; ort = Stadt/PLZ der Versorgung; versorgung = Art (z. B. Intensivpflege, Grundpflege, Beatmung); telefon = Rückrufnummer falls genannt; zusammenfassung = 1–2 Sätze Kern der Anfrage.",
      tools: [
        {
          name: "recare_anfrage",
          description: "Extrahierte Recare-Anfrage.",
          input_schema: {
            type: "object",
            properties: {
              patient: { type: "string" },
              klinik: { type: "string" },
              ort: { type: "string" },
              versorgung: { type: "string" },
              telefon: { type: "string" },
              zusammenfassung: { type: "string" },
            },
            required: ["patient", "klinik", "ort", "versorgung", "telefon", "zusammenfassung"],
            additionalProperties: false,
          },
        },
      ],
      tool_choice: { type: "tool", name: "recare_anfrage" },
      messages: [{ role: "user", content: text.slice(0, 6000) }],
    });
    const tu = response.content.find(
      (b): b is Anthropic.ToolUseBlock => b.type === "tool_use",
    );
    return tu ? (tu.input as unknown as Extracted) : null;
  } catch {
    return null;
  }
}

const LAST_SYNC_KEY = "recare_last_sync_at";
const SYNC_MIN_INTERVAL_MS = 60_000;

interface ExtractedCall {
  telefon: string;
  name: string;
  zeitpunkt: string;
  notiz: string;
  kategorie: "neuinteressent" | "bestandskunde" | "mitarbeiter_intern" | "sonstiges";
}

/**
 * Verpasster-Anruf-Mail (Telefonanlage) → Anruferdaten + Vorsortierung:
 * Nur Neuinteressenten erscheinen als offene Leads, der Rest wird als
 * "kein Neuinteressent" abgelegt (auffindbar unter Abgeschlossene).
 */
async function extractCall(text: string): Promise<ExtractedCall | null> {
  if (!process.env.ANTHROPIC_API_KEY) return null;
  try {
    const client = new Anthropic();
    const response = await client.messages.create({
      model: MODEL,
      max_tokens: 512,
      system:
        "Du extrahierst aus einer Benachrichtigungs-Mail der Telefonanlage über einen verpassten Anruf die Daten des Anrufers und sortierst den Anruf vor. Felder, die nicht im Text stehen, als leeren String lassen — nichts erfinden. telefon = Rufnummer des Anrufers; name = Name falls genannt; zeitpunkt = Datum/Uhrzeit des Anrufs; notiz = Kern der Gesprächszusammenfassung. kategorie: 'neuinteressent' = potenzieller NEUER Pflege-Kunde bzw. Angehörige(r) mit Pflege-Anliegen (im Zweifel neuinteressent wählen!); 'bestandskunde' = bereits versorgte Kundin/Kunde (Termine, aktuelle Einsätze); 'mitarbeiter_intern' = eigene Mitarbeiter (Krankmeldung, Dienstplan) oder interne Anrufe; 'sonstiges' = alles andere (Lieferanten, Schulen, Vertrieb, keine Angaben).",
      tools: [
        {
          name: "verpasster_anruf",
          description: "Extrahierte Anrufer-Daten mit Vorsortierung.",
          input_schema: {
            type: "object",
            properties: {
              telefon: { type: "string" },
              name: { type: "string" },
              zeitpunkt: { type: "string" },
              notiz: { type: "string" },
              kategorie: {
                type: "string",
                enum: ["neuinteressent", "bestandskunde", "mitarbeiter_intern", "sonstiges"],
              },
            },
            required: ["telefon", "name", "zeitpunkt", "notiz", "kategorie"],
            additionalProperties: false,
          },
        },
      ],
      tool_choice: { type: "tool", name: "verpasster_anruf" },
      messages: [{ role: "user", content: text.slice(0, 4000) }],
    });
    const tu = response.content.find(
      (b): b is Anthropic.ToolUseBlock => b.type === "tool_use",
    );
    return tu ? (tu.input as unknown as ExtractedCall) : null;
  } catch {
    return null;
  }
}

const KATEGORIE_LABEL: Record<string, string> = {
  bestandskunde: "Bestandskunde",
  mitarbeiter_intern: "Mitarbeiter/intern",
  sonstiges: "Sonstiges",
};

interface ExtractedWebsite {
  name: string;
  telefon: string;
  email: string;
  ort: string;
  anliegen: string;
  kategorie: "kundenanfrage" | "bewerbung" | "sonstiges";
}

/**
 * Website-/Kontaktformular-Mail → Kontaktdaten + Einordnung:
 * kundenanfrage = potenzielle(r) neue(r) Pflegekunde/-in bzw. Angehörige;
 * bewerbung = Stellengesuch/Bewerbung (wird ans Recruiting weitergeleitet);
 * sonstiges = Newsletter, Vertrieb, Spam, Unzustellbares.
 */
async function extractWebsite(text: string): Promise<ExtractedWebsite | null> {
  if (!process.env.ANTHROPIC_API_KEY) return null;
  try {
    const client = new Anthropic();
    const response = await client.messages.create({
      model: MODEL,
      max_tokens: 512,
      system:
        "Du bearbeitest eine (oft weitergeleitete) E-Mail an einen Pflegedienst — meist eine Kontaktanfrage über das Website-Formular. Extrahiere die Daten der anfragenden Person und ordne die Mail ein. Felder, die nicht im Text stehen, als leeren String lassen — nichts erfinden. name = Name der Person; telefon = Rufnummer; email = E-Mail-Adresse der Person (NICHT die Formular-/Weiterleitungsadresse); ort = Stadt/PLZ falls genannt; anliegen = 1–2 Sätze Kern der Anfrage. kategorie: 'kundenanfrage' = Interesse an Pflege/Betreuung für sich oder Angehörige (im Zweifel kundenanfrage wählen!); 'bewerbung' = Stellengesuch, Bewerbung, Frage nach Arbeit/Job/Praktikum; 'sonstiges' = Vertrieb, Newsletter, Spam, technische Mails ohne Anliegen.",
      tools: [
        {
          name: "website_anfrage",
          description: "Extrahierte Website-Anfrage mit Einordnung.",
          input_schema: {
            type: "object",
            properties: {
              name: { type: "string" },
              telefon: { type: "string" },
              email: { type: "string" },
              ort: { type: "string" },
              anliegen: { type: "string" },
              kategorie: {
                type: "string",
                enum: ["kundenanfrage", "bewerbung", "sonstiges"],
              },
            },
            required: ["name", "telefon", "email", "ort", "anliegen", "kategorie"],
            additionalProperties: false,
          },
        },
      ],
      tool_choice: { type: "tool", name: "website_anfrage" },
      messages: [{ role: "user", content: text.slice(0, 6000) }],
    });
    const tu = response.content.find(
      (b): b is Anthropic.ToolUseBlock => b.type === "tool_use",
    );
    return tu ? (tu.input as unknown as ExtractedWebsite) : null;
  } catch {
    return null;
  }
}

export async function syncRecareMails(): Promise<RecareSyncResult> {
  const admin = createAdminClient();

  // Drossel: Die Team-Seite lädt alle 20 s neu — das Postfach wird trotzdem
  // höchstens einmal pro Minute abgefragt.
  const { data: lastSync } = await admin
    .from("app_settings")
    .select("value")
    .eq("key", LAST_SYNC_KEY)
    .maybeSingle();
  const last = typeof lastSync?.value === "string" ? Date.parse(lastSync.value) : 0;
  if (Number.isFinite(last) && Date.now() - last < SYNC_MIN_INTERVAL_MS) {
    return { imported: 0, skipped: 0, error: null };
  }
  await admin.from("app_settings").upsert({
    key: LAST_SYNC_KEY,
    value: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  });

  // Eingangskanal: bevorzugt das IMAP-Lead-Postfach (Gmail, kein Admin
  // nötig), sonst das angebundene Outlook-Konto.
  let mails: { id: string; subject: string; fromAddress: string; receivedAt: string; body: string | null; preview: string }[];
  const { imapConfigured, fetchUnseenMails } = await import("@/lib/imap-inbox");
  if (imapConfigured()) {
    const inbound = await fetchUnseenMails(20).catch(() => null);
    if (inbound === null) {
      return { imported: 0, skipped: 0, error: "imap_error" };
    }
    mails = inbound.map((m) => ({
      id: m.id,
      subject: m.subject,
      fromAddress: m.fromAddress,
      receivedAt: m.receivedAt,
      body: m.text,
      preview: m.text.slice(0, 300),
    }));
  } else {
    const outlook = await inboxMails(50);
    if (outlook === null) {
      return { imported: 0, skipped: 0, error: "outlook_not_connected" };
    }
    mails = outlook.map((m) => ({
      id: m.id,
      subject: m.subject,
      fromAddress: m.fromAddress,
      receivedAt: m.receivedAt,
      body: null,
      preview: m.preview,
    }));
  }

  const { data: setting } = await admin
    .from("app_settings")
    .select("value")
    .eq("key", PROCESSED_KEY)
    .maybeSingle();
  const processed = new Set<string>(
    Array.isArray(setting?.value) ? (setting.value as string[]) : [],
  );

  const candidates = mails
    .map((m) => ({ ...m, kind: classifyMail(m) }))
    .filter((m) => !processed.has(m.id) && m.kind !== null);
  let imported = 0;
  let skipped = 0;

  for (const m of candidates) {
    processed.add(m.id);
    const body = m.body ?? (await fetchBody(m.id)) ?? m.preview;

    // Verpasster 0800-Anruf: Nummer/Name/Zeit rausziehen, Lead fürs DE-Team.
    if (m.kind === "anruf") {
      const call = await extractCall(`Betreff: ${m.subject}\n\n${body}`);
      // Vorsortierung: nur Neuinteressenten als offener Lead; der Rest wird
      // direkt abgeschlossen (bleibt unter "Abgeschlossene" auffindbar).
      const interessent = !call || call.kategorie === "neuinteressent";
      const { error: insErr } = await admin.from("lead_calls").insert({
        call_date: m.receivedAt.slice(0, 10),
        quelle: "telefon0800",
        lead_name: call?.name?.trim() || "Verpasster Anruf",
        telefon: call?.telefon?.trim().slice(0, 60) || null,
        notiz:
          [
            "Verpasster Anruf",
            call?.zeitpunkt ? `um ${call.zeitpunkt}` : "",
            call?.notiz ?? "",
          ]
            .filter(Boolean)
            .join(" · ")
            .slice(0, 1000) || null,
        status: interessent ? "offen" : "verloren",
        ergebnis: interessent
          ? null
          : `kein Neuinteressent (KI-vorsortiert: ${KATEGORIE_LABEL[call!.kategorie] ?? call!.kategorie})`,
      });
      if (insErr) {
        processed.delete(m.id);
        skipped++;
      } else imported++;
      continue;
    }

    // Website-/Kontaktformular-Anfrage: Claude ordnet ein.
    // Kundenanfrage → offener Lead (Kundenservice-Team); Bewerbung → Mail ans
    // Recruiting + als abgeschlossen abgelegt; Sonstiges → nur vermerken.
    // Lead-Agentur (Pflegehilfe Direkt): zugewiesener Kunden-Lead — gleiche
    // Feld-Extraktion wie Website-Anfragen, aber immer als Lead importieren
    // (Agentur-Mails sind nie Bewerbungen/Spam) und quelle = agentur.
    if (m.kind === "agentur") {
      const w = await extractWebsite(`Von: ${m.fromAddress}\nBetreff: ${m.subject}\n\n${body}`);
      if (!w) {
        processed.delete(m.id);
        skipped++;
        continue;
      }
      const lower = body.toLowerCase();
      const bereich = lower.includes("intensiv")
        ? "intensiv"
        : /alltagshilfe|hauswirtschaft|betreuung und entlastung/.test(lower)
          ? "alltagshilfe"
          : lower.includes("ambulante")
            ? "ambulant"
            : "pflege";
      const agenturValues = {
        call_date: m.receivedAt.slice(0, 10),
        quelle: "agentur",
        bereich,
        quelle_detail: "Pflegehilfe Direkt",
        lead_name: w.name.slice(0, 200) || "(ohne Name)",
        telefon: w.telefon.slice(0, 60) || null,
        email: w.email.slice(0, 200) || null,
        notiz: [w.anliegen, w.ort ? `Ort: ${w.ort}` : ""].filter(Boolean).join(" · ").slice(0, 1000) || null,
        status: "offen",
      };
      let { error: insErr } = await admin
        .from("lead_calls")
        .insert({ ...agenturValues, adresse: w.ort.slice(0, 200) || null });
      if (insErr && (insErr.code === "PGRST204" || insErr.code === "42703")) {
        ({ error: insErr } = await admin.from("lead_calls").insert(agenturValues));
      }
      if (insErr) {
        processed.delete(m.id);
        skipped++;
      } else imported++;
      continue;
    }

    if (m.kind === "website") {
      const w = await extractWebsite(`Von: ${m.fromAddress}\nBetreff: ${m.subject}\n\n${body}`);
      if (!w) {
        skipped++;
        continue;
      }
      if (w.kategorie === "sonstiges") {
        skipped++;
        continue;
      }
      if (w.kategorie === "bewerbung") {
        const { deliverMail } = await import("@/lib/mailer");
        const { FORWARD_TO } = await import("@/lib/lead-forward");
        const esc = (s: string) =>
          s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
        const sent = await deliverMail({
          to: FORWARD_TO,
          subject: `Bewerbung über Website: ${w.name || "(ohne Name)"}`,
          html:
            `<p>Bewerbung über das Website-Kontaktformular:</p>` +
            `<table cellpadding="4" style="border-collapse:collapse">` +
            [
              ["Name", w.name],
              ["Telefon", w.telefon],
              ["E-Mail", w.email],
              ["Ort", w.ort],
              ["Anliegen", w.anliegen],
            ]
              .filter(([, v]) => v)
              .map(
                ([k, v]) =>
                  `<tr><td style="color:#666;padding-right:12px;vertical-align:top">${k}</td><td><strong>${esc(v)}</strong></td></tr>`,
              )
              .join("") +
            `</table>` +
            `<p style="color:#888;font-size:12px">Original-Mail:</p><pre style="white-space:pre-wrap;font-size:12px">${esc(body.slice(0, 4000))}</pre>`,
        });
        const { error: insErr } = await admin.from("lead_calls").insert({
          call_date: m.receivedAt.slice(0, 10),
          quelle: "website",
          lead_name: w.name.slice(0, 200) || "(ohne Name)",
          telefon: w.telefon.slice(0, 60) || null,
          email: w.email.slice(0, 200) || null,
          notiz: [w.anliegen, w.ort ? `Ort: ${w.ort}` : ""].filter(Boolean).join(" · ").slice(0, 1000) || null,
          status: sent.ok ? "verloren" : "offen",
          ergebnis: sent.ok
            ? "Bewerbung — automatisch an Recruiting weitergeleitet"
            : null,
          ...(sent.ok
            ? {}
            : {
                notiz: [
                  "BEWERBUNG — Weiterleitung ans Recruiting fehlgeschlagen, bitte manuell weiterleiten!",
                  w.anliegen,
                ]
                  .filter(Boolean)
                  .join(" · ")
                  .slice(0, 1000),
              }),
        });
        if (insErr) {
          processed.delete(m.id);
          skipped++;
        } else imported++;
        continue;
      }
      // kundenanfrage → offener Lead fürs Kundenservice-Team
      const websiteValues = {
        call_date: m.receivedAt.slice(0, 10),
        quelle: "website",
        bereich: "pflege",
        lead_name: w.name.slice(0, 200) || "(ohne Name)",
        telefon: w.telefon.slice(0, 60) || null,
        email: w.email.slice(0, 200) || null,
        notiz: [w.anliegen, w.ort ? `Ort: ${w.ort}` : ""].filter(Boolean).join(" · ").slice(0, 1000) || null,
        status: "offen",
      };
      let { error: insErr } = await admin
        .from("lead_calls")
        .insert({ ...websiteValues, adresse: w.ort.slice(0, 200) || null });
      if (insErr && (insErr.code === "PGRST204" || insErr.code === "42703")) {
        // Migration 0058 fehlt noch → ohne Adress-Spalte importieren.
        ({ error: insErr } = await admin.from("lead_calls").insert(websiteValues));
      }
      if (insErr) {
        // NICHT als verarbeitet merken — sonst ist die Mail beim nächsten
        // Sync unwiederbringlich verloren.
        processed.delete(m.id);
        skipped++;
      } else imported++;
      continue;
    }

    const data = await extract(`Betreff: ${m.subject}\n\n${body}`);
    if (!data) {
      skipped++;
      continue;
    }

    // Recare schickt pro Patient mehrere Mails (Anfrage-Varianten, Daten-
    // Updates, Zuweisung). Über den Patienten-Code (z. B. "1VM-JQG-Z1V")
    // wird der BESTEHENDE Lead fortgeschrieben statt ein Duplikat anzulegen;
    // "zugewiesen"-Mails heben den Status auf kontaktiert (Klinik hat den
    // Patienten fest an uns vergeben).
    const code =
      /\b([A-Z0-9]{3}-[A-Z0-9]{3}-[A-Z0-9]{3})\b/.exec(m.subject)?.[1] ??
      /\b([A-Z0-9]{3}-[A-Z0-9]{3}-[A-Z0-9]{3})\b/.exec(data.patient)?.[1] ??
      null;
    const zugewiesen = /zugewiesen/i.test(m.subject);
    if (code) {
      const { data: vorhandene } = await admin
        .from("lead_calls")
        .select("id, status, notiz")
        .eq("quelle", "recare")
        .ilike("lead_name", `%${code}%`)
        .order("created_at", { ascending: true })
        .limit(1);
      const existing = vorhandene?.[0];
      if (existing) {
        const heute = new Date().toLocaleDateString("de-DE");
        const zusatz = zugewiesen
          ? `✔ Klinik hat den Patienten über Recare fest zugewiesen (${heute})`
          : `Update der Klinik (${heute}): ${data.zusammenfassung || "Patientendaten aktualisiert"}`;
        const notiz = (existing.notiz ?? "").includes(zusatz)
          ? existing.notiz
          : [existing.notiz, zusatz].filter(Boolean).join(" · ").slice(0, 1000);
        await admin
          .from("lead_calls")
          .update({
            notiz,
            ...(zugewiesen && existing.status === "offen"
              ? { status: "kontaktiert" }
              : {}),
          })
          .eq("id", existing.id);
        imported++;
        continue;
      }
    }

    const notizTeile = [
      data.zusammenfassung,
      data.versorgung ? `Versorgung: ${data.versorgung}` : "",
      data.ort ? `Ort: ${data.ort}` : "",
      zugewiesen ? "✔ Klinik hat den Patienten über Recare fest zugewiesen" : "",
    ].filter(Boolean);
    const recareValues = {
      call_date: m.receivedAt.slice(0, 10),
      quelle: "recare",
      bereich: "pflege",
      quelle_detail: data.klinik.slice(0, 200) || null,
      lead_name: data.patient.slice(0, 200) || "(ohne Name)",
      telefon: data.telefon.slice(0, 60) || null,
      notiz: notizTeile.join(" · ").slice(0, 1000) || null,
      status: zugewiesen ? "kontaktiert" : "offen",
    };
    let { error: insErr } = await admin
      .from("lead_calls")
      .insert({ ...recareValues, adresse: data.ort.slice(0, 200) || null });
    if (insErr && (insErr.code === "PGRST204" || insErr.code === "42703")) {
      // Migration 0058 fehlt noch → ohne Adress-Spalte importieren.
      ({ error: insErr } = await admin.from("lead_calls").insert(recareValues));
    }
    if (insErr) {
      // Mail beim nächsten Sync erneut versuchen statt sie zu verlieren.
      processed.delete(m.id);
      skipped++;
      continue;
    }
    imported++;

    // Recare-Anfrage sagt auch etwas über die Klinik-Beziehung: als
    // Kontakt (art 'lead') am passenden CRM-Ziel mitloggen.
    if (data.klinik) {
      const { data: targets } = await admin
        .from("crm_targets")
        .select("id, hub_id, name")
        .eq("kategorie", "krankenhaus");
      const kn = normName(data.klinik);
      const hit = (targets ?? []).find((t) => {
        const tn = normName(t.name);
        return tn === kn || (kn.length >= 8 && tn.includes(kn)) || (tn.length >= 8 && kn.includes(tn));
      });
      if (hit) {
        await admin.from("crm_contacts").insert({
          target_id: hit.id,
          hub_id: hit.hub_id,
          kontakt_art: "lead",
          note: `Recare-Anfrage: ${data.zusammenfassung}`.slice(0, 500),
          contact_date: m.receivedAt.slice(0, 10),
          bearbeiter: "Recare-Import",
        });
      }
    }
  }

  // Verarbeitete IDs merken (Kappe bei 300 — Posteingang liest eh nur 50).
  await admin.from("app_settings").upsert({
    key: PROCESSED_KEY,
    value: [...processed].slice(-300),
    updated_at: new Date().toISOString(),
  });

  return { imported, skipped, error: null };
}
