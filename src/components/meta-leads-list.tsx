"use client";

import { useState } from "react";
import { Check, Mail, Megaphone, Phone, Send, Undo2, X } from "lucide-react";
import { cn } from "@/lib/utils";

export interface LeadRow {
  id: string;
  campaign_name: string | null;
  ad_name: string | null;
  created_time: string | null;
  field_data: unknown;
  status: string;
  followup_subject?: string | null;
  followup_body?: string | null;
  followup_status?: string | null;
  followup_sent_at?: string | null;
  followup_error?: string | null;
  forwarded_at?: string | null;
  forward_error?: string | null;
}

interface Field {
  name: string;
  values: string[];
}

function fields(fd: unknown): Field[] {
  return Array.isArray(fd) ? (fd as Field[]) : [];
}

/** Feldwert: erst exakter Name, dann Teilstring-Treffer — in Prioritätsreihenfolge. */
function fieldValue(fd: unknown, ...names: string[]): string | null {
  const list = fields(fd);
  for (const n of names) {
    const exact = list.find((x) => x.name?.toLowerCase() === n);
    if (exact?.values?.[0]) return exact.values[0];
  }
  for (const n of names) {
    const f = list.find((x) => x.name?.toLowerCase().includes(n));
    if (f?.values?.[0]) return f.values[0];
  }
  return null;
}

function capitalize(s: string): string {
  return s.replace(/(^|[\s-])(\p{L})/gu, (m, sep, ch) => sep + ch.toUpperCase());
}

/**
 * Vollständiger Name: full_name, sonst Vorname + Nachname kombiniert
 * (deutsche Formulare nutzen meist vorname/nachname), sonst irgendein Namensfeld.
 */
function leadName(fd: unknown): string | null {
  const full = fieldValue(fd, "full_name", "voller_name", "vollständiger_name");
  if (full) return capitalize(full);
  const first = fieldValue(fd, "first_name", "vorname");
  const last = fieldValue(fd, "last_name", "nachname");
  if (first || last) return capitalize([first, last].filter(Boolean).join(" "));
  const any = fieldValue(fd, "name");
  return any ? capitalize(any) : null;
}

/**
 * Nachname-Vermutung aus der E-Mail, wenn das Formular keinen erhoben hat
 * (z. B. karolin.nestler@web.de → "Nestler"). Bewusst konservativ: nur wenn
 * die Adresse erkennbar mit dem Vornamen beginnt. Wird als Vermutung markiert.
 */
function guessLastNameFromEmail(firstName: string | null, email: string | null): string | null {
  if (!firstName || !email) return null;
  const local = email.split("@")[0]?.toLowerCase() ?? "";
  const fn = firstName
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "");
  if (!/^[a-z]/.test(fn)) return null; // nicht-lateinische Vornamen: keine Vermutung
  const tokens = local.split(/[._-]/).filter(Boolean);
  let rest: string | null = null;
  if (tokens.length >= 2 && (tokens[0] === fn || fn.startsWith(tokens[0]))) {
    rest = tokens.slice(1).join(" ");
  } else if (local.startsWith(fn)) {
    rest = local.slice(fn.length);
  }
  if (!rest) return null;
  const cleaned = rest.replace(/[0-9]/g, "").trim();
  if (cleaned.length < 3 || !/^[a-zäöüß -]+$/.test(cleaned)) return null;
  return capitalize(cleaned);
}

/** Restliche Formularfelder (ohne Name/Telefon/E-Mail) als Text. */
function extraFields(fd: unknown): string[] {
  const known = ["name", "phone", "email", "mail", "telefon"];
  return fields(fd)
    .filter((f) => !known.some((k) => f.name?.toLowerCase().includes(k)))
    .map((f) => `${f.name?.replace(/_/g, " ")}: ${f.values?.join(", ")}`);
}

/** Deterministische Chip-Farbe je Kampagne (stabil über Re-Renders und Filter). */
const CHIP_TONES = [
  "bg-violet-50 text-violet-800 border-violet-200",
  "bg-sky-50 text-sky-800 border-sky-200",
  "bg-amber-50 text-amber-800 border-amber-200",
  "bg-rose-50 text-rose-800 border-rose-200",
  "bg-teal-50 text-teal-800 border-teal-200",
  "bg-slate-100 text-slate-700 border-slate-200",
];
function campaignTone(name: string): string {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) | 0;
  return CHIP_TONES[Math.abs(h) % CHIP_TONES.length];
}

