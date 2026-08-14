"use client";

import { useEffect, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import {
  CalendarClock,
  Check,
  FileText,
  Hand,
  Headset,
  Inbox,
  Mail,
  MapPin,
  Pencil,
  Phone,
  PhoneCall,
  Search,
  Undo2,
  User,
  Users,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { leadStatusChip } from "@/components/ui/chip";
import { LEAD_QUELLEN, leadBereichLabel, leadQuelleLabel, leadShortId } from "@/lib/leads";
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
  /** Interesse des Anrufers (alltagshilfe/ambulant/intensiv) — null bei Altbestand/Meta. */
  bereich: string | null;
  /** Erste Bearbeitung (Stepper-Zeitstempel "Kontaktiert"). */
  erstbearbeitet_at: string | null;
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

/** Einheitlicher Stil für native Selects — passend zu ui/Input. */
const SELECT_CLASS =
  "rounded-lg border border-input bg-transparent px-2 text-sm text-foreground transition-colors outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-input/30";

const STATUS_LABEL: Record<string, string> = {
  offen: "Offen",
  kontaktiert: "Kontaktiert",
  erstgespraech: "Erstgespräch",
  aufgenommen: "Aufgenommen",
  verloren: "Verloren",
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

function ProcessSteps({
  lead,
  undo,
}: {
  lead: InboundLead;
  undo?: { label: string; run: () => void } | null;
}) {
  const { steps, next, lost } = processInfo(lead);
  return (
    <div className="flex flex-col gap-1.5">
      {/* Horizontaler Stepper wie in der Design-Referenz: erledigt = grüner
          Haken-Kreis, aktueller Schritt = blauer Nummern-Kreis, offen = grau —
          mit Zeitstempel unter dem Label, wo einer bekannt ist. */}
      <div className="flex flex-wrap items-start gap-x-1.5 gap-y-2">
        {steps.map((s, i) => {
          const stamp = stampFor(lead, s.label);
          return (
            <span key={s.label} className="flex items-start gap-1.5">
              {i > 0 && (
                <span className="mt-1 text-sm leading-none text-muted-foreground/40">›</span>
              )}
              <span className={cn("flex items-center gap-1.5", lost && "opacity-50")}>
                <span
                  className={cn(
                    "flex size-5 shrink-0 items-center justify-center rounded-full text-[10px] font-bold",
                    s.done
                      ? "bg-emerald-500 text-white"
                      : s.current
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted text-muted-foreground",
                  )}
                >
                  {s.done ? <Check className="size-3" /> : i + 1}
                </span>
                <span className="flex flex-col leading-tight">
                  <span
                    className={cn(
                      "text-xs",
                      s.done
                        ? "font-medium"
                        : s.current
                          ? "font-semibold text-primary"
                          : "text-muted-foreground",
                    )}
                  >
                    {s.label}
                  </span>
                  {stamp && (s.done || s.current) && (
                    <span
                      className={cn(
                        "text-[10px] tabular-nums",
                        s.current ? "text-primary/80" : "text-muted-foreground",
                      )}
                    >
                      {stamp}
                    </span>
                  )}
                </span>
              </span>
            </span>
          );
        })}
        {lost && (
          <span className="ml-1 self-center rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
            verloren
          </span>
        )}
        {undo && (
          <button
            type="button"
            onClick={undo.run}
            title="Fälschlich geklickt? Macht den letzten Prozess-Schritt rückgängig."
            className="ml-auto flex items-center gap-1 self-center rounded-md px-1.5 py-1 text-[11px] font-medium text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            <Undo2 className="size-3" />
            {undo.label}
          </button>
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
  if (label === "Kontaktiert" || label === "PDL-Klärung")
    return zeit(lead.erstbearbeitet_at);
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

/**
 * Live-Timer "unbeantwortet seit …" oben rechts an offenen Leads — tickt
 * sekündlich und eskaliert farblich (ab 15 Min amber, ab 1 Std rot).
 * Startet erst nach dem Mount (kein Server/Client-Hydration-Konflikt).
 */
function UnansweredTimer({ since }: { since: string }) {
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    // Erster Tick nach dem Mount (kein SSR-Hydration-Konflikt, kein
    // synchrones setState im Effect-Body).
    const t = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(t);
  }, []);
  if (now == null) return null;
  const ms = now - new Date(since).getTime();
  if (!Number.isFinite(ms) || ms < 0) return null;
  const total = Math.floor(ms / 1000);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const label =
    h >= 48
      ? `${Math.floor(h / 24)} Tage ${h % 24} Std`
      : h > 0
        ? `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`
        : `${m}:${String(s).padStart(2, "0")}`;
  return (
    <span
      title={`unbeantwortet seit ${exactStamp(since)}`}
      className={cn(
        "ml-auto flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 font-mono text-[11px] font-semibold tabular-nums",
        ms >= 3_600_000
          ? "bg-red-100 text-red-800"
          : ms >= 900_000
            ? "bg-amber-100 text-amber-800"
            : "bg-emerald-100 text-emerald-800",
      )}
    >
      ⏱ {label}
    </span>
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
  kontakteInbound,
  kontakteOutbound,
}: {
  token: string;
  memberName: string;
  inbound: InboundLead[];
  outbound: OutboundTarget[];
  hubs: { id: string; name: string }[];
  /** Gemeinsames Kontakte-Verzeichnis (beide Teams) — Fallback: eigene Daten. */
  kontakteInbound?: InboundLead[];
  kontakteOutbound?: OutboundTarget[];
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

  // Aktiv = alles, was noch Arbeit braucht (auch Erstgespräch: Übergabe
  // steht aus). Aufgenommen/verloren wandern in "Alte & abgelehnte Leads".
  const openInbound = inbound.filter((l) =>
    ["offen", "kontaktiert", "erstgespraech"].includes(l.status),
  );
  const doneLeads = inbound.filter(
    (l) => !["offen", "kontaktiert", "erstgespraech"].includes(l.status),
  );

  // Zähler je Quelle (nur offene) + Tages-Gruppen, neueste zuerst.
  const sourceCounts = new Map<string, number>();
  for (const l of openInbound) {
    sourceCounts.set(l.quelle, (sourceCounts.get(l.quelle) ?? 0) + 1);
  }
  const shownInbound = openInbound;
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

  /** Übergabe an die PDL zurücknehmen (solange keine Bestätigung vorliegt). */
  async function unassignHub(l: InboundLead) {
    setError(null);
    try {
      await teamAction(token, { action: "unassign-hub", kind: l.kind, id: l.id });
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
  }

  /**
   * "Fälschlich geklickt?" — ein Prozess-Schritt zurück: Übergabe zurücknehmen,
   * Erstgespräch → Kontaktiert, Kontaktiert → Offen. Nach der PDL-Bestätigung
   * ist nichts mehr zurücknehmbar (der Standort hat den Fall bestätigt).
   */
  function undoFor(l: InboundLead): { label: string; run: () => void } | null {
    if (!canAct || l.pdl_bestaetigt_at || l.status === "verloren") return null;
    if (l.zugewiesen_hub)
      return { label: "Übergabe zurücknehmen", run: () => unassignHub(l) };
    if (l.status === "aufgenommen")
      return { label: "zurück auf Erstgespräch", run: () => setStatus(l, "erstgespraech") };
    if (l.status === "erstgespraech")
      return { label: "zurück auf Kontaktiert", run: () => setStatus(l, "kontaktiert") };
    if (l.status === "kontaktiert")
      return { label: "zurück auf Offen", run: () => setStatus(l, "offen") };
    return null;
  }

  return (
    <div className="flex flex-col gap-4">
      {view === "tabs" && !monitor && (
      <div className="flex gap-1 rounded-xl border bg-card p-1 shadow-sm">
        <button
          type="button"
          onClick={() => setTab("inbound")}
          className={cn(
            "flex flex-1 items-center justify-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
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
            "flex flex-1 items-center justify-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
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
            "flex flex-1 items-center justify-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
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
          </div>
          {shownInbound.length === 0 && (
            <div className="flex flex-col items-center gap-1 rounded-xl border border-dashed bg-card p-8 text-center shadow-sm">
              <Inbox className="size-5 text-muted-foreground/50" />
              <p className="text-sm font-medium">Keine offenen Anfragen 🎉</p>
              <p className="text-xs text-muted-foreground">
                Neue Anfragen erscheinen hier automatisch oben.
              </p>
            </div>
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
                {g.key === "__wiedervorlage__" ? (
                  <span title="Leads mit fälligem To-do — egal wie alt, sie poppen hier oben auf, bis das To-do erledigt ist.">
                    📌 Wiedervorlage fällig
                  </span>
                ) : (
                  dayLabel(g.key)
                )}
                <span className="h-px flex-1 bg-border" />
                <span className="font-normal normal-case">
                  {g.leads.length} Anfrage{g.leads.length === 1 ? "" : "n"}
                </span>
              </p>
              <ul className="flex flex-col gap-2">
                {g.leads.map((l) => (
              <li
                key={`${l.kind}-${l.id}`}
                className="flex flex-col gap-2.5 rounded-xl border bg-card p-4 shadow-sm"
              >
                {/* Kopf: Wer (Name) zuerst, Status daneben, Timer oben rechts —
                    Herkunft & Zeit als ruhigere zweite Zeile darunter. */}
                <div className="flex flex-col gap-1">
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                    {isFresh(l) && (
                      <span className="size-1.5 shrink-0 animate-pulse rounded-full bg-primary" title="neu" />
                    )}
                    <span className="text-lg leading-snug font-bold tracking-tight">
                      {l.name}
                    </span>
                    <LeadIdChip id={l.id} />
                    <span
                      className={cn(
                        "rounded-full px-2 py-0.5 text-[11px] font-semibold",
                        leadStatusChip(l.status),
                      )}
                    >
                      {STATUS_LABEL[l.status] ?? l.status}
                    </span>
                    {l.bearbeiter && (
                      <span
                        title={`Übernommen von ${l.bearbeiter}`}
                        className="rounded-full border bg-card px-2 py-0.5 text-[11px] font-semibold text-foreground"
                      >
                        👤 {l.bearbeiter}
                      </span>
                    )}
                    {l.status === "offen" && <UnansweredTimer since={l.datum} />}
                  </div>
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                    <span
                      title={`eingegangen ${exactStamp(l.datum)}`}
                      className={cn(
                        "text-xs font-semibold tabular-nums",
                        isFresh(l) ? "text-primary" : "text-muted-foreground",
                      )}
                    >
                      {timeOf(l.datum) || exactStamp(l.datum) || "—"}
                      {relTime(l.datum) && (
                        <span className="font-normal"> ({relTime(l.datum)})</span>
                      )}
                    </span>
                    <span
                      className={cn(
                        "rounded-full border px-2 py-0.5 text-[11px] font-medium",
                        QUELLE_TONE[l.quelle] ?? "text-muted-foreground",
                      )}
                    >
                      {leadQuelleLabel(l.quelle) || l.quelle}
                      {l.quelle_detail ? ` · ${l.quelle_detail}` : ""}
                    </span>
                    {l.bereich && l.bereich !== "pflege" && (
                      <span className="rounded-full border border-teal-200 bg-teal-50 px-2 py-0.5 text-[11px] font-medium text-teal-800">
                        {leadBereichLabel(l.bereich)}
                      </span>
                    )}
                  </div>
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
                  <p className="flex flex-wrap items-center gap-x-2 gap-y-1 rounded-xl bg-primary/[0.06] px-3 py-2 text-xs">
                    <Headset className="size-3.5 shrink-0 text-primary" />
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
                    <span className="rounded-full bg-blue-100 px-2 py-0.5 text-blue-800">
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
                            onClick={() => unassignHub(l)}
                            className="flex items-center gap-1 font-medium text-muted-foreground hover:text-foreground"
                          >
                            <Undo2 className="size-3" /> Übergabe zurücknehmen
                          </button>
                        )}
                      </>
                    )}
                  </p>
                )}
                <div className="border-t pt-2.5">
                  <ProcessSteps lead={l} undo={undoFor(l)} />
                </div>
                <div className="flex flex-wrap items-center gap-1.5 border-t pt-2.5">
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
                              className="border-purple-300 text-purple-800 hover:bg-purple-50"
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
                  {/* Agentur-/Recare-Leads außerhalb unserer Standorte: als
                      "nicht im Einzugsbereich" zurückweisen — bei Agentur-Leads
                      Grundlage der Reklamation (wir zahlen dafür nicht; Übersicht
                      im CRM-Admin). */}
                  {canAct &&
                    ["agentur", "recare"].includes(l.quelle) &&
                    ["offen", "kontaktiert", "erstgespraech"].includes(l.status) &&
                    !l.zugewiesen_hub && (
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        title={
                          l.quelle === "agentur"
                            ? "Lead liegt außerhalb unserer Standorte — wird der Agentur gemeldet, damit er nicht berechnet wird (Übersicht im CRM-Admin)."
                            : "Patient liegt außerhalb unserer Standorte."
                        }
                        className="border-red-200 text-red-700 hover:bg-red-50 hover:text-red-700"
                        onClick={() =>
                          setStatus(
                            l,
                            "verloren",
                            `nicht im Einzugsbereich (gemeldet ${new Date().toLocaleDateString("de-DE")})`,
                          )
                        }
                      >
                        <MapPin className="size-3.5" /> Nicht im Einzugsbereich
                      </Button>
                    )}
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

          {/* Alte Leads: abgelehnte (verloren) und aufgenommene — kompakt,
              damit die aktive Liste oben schlank bleibt. */}
          {doneLeads.length > 0 && (
            <details className="group mt-3 rounded-xl border bg-card shadow-sm">
              <summary className="cursor-pointer list-none p-4 text-sm font-semibold select-none">
                Alte &amp; abgelehnte Leads ({doneLeads.length})
                <span className="ml-2 text-xs font-normal text-muted-foreground group-open:hidden">
                  aufklappen — abgelehnte und aufgenommene Leads
                </span>
              </summary>
              <ul className="divide-y border-t">
                {doneLeads.map((l) => (
                  <li
                    key={`${l.kind}-${l.id}`}
                    className="flex flex-wrap items-center gap-x-3 gap-y-1 px-4 py-2 text-sm"
                  >
                    <span className="w-24 shrink-0 text-xs text-muted-foreground tabular-nums">
                      {exactStamp(l.datum) || "—"}
                    </span>
                    <span className="font-medium">{l.name}</span>
                    <LeadIdChip id={l.id} />
                    <span className="text-xs text-muted-foreground">
                      {leadQuelleLabel(l.quelle) || l.quelle}
                      {l.quelle_detail ? ` · ${l.quelle_detail}` : ""}
                    </span>
                    <span
                      className={cn(
                        "rounded-full px-2 py-0.5 text-[11px] font-semibold",
                        leadStatusChip(l.status),
                      )}
                    >
                      {STATUS_LABEL[l.status] ?? l.status}
                    </span>
                    {l.ergebnis && (
                      <span className="text-xs text-muted-foreground">{l.ergebnis}</span>
                    )}
                    {l.bearbeiter && (
                      <span className="ml-auto text-xs text-muted-foreground">
                        {l.bearbeiter}
                      </span>
                    )}
                    {canAct && l.status === "verloren" && (
                      <button
                        type="button"
                        title="Zurück in die offene Liste"
                        onClick={() => setStatus(l, "offen")}
                        className="text-xs text-primary hover:underline"
                      >
                        wieder öffnen
                      </button>
                    )}
                  </li>
                ))}
              </ul>
            </details>
          )}
          </div>
        </div>
      )}

      {(view === "kontakte" || (view === "tabs" && !monitor && tab === "kontakte")) && (
        <KontakteView
          inbound={kontakteInbound ?? inbound}
          outbound={kontakteOutbound ?? outbound}
        />
      )}

      {(view === "outbound" || (view === "tabs" && !monitor && tab === "outbound")) && (
        <div className="flex flex-col gap-3">
          <p className="text-xs text-muted-foreground">
            Deine Anrufliste als Tagesplan: heute einfach von oben nach unten
            abtelefonieren. Nicht erreicht? Der Kontakt rutscht automatisch auf
            morgen — erreichte bekommen ihre Wiedervorlage aus der Notiz.
          </p>
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
  const [adresse, setAdresse] = useState("");
  const [quelle, setQuelle] = useState("");
  const [bereich, setBereich] = useState("");
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
        adresse,
        quelle,
        bereich,
        notiz,
      });
      onCreated({
        kind: "call",
        id: String(res.id),
        name: name || "Inbound-Anruf",
        telefon: telefon || null,
        email: null,
        adresse: adresse.trim() || null,
        bereich: bereich || null,
        erstbearbeitet_at: new Date().toISOString(),
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
      setAdresse("");
      setBereich("");
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
      <Input
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Name des Anrufers"
        className="h-9 bg-background"
      />
      <Input
        type="tel"
        value={telefon}
        onChange={(e) => setTelefon(e.target.value)}
        placeholder="Telefonnummer"
        className="h-9 bg-background"
      />
      <Input
        value={adresse}
        onChange={(e) => setAdresse(e.target.value)}
        placeholder="Adresse / Ort (optional)"
        className="h-9 bg-background"
      />
      <label className="flex flex-col gap-1 text-xs font-medium text-muted-foreground">
        Wofür interessiert sich der Anrufer?
        <select
          value={bereich}
          onChange={(e) => setBereich(e.target.value)}
          className={cn(SELECT_CLASS, "h-9 bg-background font-normal")}
        >
          <option value="">Bitte wählen…</option>
          <option value="intensiv">Intensivpflege</option>
          <option value="ambulant">Ambulante Pflege</option>
          <option value="alltagshilfe">Hauswirtschaft / Alltagshilfe</option>
        </select>
      </label>
      <label className="flex flex-col gap-1 text-xs font-medium text-muted-foreground">
        Wie sind sie auf uns aufmerksam geworden?
        <select
          value={quelle}
          onChange={(e) => setQuelle(e.target.value)}
          className={cn(SELECT_CLASS, "h-9 bg-background font-normal")}
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
            <Input
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Was ist zu tun? (z. B. Rückruf)"
              className="min-w-40 flex-1 bg-background"
            />
            <Input
              type="date"
              value={datum}
              onChange={(e) => setDatum(e.target.value)}
              className="w-fit bg-background"
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
 * Kontakte als Kanban-Board (für beide Teams identisch): Spalten nach
 * Kontakt-Stand — heute in Kontakt, demnächst geplant, Rückmeldung
 * ausstehend, zuletzt in Kontakt, noch nie in Kontakt. Große Suche über
 * alles (Name, Telefon, E-Mail, Ort) plus Kategorie-Filter (Kunden,
 * Krankenhäuser, Apotheken …).
 */

const KAT_TONE: Record<string, string> = {
  kunde: "bg-blue-100 text-blue-800",
  krankenhaus: "bg-teal-100 text-teal-800",
  praxis: "bg-purple-100 text-purple-800",
  apotheke: "bg-rose-100 text-rose-800",
  pflegeeinrichtung: "bg-amber-100 text-amber-800",
  sanitaetshaus: "bg-cyan-100 text-cyan-800",
  sonstiges: "bg-gray-100 text-gray-700",
};

type KontaktSpalte = "heute" | "geplant" | "rueckmeldung" | "zuletzt" | "nie";

interface KontaktKarte {
  key: string;
  spalte: KontaktSpalte;
  name: string;
  kategorieKey: string;
  kategorieLabel: string;
  telefon: string | null;
  /** Ort / Quelle / Standort-Zeile. */
  info: string | null;
  /** Kontakt-Stand ("zuletzt Anruf am …", "übergeben an …"). */
  meta: string | null;
  metaTone?: string;
  statusLabel?: string;
  statusTone?: string;
  todo?: string | null;
  sort: string;
  search: string;
}

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
  const in7Tagen = (() => {
    const d = new Date(`${heute}T00:00:00`);
    d.setDate(d.getDate() + 7);
    return d.toISOString().slice(0, 10);
  })();

  const leadKategorie = (l: InboundLead) =>
    l.quelle === "recare"
      ? "Recare-Patient"
      : l.status === "aufgenommen"
        ? "Klient"
        : "Interessent";

  // ── Beide Welten (Klienten-Leads + Institutionen) auf EIN Kartenmodell ──
  const karten: KontaktKarte[] = [];
  for (const l of inbound) {
    const heuteAktiv =
      (l.datum ?? "").slice(0, 10) === heute ||
      (l.erstbearbeitet_at ?? "").slice(0, 10) === heute;
    const zukunftsTodo = l.todos.find((t) => t.faellig_am && t.faellig_am > heute);
    const faelligesTodo = l.todos.find((t) => t.faellig_am && t.faellig_am <= heute);
    let spalte: KontaktSpalte;
    let meta: string | null;
    let metaTone: string | undefined;
    if (l.zugewiesen_at && !l.pdl_bestaetigt_at && l.status !== "verloren") {
      spalte = "rueckmeldung";
      meta = `an ${l.zugewiesen_hub ?? "Standort"} übergeben — PDL-Antwort offen`;
      metaTone = "text-amber-700";
    } else if (faelligesTodo) {
      spalte = "rueckmeldung";
      meta = `To-do fällig: ${faelligesTodo.text}`;
      metaTone = "text-amber-700";
    } else if (heuteAktiv) {
      spalte = "heute";
      meta =
        (l.erstbearbeitet_at ?? "").slice(0, 10) === heute
          ? "heute bearbeitet"
          : "heute eingegangen";
    } else if (zukunftsTodo) {
      spalte = "geplant";
      meta = `Wiedervorlage ${formatIsoDate(zukunftsTodo.faellig_am!)}: ${zukunftsTodo.text}`;
    } else if (l.status === "offen") {
      spalte = "nie";
      meta = `eingegangen ${formatIsoDate(l.datum.slice(0, 10))} — noch nicht erreicht`;
      metaTone = "text-red-700";
    } else {
      spalte = "zuletzt";
      meta = l.erstbearbeitet_at
        ? `zuletzt bearbeitet ${formatIsoDate(l.erstbearbeitet_at.slice(0, 10))}`
        : `eingegangen ${formatIsoDate(l.datum.slice(0, 10))}`;
    }
    karten.push({
      key: `l-${l.id}`,
      spalte,
      name: l.name,
      kategorieKey: "kunde",
      kategorieLabel: leadKategorie(l),
      telefon: l.telefon,
      info:
        [l.adresse, leadQuelleLabel(l.quelle) || l.quelle]
          .filter(Boolean)
          .join(" · ") || null,
      meta,
      metaTone,
      statusLabel: STATUS_LABEL[l.status] ?? l.status,
      statusTone: leadStatusChip(l.status),
      sort:
        spalte === "geplant"
          ? (zukunftsTodo?.faellig_am ?? "9999")
          : (l.erstbearbeitet_at ?? l.datum ?? ""),
      search:
        `${l.name} ${l.telefon ?? ""} ${l.email ?? ""} ${l.adresse ?? ""} ${l.quelle_detail ?? ""} ${leadQuelleLabel(l.quelle)}`.toLowerCase(),
    });
  }
  for (const t of outbound) {
    const offenesTodo = t.todos[0] ?? null;
    let spalte: KontaktSpalte;
    let meta: string | null;
    let metaTone: string | undefined;
    if (!t.letzter_besuch) {
      spalte = "nie";
      meta = "noch kein Kontakt";
    } else if (t.letzter_besuch === heute) {
      spalte = "heute";
      meta = `heute: ${kontaktArtLabel(t.letzte_kontakt_art) || "Kontakt"}`;
    } else if (
      offenesTodo &&
      (!offenesTodo.faellig_am || offenesTodo.faellig_am <= heute)
    ) {
      spalte = "rueckmeldung";
      meta = `To-do: ${offenesTodo.text}`;
      metaTone = "text-amber-700";
    } else if (
      t.naechster_besuch &&
      t.naechster_besuch > heute &&
      t.naechster_besuch <= in7Tagen
    ) {
      spalte = "geplant";
      meta = `wieder dran am ${formatIsoDate(t.naechster_besuch)}`;
    } else {
      spalte = "zuletzt";
      meta = `zuletzt ${kontaktArtLabel(t.letzte_kontakt_art) || "Kontakt"} am ${formatIsoDate(t.letzter_besuch)}`;
    }
    karten.push({
      key: `t-${t.id}`,
      spalte,
      name: t.name,
      kategorieKey: t.kategorie,
      kategorieLabel: placeKindLabel(t.kategorie),
      telefon: null,
      info:
        [
          t.ort,
          t.hub ? `${t.hub}${t.hub_pdl ? ` · PDL ${t.hub_pdl}` : ""}` : null,
        ]
          .filter(Boolean)
          .join(" · ") || null,
      meta,
      metaTone,
      todo: offenesTodo && spalte !== "rueckmeldung" ? offenesTodo.text : null,
      sort:
        spalte === "geplant"
          ? (t.naechster_besuch ?? "9999")
          : spalte === "nie"
            ? `${t.relevanz ?? 9}-${t.name}`
            : (t.letzter_besuch ?? ""),
      search:
        `${t.name} ${t.ort ?? ""} ${t.hub ?? ""} ${placeKindLabel(t.kategorie)}`.toLowerCase(),
    });
  }

  const kategorien = [
    { key: "alle", label: "Alle" },
    { key: "kunde", label: "Kunden & Interessenten" },
    ...[...new Set(outbound.map((t) => t.kategorie))]
      .sort()
      .map((k) => ({ key: k, label: placeKindLabel(k) })),
  ];

  const sichtbar = karten.filter(
    (k) =>
      (filter === "alle" || filter === k.kategorieKey) &&
      (!q.trim() || k.search.includes(q.trim().toLowerCase())),
  );

  const SPALTEN: {
    id: KontaktSpalte;
    titel: string;
    hint: string;
    dir: "asc" | "desc";
  }[] = [
    {
      id: "heute",
      titel: "Heute in Kontakt",
      hint: "heute gesprochen, bearbeitet oder eingegangen",
      dir: "desc",
    },
    {
      id: "geplant",
      titel: "Demnächst geplant",
      hint: "morgen bis in 7 Tagen dran (Wiedervorlagen & Anruf-Termine)",
      dir: "asc",
    },
    {
      id: "rueckmeldung",
      titel: "Rückmeldung ausstehend",
      hint: "wartet auf PDL-Antwort oder ein To-do ist fällig",
      dir: "asc",
    },
    {
      id: "zuletzt",
      titel: "Zuletzt in Kontakt",
      hint: "vergangene Kontakte — neueste zuerst",
      dir: "desc",
    },
    {
      id: "nie",
      titel: "Noch nie in Kontakt",
      hint: "noch kein Gespräch — nach Priorität",
      dir: "asc",
    },
  ];
  const cap = q.trim() ? 200 : 30;

  return (
    <div className="flex flex-col gap-3">
      <p className="text-xs text-muted-foreground">
        Gemeinsames Verzeichnis beider Teams — wenn jemand anruft, hier suchen:
        jede Karte zeigt den letzten Stand zum Kontakt.
      </p>

      {/* Große Suche über alles */}
      <div className="relative">
        <Search className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Alles durchsuchen — Name, Telefon, E-Mail, Ort …"
          className="h-11 w-full rounded-xl border bg-card pr-3 pl-9 text-base shadow-sm"
        />
      </div>

      {/* Kategorie-Filter */}
      <div className="flex flex-wrap items-center gap-2">
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

      {/* Kanban: mobil horizontal scrollbar, ab lg als 5-Spalten-Grid */}
      <div className="flex items-start gap-3 overflow-x-auto pb-2 lg:grid lg:grid-cols-5 lg:overflow-visible">
        {SPALTEN.map((sp) => {
          const cards = sichtbar
            .filter((k) => k.spalte === sp.id)
            .sort((a, b) =>
              sp.dir === "asc"
                ? a.sort.localeCompare(b.sort)
                : b.sort.localeCompare(a.sort),
            );
          return (
            <div
              key={sp.id}
              className="w-72 shrink-0 rounded-xl border bg-muted/40 p-2 lg:w-auto"
            >
              <div className="px-1.5 pt-1 pb-1.5">
                <p className="flex items-center gap-1.5 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                  {sp.titel}
                  <span className="ml-auto rounded-full border bg-card px-1.5 py-0.5 text-[10px] normal-case tabular-nums">
                    {cards.length}
                  </span>
                </p>
                <p className="text-[10px] text-muted-foreground">{sp.hint}</p>
              </div>
              <ul className="flex flex-col gap-1.5">
                {cards.length === 0 && (
                  <li className="rounded-lg border border-dashed p-3 text-center text-xs text-muted-foreground">
                    leer
                  </li>
                )}
                {cards.slice(0, cap).map((k) => (
                  <li
                    key={k.key}
                    className="rounded-lg border bg-card p-2.5 text-sm shadow-sm"
                  >
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="leading-snug font-semibold">{k.name}</span>
                      <span
                        className={cn(
                          "rounded-full px-1.5 py-0.5 text-[10px] font-semibold",
                          KAT_TONE[k.kategorieKey] ?? KAT_TONE.sonstiges,
                        )}
                      >
                        {k.kategorieLabel}
                      </span>
                      {k.statusLabel && (
                        <span
                          className={cn(
                            "rounded-full px-1.5 py-0.5 text-[10px] font-semibold",
                            k.statusTone,
                          )}
                        >
                          {k.statusLabel}
                        </span>
                      )}
                    </div>
                    {k.info && (
                      <p className="mt-0.5 text-xs text-muted-foreground">{k.info}</p>
                    )}
                    {k.telefon && (
                      <a
                        href={`tel:${k.telefon}`}
                        className="mt-0.5 flex w-fit items-center gap-1 text-xs text-primary hover:underline"
                      >
                        <Phone className="size-3" />
                        {k.telefon}
                      </a>
                    )}
                    {k.meta && (
                      <p
                        className={cn(
                          "mt-1 text-[11px] font-medium",
                          k.metaTone ?? "text-muted-foreground",
                        )}
                      >
                        {k.meta}
                      </p>
                    )}
                    {k.todo && (
                      <p className="mt-0.5 text-[11px] text-amber-700">
                        To-do: {k.todo}
                      </p>
                    )}
                  </li>
                ))}
                {cards.length > cap && (
                  <li className="p-1.5 text-center text-[11px] text-muted-foreground">
                    +{cards.length - cap} weitere — Suche oder Filter nutzen
                  </li>
                )}
              </ul>
            </div>
          );
        })}
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

  // Stammdaten-Feld im Referenz-Look: farbige Icon-Disc + Label + Wert.
  const feld = (
    label: string,
    icon: ReactNode,
    disc: string,
    value: ReactNode,
  ) => (
    <div className="flex min-w-0 items-center gap-2.5">
      <span
        className={cn(
          "flex size-8 shrink-0 items-center justify-center rounded-full",
          disc,
        )}
      >
        {icon}
      </span>
      <div className="min-w-0">
        <p className="text-[10px] font-semibold tracking-wide text-muted-foreground uppercase">
          {label}
        </p>
        <p className="truncate text-sm font-medium" title={typeof value === "string" ? value : undefined}>
          {value ?? <span className="font-normal text-muted-foreground">—</span>}
        </p>
      </div>
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
        <Input
          type={opts?.type ?? "text"}
          value={value}
          onChange={(e) => set(e.target.value)}
          disabled={opts?.locked || busy}
          className="bg-background"
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
    <div className="relative grid grid-cols-1 gap-x-4 gap-y-2.5 rounded-xl border bg-card px-3.5 py-3 pr-10 shadow-sm sm:grid-cols-2 lg:grid-cols-4">
      {feld(
        "Telefon",
        <Phone className="size-3.5" />,
        "bg-blue-100 text-blue-600",
        lead.telefon ? (
          <a href={`tel:${lead.telefon}`} className="text-primary hover:underline">
            {lead.telefon}
          </a>
        ) : null,
      )}
      {feld(
        "E-Mail",
        <Mail className="size-3.5" />,
        "bg-indigo-100 text-indigo-600",
        lead.email ? (
          <a href={`mailto:${lead.email}`} className="text-primary hover:underline">
            {lead.email}
          </a>
        ) : null,
      )}
      {feld(
        "Adresse / Ort",
        <MapPin className="size-3.5" />,
        "bg-purple-100 text-purple-600",
        lead.adresse || null,
      )}
      {feld(
        "Eingang",
        <CalendarClock className="size-3.5" />,
        "bg-emerald-100 text-emerald-600",
        exactStamp(lead.datum) || null,
      )}
      {canAct && (
        <button
          type="button"
          title="Stammdaten bearbeiten"
          onClick={() => setEditing(true)}
          className="absolute top-2 right-2 rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
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
          <p className="w-full text-sm whitespace-pre-line text-foreground/85">
            {lead.notiz}
          </p>
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
        className="border-purple-300 text-purple-800 hover:bg-purple-50"
        onClick={() => setOpen(true)}
      >
        <Check className="size-3.5" /> Erstgespräch vereinbart
      </Button>
    );
  }
  return (
    <div className="flex w-full flex-col gap-1.5 rounded-lg border border-purple-200 bg-purple-50/50 p-2.5">
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
          className={cn(SELECT_CLASS, "h-8 bg-background")}
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
 * Ein Eintrag der Outbound-Tagesliste im Referenz-Look: Nummern-Disc,
 * großer Name, Kontext-Zeilen mit Icons — und beim Loggen ein zweispaltiges
 * Formular: links die Pflicht-Auswahl Erreicht?/Nicht erreicht als Kacheln
 * plus Mini-Timeline (Kontakt heute → Wiedervorlage → Erledigt), rechts
 * Ansprechpartner, Notiz (liest die KI: "in 1 Woche zurückrufen" →
 * Wiedervorlage-Tag, "Flyer schicken" → To-do) und optional festes Datum.
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
  const [openedAt, setOpenedAt] = useState<string | null>(null);
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

  const feldLabel = (icon: ReactNode, text: string) => (
    <span className="flex items-center gap-1.5 text-[10px] font-semibold tracking-wide text-muted-foreground uppercase">
      {icon}
      {text}
    </span>
  );

  const timelineItem = (
    icon: ReactNode,
    active: boolean,
    label: string,
    sub: string,
  ) => (
    <div className="flex items-center gap-2.5">
      <span
        className={cn(
          "flex size-6 shrink-0 items-center justify-center rounded-full border",
          active
            ? "border-primary bg-primary text-primary-foreground"
            : "bg-card text-muted-foreground",
        )}
      >
        {icon}
      </span>
      <span className="min-w-0">
        <p className="text-xs leading-tight font-medium">{label}</p>
        <p className="truncate text-[11px] text-muted-foreground">{sub}</p>
      </span>
    </div>
  );

  return (
    <li
      className={cn(
        "flex flex-col gap-2 rounded-xl border bg-card p-4 shadow-sm",
        isDue && "border-amber-500/40",
      )}
    >
      <div className="flex items-start gap-3">
        {/* Reihenfolge im Tag */}
        <span className="mt-1 flex size-7 shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-bold text-primary">
          {index}
        </span>
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <span className="text-lg leading-snug font-bold tracking-tight">{t.name}</span>
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
          <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
            <MapPin className="size-3.5 shrink-0" />
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
          {t.hub && (
            <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
              <span className="font-semibold text-primary">Standort {t.hub}:</span>
              <span className="font-medium">
                {t.hub_pdl ? `PDL ${t.hub_pdl}` : "keine PDL hinterlegt"}
              </span>
              {t.hub_pdl_phone && (
                <a
                  href={`tel:${t.hub_pdl_phone}`}
                  className="flex items-center gap-1 font-medium text-primary hover:underline"
                >
                  <Phone className="size-3.5" />
                  {t.hub_pdl_phone}
                </a>
              )}
            </p>
          )}
          {t.besuche.map((b) => (
            <p
              key={b.art}
              className={cn(
                "flex w-fit flex-wrap items-center gap-x-1.5 rounded-lg px-2 py-1 text-xs font-medium",
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
          <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
            <CalendarClock className="size-3.5 shrink-0" />
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
            variant="outline"
            className="shrink-0 border-primary/40 text-primary hover:bg-primary/5 hover:text-primary"
            onClick={() => {
              setHinweis(null);
              setOpenedAt(
                new Date().toLocaleTimeString("de-DE", {
                  hour: "2-digit",
                  minute: "2-digit",
                }),
              );
              setOpen(true);
            }}
          >
            <PhoneCall className="size-3.5" /> Anruf loggen
          </Button>
        )}
      </div>

      {open && (
        <div className="grid gap-3 border-t pt-3 md:grid-cols-[230px_minmax(0,1fr)]">
          {/* Linke Schiene: Pflicht-Auswahl + Mini-Timeline */}
          <div className="flex flex-col gap-2">
            <button
              type="button"
              onClick={() => setErreicht(true)}
              className={cn(
                "flex items-center gap-2.5 rounded-xl border p-2.5 text-left transition-colors",
                erreicht === true
                  ? "border-emerald-300 bg-emerald-50"
                  : "bg-card hover:bg-muted/50",
              )}
            >
              <span
                className={cn(
                  "flex size-7 shrink-0 items-center justify-center rounded-full",
                  erreicht === true
                    ? "bg-emerald-500 text-white"
                    : "bg-muted text-muted-foreground",
                )}
              >
                <Check className="size-4" />
              </span>
              <span>
                <p className="text-xs text-muted-foreground">Erreicht?</p>
                <p
                  className={cn(
                    "text-sm font-semibold",
                    erreicht === true && "text-emerald-700",
                  )}
                >
                  Ja, gesprochen
                </p>
              </span>
            </button>
            <button
              type="button"
              onClick={() => setErreicht(false)}
              className={cn(
                "flex items-center gap-2.5 rounded-xl border p-2.5 text-left transition-colors",
                erreicht === false
                  ? "border-red-300 bg-red-50"
                  : "bg-card hover:bg-muted/50",
              )}
            >
              <span
                className={cn(
                  "flex size-7 shrink-0 items-center justify-center rounded-full",
                  erreicht === false
                    ? "bg-red-500 text-white"
                    : "bg-muted text-muted-foreground",
                )}
              >
                <X className="size-4" />
              </span>
              <span>
                <p className="text-xs text-muted-foreground">Nicht erreicht?</p>
                <p
                  className={cn(
                    "text-sm font-semibold",
                    erreicht === false && "text-red-700",
                  )}
                >
                  Nicht erreicht
                </p>
              </span>
            </button>
            <div className="mt-1 flex flex-col gap-3 pl-1">
              {timelineItem(
                <Phone className="size-3" />,
                true,
                "Kontakt heute",
                openedAt ? `${openedAt} Uhr` : formatIsoDate(today),
              )}
              {timelineItem(
                <CalendarClock className="size-3" />,
                false,
                "Wiedervorlage",
                wiedervorlage
                  ? formatIsoDate(wiedervorlage)
                  : erreicht === false
                    ? "morgen (automatisch)"
                    : "aus Notiz / Rhythmus",
              )}
              {timelineItem(<Check className="size-3" />, false, "Erledigt", "Offen")}
            </div>
          </div>

          {/* Rechte Seite: Felder */}
          <div className="flex flex-col gap-2.5">
            {erreicht === null && (
              <p className="rounded-lg border border-dashed p-3 text-sm text-muted-foreground">
                Links auswählen: erreicht oder nicht erreicht — dann geht es hier
                weiter.
              </p>
            )}
            {erreicht === true && (
              <label className="flex flex-col gap-1">
                {feldLabel(<User className="size-3" />, "Ansprechpartner")}
                <Input
                  type="text"
                  value={ansprechpartner}
                  onChange={(e) => setAnsprechpartner(e.target.value)}
                  placeholder="Mit wem gesprochen? (z. B. Frau Meier, Sozialdienst)"
                />
              </label>
            )}
            {erreicht !== null && (
              <>
                <label className="flex flex-col gap-1">
                  {feldLabel(<FileText className="size-3" />, "Notiz")}
                  <Textarea
                    value={notiz}
                    onChange={(e) => setNotiz(e.target.value)}
                    rows={3}
                    placeholder={
                      erreicht
                        ? "Was wurde besprochen? Die KI liest mit: „ruf in 1 Woche zurück“ wird zum Termin, „Flyer schicken“ zum To-do."
                        : "Optional: Mailbox, besetzt, …"
                    }
                  />
                </label>
                {erreicht && (
                  <label className="flex flex-col gap-1">
                    {feldLabel(
                      <CalendarClock className="size-3" />,
                      "Wiedervorlage am (optional — sonst entscheidet die Notiz/der Rhythmus)",
                    )}
                    <Input
                      type="date"
                      min={today}
                      value={wiedervorlage}
                      onChange={(e) => setWiedervorlage(e.target.value)}
                      className="w-fit"
                    />
                  </label>
                )}
              </>
            )}
            {erreicht === false && (
              <p className="text-xs text-muted-foreground">
                Wird automatisch <span className="font-semibold">morgen</span> wieder
                auf die Liste gesetzt.
              </p>
            )}
            {error && <p className="text-xs text-destructive">{error}</p>}
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                size="sm"
                disabled={busy || erreicht === null}
                onClick={log}
              >
                <Check className="size-3.5" />
                {busy
                  ? "Speichert…"
                  : erreicht === null
                    ? "Erst „Erreicht?“ beantworten"
                    : `Speichern (als ${memberName})`}
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => setOpen(false)}
                disabled={busy}
              >
                Abbrechen
              </Button>
            </div>
          </div>
        </div>
      )}
    </li>
  );
}
