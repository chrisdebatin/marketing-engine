"use client";

import { useEffect, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import {
  CalendarClock,
  Check,
  Hand,
  Inbox,
  Mail,
  MapPin,
  Pencil,
  Phone,
  PhoneCall,
  Undo2,
  Users,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { LEAD_QUELLEN, leadQuelleLabel, leadShortId } from "@/lib/leads";
import { OutboundMap } from "@/components/outbound-map";
import { placeKindLabel } from "@/lib/places";
import { formatIsoDate, kontaktArtLabel, todayIso } from "@/lib/crm";

export interface InboundLead {
  kind: "meta" | "call";
  id: string;
  name: string;
  telefon: string | null;
  email: string | null;
  adresse: string | null;
  quelle: string;
  quelle_detail: string | null;
  datum: string;
  status: string;
  bearbeiter: string | null;
  notiz: string | null;
  ergebnis: string | null;
  hub: string | null;
  zugewiesen_hub: string | null;
  zugewiesen_pdl: string | null;
  zugewiesen_at: string | null;
  pdl_bestaetigt_at: string | null;
  pdl_ergebnis: string | null;
  vorschlag_hub_id: string | null;
  /** Vorgeschlagener Standort samt PDL-Kontakt — spart den Blick in den Hubs-Reiter. */
  vorschlag_hub: string | null;
  vorschlag_pdl: string | null;
  vorschlag_pdl_phone: string | null;
  /** Düsseldorf/Gevelsberg: Team bucht Termin selbst + legt in MediFox (DUS) an. */
  direct_booking: boolean;
  /** Offene To-dos mit Deadline — fällige heben den Lead in die Wiedervorlage. */
  todos: { id: string; text: string; faellig_am: string | null }[];
}

export interface OutboundTarget {
  id: string;
  name: string;
  kategorie: string;
  ort: string | null;
  relevanz: number | null;
  hub: string | null;
  hub_pdl: string | null;
  hub_pdl_phone: string | null;
  /** KI-generierte Kurz-Info (z. B. "Maximalversorger, ~1.400 Betten"). */
  kurzinfo: string | null;
  letzter_besuch: string | null;
  letzte_kontakt_art: string | null;
  naechster_besuch: string | null;
  besuchs_notiz: string | null;
  exklusiv: boolean;
  /** Offene To-dos am Kontakt (aus KI-gelesenen Anruf-Notizen). */
  todos: { id: string; text: string; faellig_am: string | null }[];
  /** PDL-Aktivitäten vor Ort (CM-Box beliefert / Flyer ausgelegt), jüngste je Art. */
  besuche: { art: "box" | "flyer"; datum: string; von: string | null; hub: string | null }[];
}

const STATUS_LABEL: Record<string, string> = {
  offen: "Offen",
  kontaktiert: "Kontaktiert",
  erstgespraech: "Erstgespräch",
  aufgenommen: "Aufgenommen",
  verloren: "Verloren",
};

const STATUS_TONE: Record<string, string> = {
  offen: "bg-amber-100 text-amber-800",
  kontaktiert: "bg-sky-100 text-sky-800",
  erstgespraech: "bg-emerald-100 text-emerald-800",
  aufgenommen: "bg-emerald-100 text-emerald-800",
  verloren: "bg-muted text-muted-foreground",
};

/** Farbige Quellen-Chips: jede Quelle sofort erkennbar. */
const QUELLE_TONE: Record<string, string> = {
  meta: "border-violet-200 bg-violet-50 text-violet-800",
  google: "border-emerald-200 bg-emerald-50 text-emerald-800",
  website: "border-sky-200 bg-sky-50 text-sky-800",
  agentur: "border-amber-200 bg-amber-50 text-amber-800",
  recare: "border-teal-200 bg-teal-50 text-teal-800",
  telefon0800: "border-indigo-200 bg-indigo-50 text-indigo-800",
};

/**
 * Prozess-Stepper je Lead: wo steht die Anfrage, was ist der nächste Schritt?
 * B2C-Funnel: Eingegangen → Kontaktiert → Erstgespräch → Übergeben → Aufgenommen.
 * Recare verkürzt: Eingegangen → PDL-Klärung → Übergeben → Aufgenommen.
 */
function processInfo(l: InboundLead): {
  steps: { label: string; done: boolean; current: boolean }[];
  next: string | null;
  lost: boolean;
} {
  const lost = l.status === "verloren" && !l.pdl_bestaetigt_at;
  const uebergeben = Boolean(l.zugewiesen_hub);
  const aufgenommen =
    l.status === "aufgenommen" ||
    Boolean(l.pdl_bestaetigt_at && !/nicht|kein/i.test(l.pdl_ergebnis ?? ""));
  const kontaktiert =
    ["kontaktiert", "erstgespraech", "aufgenommen"].includes(l.status) || uebergeben;
  const erstgespraech = ["erstgespraech", "aufgenommen"].includes(l.status) || uebergeben;

  const defs =
    l.quelle === "recare"
      ? [
          { label: "Eingegangen", done: true },
          { label: "PDL-Klärung", done: kontaktiert },
          { label: "Übergeben", done: uebergeben },
          { label: "Aufgenommen", done: aufgenommen },
        ]
      : [
          { label: "Eingegangen", done: true },
          { label: "Kontaktiert", done: kontaktiert },
          { label: "Erstgespräch", done: erstgespraech },
          { label: "Übergeben", done: uebergeben },
          { label: "Aufgenommen", done: aufgenommen },
        ];
  const firstOpen = defs.findIndex((s) => !s.done);
  const steps = defs.map((s, i) => ({ ...s, current: !lost && i === firstOpen }));

  let next: string | null = null;
  if (lost) next = null;
  else if (aufgenommen) next = "Abgeschlossen";
  else if (uebergeben) next = "Auf Rückmeldung der PDL warten";
  else if (l.quelle === "recare")
    next = "PDL anrufen & Kapazität klären, dann übergeben";
  else if (l.status === "offen" && !l.bearbeiter) next = "Übernehmen & anrufen";
  else if (l.status === "offen")
    next = l.telefon
      ? "Anrufen"
      : l.email
        ? "Keine Telefonnummer — per E-Mail Infos abfragen"
        : "Kontaktdaten unvollständig — Infos abfragen";
  else if (l.status === "kontaktiert")
    next = l.direct_booking
      ? "Erstgespräch vereinbaren (Kalender + MediFox)"
      : "Erstgespräch vereinbaren";
  else if (l.status === "erstgespraech") next = "An Standort/PDL übergeben";
  return { steps, next, lost };
}

function ProcessSteps({ lead }: { lead: InboundLead }) {
  const { steps, next, lost } = processInfo(lead);
  return (
    <div className="flex flex-col gap-1">
      <div className="flex flex-wrap items-center gap-x-1 gap-y-0.5 text-xs">
        {steps.map((s, i) => (
          <span key={s.label} className="flex items-center gap-1" title={stampFor(lead, s.label) ?? undefined}>
            {i > 0 && <span className="text-muted-foreground/40">›</span>}
            <span
              className={cn(
                "flex items-center gap-0.5",
                lost
                  ? "text-muted-foreground/50"
                  : s.done
                    ? "font-medium text-emerald-700"
                    : s.current
                      ? "font-semibold text-primary"
                      : "text-muted-foreground/60",
              )}
            >
              {s.done ? "✓ " : ""}
              {s.label}
            </span>
          </span>
        ))}
        {lost && (
          <span className="ml-1 rounded-full bg-muted px-1.5 py-0.5 font-medium text-muted-foreground">
            verloren
          </span>
        )}
      </div>
      {next && (
        <p className="text-xs">
          <span className="font-semibold text-primary">Nächster Schritt:</span>{" "}
          <span className={next === "Abgeschlossen" ? "text-emerald-700" : ""}>{next}</span>
        </p>
      )}
    </div>
  );
}

/** Zeitstempel je Prozessschritt (für Tooltips am Stepper). */
function stampFor(lead: InboundLead, label: string): string | null {
  const zeit = (iso: string | null) => (iso ? exactStamp(iso) : null);
  if (label === "Eingegangen") return zeit(lead.datum);
  if (label === "Übergeben") return zeit(lead.zugewiesen_at);
  if (label === "Aufgenommen") return zeit(lead.pdl_bestaetigt_at);
  return null;
}

/**
 * Kurze Lead-ID als Chip — Klick kopiert sie. Diese ID gehört beim Anlegen
 * des Neukunden in MediFox als Referenz ins Kundenprofil (Disclaimer im
 * Tooltip), damit Lead ↔ MediFox zuordenbar bleibt.
 */
function LeadIdChip({ id }: { id: string }) {
  const [copied, setCopied] = useState(false);
  const short = leadShortId(id);
  return (
    <button
      type="button"
      title="Lead-ID — bitte beim Anlegen in MediFox als Referenz hinterlegen. Klick kopiert."
      onClick={() => {
        void navigator.clipboard?.writeText(short).catch(() => {});
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      }}
      className="rounded border bg-muted/60 px-1.5 py-0.5 font-mono text-[11px] text-muted-foreground hover:text-foreground"
    >
      {copied ? "kopiert ✓" : short}
    </button>
  );
}

/** Frisch = jünger als 1 Std und noch offen — nur dann darf etwas pulsieren. */
function isFresh(l: InboundLead): boolean {
  const t = new Date(l.datum).getTime();
  return l.status === "offen" && !Number.isNaN(t) && Date.now() - t < 3_600_000;
}

/** Exakter Eingangszeitpunkt („13.08., 10:47"). */
function exactStamp(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const datum = d.toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit" });
  const zeit = iso.includes("T")
    ? d.toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" })
    : "";
  return zeit ? `${datum}, ${zeit}` : datum;
}

/** „vor 5 Min" / „vor 3 Std." / leer ab gestern (dann zählt die Tages-Gruppe). */
function relTime(iso: string): string | null {
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return null;
  const min = Math.floor((Date.now() - t) / 60000);
  if (min < 1) return "gerade eben";
  if (min < 60) return `vor ${min} Min`;
  const h = Math.floor(min / 60);
  if (h < 12) return `vor ${h} Std`;
  return null;
}

function dayKey(iso: string): string {
  return (iso || "").slice(0, 10);
}

/** Tages-Überschrift der Outbound-Liste: Heute / Morgen / "Freitag, 15.08." */
function outboundDayLabel(key: string, today: string): string {
  if (key === today) return "Heute";
  const morgen = new Date(`${today}T00:00:00`);
  morgen.setDate(morgen.getDate() + 1);
  if (key === morgen.toISOString().slice(0, 10)) return "Morgen";
  const d = new Date(`${key}T00:00:00`);
  if (Number.isNaN(d.getTime())) return key;
  return d.toLocaleDateString("de-DE", {
    weekday: "long",
    day: "2-digit",
    month: "2-digit",
  });
}

function dayLabel(key: string): string {
  const today = new Date();
  const iso = (d: Date) => d.toISOString().slice(0, 10);
  if (key === iso(today)) return "Heute";
  const yesterday = new Date(today.getTime() - 86400_000);
  if (key === iso(yesterday)) return "Gestern";
  const d = new Date(`${key}T00:00:00`);
  if (Number.isNaN(d.getTime())) return "Ohne Datum";
  return d.toLocaleDateString("de-DE", {
    weekday: "long",
    day: "2-digit",
    month: "2-digit",
  });
}

function timeOf(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime()) || !iso.includes("T")) return "";
  return d.toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" });
}