/** Follow-up-Bereich eines Leads: Entwurf editieren + 1-Klick senden/verwerfen. */
function FollowupPanel({
  lead,
  onUpdate,
}: {
  lead: LeadRow;
  onUpdate: (patch: Partial<LeadRow>) => void;
}) {
  const [subject, setSubject] = useState(lead.followup_subject ?? "");
  const [body, setBody] = useState(lead.followup_body ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function act(action: "send" | "discard") {
    setBusy(true);
    setError(null);
    const res = await fetch("/api/meta-ads/lead/send", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: lead.id, action, subject, body }),
    });
    const json = (await res.json().catch(() => ({}))) as { error?: string };
    setBusy(false);
    if (!res.ok) {
      setError(json.error ?? "Fehler beim Senden.");
      return;
    }
    onUpdate({
      followup_status: action === "send" ? "gesendet" : "verworfen",
      followup_subject: subject,
      followup_body: body,
      followup_sent_at: new Date().toISOString(),
    });
  }

  if (lead.followup_status === "gesendet") {
    return (
      <p className="mt-1.5 flex items-center gap-1.5 text-xs text-sky-700">
        <Mail className="size-3.5" />
        Follow-up gesendet
        {lead.followup_sent_at &&
          ` am ${new Date(lead.followup_sent_at).toLocaleString("de-DE", { dateStyle: "medium", timeStyle: "short" })}`}
      </p>
    );
  }
  if (lead.followup_status === "verworfen" || !lead.followup_status) return null;

  return (
    <details className="mt-2 w-full rounded-lg border bg-muted/30">
      <summary className="cursor-pointer select-none px-3 py-1.5 text-xs font-medium text-muted-foreground hover:text-foreground">
        <Mail className="mr-1 inline size-3.5" />
        Follow-up-Entwurf
        {lead.followup_status === "fehlgeschlagen" && (
          <span className="ml-2 text-red-600">Versand fehlgeschlagen — erneut versuchen</span>
        )}
      </summary>
      <div className="flex flex-col gap-2 p-3 pt-1">
        <input
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
          className="w-full rounded-md border bg-background px-2.5 py-1.5 text-sm"
          placeholder="Betreff"
        />
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          rows={7}
          className="w-full rounded-md border bg-background px-2.5 py-1.5 text-sm leading-relaxed"
        />
        {(error || lead.followup_error) && (
          <p className="text-xs text-red-600">{error ?? lead.followup_error}</p>
        )}
        <div className="flex items-center gap-2">
          <button
            type="button"
            disabled={busy}
            onClick={() => act("send")}
            className="flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:opacity-90 disabled:opacity-50"
          >
            <Send className="size-3.5" /> {busy ? "Sendet…" : "Follow-up senden"}
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => act("discard")}
            className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
          >
            <X className="size-3.5" /> verwerfen
          </button>
        </div>
      </div>
    </details>
  );
}

/** Bewerber-Lead (Stellenanzeige)? Gleiche Erkennung wie serverseitig. */
function isRecruitingCampaign(campaignName: string | null): boolean {
  return !!campaignName && /mitarbeiter|fachkraft|recruiting|stellen/i.test(campaignName);
}

export function MetaLeadsList({ initial }: { initial: LeadRow[] }) {
  const [leads, setLeads] = useState(initial);
  const [showDone, setShowDone] = useState(false);
  const [showBewerber, setShowBewerber] = useState(false);

  async function setStatus(id: string, status: "offen" | "kontaktiert") {
    setLeads((cur) => cur.map((l) => (l.id === id ? { ...l, status } : l)));
    await fetch("/api/meta-ads/lead", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, status }),
    });
  }

  const bewerberCount = leads.filter((l) => isRecruitingCampaign(l.campaign_name)).length;
  const scoped = leads.filter((l) => showBewerber || !isRecruitingCampaign(l.campaign_name));
  const visible = scoped.filter((l) => showDone || l.status === "offen");
  const doneCount = scoped.length - scoped.filter((l) => l.status === "offen").length;

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap gap-3">
        {doneCount > 0 && (
          <button
            type="button"
            onClick={() => setShowDone((s) => !s)}
            className="self-start text-xs text-muted-foreground hover:text-foreground"
          >
            {showDone
              ? "Kontaktierte ausblenden"
              : `${doneCount} kontaktierte anzeigen`}
          </button>
        )}
        {bewerberCount > 0 && (
          <button
            type="button"
            onClick={() => setShowBewerber((s) => !s)}
            className="self-start text-xs text-muted-foreground hover:text-foreground"
          >
            {showBewerber
              ? "Bewerber ausblenden"
              : `${bewerberCount} Bewerber anzeigen (laufen übers Recruiting)`}
          </button>
        )}
      </div>
      {visible.length === 0 && (
        <p className="rounded-xl border bg-card p-5 text-sm text-muted-foreground shadow-sm">
          {bewerberCount > 0 && !showBewerber
            ? "Keine offenen Kunden-Anfragen — Bewerber laufen direkt übers Recruiting."
            : "Alles abgearbeitet — keine offenen Leads. 🎉"}
        </p>
      )}
      <ul className="flex flex-col gap-2">
        {visible.map((l) => {
          const name = leadName(l.field_data) ?? "(ohne Name)";
          const phone = fieldValue(l.field_data, "phone", "telefon", "mobil");
          const email = fieldValue(l.field_data, "email", "mail");
          const hasLastName = /\s/.test(name);
          const guessed = hasLastName
            ? null
            : guessLastNameFromEmail(leadName(l.field_data), email);
          const done = l.status === "kontaktiert";
          return (
            <li
              key={l.id}
              className={cn(
                "flex flex-wrap items-center gap-x-4 gap-y-1 rounded-xl border bg-card p-3.5 shadow-sm",
                done && "opacity-60",
              )}
            >
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                  <span className="font-medium">
                    {name}
                    {guessed && (
                      <span
                        className="font-normal text-muted-foreground"
                        title="Nachname aus der E-Mail-Adresse vermutet — das Formular fragt keinen Nachnamen ab"
                      >
                        {" "}
                        {guessed}?
                      </span>
                    )}
                  </span>
                  {l.campaign_name && (
                    <span
                      title={l.ad_name ? `Anzeige: ${l.ad_name}` : undefined}
                      className={cn(
                        "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium",
                        campaignTone(l.campaign_name),
                      )}
                    >
                      <Megaphone className="size-3" />
                      {l.campaign_name}
                    </span>
                  )}
                  {l.forwarded_at && (
                    <span
                      className="inline-flex items-center gap-1 rounded-full border border-sky-200 bg-sky-50 px-2 py-0.5 text-[11px] font-medium text-sky-800"
                      title={`An Recruiting weitergeleitet am ${new Date(l.forwarded_at).toLocaleString("de-DE", { dateStyle: "medium", timeStyle: "short" })}`}
                    >
                      → Recruiting
                    </span>
                  )}
                  {phone && (
                    <a
                      href={`tel:${phone}`}
                      className="flex items-center gap-1 text-sm text-primary hover:underline"
                    >
                      <Phone className="size-3" />
                      {phone}
                    </a>
                  )}
                  {email && (
                    <a
                      href={`mailto:${email}`}
                      className="text-sm text-primary hover:underline"
                    >
                      {email}
                    </a>
                  )}
                </div>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {l.created_time
                    ? new Date(l.created_time).toLocaleString("de-DE", {
                        dateStyle: "medium",
                        timeStyle: "short",
                      })
                    : ""}
                  {extraFields(l.field_data).map((x) => ` · ${x}`)}
                </p>
                <FollowupPanel
                  lead={l}
                  onUpdate={(patch) =>
                    setLeads((cur) =>
                      cur.map((x) => (x.id === l.id ? { ...x, ...patch } : x)),
                    )
                  }
                />
              </div>
              {done ? (
                <div className="flex shrink-0 items-center gap-2">
                  <span className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-800">
                    <Check className="size-3.5" /> kontaktiert
                  </span>
                  <button
                    type="button"
                    onClick={() => setStatus(l.id, "offen")}
                    className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
                  >
                    <Undo2 className="size-3.5" /> zurück auf offen
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setStatus(l.id, "kontaktiert")}
                  className="flex shrink-0 items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:border-emerald-300 hover:bg-emerald-50 hover:text-emerald-800"
                >
                  <Check className="size-3.5" /> als kontaktiert markieren
                </button>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