async function teamAction(token: string, payload: Record<string, unknown>) {
  const res = await fetch("/api/public/team", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ token, ...payload }),
  });
  const json = (await res.json().catch(() => ({}))) as { error?: string };
  if (!res.ok) throw new Error(json.error ?? "Fehler beim Speichern.");
  return json as Record<string, unknown>;
}

export function TeamWorkspace({
  token,
  memberName,
  inbound: initialInbound,
  outbound: initialOutbound,
  hubs,
  monitor = false,
  editable = false,
  view = "tabs",
  inboundLog = true,
}: {
  token: string;
  memberName: string;
  inbound: InboundLead[];
  outbound: OutboundTarget[];
  hubs: { id: string; name: string }[];
  /** true = Gesamtsicht (z. B. /crm): kein Auto-Reload, keine Anrufliste. Mit
   * editable=true bleiben die Lead-Aktionen trotzdem nutzbar (Admin-Session). */
  monitor?: boolean;
  editable?: boolean;
  /** "tabs" = eigener Umschalter (persönliche Seiten); "inbound"/"outbound"
   * = nur eine Ansicht, Umschalter kommt von außen (/crm-Board). */
  view?: "tabs" | "inbound" | "outbound" | "kontakte";
  /** false = keine Inbound-Anruf-Box (Davina bekommt keine Inbound-Anrufe). */
  inboundLog?: boolean;
}) {
  const [tab, setTab] = useState<"inbound" | "outbound" | "kontakte">("inbound");
  const [inbound, setInbound] = useState(initialInbound);
  const [outbound, setOutbound] = useState(initialOutbound);
  const [error, setError] = useState<string | null>(null);
  const [showDone, setShowDone] = useState(false);
  const canAct = !monitor || editable;

  const router = useRouter();

  // Auto-Aktualisierung: sanftes Server-Refresh (Scroll, Fokus und offene
  // Panels bleiben erhalten) statt Full-Reload. Pausiert beim Tippen und in
  // Hintergrund-Tabs; der Mail-Abruf ist serverseitig gedrosselt.
  useEffect(() => {
    if (monitor) return;
    const id = setInterval(() => {
      const el = document.activeElement;
      const typing =
        el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement;
      if (!typing && document.visibilityState === "visible") {
        router.refresh();
      }
    }, 45 * 1000);
    return () => clearInterval(id);
  }, [monitor, router]);

  // Frische Server-Daten nach refresh in den lokalen State übernehmen.
  useEffect(() => setInbound(initialInbound), [initialInbound]);
  useEffect(() => setOutbound(initialOutbound), [initialOutbound]);

  const openInbound = inbound.filter((l) =>
    ["offen", "kontaktiert"].includes(l.status),
  );
  const doneInbound = inbound.length - openInbound.length;

  // Zähler je Quelle (nur offene) + Tages-Gruppen, neueste zuerst.
  const sourceCounts = new Map<string, number>();
  for (const l of openInbound) {
    sourceCounts.set(l.quelle, (sourceCounts.get(l.quelle) ?? 0) + 1);
  }
  const shownInbound = showDone ? inbound : openInbound;
  // Wiedervorlage: Leads mit fälligem To-do poppen ganz oben auf — egal wie
  // alt sie sind. Der Rest bleibt chronologisch in Tages-Gruppen.
  const heute = todayIso();
  const hatFaelligesTodo = (l: InboundLead) =>
    l.todos.some((t) => t.faellig_am !== null && t.faellig_am <= heute);
  const wiedervorlage = inbound.filter(
    (l) => hatFaelligesTodo(l) && l.status !== "verloren",
  );
  const wvIds = new Set(wiedervorlage.map((l) => l.id));
  const dayGroups: { key: string; leads: InboundLead[] }[] = [];
  for (const l of shownInbound) {
    if (wvIds.has(l.id)) continue;
    const key = dayKey(l.datum);
    const last = dayGroups[dayGroups.length - 1];
    if (last && last.key === key) last.leads.push(l);
    else dayGroups.push({ key, leads: [l] });
  }
  if (wiedervorlage.length > 0) {
    dayGroups.unshift({ key: "__wiedervorlage__", leads: wiedervorlage });
  }

  const today = todayIso();
  const due = (t: OutboundTarget) =>
    !t.letzter_besuch || (t.naechster_besuch !== null && t.naechster_besuch <= today);
  const sortedOutbound = [...outbound].sort((a, b) => {
    const d = Number(due(b)) - Number(due(a));
    if (d !== 0) return d;
    const r = (a.relevanz ?? 9) - (b.relevanz ?? 9);
    if (r !== 0) return r;
    return (a.naechster_besuch ?? "9999").localeCompare(b.naechster_besuch ?? "9999");
  });
  const dueCount = outbound.filter(due).length;

  // ── Outbound als Tages-Kalender: Heute (inkl. Überfällig & noch nie
  // kontaktiert), dann jeder Tag mit Einträgen der nächsten 2 Wochen,
  // Rest unter "Später". Innerhalb eines Tages klare Reihenfolge:
  // überfällig zuerst, dann Priorität, dann Name.
  const horizonDate = new Date(`${today}T00:00:00`);
  horizonDate.setDate(horizonDate.getDate() + 13);
  const horizon = horizonDate.toISOString().slice(0, 10);
  const outboundDayMap = new Map<string, OutboundTarget[]>();
  for (const t of outbound) {
    const key = due(t)
      ? today
      : !t.naechster_besuch || t.naechster_besuch > horizon
        ? "__spaeter__"
        : t.naechster_besuch;
    const arr = outboundDayMap.get(key);
    if (arr) arr.push(t);
    else outboundDayMap.set(key, [t]);
  }
  const sortTargets = (arr: OutboundTarget[]) =>
    [...arr].sort((a, b) => {
      const overdue = (t: OutboundTarget) =>
        t.letzter_besuch && t.naechster_besuch && t.naechster_besuch < today ? 1 : 0;
      const o = overdue(b) - overdue(a);
      if (o !== 0) return o;
      const r = (a.relevanz ?? 9) - (b.relevanz ?? 9);
      if (r !== 0) return r;
      return a.name.localeCompare(b.name);
    });
  const outboundDays = [...outboundDayMap.entries()]
    .filter(([k]) => k !== "__spaeter__")
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([key, targets]) => ({ key, targets: sortTargets(targets) }));
  const outboundLater = sortTargets(outboundDayMap.get("__spaeter__") ?? []).sort(
    (a, b) => (a.naechster_besuch ?? "9999").localeCompare(b.naechster_besuch ?? "9999"),
  );

  async function claim(l: InboundLead) {
    setError(null);
    try {
      await teamAction(token, { action: "claim", kind: l.kind, id: l.id });
      setInbound((cur) =>
        cur.map((x) => (x.id === l.id ? { ...x, bearbeiter: memberName } : x)),
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "Fehler");
    }
  }

  async function setStatus(l: InboundLead, status: string, ergebnis?: string) {
    setError(null);
    try {
      await teamAction(token, {
        action: "lead-status",
        kind: l.kind,
        id: l.id,
        status,
        ...(ergebnis ? { ergebnis } : {}),
      });
      setInbound((cur) =>
        cur.map((x) =>
          x.id === l.id
            ? { ...x, status, bearbeiter: memberName, ...(ergebnis ? { ergebnis } : {}) }
            : x,
        ),
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "Fehler");
    }
  }

  return (
    <div className="flex flex-col gap-4">
      {view === "tabs" && !monitor && (
      <div className="flex gap-1 rounded-xl border bg-card p-1 shadow-sm">
        <button
          type="button"
          onClick={() => setTab("inbound")}
          className={cn(
            "flex flex-1 items-center justify-center gap-2 rounded-lg px-3 py-2 text-sm font-medium",
            tab === "inbound"
              ? "bg-primary text-primary-foreground"
              : "text-muted-foreground hover:text-foreground",
          )}
        >
          <Inbox className="size-4" />
          Anfragen
          {openInbound.length > 0 && (
            <span
              className={cn(
                "rounded-full px-1.5 text-xs font-semibold",
                tab === "inbound" ? "bg-white/20" : "bg-primary/10 text-primary",
              )}
            >
              {openInbound.length}
            </span>
          )}
        </button>
        <button
          type="button"
          onClick={() => setTab("outbound")}
          className={cn(
            "flex flex-1 items-center justify-center gap-2 rounded-lg px-3 py-2 text-sm font-medium",
            tab === "outbound"
              ? "bg-primary text-primary-foreground"
              : "text-muted-foreground hover:text-foreground",
          )}
        >
          <PhoneCall className="size-4" />
          Anrufliste
          {dueCount > 0 && (
            <span
              className={cn(
                "rounded-full px-1.5 text-xs font-semibold",
                tab === "outbound" ? "bg-white/20" : "bg-primary/10 text-primary",
              )}
            >
              {dueCount} fällig
            </span>
          )}
        </button>
        <button
          type="button"
          onClick={() => setTab("kontakte")}
          className={cn(
            "flex flex-1 items-center justify-center gap-2 rounded-lg px-3 py-2 text-sm font-medium",
            tab === "kontakte"
              ? "bg-primary text-primary-foreground"
              : "text-muted-foreground hover:text-foreground",
          )}
        >
          <Users className="size-4" />
          Kontakte
        </button>
      </div>
      )}

      {error && <p className="text-sm text-destructive">{error}</p>}

      {(view === "inbound" || (view === "tabs" && (monitor || tab === "inbound"))) && (
        <div className="flex flex-col gap-3 lg:grid lg:grid-cols-[340px_minmax(0,1fr)] lg:items-start lg:gap-5">
          {canAct && inboundLog && (
            <div className="lg:sticky lg:top-4">
              <InboundCallLog
                token={token}
                memberName={memberName}
                onCreated={(lead) => setInbound((cur) => [lead, ...cur])}
              />
            </div>
          )}
          <div
            className={cn(
              "flex min-w-0 flex-col gap-2",
              !(canAct && inboundLog) && "lg:col-span-2",
            )}
          >
          {/* Kopfzeile: Zähler je Quelle + Abgeschlossene-Toggle */}
          <div className="flex flex-wrap items-center gap-2">
            {[...sourceCounts.entries()]
              .sort((a, b) => b[1] - a[1])
              .map(([q, n]) => (
                <span
                  key={q}
                  className={cn(
                    "rounded-full border px-2.5 py-1 text-xs font-semibold",
                    QUELLE_TONE[q] ?? "bg-muted text-muted-foreground",
                  )}
                >
                  {n} × {leadQuelleLabel(q) || q}
                </span>
              ))}
            <span className="ml-auto text-xs text-muted-foreground">
              neueste zuerst · aktualisiert sich automatisch
            </span>
            {doneInbound > 0 && (
              <button
                type="button"
                onClick={() => setShowDone((s) => !s)}
                className="text-xs text-muted-foreground hover:text-foreground"
              >
                {showDone
                  ? "Abgeschlossene ausblenden"
                  : `${doneInbound} abgeschlossene anzeigen`}
              </button>
            )}
          </div>
          {shownInbound.length === 0 && (
            <p className="rounded-xl border bg-card p-5 text-sm text-muted-foreground shadow-sm">
              Keine offenen Anfragen. 🎉 Neue Anfragen erscheinen hier
              automatisch oben.
            </p>
          )}
          {dayGroups.map((g) => (
            <div key={g.key} className="flex flex-col gap-2">
              <p
                className={cn(
                  "mt-2 flex items-center gap-2 text-xs font-semibold tracking-wide uppercase first:mt-0",
                  g.key === "__wiedervorlage__"
                    ? "text-amber-700"
                    : "text-muted-foreground",
                )}
              >
                {g.key === "__wiedervorlage__"
                  ? "📌 Wiedervorlage fällig"
                  : dayLabel(g.key)}
                <span className="h-px flex-1 bg-border" />
                <span className="font-normal normal-case">
                  {g.leads.length} Anfrage{g.leads.length === 1 ? "" : "n"}
                </span>
              </p>
              <ul className="flex flex-col gap-2">
                {g.leads.map((l) => (
              <li
                key={`${l.kind}-${l.id}`}
                className="flex flex-col gap-2 rounded-xl border bg-card p-3.5 shadow-sm"
              >
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                  <span
                    title={`eingegangen ${exactStamp(l.datum)}`}
                    className={cn(
                      "flex items-center gap-1.5 text-xs font-semibold tabular-nums",
                      isFresh(l) ? "text-primary" : "text-muted-foreground",
                    )}
                  >
                    {isFresh(l) && (
                      <span className="size-1.5 animate-pulse rounded-full bg-primary" title="neu" />
                    )}
                    {timeOf(l.datum) || exactStamp(l.datum) || "—"}
                    {relTime(l.datum) && (
                      <span className="font-normal">({relTime(l.datum)})</span>
                    )}
                  </span>
                  <span className="font-medium">{l.name}</span>
                  <LeadIdChip id={l.id} />
                  <span
                    className={cn(
                      "rounded-full border px-2 py-0.5 text-[11px] font-medium",
                      QUELLE_TONE[l.quelle] ?? "text-muted-foreground",
                    )}
                  >
                    {leadQuelleLabel(l.quelle) || l.quelle}
                    {l.quelle_detail ? ` · ${l.quelle_detail}` : ""}
                  </span>
                  <span
                    className={cn(
                      "rounded-full px-2 py-0.5 text-[11px] font-semibold",
                      STATUS_TONE[l.status] ?? "bg-muted text-muted-foreground",
                    )}
                  >
                    {STATUS_LABEL[l.status] ?? l.status}
                  </span>
                  {l.bearbeiter && (
                    <span className="rounded-full bg-violet-100 px-2 py-0.5 text-[11px] font-semibold text-violet-800">
                      {l.bearbeiter}
                    </span>
                  )}
                </div>
                <LeadStammdaten
                  lead={l}
                  canAct={canAct}
                  token={token}
                  onSaved={(patch) =>
                    setInbound((cur) =>
                      cur.map((x) => (x.id === l.id ? { ...x, ...patch } : x)),
                    )
                  }
                />
                {!l.zugewiesen_hub && l.vorschlag_hub && l.vorschlag_pdl && (
                  <p className="flex flex-wrap items-center gap-x-2 gap-y-1 rounded-lg bg-primary/[0.05] px-2.5 py-1.5 text-xs">
                    <span className="font-semibold text-primary">
                      Ansprechpartner {l.vorschlag_hub}:
                    </span>
                    <span className="font-medium">PDL {l.vorschlag_pdl}</span>
                    {l.vorschlag_pdl_phone ? (
                      <a
                        href={`tel:${l.vorschlag_pdl_phone}`}
                        className="flex items-center gap-1 font-medium text-primary hover:underline"
                      >
                        <Phone className="size-3" />
                        {l.vorschlag_pdl_phone}
                      </a>
                    ) : (
                      <span className="text-muted-foreground">
                        (keine Nummer hinterlegt — Admin → Hub)
                      </span>
                    )}
                  </p>
                )}
                <LeadNote
                  lead={l}
                  canAct={canAct}
                  token={token}
                  onSaved={(notiz) =>
                    setInbound((cur) =>
                      cur.map((x) => (x.id === l.id ? { ...x, notiz } : x)),
                    )
                  }
                />
                <LeadTodos
                  lead={l}
                  canAct={canAct}
                  token={token}
                  onChanged={(todos) =>
                    setInbound((cur) =>
                      cur.map((x) => (x.id === l.id ? { ...x, todos } : x)),
                    )
                  }
                />
                {l.ergebnis && (
                  <p className="text-xs font-medium text-emerald-800">
                    Ergebnis: {l.ergebnis}
                  </p>
                )}
                {l.zugewiesen_hub && (
                  <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs font-medium">
                    <span className="rounded-full bg-sky-100 px-2 py-0.5 text-sky-800">
                      → übergeben an {l.zugewiesen_hub}
                      {l.zugewiesen_pdl ? ` (PDL ${l.zugewiesen_pdl})` : ""}
                      {l.zugewiesen_at
                        ? ` am ${new Date(l.zugewiesen_at).toLocaleDateString("de-DE")}`
                        : ""}
                    </span>
                    {l.pdl_bestaetigt_at ? (
                      <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-emerald-800">
                        PDL bestätigt: {l.pdl_ergebnis ?? "aufgenommen"} ✓
                      </span>
                    ) : (
                      <>
                        <span className="text-muted-foreground">
                          Rückmeldung der PDL steht aus
                        </span>
                        {canAct && (
                          <button
                            type="button"
                            onClick={async () => {
                              setError(null);
                              try {
                                await teamAction(token, {
                                  action: "unassign-hub",
                                  kind: l.kind,
                                  id: l.id,
                                });
                                setInbound((cur) =>
                                  cur.map((x) =>
                                    x.id === l.id
                                      ? {
                                          ...x,
                                          zugewiesen_hub: null,
                                          zugewiesen_pdl: null,
                                          zugewiesen_at: null,
                                          pdl_bestaetigt_at: null,
                                          pdl_ergebnis: null,
                                        }
                                      : x,
                                  ),
                                );
                              } catch (e) {
                                setError(e instanceof Error ? e.message : "Fehler");
                              }
                            }}
                            className="flex items-center gap-1 font-medium text-muted-foreground hover:text-foreground"
                          >
                            <Undo2 className="size-3" /> Übergabe zurücknehmen
                          </button>
                        )}
                      </>
                    )}
                  </p>
                )}
                <div className="border-t pt-2">
                  <ProcessSteps lead={l} />
                </div>
                <div className="flex flex-wrap items-center gap-1.5">
                  {canAct && !l.bearbeiter && (
                    <Button type="button" size="sm" onClick={() => claim(l)}>
                      <Hand className="size-3.5" />
                      Übernehmen
                    </Button>
                  )}
                  {canAct && (l.quelle === "recare" ? (
                    ["offen", "kontaktiert"].includes(l.status) && (
                      <RecareOutcome
                        lead={l}
                        token={token}
                        memberName={memberName}
                        onDone={(patch) =>
                          setInbound((cur) =>
                            cur.map((x) =>
                              x.id === l.id
                                ? { ...x, ...patch, bearbeiter: memberName }
                                : x,
                            ),
                          )
                        }
                      />
                    )
                  ) : (
                    <>
                      {l.status === "offen" && (
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          onClick={() => setStatus(l, "kontaktiert")}
                        >
                          <Check className="size-3.5" /> Kontaktiert
                        </Button>
                      )}
                      {["offen", "kontaktiert"].includes(l.status) && (
                        <>
                          {l.direct_booking ? (
                            <ErstgespraechChecklist
                              leadId={l.id}
                              onConfirm={() => setStatus(l, "erstgespraech")}
                            />
                          ) : (
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              className="border-emerald-300 text-emerald-800 hover:bg-emerald-50"
                              onClick={() => setStatus(l, "erstgespraech")}
                            >
                              <Check className="size-3.5" /> Erstgespräch vereinbart
                            </Button>
                          )}
                          <LostReason
                            onSave={(grund) => setStatus(l, "verloren", grund)}
                          />
                        </>
                      )}
                    </>
                  ))}
                </div>
                {canAct && !l.zugewiesen_hub && l.status !== "verloren" &&
                  (l.status === "erstgespraech" || l.quelle === "recare") && (
                  <AssignHub
                    lead={l}
                    hubs={hubs}
                    token={token}
                    onDone={(patch) =>
                      setInbound((cur) =>
                        cur.map((x) =>
                          x.id === l.id
                            ? { ...x, ...patch, bearbeiter: memberName }
                            : x,
                        ),
                      )
                    }
                  />
                )}
              </li>
                ))}
              </ul>
            </div>
          ))}
          </div>
        </div>
      )}

      {(view === "kontakte" || (view === "tabs" && !monitor && tab === "kontakte")) && (
        <KontakteView inbound={inbound} outbound={outbound} />
      )}

      {(view === "outbound" || (view === "tabs" && !monitor && tab === "outbound")) && (
        <div className="flex flex-col gap-3">
          <OutboundMap
            targets={sortedOutbound.map((t) => ({
              id: t.id,
              name: t.name,
              ort: t.ort,
              hub: t.hub,
              hub_pdl: t.hub_pdl,
              faellig: due(t),
              letzter_besuch: t.letzter_besuch,
            }))}
          />
          {outboundDays.map((g) => (
            <div key={g.key} className="flex flex-col gap-2">
              <p
                className={cn(
                  "mt-2 flex items-center gap-2 text-xs font-semibold tracking-wide uppercase first:mt-0",
                  g.key === today ? "text-amber-700" : "text-muted-foreground",
                )}
              >
                <CalendarClock className="size-3.5" />
                {outboundDayLabel(g.key, today)}
                <span className="h-px flex-1 bg-border" />
                <span className="font-normal normal-case">
                  {g.targets.length} Anruf{g.targets.length === 1 ? "" : "e"}
                </span>
              </p>
              <ol className="flex flex-col gap-2">
                {g.targets.map((t, i) => (
                  <OutboundRow
                    key={t.id}
                    target={t}
                    index={i + 1}
                    today={today}
                    token={token}
                    memberName={memberName}
                    isDue={due(t)}
                    onLogged={(patch) =>
                      setOutbound((cur) =>
                        cur.map((x) => (x.id === t.id ? { ...x, ...patch } : x)),
                      )
                    }
                  />
                ))}
              </ol>
            </div>
          ))}
          {outboundLater.length > 0 && (
            <details className="group mt-2 rounded-xl border bg-card shadow-sm">
              <summary className="cursor-pointer list-none p-3.5 text-sm font-semibold select-none">
                Später ({outboundLater.length} Kontakte ab {formatIsoDate(outboundLater[0]?.naechster_besuch)})
                <span className="ml-2 text-xs font-normal text-muted-foreground group-open:hidden">
                  aufklappen
                </span>
              </summary>
              <ol className="flex flex-col gap-2 border-t p-3.5">
                {outboundLater.map((t, i) => (
                  <OutboundRow
                    key={t.id}
                    target={t}
                    index={i + 1}
                    today={today}
                    token={token}
                    memberName={memberName}
                    isDue={false}
                    onLogged={(patch) =>
                      setOutbound((cur) =>
                        cur.map((x) => (x.id === t.id ? { ...x, ...patch } : x)),
                      )
                    }
                  />
                ))}
              </ol>
            </details>
          )}
        </div>
      )}
    </div>
  );
}

/**
 * Inbound-Anruf direkt loggen: kompaktes Fenster über der Liste — der Anruf
 * erscheint sofort als offener Lead mit denselben Optionen wie alle anderen.
 */
function InboundCallLog({
  token,
  memberName,
  onCreated,
}: {
  token: string;
  memberName: string;
  onCreated: (lead: InboundLead) => void;
}) {
  const [name, setName] = useState("");
  const [telefon, setTelefon] = useState("");
  const [quelle, setQuelle] = useState("");
  const [notiz, setNotiz] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    setBusy(true);
    setError(null);
    try {
      const res = await teamAction(token, {
        action: "log-inbound",
        ansprechpartner: name,
        telefon,
        quelle,
        notiz,
      });
      onCreated({
        kind: "call",
        id: String(res.id),
        name: name || "Inbound-Anruf",
        telefon: telefon || null,
        email: null,
        adresse: null,
        quelle,
        quelle_detail: null,
        datum: String(res.created_at ?? new Date().toISOString()),
        status: "offen",
        bearbeiter: memberName,
        notiz: notiz || null,
        ergebnis: null,
        hub: null,
        zugewiesen_hub: null,
        zugewiesen_pdl: null,
        zugewiesen_at: null,
        pdl_bestaetigt_at: null,
        pdl_ergebnis: null,
        vorschlag_hub_id: null,
        vorschlag_hub: null,
        vorschlag_pdl: null,
        vorschlag_pdl_phone: null,
        direct_booking: false,
        todos: [],
      });
      setName("");
      setTelefon("");
      setNotiz("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Fehler");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-2 rounded-xl border border-primary/25 bg-primary/[0.04] p-3.5 shadow-sm">
      <p className="flex items-center gap-1.5 text-sm font-semibold">
        <PhoneCall className="size-4 text-primary" />
        Inbound-Anruf loggen
      </p>
      <p className="-mt-1 text-xs text-muted-foreground">
        Anruf angenommen? Hier eintragen — erscheint sofort als offener Lead.
      </p>
      <input
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Name des Anrufers"
        className="h-9 rounded-lg border bg-background px-2.5 text-sm"
      />
      <input
        value={telefon}
        onChange={(e) => setTelefon(e.target.value)}
        placeholder="Telefonnummer"
        className="h-9 rounded-lg border bg-background px-2.5 text-sm"
      />
      <label className="flex flex-col gap-1 text-xs font-medium text-muted-foreground">
        Wie sind sie auf uns aufmerksam geworden?
        <select
          value={quelle}
          onChange={(e) => setQuelle(e.target.value)}
          className="h-9 rounded-lg border bg-background px-2 text-sm font-normal text-foreground"
        >
          <option value="">Bitte wählen…</option>
          {LEAD_QUELLEN.filter(
            // Kanäle mit eigenem automatischen Eingang sind hier keine
            // Antwort auf "wie aufmerksam geworden".
            (q) => !["telefon0800", "recare", "agentur"].includes(q.key),
          ).map((q) => (
            <option key={q.key} value={q.key}>
              {q.label}
            </option>
          ))}
        </select>
      </label>
      <Textarea
        value={notiz}
        onChange={(e) => setNotiz(e.target.value)}
        rows={2}
        placeholder="Worum ging es? (optional)"
      />
      {error && <p className="text-xs text-destructive">{error}</p>}
      <Button
        type="button"
        size="sm"
        disabled={busy || !quelle || (!name.trim() && !telefon.trim())}
        onClick={save}
      >
        {busy ? "Speichere…" : "Als Lead anlegen"}
      </Button>
    </div>
  );
}

/**
 * To-dos mit Deadline am Lead ("ruf mich in 1 Woche zurück") — fällige
 * To-dos heben den Lead oben in die Wiedervorlage-Gruppe.
 */
function LeadTodos({
  lead,
  canAct,
  token,
  onChanged,
}: {
  lead: InboundLead;
  canAct: boolean;
  token: string;
  onChanged: (todos: InboundLead["todos"]) => void;
}) {
  const [adding, setAdding] = useState(false);
  const [text, setText] = useState("");
  const [datum, setDatum] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const heute = todayIso();

  async function add() {
    setBusy(true);
    setError(null);
    try {
      const res = await teamAction(token, {
        action: "todo-add",
        kind: lead.kind,
        id: lead.id,
        notiz: text,
        status: datum,
      });
      const todo = res.todo as { id: string; text: string; faellig_am: string | null };
      onChanged([...lead.todos, todo]);
      setText("");
      setDatum("");
      setAdding(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Fehler");
    } finally {
      setBusy(false);
    }
  }

  async function done(todoId: string) {
    try {
      await teamAction(token, { action: "todo-done", id: todoId });
      onChanged(lead.todos.filter((t) => t.id !== todoId));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Fehler");
    }
  }

  if (lead.todos.length === 0 && !canAct) return null;
  return (
    <div className="flex flex-col gap-1">
      {lead.todos.map((t) => {
        const faellig = t.faellig_am !== null && t.faellig_am <= heute;
        return (
          <p key={t.id} className="flex flex-wrap items-center gap-1.5 text-xs">
            <span
              className={cn(
                "rounded-full px-1.5 py-0.5 font-semibold",
                faellig
                  ? "bg-amber-100 text-amber-800"
                  : "bg-muted text-muted-foreground",
              )}
            >
              To-do{t.faellig_am ? ` · ${formatIsoDate(t.faellig_am)}` : ""}
              {faellig ? " · fällig" : ""}
            </span>
            <span className="min-w-0">{t.text}</span>
            {canAct && (
              <button
                type="button"
                onClick={() => done(t.id)}
                className="text-muted-foreground hover:text-emerald-700"
                title="To-do erledigt"
              >
                <Check className="size-3.5" />
              </button>
            )}
          </p>
        );
      })}
      {canAct &&
        (adding ? (
          <div className="flex flex-wrap items-center gap-1.5">
            <input
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Was ist zu tun? (z. B. Rückruf)"
              className="h-8 min-w-40 flex-1 rounded-lg border bg-background px-2 text-xs"
            />
            <input
              type="date"
              value={datum}
              onChange={(e) => setDatum(e.target.value)}
              className="h-8 rounded-lg border bg-background px-2 text-xs"
              title="Wiedervorlage-Datum — an dem Tag poppt der Lead oben auf"
            />
            <Button type="button" size="sm" disabled={busy || !text.trim()} onClick={add}>
              {busy ? "…" : "Speichern"}
            </Button>
            <button
              type="button"
              onClick={() => setAdding(false)}
              className="text-xs text-muted-foreground hover:text-foreground"
            >
              Abbrechen
            </button>
          </div>
        ) : (
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="h-7 self-start px-2.5 text-xs"
            onClick={() => setAdding(true)}
          >
            <CalendarClock className="size-3" />
            To-do mit Wiedervorlage
          </Button>
        ))}
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}


/**
 * Kontakte-Verzeichnis: alle Institutionen (Krankenhäuser, Praxen …) und
 * Klienten (Leads) des Teams, kategorisiert und durchsuchbar — daneben die
 * Spalte mit allen offenen To-dos (Kontakte, bei denen etwas ansteht).
 */
function KontakteView({
  inbound,
  outbound,
}: {
  inbound: InboundLead[];
  outbound: OutboundTarget[];
}) {
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState<string>("alle");
  const heute = todayIso();

  const leadKategorie = (l: InboundLead) =>
    l.quelle === "recare"
      ? "Recare-Patient"
      : l.status === "aufgenommen"
        ? "Klient"
        : "Interessent";

  const kategorien = [
    { key: "alle", label: "Alle" },
    { key: "klienten", label: "Klienten & Interessenten" },
    ...[...new Set(outbound.map((t) => t.kategorie))]
      .sort()
      .map((k) => ({ key: k, label: placeKindLabel(k) })),
  ];

  const norm = (x: string) => x.toLowerCase();
  const matches = (text: string) => !q.trim() || norm(text).includes(norm(q));

  const insts = outbound.filter(
    (t) =>
      (filter === "alle" || filter === t.kategorie) &&
      filter !== "klienten" &&
      matches(`${t.name} ${t.ort ?? ""} ${t.hub ?? ""}`),
  );
  const klienten = inbound.filter(
    (l) =>
      (filter === "alle" || filter === "klienten") &&
      matches(`${l.name} ${l.telefon ?? ""} ${l.quelle_detail ?? ""}`),
  );

  // Offene To-dos über alle Leads, fällige zuerst.
  const offeneTodos = inbound
    .flatMap((l) => l.todos.map((t) => ({ lead: l, todo: t })))
    .sort((a, b) =>
      (a.todo.faellig_am ?? "9999").localeCompare(b.todo.faellig_am ?? "9999"),
    );

  return (
    <div className="flex flex-col gap-3 lg:grid lg:grid-cols-[minmax(0,1fr)_320px] lg:items-start lg:gap-5">
      <div className="flex min-w-0 flex-col gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Suchen (Name, Ort, Telefon)…"
            className="h-9 w-full max-w-xs rounded-lg border bg-background px-3 text-sm"
          />
          {kategorien.map((k) => (
            <button
              key={k.key}
              type="button"
              onClick={() => setFilter(k.key)}
              className={cn(
                "rounded-full border px-2.5 py-1 text-xs font-medium",
                filter === k.key
                  ? "border-primary bg-primary text-primary-foreground"
                  : "bg-card text-muted-foreground hover:text-foreground",
              )}
            >
              {k.label}
            </button>
          ))}
        </div>

        {klienten.length > 0 && (
          <div className="flex flex-col gap-1.5">
            <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
              Klienten &amp; Interessenten ({klienten.length})
            </p>
            <ul className="grid gap-2 sm:grid-cols-2 2xl:grid-cols-3">
              {klienten.map((l) => (
                <li
                  key={`${l.kind}-${l.id}`}
                  className="flex flex-col gap-1 rounded-xl border bg-card p-3 text-sm shadow-sm"
                >
                  <span className="flex flex-wrap items-center gap-1.5">
                    <span className="font-medium">{l.name}</span>
                    <span className="rounded-full bg-primary/10 px-1.5 py-0.5 text-[10px] font-semibold text-primary">
                      {leadKategorie(l)}
                    </span>
                    <span
                      className={cn(
                        "rounded-full px-1.5 py-0.5 text-[10px] font-semibold",
                        STATUS_TONE[l.status] ?? "bg-muted text-muted-foreground",
                      )}
                    >
                      {STATUS_LABEL[l.status] ?? l.status}
                    </span>
                  </span>
                  <span className="flex flex-wrap gap-x-3 text-xs text-muted-foreground">
                    {l.telefon && (
                      <a href={`tel:${l.telefon}`} className="text-primary hover:underline">
                        {l.telefon}
                      </a>
                    )}
                    {l.zugewiesen_hub && <span>→ {l.zugewiesen_hub}</span>}
                    <span>{leadQuelleLabel(l.quelle) || l.quelle}</span>
                  </span>
                  {l.todos.length > 0 && (
                    <span className="text-xs text-amber-700">
                      {l.todos.length} offenes To-do
                      {l.todos.length === 1 ? "" : "s"}
                    </span>
                  )}
                </li>
              ))}
            </ul>
          </div>
        )}

        {insts.length > 0 && (
          <div className="flex flex-col gap-1.5">
            <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
              Institutionen ({insts.length})
            </p>
            <ul className="grid gap-2 sm:grid-cols-2 2xl:grid-cols-3">
              {insts.map((t) => (
                <li
                  key={t.id}
                  className="flex flex-col gap-1 rounded-xl border bg-card p-3 text-sm shadow-sm"
                >
                  <span className="flex flex-wrap items-center gap-1.5">
                    <span className="font-medium">{t.name}</span>
                    <LeadIdChip id={t.id} />
                    <span className="rounded-full border px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
                      {placeKindLabel(t.kategorie)}
                    </span>
                  </span>
                  <span className="flex flex-wrap gap-x-3 text-xs text-muted-foreground">
                    {t.ort && <span>{t.ort}</span>}
                    {t.hub && (
                      <span>
                        {t.hub}
                        {t.hub_pdl ? ` · PDL ${t.hub_pdl}` : ""}
                      </span>
                    )}
                    <span>
                      {t.letzter_besuch
                        ? `zuletzt ${formatIsoDate(t.letzter_besuch)}`
                        : "kein Kontakt"}
                    </span>
                  </span>
                  {t.besuche.map((b) => (
                    <span
                      key={b.art}
                      className={cn(
                        "w-fit rounded-lg px-2 py-0.5 text-[11px] font-medium",
                        b.art === "box"
                          ? "bg-sky-100 text-sky-900"
                          : "bg-muted text-muted-foreground",
                      )}
                    >
                      {b.art === "box" ? "📦 CM-Box beliefert" : "📄 Flyer ausgelegt"} am{" "}
                      {formatIsoDate(b.datum)}
                      {b.von ? ` von ${b.von}` : ""}
                    </span>
                  ))}
                </li>
              ))}
            </ul>
          </div>
        )}
        {insts.length === 0 && klienten.length === 0 && (
          <p className="rounded-xl border bg-card p-5 text-sm text-muted-foreground shadow-sm">
            Keine Treffer.
          </p>
        )}
      </div>

      {/* Spalte: offene To-dos */}
      <div className="flex flex-col gap-2 rounded-xl border bg-card p-4 shadow-sm lg:sticky lg:top-4">
        <p className="text-sm font-semibold">
          Offene To-dos ({offeneTodos.length})
        </p>
        {offeneTodos.length === 0 ? (
          <p className="text-xs text-muted-foreground">
            Nichts offen. To-dos legst du direkt an der Lead-Karte an („+ To-do
            mit Wiedervorlage&ldquo;).
          </p>
        ) : (
          <ul className="flex flex-col gap-2">
            {offeneTodos.map(({ lead, todo }) => {
              const faellig = todo.faellig_am !== null && todo.faellig_am <= heute;
              return (
                <li
                  key={todo.id}
                  className={cn(
                    "rounded-lg border p-2 text-xs",
                    faellig && "border-amber-500/50 bg-amber-500/[0.06]",
                  )}
                >
                  <p className="font-medium">{lead.name}</p>
                  <p className="text-muted-foreground">{todo.text}</p>
                  {todo.faellig_am && (
                    <p className={cn("mt-0.5 font-semibold", faellig ? "text-amber-700" : "text-muted-foreground")}>
                      {faellig ? "fällig seit " : "fällig am "}
                      {formatIsoDate(todo.faellig_am)}
                    </p>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}

/** Notiz am Lead: anzeigen + direkt auf der Karte bearbeiten. */
/**
 * Standardisierter Stammdaten-Block auf jeder Lead-Karte: Telefon, E-Mail und
 * Adresse/Ort immer an derselben Stelle (fehlende Angaben als "—"), mit
 * Stift zum Nachpflegen. Bei Meta-Leads kommen Name/Telefon/E-Mail aus dem
 * Meta-Formular und sind nicht editierbar — nur die Adresse.
 */
function LeadStammdaten({
  lead,
  canAct,
  token,
  onSaved,
}: {
  lead: InboundLead;
  canAct: boolean;
  token: string;
  onSaved: (patch: Partial<InboundLead>) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(lead.name === "(ohne Name)" ? "" : lead.name);
  const [telefon, setTelefon] = useState(lead.telefon ?? "");
  const [email, setEmail] = useState(lead.email ?? "");
  const [adresse, setAdresse] = useState(lead.adresse ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const isMeta = lead.kind === "meta";

  async function save() {
    setBusy(true);
    setError(null);
    try {
      await teamAction(token, {
        action: "lead-daten",
        kind: lead.kind,
        id: lead.id,
        ansprechpartner: name,
        telefon,
        email,
        adresse,
      });
      onSaved(
        isMeta
          ? { adresse: adresse.trim() || null }
          : {
              name: name.trim() || "(ohne Name)",
              telefon: telefon.trim() || null,
              email: email.trim() || null,
              adresse: adresse.trim() || null,
            },
      );
      setEditing(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Fehler beim Speichern.");
    } finally {
      setBusy(false);
    }
  }

  const feld = (label: string, value: ReactNode) => (
    <div className="min-w-0">
      <p className="text-[10px] font-semibold tracking-wide text-muted-foreground uppercase">
        {label}
      </p>
      <p className="truncate text-sm" title={typeof value === "string" ? value : undefined}>
        {value ?? <span className="text-muted-foreground">—</span>}
      </p>
    </div>
  );

  if (editing) {
    const input = (
      label: string,
      value: string,
      set: (v: string) => void,
      opts?: { locked?: boolean; type?: string },
    ) => (
      <label className="flex min-w-0 flex-col gap-0.5">
        <span className="text-[10px] font-semibold tracking-wide text-muted-foreground uppercase">
          {label}
          {opts?.locked ? " (aus Meta-Formular)" : ""}
        </span>
        <input
          type={opts?.type ?? "text"}
          value={value}
          onChange={(e) => set(e.target.value)}
          disabled={opts?.locked || busy}
          className="rounded-md border bg-background px-2 py-1 text-sm disabled:opacity-60"
        />
      </label>
    );
    return (
      <div className="flex flex-col gap-2 rounded-lg border bg-muted/40 px-3 py-2">
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {input("Name", name, setName, { locked: isMeta })}
          {input("Telefon", telefon, setTelefon, { locked: isMeta, type: "tel" })}
          {input("E-Mail", email, setEmail, { locked: isMeta, type: "email" })}
          {input("Adresse / Ort", adresse, setAdresse)}
        </div>
        {error && <p className="text-xs text-destructive">{error}</p>}
        <div className="flex gap-2">
          <Button size="sm" onClick={save} disabled={busy}>
            {busy ? "Speichert…" : "Speichern"}
          </Button>
          <Button size="sm" variant="ghost" onClick={() => setEditing(false)} disabled={busy}>
            Abbrechen
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="relative grid grid-cols-2 gap-x-4 gap-y-1.5 rounded-lg border bg-muted/40 px-3 py-2 pr-9 sm:grid-cols-4">
      {feld(
        "Telefon",
        lead.telefon ? (
          <a href={`tel:${lead.telefon}`} className="flex items-center gap-1 text-primary hover:underline">
            <Phone className="size-3 shrink-0" />
            {lead.telefon}
          </a>
        ) : null,
      )}
      {feld(
        "E-Mail",
        lead.email ? (
          <a href={`mailto:${lead.email}`} className="flex items-center gap-1 text-primary hover:underline">
            <Mail className="size-3 shrink-0" />
            {lead.email}
          </a>
        ) : null,
      )}
      {feld(
        "Adresse / Ort",
        lead.adresse ? (
          <span className="flex items-center gap-1">
            <MapPin className="size-3 shrink-0 text-muted-foreground" />
            {lead.adresse}
          </span>
        ) : null,
      )}
      {feld("Eingang", exactStamp(lead.datum) || null)}
      {canAct && (
        <button
          type="button"
          title="Stammdaten bearbeiten"
          onClick={() => setEditing(true)}
          className="absolute top-1.5 right-1.5 rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
        >
          <Pencil className="size-3.5" />
        </button>
      )}
    </div>
  );
}

function LeadNote({
  lead,
  canAct,
  token,
  onSaved,
}: {
  lead: InboundLead;
  canAct: boolean;
  token: string;
  onSaved: (notiz: string | null) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState(lead.notiz ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    setBusy(true);
    setError(null);
    try {
      await teamAction(token, {
        action: "lead-note",
        kind: lead.kind,
        id: lead.id,
        notiz: text.trim(),
      });
      onSaved(text.trim() || null);
      setEditing(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Fehler");
    } finally {
      setBusy(false);
    }
  }

  if (!editing) {
    if (!lead.notiz && !canAct) return null;
    return (
      <div className="flex flex-wrap items-center gap-2">
        {lead.notiz ? (
          <p className="text-xs text-muted-foreground">„{lead.notiz}“</p>
        ) : null}
        {canAct && (
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="h-7 px-2.5 text-xs"
            onClick={() => {
              setText(lead.notiz ?? "");
              setEditing(true);
            }}
          >
            <Pencil className="size-3" />
            {lead.notiz ? "Notiz bearbeiten" : "Notiz"}
          </Button>
        )}
      </div>
    );
  }
  return (
    <div className="flex flex-col gap-1.5">
      <Textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={2}
        placeholder="Notiz zum Lead (z. B. Rückruf gewünscht, Pflegegrad, Besonderheiten …)"
      />
      {error && <p className="text-xs text-destructive">{error}</p>}
      <div className="flex gap-2">
        <Button type="button" size="sm" disabled={busy} onClick={save}>
          {busy ? "Speichere…" : "Notiz speichern"}
        </Button>
        <Button type="button" size="sm" variant="ghost" onClick={() => setEditing(false)}>
          Abbrechen
        </Button>
      </div>
    </div>
  );
}

/**
 * "verloren" fragt nach dem Grund: nicht erreicht / doch kein Interesse /
 * eigene Angabe. Der Grund landet als Ergebnis am Lead (Admin-Auswertung).
 */
function LostReason({ onSave }: { onSave: (grund: string) => void }) {
  const [open, setOpen] = useState(false);
  const [custom, setCustom] = useState(false);
  const [text, setText] = useState("");

  if (!open) {
    return (
      <Button
        type="button"
        size="sm"
        variant="ghost"
        className="text-muted-foreground"
        onClick={() => setOpen(true)}
      >
        <X className="size-3.5" /> Verloren
      </Button>
    );
  }
  return (
    <div className="flex w-full flex-col gap-1.5 rounded-lg border bg-muted/30 p-2.5">
      <p className="text-xs font-medium text-muted-foreground">Warum verloren?</p>
      <div className="flex flex-wrap items-center gap-1.5">
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={() => onSave("Nicht erreicht")}
        >
          <PhoneCall className="size-3.5" /> Nicht erreicht
        </Button>
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={() => onSave("Doch kein Interesse")}
        >
          <X className="size-3.5" /> Doch kein Interesse
        </Button>
        <Button
          type="button"
          size="sm"
          variant="ghost"
          className="text-muted-foreground"
          onClick={() => setCustom((s) => !s)}
        >
          Eigene Angabe…
        </Button>
        <Button
          type="button"
          size="sm"
          variant="ghost"
          className="ml-auto text-muted-foreground"
          onClick={() => {
            setOpen(false);
            setCustom(false);
          }}
        >
          Abbrechen
        </Button>
      </div>
      {custom && (
        <div className="flex flex-col gap-1.5">
          <Textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={2}
            placeholder="Grund (z. B. bereits versorgt, falsche Region …)"
          />
          <Button
            type="button"
            size="sm"
            className="self-start"
            disabled={!text.trim()}
            onClick={() => onSave(text.trim())}
          >
            <Check className="size-3.5" /> Als verloren speichern
          </Button>
        </div>
      )}
    </div>
  );
}

/**
 * Düsseldorf/Gevelsberg: Vor "Erstgespräch vereinbart" beide Pflicht-Häkchen
 * — Termin im Beraterinnen-Kalender gebucht + Neukunde in MediFox (DUS-
 * Mandant) angelegt. Verhindert, dass Leads zwischen Tool und MediFox
 * verloren gehen.
 */
function ErstgespraechChecklist({
  leadId,
  onConfirm,
}: {
  leadId: string;
  onConfirm: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [kalender, setKalender] = useState(false);
  const [medifox, setMedifox] = useState(false);

  if (!open) {
    return (
      <Button
        type="button"
        size="sm"
        variant="outline"
        className="border-emerald-300 text-emerald-800 hover:bg-emerald-50"
        onClick={() => setOpen(true)}
      >
        <Check className="size-3.5" /> Erstgespräch vereinbart
      </Button>
    );
  }
  return (
    <div className="flex w-full flex-col gap-1.5 rounded-lg border border-emerald-200 bg-emerald-50/50 p-2.5">
      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={kalender}
          onChange={(e) => setKalender(e.target.checked)}
          className="size-4"
        />
        Termin im Beraterinnen-Kalender gebucht
      </label>
      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={medifox}
          onChange={(e) => setMedifox(e.target.checked)}
          className="size-4"
        />
        <span>
          Neukunde in MediFox (DUS-Mandant) angelegt —{" "}
          <strong>
            Lead-ID <span className="font-mono">{leadShortId(leadId)}</span>
          </strong>{" "}
          dort als Referenz hinterlegt
        </span>
      </label>
      <div className="flex gap-2">
        <Button
          type="button"
          size="sm"
          disabled={!kalender || !medifox}
          onClick={onConfirm}
        >
          <Check className="size-3.5" /> Bestätigen
        </Button>
        <Button
          type="button"
          size="sm"
          variant="ghost"
          onClick={() => setOpen(false)}
        >
          Abbrechen
        </Button>
      </div>
    </div>
  );
}

/**
 * Standort-Übergabe: Vorschlag vorausgewählt, PDL bekommt automatisch die
 * Kontaktdaten per Mail und bestätigt später "in Versorgung aufgenommen".
 */
function AssignHub({
  lead,
  hubs,
  token,
  onDone,
}: {
  lead: InboundLead;
  hubs: { id: string; name: string }[];
  token: string;
  onDone: (patch: Partial<InboundLead>) => void;
}) {
  const [hubId, setHubId] = useState(lead.vorschlag_hub_id ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mailInfo, setMailInfo] = useState<string | null>(null);

  async function assign() {
    if (!hubId) return;
    setBusy(true);
    setError(null);
    try {
      const res = await teamAction(token, {
        action: "assign-hub",
        kind: lead.kind,
        id: lead.id,
        target_id: hubId,
      });
      setMailInfo(String(res.mail_info ?? ""));
      onDone({
        zugewiesen_hub: String(res.hub_name),
        zugewiesen_pdl: res.pdl_name ? String(res.pdl_name) : null,
        zugewiesen_at: String(res.zugewiesen_at),
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Fehler");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-1 border-t pt-2">
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="text-xs text-muted-foreground">An Standort übergeben:</span>
        <select
          value={hubId}
          onChange={(e) => setHubId(e.target.value)}
          disabled={busy}
          className="h-8 rounded-lg border bg-background px-2 text-sm"
        >
          <option value="">Standort wählen…</option>
          {hubs.map((h) => (
            <option key={h.id} value={h.id}>
              {h.name}
              {h.id === lead.vorschlag_hub_id ? " (Vorschlag)" : ""}
            </option>
          ))}
        </select>
        <Button
          type="button"
          size="sm"
          variant={lead.status === "erstgespraech" || lead.quelle === "recare" ? "default" : "outline"}
          disabled={busy || !hubId}
          onClick={assign}
        >
          {busy ? "Übergebe…" : "Übergeben + PDL informieren"}
        </Button>
      </div>
      {mailInfo && <p className="text-xs text-muted-foreground">{mailInfo}</p>}
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}

/**
 * Recare-Ausgang: keine Kapazität / PDL nicht erreicht / Freitext.
 * ("Patient aufgenommen" bestätigt die PDL nach der Übergabe selbst.)
 */
function RecareOutcome({
  lead,
  token,
  memberName,
  onDone,
}: {
  lead: InboundLead;
  token: string;
  memberName: string;
  onDone: (patch: Partial<InboundLead>) => void;
}) {
  const [freitextOpen, setFreitextOpen] = useState(false);
  const [freitext, setFreitext] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  void memberName;

  async function set(ergebnis: string, status: string) {
    setBusy(true);
    setError(null);
    try {
      await teamAction(token, {
        action: "recare-ergebnis",
        id: lead.id,
        ergebnis,
        status,
      });
      onDone({ ergebnis, status });
      setFreitextOpen(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Fehler");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex w-full flex-col gap-1.5">
      <div className="flex flex-wrap items-center gap-1.5">
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={busy}
          onClick={() => set("Keine Kapazität", "verloren")}
        >
          <X className="size-3.5" /> Keine Kapazität
        </Button>
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={busy}
          onClick={() => set("PDL nicht erreicht", "kontaktiert")}
        >
          <PhoneCall className="size-3.5" /> PDL nicht erreicht
        </Button>
        <Button
          type="button"
          size="sm"
          variant="ghost"
          disabled={busy}
          className="text-muted-foreground"
          onClick={() => setFreitextOpen((s) => !s)}
        >
          Anderes…
        </Button>
      </div>
      {freitextOpen && (
        <div className="flex w-full flex-col gap-1.5">
          <Textarea
            value={freitext}
            onChange={(e) => setFreitext(e.target.value)}
            rows={2}
            placeholder="Was ist passiert? (z. B. Klinik hat zurückgezogen)"
          />
          <Button
            type="button"
            size="sm"
            className="self-start"
            disabled={busy || !freitext.trim()}
            onClick={() => set(freitext.trim(), "kontaktiert")}
          >
            {busy ? "Speichere…" : "Ergebnis speichern"}
          </Button>
        </div>
      )}
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}

/**
 * Ein Eintrag der Outbound-Tagesliste: Nummer in der Reihenfolge, Institution
 * mit Kontext, offene To-dos und das Anruf-Formular mit klaren Abfragen —
 * Erreicht?/Nicht erreicht (nicht erreicht → automatisch morgen wieder),
 * Ansprechpartner, Notiz (liest die KI: "in 1 Woche zurückrufen" → Wieder-
 * vorlage-Tag, konkrete Aufgabe → To-do) und optional festes Datum.
 */
function OutboundRow({
  target: t,
  index,
  today,
  token,
  memberName,
  isDue,
  onLogged,
}: {
  target: OutboundTarget;
  index: number;
  today: string;
  token: string;
  memberName: string;
  isDue: boolean;
  onLogged: (patch: Partial<OutboundTarget>) => void;
}) {
  const [open, setOpen] = useState(false);
  const [erreicht, setErreicht] = useState<boolean | null>(null);
  const [ansprechpartner, setAnsprechpartner] = useState("");
  const [notiz, setNotiz] = useState("");
  const [wiedervorlage, setWiedervorlage] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hinweis, setHinweis] = useState<string | null>(null);

  const ueberfaelligTage =
    t.letzter_besuch && t.naechster_besuch && t.naechster_besuch < today
      ? Math.round(
          (new Date(`${today}T00:00:00`).getTime() -
            new Date(`${t.naechster_besuch}T00:00:00`).getTime()) /
            86_400_000,
        )
      : 0;

  async function log() {
    if (erreicht === null) return;
    setBusy(true);
    setError(null);
    try {
      const res = await teamAction(token, {
        action: "outbound-log",
        target_id: t.id,
        erreicht,
        ansprechpartner,
        notiz,
        wiedervorlage,
      });
      const neuesTodo = res.todo as
        | { id: string; text: string; faellig_am: string | null }
        | null;
      onLogged({
        letzter_besuch: String(res.letzter_besuch),
        letzte_kontakt_art: "anruf",
        naechster_besuch: String(res.naechster_besuch),
        besuchs_notiz:
          [!erreicht ? "Nicht erreicht" : "", notiz].filter(Boolean).join(" — ") || null,
        ...(neuesTodo ? { todos: [...t.todos, neuesTodo] } : {}),
      });
      setHinweis(
        [
          typeof res.hinweis === "string" ? res.hinweis : null,
          neuesTodo ? `To-do angelegt: „${neuesTodo.text}“` : null,
        ]
          .filter(Boolean)
          .join(" · ") || null,
      );
      setOpen(false);
      setErreicht(null);
      setAnsprechpartner("");
      setNotiz("");
      setWiedervorlage("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Fehler");
    } finally {
      setBusy(false);
    }
  }

  async function todoDone(todoId: string) {
    setError(null);
    try {
      await teamAction(token, { action: "todo-done", id: todoId });
      onLogged({ todos: t.todos.filter((td) => td.id !== todoId) });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Fehler");
    }
  }

  return (
    <li
      className={cn(
        "flex flex-col gap-2 rounded-xl border bg-card p-3.5 shadow-sm",
        isDue && "border-amber-500/50 bg-amber-500/[0.04]",
      )}
    >
      <div className="flex items-start gap-3">
        {/* Reihenfolge im Tag */}
        <span
          className={cn(
            "mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full text-xs font-bold",
            isDue ? "bg-amber-500 text-white" : "bg-muted text-muted-foreground",
          )}
        >
          {index}
        </span>
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <span className="font-semibold leading-snug">{t.name}</span>
            <LeadIdChip id={t.id} />
            {t.relevanz != null && (
              <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-semibold text-primary">
                Prio {t.relevanz}
              </span>
            )}
            {ueberfaelligTage > 0 && (
              <span className="rounded-full bg-red-100 px-2 py-0.5 text-[11px] font-semibold text-red-800">
                überfällig seit {ueberfaelligTage} Tag{ueberfaelligTage === 1 ? "" : "en"}
              </span>
            )}
            {!t.letzter_besuch && (
              <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-semibold text-amber-800">
                noch nie kontaktiert
              </span>
            )}
          </div>
          <p className="flex items-center gap-1 text-xs text-muted-foreground">
            <MapPin className="size-3 shrink-0" />
            {[
              t.ort,
              placeKindLabel(t.kategorie) + (t.exklusiv ? "" : " · gemeinsamer Pool"),
            ]
              .filter(Boolean)
              .join(" · ")}
          </p>
          {t.kurzinfo && (
            <p className="text-xs text-muted-foreground italic">{t.kurzinfo}</p>
          )}
          {t.besuche.map((b) => (
            <p
              key={b.art}
              className={cn(
                "flex flex-wrap items-center gap-x-1.5 rounded-lg px-2 py-1 text-xs font-medium",
                b.art === "box"
                  ? "bg-sky-100 text-sky-900"
                  : "bg-muted text-muted-foreground",
              )}
            >
              <span>{b.art === "box" ? "📦" : "📄"}</span>
              {b.art === "box" ? "CM-Box beliefert" : "Flyer/Aufsteller ausgelegt"} am{" "}
              {formatIsoDate(b.datum)}
              {b.von ? ` von ${b.von}` : ""}
              {b.hub ? ` (${b.hub})` : ""}
            </p>
          ))}
          {t.hub && (
            <p className="flex flex-wrap items-center gap-x-1.5 rounded-lg bg-primary/[0.05] px-2 py-1 text-xs">
              <span className="font-semibold text-primary">Standort {t.hub}:</span>
              <span className="font-medium">
                {t.hub_pdl ? `PDL ${t.hub_pdl}` : "keine PDL hinterlegt"}
              </span>
              {t.hub_pdl_phone && (
                <a
                  href={`tel:${t.hub_pdl_phone}`}
                  className="flex items-center gap-1 font-medium text-primary hover:underline"
                >
                  <Phone className="size-3" />
                  {t.hub_pdl_phone}
                </a>
              )}
            </p>
          )}
          <p className="flex items-center gap-1 text-xs text-muted-foreground">
            <CalendarClock className="size-3 shrink-0" />
            {t.letzter_besuch
              ? `Zuletzt: ${kontaktArtLabel(t.letzte_kontakt_art) || "Kontakt"} am ${formatIsoDate(t.letzter_besuch)}${t.besuchs_notiz ? ` — „${t.besuchs_notiz}“` : ""} · wieder dran ab ${formatIsoDate(t.naechster_besuch)}`
              : "Noch kein Kontakt"}
          </p>
          {t.todos.length > 0 && (
            <ul className="flex flex-col gap-1">
              {t.todos.map((td) => (
                <li key={td.id} className="flex items-center gap-2 text-xs">
                  <button
                    type="button"
                    title="To-do erledigt"
                    onClick={() => todoDone(td.id)}
                    className="flex size-4 shrink-0 items-center justify-center rounded border text-transparent hover:border-emerald-600 hover:text-emerald-600"
                  >
                    <Check className="size-3" />
                  </button>
                  <span className="font-medium">{td.text}</span>
                  {td.faellig_am && (
                    <span className="text-muted-foreground">
                      bis {formatIsoDate(td.faellig_am)}
                    </span>
                  )}
                </li>
              ))}
            </ul>
          )}
          {hinweis && (
            <p className="rounded-lg bg-emerald-50 px-2 py-1 text-xs font-medium text-emerald-800">
              ✓ {hinweis}
            </p>
          )}
        </div>
        {!open && (
          <Button
            type="button"
            size="sm"
            variant={isDue ? "default" : "outline"}
            className="shrink-0"
            onClick={() => {
              setHinweis(null);
              setOpen(true);
            }}
          >
            <PhoneCall className="size-3.5" /> Anruf loggen
          </Button>
        )}
      </div>

      {open && (
        <div className="flex flex-col gap-2 rounded-lg border bg-muted/40 p-3">
          {/* 1. Erreicht? */}
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-semibold">Erreicht?</span>
            <button
              type="button"
              onClick={() => setErreicht(true)}
              className={cn(
                "rounded-full border px-3 py-1 text-xs font-medium",
                erreicht === true
                  ? "border-emerald-600 bg-emerald-600 text-white"
                  : "bg-background text-muted-foreground hover:text-foreground",
              )}
            >
              ✓ Ja, gesprochen
            </button>
            <button
              type="button"
              onClick={() => setErreicht(false)}
              className={cn(
                "rounded-full border px-3 py-1 text-xs font-medium",
                erreicht === false
                  ? "border-red-600 bg-red-600 text-white"
                  : "bg-background text-muted-foreground hover:text-foreground",
              )}
            >
              ✗ Nicht erreicht
            </button>
          </div>
          {erreicht === false && (
            <p className="text-xs text-muted-foreground">
              Wird automatisch <span className="font-semibold">morgen</span> wieder
              auf die Liste gesetzt.
            </p>
          )}
          {erreicht === true && (
            <>
              <label className="flex flex-col gap-0.5">
                <span className="text-[10px] font-semibold tracking-wide text-muted-foreground uppercase">
                  Ansprechpartner
                </span>
                <input
                  type="text"
                  value={ansprechpartner}
                  onChange={(e) => setAnsprechpartner(e.target.value)}
                  placeholder="Mit wem gesprochen? (z. B. Frau Meier, Sozialdienst)"
                  className="rounded-md border bg-background px-2 py-1 text-sm"
                />
              </label>
            </>
          )}
          {erreicht !== null && (
            <>
              <label className="flex flex-col gap-0.5">
                <span className="text-[10px] font-semibold tracking-wide text-muted-foreground uppercase">
                  Notiz
                </span>
                <Textarea
                  value={notiz}
                  onChange={(e) => setNotiz(e.target.value)}
                  rows={2}
                  placeholder={
                    erreicht
                      ? "Was wurde besprochen? Die KI liest mit: „ruf in 1 Woche zurück“ wird zum Termin, „Flyer schicken“ zum To-do."
                      : "Optional: Mailbox, besetzt, …"
                  }
                />
              </label>
              {erreicht && (
                <label className="flex flex-col gap-0.5">
                  <span className="text-[10px] font-semibold tracking-wide text-muted-foreground uppercase">
                    Wiedervorlage am (optional — sonst entscheidet die Notiz/der Rhythmus)
                  </span>
                  <input
                    type="date"
                    min={today}
                    value={wiedervorlage}
                    onChange={(e) => setWiedervorlage(e.target.value)}
                    className="w-fit rounded-md border bg-background px-2 py-1 text-sm"
                  />
                </label>
              )}
            </>
          )}
          {error && <p className="text-xs text-destructive">{error}</p>}
          <div className="flex gap-2">
            <Button
              type="button"
              size="sm"
              disabled={busy || erreicht === null}
              onClick={log}
            >
              {busy
                ? "Speichere…"
                : erreicht === null
                  ? "Erst „Erreicht?“ beantworten"
                  : `Speichern (als ${memberName})`}
            </Button>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={() => setOpen(false)}
            >
              Abbrechen
            </Button>
          </div>
        </div>
      )}
    </li>
  );
}
