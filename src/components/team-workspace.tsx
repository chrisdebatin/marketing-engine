"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  Ban,
  CalendarClock,
  Building2,
  Check,
  ChevronDown,
  ClipboardList,
  Copy,
  FileText,
  Hand,
  Headset,
  Inbox,
  Mail,
  MapPin,
  MoreVertical,
  Pencil,
  Send,
  Phone,
  PhoneCall,
  PhoneOff,
  ThumbsDown,
  Trash2,
  Search,
  Undo2,
  User,
  Users,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { StatTile } from "@/components/ui/stat-tile";
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
  zugewiesen_hub_id: string | null;
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
  vorschlag_pdl_email: string | null;
  /** Klinik-Beziehung bei Recare-Leads: waren wir schon da, wer war Ansprechpartner, wie viele Patienten kamen bisher. */
  klinik_info: {
    name: string;
    letzter_anruf: { datum: string; ansprechpartner: string | null } | null;
    letzter_besuch: { datum: string; art: string } | null;
    ansprechpartner: string | null;
    patienten: number;
    aufgenommen: number;
  } | null;
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
  /** Wer zuletzt bei dieser Institution angerufen/kontaktiert hat. */
  letzter_von: string | null;
  /** ID des jüngsten Kontakt-Log-Eintrags — zum Nachbearbeiten. */
  letzter_log_id: string | null;
  /** Ansprechpartner aus dem jüngsten Log-Eintrag. */
  letzter_ansprechpartner: string | null;
  adresse: string | null;
  /** Hinterlegte Ansprechpartner mit Telefon/E-Mail (crm_persons). */
  personen: {
    id: string;
    name: string;
    funktion: string | null;
    telefon: string | null;
    email: string | null;
  }[];
  exklusiv: boolean;
  /** Offene To-dos am Kontakt (aus KI-gelesenen Anruf-Notizen). */
  todos: { id: string; text: string; faellig_am: string | null }[];
  /** PDL-Aktivitäten vor Ort (CM-Box beliefert / Flyer ausgelegt), jüngste je Art. */
  besuche: { art: "box" | "flyer"; datum: string; von: string | null; hub: string | null }[];
}

/** Einheitlicher Stil für native Selects — passend zu ui/Input. */
const SELECT_CLASS =
  "rounded-lg border border-input bg-transparent px-2 text-sm text-foreground transition-colors outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-input/30";

/** Farbiger Seitenrand der Lead-Karte = Status auf einen Blick (Referenz-Mock). */
const STATUS_BORDER: Record<string, string> = {
  offen: "border-l-amber-400",
  kontaktiert: "border-l-blue-500",
  erstgespraech: "border-l-purple-500",
  aufgenommen: "border-l-emerald-500",
  verloren: "border-l-slate-300",
};

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
 * Sind die Stammdaten vollständig genug, um den Lead zu übergeben?
 * Name und Adresse/Ort muss die MA im Erstkontakt aufnehmen — fehlt eins
 * davon, erscheint ein To-do an der Karte und der Schritt bleibt offen.
 */
function datenVollstaendig(l: InboundLead): boolean {
  const name = (l.name ?? "").trim();
  // Platzhalter-Namen der Importe zählen nicht als erfasster Name.
  const echterName =
    name.length > 2 &&
    !/^(verpasster anruf|\(ohne name\)|unbekannt)$/i.test(name);
  const adresse = (l.adresse ?? "").trim().length > 2;
  return echterName && adresse;
}

/**
 * Prozess-Stepper je Lead: wo steht die Anfrage, was ist der nächste Schritt?
 * B2C-Funnel: Eingegangen → Kontaktiert → Daten aufgenommen → Interesse
 * bestätigt → [Beratungstermin] → Übergeben → Aufgenommen.
 * Der Beratungstermin gibt es nur an Direktbuchungs-Standorten (Düsseldorf,
 * Gevelsberg) — nur dort darf das Callcenter Termine vereinbaren.
 * Recare verkürzt: Eingegangen → PDL-Klärung → Übergeben → Aufgenommen.
 */
function processInfo(l: InboundLead): {
  steps: { label: string; done: boolean; current: boolean }[];
  next: string | null;
  lost: boolean;
  /** Stammdaten fehlen → To-do an der Karte anzeigen. */
  datenFehlen: boolean;
} {
  const lost = l.status === "verloren" && !l.pdl_bestaetigt_at;
  const uebergeben = Boolean(l.zugewiesen_hub);
  const aufgenommen =
    l.status === "aufgenommen" ||
    Boolean(l.pdl_bestaetigt_at && !/nicht|kein/i.test(l.pdl_ergebnis ?? ""));
  const kontaktiert =
    ["kontaktiert", "erstgespraech", "aufgenommen"].includes(l.status) || uebergeben;
  const interesse = ["erstgespraech", "aufgenommen"].includes(l.status) || uebergeben;
  const datenOk = datenVollstaendig(l);
  // Nach der Übergabe ist die Datenaufnahme zwangsläufig passiert.
  const datenDone = datenOk || uebergeben || aufgenommen;
  const datenFehlen = !datenOk && !uebergeben && !aufgenommen && !lost;

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
          { label: "Daten aufgenommen", done: datenDone },
          { label: "Interesse bestätigt", done: interesse },
          // Nur Düsseldorf/Gevelsberg: Callcenter vereinbart den Termin selbst
          ...(l.direct_booking
            ? [{ label: "Beratungstermin vereinbart", done: interesse }]
            : []),
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
  else if (l.status === "offen" && !l.bearbeiter)
    next = "Übernehmen, anrufen, Daten abfragen & Interesse klären";
  else if (l.status === "offen")
    next = l.telefon
      ? "Anrufen, Daten abfragen & Interesse klären"
      : l.email
        ? "Keine Telefonnummer — per E-Mail Daten & Interesse abfragen"
        : "Kontaktdaten unvollständig — Infos abfragen";
  else if (l.status === "kontaktiert")
    next = !datenOk
      ? "Fehlende Daten aufnehmen (Name & Adresse), dann Interesse bestätigen"
      : l.direct_booking
        ? "Interesse bestätigen & Beratungstermin vereinbaren (Kalender + MediFox)"
        : "Interesse bestätigen";
  else if (l.status === "erstgespraech")
    next = l.direct_booking
      ? "An Beratungsperson/PDL übergeben"
      : "An Standort/PDL übergeben";
  return { steps, next, lost, datenFehlen };
}

function ProcessSteps({
  lead,
  undo,
}: {
  lead: InboundLead;
  undo?: { label: string; run: () => void } | null;
}) {
  const { steps, next, lost, datenFehlen } = processInfo(lead);
  return (
    <div className="flex flex-col gap-1.5">
      {/* Horizontaler Stepper wie in der Design-Referenz: erledigt = grüner
          Haken-Kreis, aktueller Schritt = blauer Nummern-Kreis, offen = grau —
          mit Zeitstempel unter dem Label, wo einer bekannt ist. */}
      <div className="flex flex-wrap items-start gap-x-2 gap-y-2.5">
        {steps.map((s, i) => {
          const stamp = stampFor(lead, s.label);
          return (
            <span key={s.label} className="flex items-start gap-2">
              {i > 0 && (
                <span className="mt-1.5 text-base leading-none text-muted-foreground/40">
                  ›
                </span>
              )}
              <span className={cn("flex items-center gap-2", lost && "opacity-50")}>
                <span
                  className={cn(
                    "flex size-7 shrink-0 items-center justify-center rounded-full text-xs font-bold",
                    s.done
                      ? "bg-emerald-500 text-white"
                      : s.current
                        ? "bg-primary text-primary-foreground ring-4 ring-primary/15"
                        : "bg-muted text-muted-foreground",
                  )}
                >
                  {s.done ? <Check className="size-4" /> : i + 1}
                </span>
                <span className="flex flex-col leading-tight">
                  <span
                    className={cn(
                      "text-sm",
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
                        "text-[11px] tabular-nums",
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
      </div>
      {/* Nächster Schritt + Zurück-Button in einer eigenen Zeile — in der
          Schritt-Reihe wurde der Button bei 6 Schritten aus dem Bild
          geschoben. */}
      {(next || undo) && (
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          {next && (
            <p className="text-sm">
              <span className="font-semibold text-primary">Nächster Schritt:</span>{" "}
              <span className={next === "Abgeschlossen" ? "text-emerald-700" : ""}>
                {next}
              </span>
            </p>
          )}
          {undo && (
            <button
              type="button"
              onClick={undo.run}
              title="Fälschlich geklickt? Macht den letzten Prozess-Schritt rückgängig."
              className="ml-auto flex shrink-0 items-center gap-1 rounded-md border px-2 py-1 text-xs font-medium text-muted-foreground hover:bg-muted hover:text-foreground"
            >
              <Undo2 className="size-3.5" />
              {undo.label}
            </button>
          )}
        </div>
      )}
      {/* Pflicht-To-do: ohne Name/Adresse kann der Lead nicht sauber
          übergeben werden — deshalb sichtbar markiert. */}
      {datenFehlen && (
        <p className="flex items-center gap-1.5 rounded-lg border border-amber-300 bg-amber-50 px-2.5 py-1.5 text-xs font-medium text-amber-900">
          <ClipboardList className="size-3.5 shrink-0" />
          To-do: Daten aufnehmen —{" "}
          {[
            !((lead.name ?? "").trim().length > 2 &&
              !/^(verpasster anruf|\(ohne name\)|unbekannt)$/i.test(
                (lead.name ?? "").trim(),
              ))
              ? "Name"
              : null,
            (lead.adresse ?? "").trim().length > 2 ? null : "Adresse/Ort",
          ]
            .filter(Boolean)
            .join(" & ")}{" "}
          fehlt (oben per Stift nachtragen).
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

/**
 * Im Namen wessen gerade gehandelt wird. Nur in der Admin-Ansicht (/crm)
 * gesetzt, wo man die Person auswählt; auf den persönlichen Token-Seiten
 * bleibt es null und der Name kommt aus dem Token. Bewusst modulweit statt
 * als Prop: der Wert wird in 16 Kind-Komponenten gebraucht, und die API
 * prüft ihn ohnehin gegen die Team-Liste.
 */
let aktiverBearbeiter: string | null = null;

/**
 * Aktion an die Team-API. Der gewählte Bearbeiter geht als `als` mit — die
 * API akzeptiert ihn nur bei Admin-Session und nur, wenn der Name in der
 * Team-Liste steht.
 */
async function teamAction(
  token: string,
  payload: Record<string, unknown>,
  als?: string,
) {
  const name = als ?? aktiverBearbeiter;
  // Der Body wird bewusst VOR dem fetch gebaut und als eigene Variable
  // uebergeben. Frueher stand JSON.stringify(...) direkt im Options-Objekt,
  // umgeben von Kommentaren — dabei ist im Production-Bundle das body-Feld
  // verlorengegangen, der Server bekam {} und JEDE Aktion scheiterte mit
  // "Unbekannte Aktion". Diese Form ist gegen solche Ausfaelle robust.
  // token: leer auf /crm (dort greift die Admin-Session), gesetzt auf den
  // persoenlichen Token-Seiten. "als" nur, wenn ein Name gewaehlt wurde —
  // die API prueft ihn gegen die Team-Liste.
  const requestBody = JSON.stringify({
    ...payload,
    token,
    ...(name ? { als: name } : {}),
  });
  const res = await fetch("/api/public/team", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: requestBody,
  });
  const json = (await res.json().catch(() => ({}))) as { error?: string };
  if (!res.ok) throw new Error(json.error ?? "Fehler beim Speichern.");
  return json as Record<string, unknown>;
}

export function TeamWorkspace({
  token,
  memberName: memberNameProp,
  inbound: initialInbound,
  outbound: initialOutbound,
  hubs,
  pdlListe,
  bearbeiterOptionen,
  monitor = false,
  editable = false,
  view = "tabs",
  inboundLog = true,
  kontakteInbound,
  kontakteOutbound,
  anrufe = [],
}: {
  token: string;
  memberName: string;
  inbound: InboundLead[];
  outbound: OutboundTarget[];
  hubs: { id: string; name: string }[];
  /** Auswählbare Bearbeiter (nur Admin-Ansicht /crm): Wer trägt gerade ein? */
  bearbeiterOptionen?: string[];
  /** Standorte mit Ansprechpartner — als Nachschlage-Liste auf der Seite. */
  pdlListe?: {
    name: string;
    pdl: string | null;
    telefon: string | null;
    email: string | null;
  }[];
  /** Gemeinsames Kontakte-Verzeichnis (beide Teams) — Fallback: eigene Daten. */
  kontakteInbound?: InboundLead[];
  kontakteOutbound?: OutboundTarget[];
  /** Outbound-Anruf-Log der letzten 7 Tage (KPI-Zeile der Anruf-Ansicht). */
  anrufe?: { datum: string; erreicht: boolean; bearbeiter: string | null }[];
  /** true = Gesamtsicht (z. B. /crm): kein Auto-Reload, keine Anrufliste. Mit
   * editable=true bleiben die Lead-Aktionen trotzdem nutzbar (Admin-Session). */
  monitor?: boolean;
  editable?: boolean;
  /** "tabs" = eigener Umschalter (persönliche Seiten); "inbound"/"outbound"
   * = nur eine Ansicht, Umschalter kommt von außen (/crm-Board). */
  view?: "tabs" | "inbound" | "outbound" | "kontakte";
  /** false = keine Inbound-Anruf-Box (Devina bekommt keine Inbound-Anrufe). */
  inboundLog?: boolean;
}) {
  const [tab, setTab] = useState<"inbound" | "outbound" | "kontakte">("inbound");
  const [inbound, setInbound] = useState(initialInbound);
  // In der Admin-Ansicht (/crm) waehlbar, wer gerade eintraegt — auf den
  // persoenlichen Token-Seiten gibt es keine Auswahl, dort gilt der Name
  // aus dem Token. Alle Aktionen nutzen memberName, deshalb reicht dieser
  // eine State, statt jeden einzelnen Aufruf anzufassen.
  const [gewaehlterName, setGewaehlterName] = useState(memberNameProp);
  const hatAuswahl = Boolean(bearbeiterOptionen && bearbeiterOptionen.length > 0);
  const memberName = hatAuswahl ? gewaehlterName : memberNameProp;
  // Nur mit Auswahl wird ein Name mitgeschickt; die API prüft ihn gegen die
  // Team-Liste. Ohne Auswahl (Token-Seite) bleibt es beim Token-Namen.
  const alsName = hatAuswahl ? gewaehlterName : undefined;
  // Damit auch die Kind-Komponenten (Anruf-Formular, Recare-Ausgang …) unter
  // dem gewählten Namen speichern. Im Effect statt im Render — eine
  // Zuweisung während des Renders verstößt gegen react-hooks/purity.
  useEffect(() => {
    aktiverBearbeiter = alsName ?? null;
  }, [alsName]);
  const [outbound, setOutbound] = useState(initialOutbound);
  const [error, setError] = useState<string | null>(null);
  // "wieder" ist die Anrufliste (heute + kommende Tage in einer Ansicht).
  const [outTab, setOutTab] = useState<"wieder" | "erledigt">("wieder");
  const [inTab, setInTab] = useState<"offen" | "pdl" | "closed">("offen");
  // Aktive Quellen-Einschraenkung der Lead-Liste (null = alle Quellen).
  const [quelleFilter, setQuelleFilter] = useState<string | null>(null);
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

  // Drei Zustände im Leads-Tab: Offen (unser Zug), "Hängt bei PDL"
  // (übergeben, pending confirmation) und Geschlossen (PDL hat bestätigt).
  // Verlorene bleiben unten unter "Alte & abgelehnte Leads".
  const istPending = (l: InboundLead) =>
    Boolean(l.zugewiesen_at && !l.pdl_bestaetigt_at && l.status !== "verloren");
  const istGeschlossen = (l: InboundLead) =>
    l.status === "aufgenommen" ||
    Boolean(l.pdl_bestaetigt_at && !/nicht|kein/i.test(l.pdl_ergebnis ?? ""));
  const pendingLeads = inbound
    .filter(istPending)
    .sort((a, b) => (a.zugewiesen_at ?? "").localeCompare(b.zugewiesen_at ?? ""));
  const closedLeads = inbound
    .filter(istGeschlossen)
    .sort((a, b) =>
      (b.pdl_bestaetigt_at ?? b.datum ?? "").localeCompare(
        a.pdl_bestaetigt_at ?? a.datum ?? "",
      ),
    );
  const heuteIso = todayIso();
  const heuteGeschlossen = closedLeads.filter(
    (l) => (l.pdl_bestaetigt_at ?? "").slice(0, 10) === heuteIso,
  ).length;
  const openInbound = inbound.filter(
    (l) =>
      ["offen", "kontaktiert", "erstgespraech"].includes(l.status) &&
      !istPending(l) &&
      !istGeschlossen(l),
  );
  // Abgelehnte Recare-Anfragen bekommen eine eigene Sektion (Recare-Ausgang
  // dokumentieren: abgelehnt, keine Kapazität, nicht im Einzugsbereich).
  const istRecareAbgelehnt = (l: InboundLead) =>
    l.quelle === "recare" &&
    l.status === "verloren" &&
    !l.pdl_bestaetigt_at &&
    Boolean(l.ergebnis);
  const recareAbgelehnt = inbound
    .filter(istRecareAbgelehnt)
    .sort((a, b) => (b.datum ?? "").localeCompare(a.datum ?? ""));
  const doneLeads = inbound.filter(
    (l) => l.status === "verloren" && !istGeschlossen(l) && !istRecareAbgelehnt(l),
  );

  // Zähler je Quelle (nur offene) + Tages-Gruppen, neueste zuerst.
  const sourceCounts = new Map<string, number>();
  for (const l of openInbound) {
    sourceCounts.set(l.quelle, (sourceCounts.get(l.quelle) ?? 0) + 1);
  }
  // Quellen-Filter: Klick auf einen Zähler-Chip zeigt nur diese Quelle.
  // Der Filter gilt für die Tages-Gruppen UND die Wiedervorlage, damit die
  // Liste nicht doch wieder fremde Quellen einblendet.
  const shownInbound = quelleFilter
    ? openInbound.filter((l) => l.quelle === quelleFilter)
    : openInbound;
  // Wiedervorlage: Leads mit fälligem To-do poppen ganz oben auf — egal wie
  // alt sie sind. Der Rest bleibt chronologisch in Tages-Gruppen.
  const heute = todayIso();
  const hatFaelligesTodo = (l: InboundLead) =>
    l.todos.some((t) => t.faellig_am !== null && t.faellig_am <= heute);
  const wiedervorlage = inbound.filter(
    (l) =>
      hatFaelligesTodo(l) &&
      l.status !== "verloren" &&
      !istPending(l) &&
      !istGeschlossen(l) &&
      (!quelleFilter || l.quelle === quelleFilter),
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
  // Drei Outbound-Reiter: Anrufliste (heute), Wiedervorlagen (kommende Tage
  // + Später), Erledigt (heute bereits telefoniert/besucht).
  const heuteGruppe = outboundDays.find((g) => g.key === today)?.targets ?? [];
  const futureDays = outboundDays.filter((g) => g.key !== today);
  const erledigtHeute = [...outbound]
    .filter((t) => t.letzter_besuch === today)
    .sort((a, b) => a.name.localeCompare(b.name, "de"));
  const wiederAnzahl =
    futureDays.reduce((s, g) => s + g.targets.length, 0) + outboundLater.length;

  /** Optimistisch: die Karte reagiert sofort, der Server bestaetigt danach.
   *  Schlaegt der Aufruf fehl, wird der alte Zustand zurueckgerollt — sonst
   *  zeigt die Oberflaeche etwas an, das nicht gespeichert wurde. */
  async function claim(l: InboundLead) {
    setError(null);
    const vorher = l.bearbeiter;
    setInbound((cur) =>
      cur.map((x) => (x.id === l.id ? { ...x, bearbeiter: memberName } : x)),
    );
    try {
      await teamAction(token, { action: "claim", kind: l.kind, id: l.id }, alsName);
    } catch (e) {
      setInbound((cur) =>
        cur.map((x) => (x.id === l.id ? { ...x, bearbeiter: vorher } : x)),
      );
      setError(e instanceof Error ? e.message : "Fehler");
    }
  }

  /** Statuswechsel ebenfalls optimistisch, inkl. Rollback bei Fehler. */
  async function setStatus(l: InboundLead, status: string, ergebnis?: string) {
    setError(null);
    const vorher = { status: l.status, bearbeiter: l.bearbeiter, ergebnis: l.ergebnis };
    setInbound((cur) =>
      cur.map((x) =>
        x.id === l.id
          ? { ...x, status, bearbeiter: memberName, ...(ergebnis ? { ergebnis } : {}) }
          : x,
      ),
    );
    try {
      await teamAction(token, {
        action: "lead-status",
        kind: l.kind,
        id: l.id,
        status,
        ...(ergebnis ? { ergebnis } : {}),
      }, alsName);
    } catch (e) {
      setInbound((cur) =>
        cur.map((x) => (x.id === l.id ? { ...x, ...vorher } : x)),
      );
      setError(e instanceof Error ? e.message : "Fehler");
    }
  }

  /**
   * Lead löschen: verschwindet sofort aus der Liste. Serverseitig nur ein
   * Statuswechsel auf "geloescht" — die Zeile bleibt in der Datenbank.
   */
  async function deleteLead(l: InboundLead) {
    setError(null);
    try {
      await teamAction(token, { action: "lead-delete", kind: l.kind, id: l.id }, alsName);
      setInbound((cur) => cur.filter((x) => x.id !== l.id));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Fehler");
    }
  }

  /** Übergabe an die PDL zurücknehmen (solange keine Bestätigung vorliegt). */
  async function unassignHub(l: InboundLead) {
    setError(null);
    try {
      await teamAction(token, { action: "unassign-hub", kind: l.kind, id: l.id }, alsName);
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
      {/* Wer trägt gerade ein? Nur in der Admin-Ansicht — auf den
          persönlichen Seiten ist der Name durch den Link festgelegt. */}
      {hatAuswahl && (
        <div className="flex flex-wrap items-center gap-2 rounded-xl border bg-card px-4 py-2.5 shadow-sm">
          <label
            htmlFor="bearbeiter-auswahl"
            className="flex items-center gap-1.5 text-sm font-medium"
          >
            <User className="size-4 text-primary" />
            Ich trage ein als:
          </label>
          {/* Natives select statt Chip-Leiste: ein Tap, die Liste waechst mit
              team_members ohne die Seite zu sprengen, und auf dem Handy
              erscheint das gewohnte Auswahlrad. */}
          <select
            id="bearbeiter-auswahl"
            value={gewaehlterName}
            onChange={(e) => setGewaehlterName(e.target.value)}
            className="h-9 rounded-lg border bg-background px-3 text-sm font-medium text-foreground shadow-sm focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
          >
            {(bearbeiterOptionen ?? []).map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
          <span className="text-xs text-muted-foreground">
            Jede Übernahme und jeder Statuswechsel wird unter diesem Namen
            gespeichert.
          </span>
        </div>
      )}
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
        <div className="flex flex-col gap-3 lg:grid lg:grid-cols-[300px_minmax(0,1fr)] lg:items-start lg:gap-5">
          {canAct && inboundLog && (
            <div className="lg:sticky lg:top-4">
              <InboundCallLog
                token={token}
                memberName={memberName}
                onCreated={(lead) => setInbound((cur) => [lead, ...cur])}
              />
            </div>
          )}
          {/* Ohne Erfassungs-Formular (Call-Center) steht links das
              PDL-Register — dort braucht man beim Abarbeiten der
              Recare-Anfragen staendig die Standort-Nummern. */}
          {!(canAct && inboundLog) && pdlListe && pdlListe.length > 0 && (
            <div className="lg:sticky lg:top-4">
              <PdlRegister eintraege={pdlListe} />
            </div>
          )}
          <div
            className={cn(
              "flex min-w-0 flex-col gap-2",
              !(canAct && inboundLog) &&
                !(pdlListe && pdlListe.length > 0) &&
                "lg:col-span-2",
            )}
          >
          {/* Zustands-Reiter: Offen / Hängt bei PDL / Geschlossen */}
          <div className="flex gap-1 rounded-xl border bg-card p-1 shadow-sm">
            {(
              [
                { key: "offen", label: "Offene Leads", n: openInbound.length },
                { key: "pdl", label: "Hängt bei PDL", n: pendingLeads.length },
                { key: "closed", label: "Geschlossen", n: heuteGeschlossen },
              ] as const
            ).map((t) => (
              <button
                key={t.key}
                type="button"
                onClick={() => setInTab(t.key)}
                title={
                  t.key === "pdl"
                    ? "Übergeben — wartet auf Freigabe (pending confirmation)"
                    : t.key === "closed"
                      ? "Von der PDL bestätigt — Badge zählt heute geschlossene"
                      : undefined
                }
                className={cn(
                  "flex flex-1 items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium",
                  inTab === t.key
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                <span className="truncate">{t.label}</span>
                {t.n > 0 && (
                  <span
                    className={cn(
                      "rounded-full px-1.5 text-xs font-semibold tabular-nums",
                      inTab === t.key ? "bg-white/20" : "bg-primary/10 text-primary",
                    )}
                  >
                    {t.n}
                  </span>
                )}
              </button>
            ))}
          </div>

          {inTab === "pdl" && (
            <>
              <p className="text-xs text-muted-foreground">
                Übergeben und wartet auf Freigabe der PDL (pending
                confirmation). Nachfassen lohnt sich ab 48 Std — jeder
                Anruf-Versuch bitte per ✓/✗ vermerken.
              </p>
              {pendingLeads.length === 0 ? (
                <p className="rounded-xl border bg-card p-5 text-sm text-muted-foreground shadow-sm">
                  Nichts wartet auf PDL-Freigabe.
                </p>
              ) : (
                <ul className="flex flex-col gap-2">
                  {pendingLeads.map((l) => {
                    const wartetMs = l.zugewiesen_at
                      ? Date.parse(heuteIso) - Date.parse(l.zugewiesen_at)
                      : 0;
                    const spaet = wartetMs > 48 * 3_600_000;
                    return (
                      <li
                        key={`${l.kind}-${l.id}`}
                        className={cn(
                          "flex flex-col gap-1.5 rounded-xl border border-l-4 bg-card p-3.5 shadow-sm",
                          spaet ? "border-l-red-400" : "border-l-sky-400",
                        )}
                      >
                        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                          <span className="font-semibold">{l.name}</span>
                          <LeadIdChip id={l.id} />
                          <span
                            className={cn(
                              "rounded-full px-2 py-0.5 text-[11px] font-semibold",
                              spaet
                                ? "bg-red-100 text-red-800"
                                : "bg-sky-100 text-sky-800",
                            )}
                          >
                            wartet {relTime(l.zugewiesen_at ?? "") || "…"}
                          </span>
                        </div>
                        <p className="text-xs text-muted-foreground">
                          → übergeben an{" "}
                          <span className="font-medium text-foreground">
                            {l.zugewiesen_hub}
                          </span>
                          {l.zugewiesen_pdl ? ` (PDL ${l.zugewiesen_pdl})` : ""}
                          {l.zugewiesen_at
                            ? ` am ${formatIsoDate(l.zugewiesen_at.slice(0, 10))}`
                            : ""}
                          {l.bearbeiter ? ` · von ${l.bearbeiter}` : ""}
                        </p>
                        {l.notiz && (
                          <p className="line-clamp-2 text-xs text-muted-foreground">
                            „{l.notiz}“
                          </p>
                        )}
                        {canAct && (
                          <div className="flex flex-wrap items-center gap-3 border-t pt-2">
                            <PdlVersuchButtons lead={l} token={token} />
                            <button
                              type="button"
                              onClick={() => unassignHub(l)}
                              className="flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground"
                            >
                              <Undo2 className="size-3" /> Übergabe zurücknehmen
                            </button>
                          </div>
                        )}
                      </li>
                    );
                  })}
                </ul>
              )}
            </>
          )}

          {inTab === "closed" && (
            <>
              <p className="text-xs text-muted-foreground">
                Von der PDL bestätigt und damit geschlossen —{" "}
                <span className="font-semibold text-foreground">
                  {heuteGeschlossen} heute
                </span>
                , {closedLeads.length} gesamt.
              </p>
              {closedLeads.length === 0 ? (
                <p className="rounded-xl border bg-card p-5 text-sm text-muted-foreground shadow-sm">
                  Noch keine geschlossenen Leads.
                </p>
              ) : (
                <ul className="divide-y rounded-xl border bg-card shadow-sm">
                  {closedLeads.slice(0, 50).map((l) => (
                    <li
                      key={`${l.kind}-${l.id}`}
                      className="flex flex-wrap items-center gap-x-3 gap-y-1 px-4 py-2.5 text-sm"
                    >
                      <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-emerald-700">
                        <Check className="size-3.5" />
                      </span>
                      <span className="w-20 shrink-0 text-xs text-muted-foreground tabular-nums">
                        {l.pdl_bestaetigt_at
                          ? formatIsoDate(l.pdl_bestaetigt_at.slice(0, 10))
                          : "—"}
                      </span>
                      <span className="font-medium">{l.name}</span>
                      <LeadIdChip id={l.id} />
                      {l.zugewiesen_hub && (
                        <span className="text-xs text-muted-foreground">
                          → {l.zugewiesen_hub}
                        </span>
                      )}
                      <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-semibold text-emerald-800">
                        {l.pdl_ergebnis ?? "aufgenommen"}
                      </span>
                      {l.bearbeiter && (
                        <span className="ml-auto text-xs text-muted-foreground">
                          {l.bearbeiter}
                        </span>
                      )}
                    </li>
                  ))}
                  {closedLeads.length > 50 && (
                    <li className="px-4 py-2 text-center text-xs text-muted-foreground">
                      +{closedLeads.length - 50} ältere
                    </li>
                  )}
                </ul>
              )}
            </>
          )}

          {inTab === "offen" && (
          <>
          {/* Kopfzeile: Zähler je Quelle + Abgeschlossene-Toggle */}
          <div className="flex flex-wrap items-center gap-2">
            {/* Chips sind Filter: Klick zeigt nur diese Quelle, erneuter
                Klick hebt den Filter wieder auf. */}
            {[...sourceCounts.entries()]
              .sort((a, b) => b[1] - a[1])
              .map(([q, n]) => {
                const aktiv = quelleFilter === q;
                return (
                  <button
                    key={q}
                    type="button"
                    aria-pressed={aktiv}
                    title={
                      aktiv
                        ? "Filter aufheben — wieder alle Quellen zeigen"
                        : `Nur ${leadQuelleLabel(q) || q} anzeigen`
                    }
                    onClick={() => setQuelleFilter(aktiv ? null : q)}
                    className={cn(
                      "rounded-full border px-2.5 py-1 text-xs font-semibold transition-all",
                      QUELLE_TONE[q] ?? "bg-muted text-muted-foreground",
                      aktiv
                        ? "ring-2 ring-primary ring-offset-1"
                        : "opacity-100 hover:brightness-95",
                      quelleFilter && !aktiv && "opacity-45",
                    )}
                  >
                    {n} × {leadQuelleLabel(q) || q}
                  </button>
                );
              })}
            {quelleFilter && (
              <button
                type="button"
                onClick={() => setQuelleFilter(null)}
                className="flex items-center gap-1 rounded-full border bg-card px-2.5 py-1 text-xs font-semibold text-muted-foreground hover:text-foreground"
              >
                <X className="size-3" /> Filter aufheben
              </button>
            )}
            <span className="ml-auto text-xs text-muted-foreground">
              neueste zuerst · aktualisiert sich automatisch
            </span>
          </div>
          {shownInbound.length === 0 && (
            <div className="flex flex-col items-center gap-1 rounded-xl border border-dashed bg-card p-8 text-center shadow-sm">
              <Inbox className="size-5 text-muted-foreground/50" />
              {quelleFilter ? (
                <>
                  <p className="text-sm font-medium">
                    Keine offenen Anfragen aus dieser Quelle
                  </p>
                  <button
                    type="button"
                    onClick={() => setQuelleFilter(null)}
                    className="text-xs font-semibold text-primary hover:underline"
                  >
                    Filter aufheben und alle zeigen
                  </button>
                </>
              ) : (
                <>
                  <p className="text-sm font-medium">Keine offenen Anfragen 🎉</p>
                  <p className="text-xs text-muted-foreground">
                    Neue Anfragen erscheinen hier automatisch oben.
                  </p>
                </>
              )}
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
                className={cn(
                  "flex flex-col gap-2.5 rounded-xl border border-l-4 bg-card p-4 shadow-sm",
                  STATUS_BORDER[l.status] ?? "border-l-transparent",
                )}
              >
                {/* Kopf: Icon-Disc, Wer (Name) zuerst, Status daneben, Timer
                    oben rechts — Herkunft & Zeit als ruhigere zweite Zeile. */}
                <div className="flex items-start gap-3">
                  <span className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                    {l.kind === "meta" ? (
                      <Inbox className="size-4" />
                    ) : (
                      <PhoneCall className="size-4" />
                    )}
                  </span>
                  <div className="flex min-w-0 flex-1 flex-col gap-1">
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
                    {/* Seltene Aktionen im Kebab — hält die Aktionszeile
                        unten einzeilig. */}
                    {canAct && (
                        <LeadKebab>
                          {(l.zugewiesen_hub_id || l.vorschlag_hub_id) &&
                            !["aufgenommen", "verloren"].includes(l.status) && (
                              <PdlVersuchButtons lead={l} token={token} />
                            )}
                          {l.quelle === "recare" &&
                            !["aufgenommen", "verloren"].includes(l.status) && (
                              <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                title="Anfrage abgelehnt (z. B. Versorgung passt nicht, außerhalb des Einzugsbereichs). Der Lead verschwindet aus der Liste und steht unten unter „Abgelehnte Recare-Anfragen“."
                                className="justify-start border-red-200 text-red-700 hover:bg-red-50 hover:text-red-700"
                                onClick={() =>
                                  setStatus(l, "verloren", "Pat. abgelehnt")
                                }
                              >
                                <X className="size-3.5" /> Pat. abgelehnt
                              </Button>
                            )}
                          <LeadLoeschen lead={l} onDelete={deleteLead} />
                        </LeadKebab>
                      )}
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
                    {l.vorschlag_pdl_email && (
                      <a
                        href={`mailto:${l.vorschlag_pdl_email}`}
                        className="flex items-center gap-1 font-medium text-primary hover:underline"
                        title={`E-Mail an ${l.vorschlag_pdl}`}
                      >
                        <Mail className="size-3" />
                        {l.vorschlag_pdl_email}
                      </a>
                    )}
                  </p>
                )}
                {/* Klinik-Beziehung (nur Recare): waren wir schon da, wer war
                    zuletzt Ansprechpartner, wie viele Patienten kamen bisher. */}
                {l.klinik_info && (
                  <div className="rounded-xl border border-indigo-100 bg-indigo-50/60 px-3 py-2 text-xs">
                    <p className="font-semibold text-indigo-950">
                      🏥 {l.klinik_info.name} — unsere Beziehung
                    </p>
                    {/* Drei Spalten nebeneinander — auf einen Blick erfassbar,
                        statt untereinander gestapelt. */}
                    <dl className="mt-1.5 grid gap-x-4 gap-y-2 sm:grid-cols-3">
                      <div>
                        <dt className="text-[0.7rem] text-indigo-950/60">
                          Vor Ort:
                        </dt>
                        <dd className="text-indigo-950/90">
                          {l.klinik_info.letzter_besuch ? (
                            <>
                              {kontaktArtLabel(l.klinik_info.letzter_besuch.art) || "Besuch"}{" "}
                              am {formatIsoDate(l.klinik_info.letzter_besuch.datum)}
                            </>
                          ) : (
                            "noch nie besucht"
                          )}
                        </dd>
                      </div>
                      <div>
                        <dt className="text-[0.7rem] text-indigo-950/60">
                          Angerufen:
                        </dt>
                        <dd className="text-indigo-950/90">
                          {l.klinik_info.letzter_anruf ? (
                            <>
                              am {formatIsoDate(l.klinik_info.letzter_anruf.datum)}
                              {l.klinik_info.letzter_anruf.ansprechpartner
                                ? ` (mit ${l.klinik_info.letzter_anruf.ansprechpartner})`
                                : ""}
                            </>
                          ) : (
                            "noch nie"
                          )}
                        </dd>
                      </div>
                      <div>
                        <dt className="text-[0.7rem] text-indigo-950/60">
                          Patienten von dort:
                        </dt>
                        <dd className="text-indigo-950/90">
                          {l.klinik_info.patienten > 1 ? (
                            <>
                              {l.klinik_info.patienten} Anfragen ·{" "}
                              <span className="font-medium">
                                {l.klinik_info.aufgenommen} aufgenommen
                              </span>
                            </>
                          ) : (
                            "erste Anfrage dieser Klinik"
                          )}
                        </dd>
                      </div>
                      {l.klinik_info.ansprechpartner && (
                        <div className="sm:col-span-3">
                          <dt className="text-[0.7rem] text-indigo-950/60">
                            Letzter Ansprechpartner:
                          </dt>
                          <dd className="font-medium text-indigo-950/90">
                            {l.klinik_info.ansprechpartner}
                          </dd>
                        </div>
                      )}
                    </dl>
                  </div>
                )}
                {/* Notiz und To-do teilen sich eine Zeile (wrappt bei Bedarf) */}
                <div className="flex flex-wrap items-start gap-x-2 gap-y-1.5">
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
                </div>
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
                              <Check className="size-3.5" /> Interesse bestätigt
                            </Button>
                          )}
                          <LostReason
                            onSave={(grund) => setStatus(l, "verloren", grund)}
                          />
                          {/* Offensichtlich unbrauchbare Leads (Fake-Daten,
                              Spam, Unsinns-Eintraege). Bewusst NICHT als
                              normaler Verlustgrund: "verloren" heisst echter
                              Interessent, den wir nicht gewonnen haben — ein
                              Fake-Lead war nie einer und wuerde die
                              Conversion-Rate verfaelschen. Der Text enthaelt
                              "kein Neuinteressent", damit kategorieAusErgebnis
                              (src/lib/callcenter.ts) ihn aus der
                              Interessenten-Auswertung nimmt. Bei Agentur-Leads
                              zusaetzlich mit Melde-Datum = Grundlage der
                              Reklamation (Uebersicht im CRM-Admin). */}
                          <UngueltigButton
                            quelle={l.quelle}
                            onSave={(grund) =>
                              setStatus(l, "verloren", grund)
                            }
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
                  {/* PDL-Erreichbarkeit sitzt jetzt im Kebab oben rechts. */}
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

          {/* Abgelehnte Recare-Anfragen: eigener Bereich, damit nachvollziehbar
              bleibt, welche Klinik-Anfragen wir warum nicht angenommen haben. */}
          {recareAbgelehnt.length > 0 && (
            <details className="group mt-3 rounded-xl border bg-card shadow-sm">
              <summary className="cursor-pointer list-none p-4 text-sm font-semibold select-none">
                Abgelehnte Recare-Anfragen ({recareAbgelehnt.length})
                <span className="ml-2 text-xs font-normal text-muted-foreground group-open:hidden">
                  aufklappen — von uns abgelehnt (Grund je Zeile)
                </span>
              </summary>
              <ul className="divide-y border-t">
                {recareAbgelehnt.map((l) => (
                  <li
                    key={`${l.kind}-${l.id}`}
                    className="flex flex-wrap items-center gap-x-3 gap-y-1 px-4 py-2 text-sm"
                  >
                    <span className="w-20 shrink-0 text-xs text-muted-foreground tabular-nums">
                      {formatIsoDate(l.datum.slice(0, 10))}
                    </span>
                    <span className="font-medium">{l.name}</span>
                    <LeadIdChip id={l.id} />
                    {l.quelle_detail && (
                      <span className="text-xs text-muted-foreground">
                        {l.quelle_detail}
                      </span>
                    )}
                    <span className="rounded-full bg-red-100 px-2 py-0.5 text-[11px] font-semibold text-red-800">
                      {l.ergebnis}
                    </span>
                    {l.bearbeiter && (
                      <span className="ml-auto text-xs text-muted-foreground">
                        {l.bearbeiter}
                      </span>
                    )}
                    {canAct && (
                      <button
                        type="button"
                        title="Doch wieder aufnehmen — Lead kommt zurück in die offene Liste"
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

          {/* Alte Leads: abgelehnte (verloren) und aufgenommene — kompakt,
              damit die aktive Liste oben schlank bleibt. */}
          {doneLeads.length > 0 && (
            <details className="group mt-3 rounded-xl border bg-card shadow-sm">
              <summary className="cursor-pointer list-none p-4 text-sm font-semibold select-none">
                Alte &amp; abgelehnte Leads ({doneLeads.length})
                <span className="ml-2 text-xs font-normal text-muted-foreground group-open:hidden">
                  aufklappen — abgelehnte / verlorene Leads
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
          </>
          )}
          </div>
        </div>
      )}

      {(view === "kontakte" || (view === "tabs" && !monitor && tab === "kontakte")) && (
        <KontakteView
          inbound={kontakteInbound ?? inbound}
          outbound={kontakteOutbound ?? outbound}
          token={token}
        />
      )}

      {(view === "outbound" || (view === "tabs" && !monitor && tab === "outbound")) && (
        <div className="flex flex-col gap-4">
          {/* KPI-Zeile: Tagesziel-Donut + Quoten aus dem Anruf-Log */}
          <OutboundKpis anrufe={anrufe} faellig={dueCount} today={today} />

          <div className="flex flex-col gap-4 lg:grid lg:grid-cols-[minmax(0,1fr)_290px] lg:items-start">
            <div className="flex min-w-0 flex-col gap-3">
              {/* Reiter: Wiedervorlagen (= die Anrufliste) / Erledigt */}
              <div className="flex gap-1 rounded-xl border bg-card p-1 shadow-sm">
                {(
                  [
                    { key: "wieder", label: "Wiedervorlagen", n: wiederAnzahl },
                    { key: "erledigt", label: "Erledigt", n: erledigtHeute.length },
                  ] as const
                ).map((t) => (
                  <button
                    key={t.key}
                    type="button"
                    onClick={() => setOutTab(t.key)}
                    className={cn(
                      "flex flex-1 items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium",
                      outTab === t.key
                        ? "bg-primary text-primary-foreground"
                        : "text-muted-foreground hover:text-foreground",
                    )}
                  >
                    {t.label}
                    {t.n > 0 && (
                      <span
                        className={cn(
                          "rounded-full px-1.5 text-xs font-semibold tabular-nums",
                          outTab === t.key
                            ? "bg-white/20"
                            : "bg-primary/10 text-primary",
                        )}
                      >
                        {t.n}
                      </span>
                    )}
                  </button>
                ))}
              </div>

              {outTab === "wieder" && (
                <>
                  <p className="text-xs text-muted-foreground">
                    Die Anrufliste: heute fällige Kontakte zuerst (überfällig
                    ganz oben), darunter die kommenden Tage. Nicht erreicht?
                    Steht morgen automatisch wieder hier.
                  </p>

                  {/* Heute fällig — das ist die eigentliche Anrufliste */}
                  <div className="flex flex-col gap-2">
                    <p className="flex items-center gap-2 text-xs font-semibold tracking-wide text-primary uppercase">
                      <CalendarClock className="size-3.5" />
                      Heute dran
                      <span className="h-px flex-1 bg-border" />
                      <span className="font-normal normal-case text-muted-foreground">
                        {heuteGruppe.length} Anruf
                        {heuteGruppe.length === 1 ? "" : "e"}
                      </span>
                    </p>
                    {heuteGruppe.length === 0 ? (
                      <p className="rounded-xl border bg-card p-5 text-sm text-muted-foreground shadow-sm">
                        Alles abtelefoniert. 🎉 Die nächsten Kontakte stehen
                        weiter unten.
                      </p>
                    ) : (
                      <ol
                        id="naechster-anruf"
                        className="flex scroll-mt-4 flex-col gap-2"
                      >
                        {heuteGruppe.map((t, i) => (
                          <OutboundRow
                            key={t.id}
                            target={t}
                            index={i + 1}
                            today={today}
                            token={token}
                            memberName={memberName}
                            isDue
                            canAct={canAct}
                            onLogged={(patch) =>
                              setOutbound((cur) =>
                                cur.map((x) =>
                                  x.id === t.id ? { ...x, ...patch } : x,
                                ),
                              )
                            }
                          />
                        ))}
                      </ol>
                    )}
                  </div>

                  {futureDays.length === 0 && outboundLater.length === 0 && (
                    <p className="rounded-xl border bg-card p-5 text-sm text-muted-foreground shadow-sm">
                      Keine weiteren Wiedervorlagen geplant.
                    </p>
                  )}
                  {futureDays.map((g) => (
                    <div key={g.key} className="flex flex-col gap-2">
                      <p className="mt-2 flex items-center gap-2 text-xs font-semibold tracking-wide text-muted-foreground uppercase first:mt-0">
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
                            isDue={false}
                            canAct={canAct}
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
                            canAct={canAct}
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
                </>
              )}

              {outTab === "erledigt" && (
                <>
                  <p className="text-xs text-muted-foreground">
                    Heute bereits kontaktiert — der nächste Termin ist automatisch
                    gesetzt.
                  </p>
                  {erledigtHeute.length === 0 ? (
                    <p className="rounded-xl border bg-card p-5 text-sm text-muted-foreground shadow-sm">
                      Heute noch nichts geloggt.
                    </p>
                  ) : (
                    <ul className="divide-y rounded-xl border bg-card shadow-sm">
                      {erledigtHeute.map((t) => (
                        <ErledigtRow
                          key={t.id}
                          target={t}
                          token={token}
                          canAct={canAct}
                          memberName={memberName}
                          onSaved={(patch) =>
                            setOutbound((cur) =>
                              cur.map((x) =>
                                x.id === t.id ? { ...x, ...patch } : x,
                              ),
                            )
                          }
                        />
                      ))}
                    </ul>
                  )}
                </>
              )}

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
            </div>

            <OutboundSidebar anrufe={anrufe} today={today} />
          </div>

          {/* Standort-Nummern zum Nachschlagen — die Team-Seiten haben keine
              Sidebar, ohne diese Liste käme man hier nicht an die Kontakte. */}
          {pdlListe && pdlListe.length > 0 && (
            <PdlKontaktliste eintraege={pdlListe} />
          )}

          {/* Abschluss-Banner: direkt zum wichtigsten Anruf springen */}
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-primary/20 bg-primary/[0.05] p-4">
            <div className="min-w-0">
              <p className="text-sm font-semibold">Bereit für den nächsten Anruf?</p>
              <p className="text-xs text-muted-foreground">
                Oben in der Anrufliste steht der wichtigste Kontakt zuerst —
                Formular öffnen, telefonieren, Ergebnis loggen.
              </p>
            </div>
            <a
              href="#naechster-anruf"
              onClick={() => setOutTab("wieder")}
              className="inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow-sm transition-colors hover:bg-primary/90"
            >
              <PhoneCall className="size-4" /> Nächsten Anruf starten
            </a>
          </div>
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
        zugewiesen_hub_id: null,
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
        vorschlag_pdl_email: null,
        direct_booking: false,
        todos: [],
        klinik_info: null,
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

  const feldLabel = (text: string) => (
    <span className="text-xs font-medium text-foreground">{text}</span>
  );

  return (
    <div className="flex flex-col gap-3">
    <div className="flex flex-col gap-2.5 rounded-xl border bg-card p-4 shadow-sm">
      <div className="flex items-start gap-2.5">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
          <PhoneCall className="size-4" />
        </span>
        <div>
          <p className="text-sm font-semibold">Inbound-Anruf loggen</p>
          <p className="text-xs text-muted-foreground">
            Anruf angenommen? Hier eintragen — erscheint sofort als offener
            Lead.
          </p>
        </div>
      </div>
      <label className="flex flex-col gap-1">
        {feldLabel("Name des Anrufers")}
        <Input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="z. B. Max Mustermann"
          className="h-9 bg-background"
        />
      </label>
      <label className="flex flex-col gap-1">
        {feldLabel("Telefonnummer")}
        <Input
          type="tel"
          value={telefon}
          onChange={(e) => setTelefon(e.target.value)}
          placeholder="z. B. 0176 12345678"
          className="h-9 bg-background"
        />
      </label>
      <label className="flex flex-col gap-1">
        {feldLabel("Adresse / Ort (optional)")}
        <Input
          value={adresse}
          onChange={(e) => setAdresse(e.target.value)}
          placeholder="z. B. 47198 Duisburg"
          className="h-9 bg-background"
        />
      </label>
      <label className="flex flex-col gap-1">
        {feldLabel("Wofür interessiert sich der Anrufer?")}
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
      <label className="flex flex-col gap-1">
        {feldLabel("Wie sind sie auf uns aufmerksam geworden?")}
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
      <label className="flex flex-col gap-1">
        {feldLabel("Worum ging es? (optional)")}
        <Textarea
          value={notiz}
          onChange={(e) => setNotiz(e.target.value)}
          rows={2}
          placeholder="Notiz hinzufügen…"
        />
      </label>
      {error && <p className="text-xs text-destructive">{error}</p>}
      <Button
        type="button"
        disabled={busy || !quelle || (!name.trim() && !telefon.trim())}
        onClick={save}
        className="w-full"
      >
        <PhoneCall className="size-4" />
        {busy ? "Speichere…" : "Als Lead anlegen"}
      </Button>
    </div>

    {/* Tipp-Karte wie im Referenz-Mock */}
    <div className="flex items-start gap-2 rounded-xl border border-emerald-200 bg-emerald-50/70 p-3 text-xs text-emerald-900">
      <span aria-hidden>💡</span>
      <p>
        <span className="font-semibold">Tipp:</span> Je mehr Infos Sie hier
        eintragen, desto schneller können wir den Lead bearbeiten.
      </p>
    </div>
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
  // contents: To-dos und Button liegen direkt im Eltern-Flex, damit der
  // "To-do"-Button neben dem Notiz-Button steht statt darunter.
  return (
    <div className="contents">
      {lead.todos.map((t) => {
        const faellig = t.faellig_am !== null && t.faellig_am <= heute;
        return (
          <p
            key={t.id}
            className="flex basis-full flex-wrap items-center gap-1.5 text-xs"
          >
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
          <div className="flex basis-full flex-wrap items-center gap-1.5">
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

/** Chip- und Seitenrand-Farbe je Kategorie (Referenz-Mock: Akzent links). */
const KAT_TONE: Record<string, { chip: string; border: string }> = {
  kunde: { chip: "bg-violet-100 text-violet-800", border: "border-l-violet-400" },
  recare: { chip: "bg-teal-100 text-teal-800", border: "border-l-teal-400" },
  klient: { chip: "bg-emerald-100 text-emerald-800", border: "border-l-emerald-400" },
  krankenhaus: { chip: "bg-teal-100 text-teal-800", border: "border-l-teal-400" },
  praxis: { chip: "bg-purple-100 text-purple-800", border: "border-l-purple-400" },
  apotheke: { chip: "bg-rose-100 text-rose-800", border: "border-l-rose-400" },
  pflegeeinrichtung: { chip: "bg-amber-100 text-amber-800", border: "border-l-amber-400" },
  sanitaetshaus: { chip: "bg-cyan-100 text-cyan-800", border: "border-l-cyan-400" },
  sonstiges: { chip: "bg-gray-100 text-gray-700", border: "border-l-slate-300" },
};

type KontaktSpalte = "heute" | "geplant" | "rueckmeldung" | "zuletzt" | "nie";

interface KontaktKarte {
  key: string;
  spalte: KontaktSpalte;
  name: string;
  kategorieKey: string;
  kategorieLabel: string;
  /** Farb-Schlüssel für Chip + linken Seitenrand (KAT_TONE). */
  toneKey: string;
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
  /** Für den aufklappbaren Verlauf: Lead-Daten bzw. Institutions-ID. */
  lead?: InboundLead;
  targetId?: string;
}

function KontakteView({
  inbound,
  outbound,
  token,
}: {
  inbound: InboundLead[];
  outbound: OutboundTarget[];
  token: string;
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
      toneKey:
        l.quelle === "recare"
          ? "recare"
          : l.status === "aufgenommen"
            ? "klient"
            : "kunde",
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
      lead: l,
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
      meta = `heute: ${kontaktArtLabel(t.letzte_kontakt_art) || "Kontakt"}${t.letzter_von ? ` — ${t.letzter_von}` : ""}`;
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
      meta = `zuletzt ${kontaktArtLabel(t.letzte_kontakt_art) || "Kontakt"} am ${formatIsoDate(t.letzter_besuch)}${t.letzter_von ? ` — ${t.letzter_von}` : ""}`;
    }
    karten.push({
      key: `t-${t.id}`,
      spalte,
      name: t.name,
      kategorieKey: t.kategorie,
      toneKey: t.kategorie,
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
      targetId: t.id,
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
                  <KanbanKarte key={k.key} k={k} token={token} />
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

/**
 * Erreichbarkeits-Log: ✓/✗-Vermerk je Anruf-Versuch bei der PDL — ändert
 * nichts am Lead, speist nur das PDL-Ranking im CRM-Admin (wo müssen wir
 * mit Schulung/Sensibilisierung nachbessern?).
 */
/**
 * Kebab-Menü oben rechts an der Lead-Karte: seltener genutzte Aktionen
 * (PDL-Erreichbarkeit vermerken, Patient abgelehnt), damit die Aktionszeile
 * unten in EINER Reihe bleibt. Schließt bei Klick nach außen.
 */
/**
 * Lead löschen — für Altlasten aus der Aufbauphase, die nie bearbeitet
 * wurden und die Liste zumüllen. Zwei Schritte, damit niemand versehentlich
 * einen echten Interessenten entfernt. Gelöscht wird nur der Status
 * ("geloescht"), die Zeile bleibt für die Auswertung erhalten.
 */
function LeadLoeschen({
  lead,
  onDelete,
}: {
  lead: InboundLead;
  onDelete: (l: InboundLead) => Promise<void>;
}) {
  const [nachfrage, setNachfrage] = useState(false);
  const [busy, setBusy] = useState(false);

  if (!nachfrage) {
    return (
      <Button
        type="button"
        size="sm"
        variant="ghost"
        title="Lead endgültig aus allen Listen entfernen — für alte Anfragen, die nie bearbeitet wurden."
        className="justify-start text-muted-foreground hover:bg-red-50 hover:text-red-700"
        // Menü offen halten, bis die Rückfrage beantwortet ist.
        onClick={(e) => {
          e.stopPropagation();
          setNachfrage(true);
        }}
      >
        <Trash2 className="size-3.5" /> Lead löschen
      </Button>
    );
  }

  return (
    <div
      className="flex flex-col gap-2 rounded-lg border border-red-200 bg-red-50/60 p-2.5"
      onClick={(e) => e.stopPropagation()}
    >
      <p className="text-xs font-semibold text-red-900">Diesen Lead löschen?</p>
      <p className="text-[11px] leading-snug text-red-800">
        Er verschwindet aus allen Listen. Rückgängig machen kannst du das nur
        über Chris.
      </p>
      <div className="flex flex-wrap gap-1.5">
        <Button
          type="button"
          size="sm"
          disabled={busy}
          className="bg-red-600 text-white hover:bg-red-700"
          onClick={async () => {
            setBusy(true);
            await onDelete(lead);
            setBusy(false);
          }}
        >
          {busy ? "Lösche…" : "Ja, löschen"}
        </Button>
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={busy}
          onClick={() => setNachfrage(false)}
        >
          Abbrechen
        </Button>
      </div>
    </div>
  );
}

function LeadKebab({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  return (
    <div ref={ref} className="relative shrink-0">
      <button
        type="button"
        aria-label="Weitere Aktionen"
        aria-expanded={open}
        onClick={() => setOpen((s) => !s)}
        className="flex size-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
      >
        <MoreVertical className="size-4" />
      </button>
      {open && (
        <div
          className="absolute top-8 right-0 z-20 flex w-64 flex-col gap-2 rounded-xl border bg-card p-3 shadow-lg"
          onClick={() => setOpen(false)}
        >
          {children}
        </div>
      )}
    </div>
  );
}

/**
 * Kontaktdaten einer Institution auf der Anruf-Karte: Telefon zum Wählen,
 * E-Mail, Ansprechpartner und Adresse — alles direkt korrigierbar, wenn die
 * hinterlegten Daten nicht stimmen (häufig bei importierten Listen).
 */
function KontaktDaten({
  target: t,
  token,
  canAct,
  onSaved,
}: {
  target: OutboundTarget;
  token: string;
  canAct: boolean;
  onSaved: (patch: Partial<OutboundTarget>) => void;
}) {
  // Bevorzugt der Eintrag mit Telefonnummer, sonst der erste.
  const haupt = t.personen.find((p) => p.telefon) ?? t.personen[0] ?? null;
  const [open, setOpen] = useState(false);
  const [telefon, setTelefon] = useState(haupt?.telefon ?? "");
  const [email, setEmail] = useState(haupt?.email ?? "");
  const [name, setName] = useState(haupt?.name ?? "");
  const [adresse, setAdresse] = useState(t.adresse ?? "");
  const [busy, setBusy] = useState(false);
  const [fehler, setFehler] = useState<string | null>(null);

  async function speichern() {
    setBusy(true);
    setFehler(null);
    try {
      const res = await teamAction(token, {
        action: "kontakt-daten",
        target_id: t.id,
        telefon,
        email,
        ansprechpartner: name,
        adresse,
      });
      onSaved({
        personen: (res.personen as OutboundTarget["personen"]) ?? t.personen,
        ...(res.adresse ? { adresse: String(res.adresse) } : {}),
      });
      setOpen(false);
    } catch (e) {
      setFehler(e instanceof Error ? e.message : "Fehler");
    } finally {
      setBusy(false);
    }
  }

  if (open) {
    return (
      <div className="flex flex-col gap-2 rounded-lg border bg-muted/30 p-3">
        <p className="text-xs font-semibold">Kontaktdaten korrigieren</p>
        <div className="grid gap-2 sm:grid-cols-2">
          <label className="flex flex-col gap-1 text-xs">
            <span className="font-medium">Telefon</span>
            <Input
              value={telefon}
              onChange={(e) => setTelefon(e.target.value)}
              placeholder="z. B. 02374 2400"
              className="bg-background"
            />
          </label>
          <label className="flex flex-col gap-1 text-xs">
            <span className="font-medium">E-Mail</span>
            <Input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="z. B. info@praxis.de"
              className="bg-background"
            />
          </label>
          <label className="flex flex-col gap-1 text-xs">
            <span className="font-medium">Ansprechpartner</span>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="z. B. Frau Meier, Sozialdienst"
              className="bg-background"
            />
          </label>
          <label className="flex flex-col gap-1 text-xs">
            <span className="font-medium">Adresse</span>
            <Input
              value={adresse}
              onChange={(e) => setAdresse(e.target.value)}
              placeholder="Straße, PLZ Ort"
              className="bg-background"
            />
          </label>
        </div>
        {fehler && <p className="text-xs text-destructive">{fehler}</p>}
        <div className="flex items-center gap-2">
          <Button type="button" size="sm" disabled={busy} onClick={speichern}>
            {busy ? "Speichert…" : "Speichern"}
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

  return (
    <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
      {haupt?.telefon ? (
        <a
          href={`tel:${haupt.telefon.replace(/\s/g, "")}`}
          className="flex items-center gap-1.5 font-medium text-primary hover:underline"
          title="Anrufen"
        >
          <Phone className="size-3.5" />
          {haupt.telefon}
        </a>
      ) : (
        <span className="flex items-center gap-1.5 text-muted-foreground">
          <Phone className="size-3.5" />
          keine Nummer hinterlegt
        </span>
      )}
      {haupt?.email && (
        <a
          href={`mailto:${haupt.email}`}
          className="flex items-center gap-1.5 font-medium text-primary hover:underline"
        >
          <Mail className="size-3.5" />
          {haupt.email}
        </a>
      )}
      {haupt?.name && haupt.name !== "Ansprechpartner" && (
        <span className="flex items-center gap-1.5 text-muted-foreground">
          <User className="size-3.5" />
          {haupt.name}
          {haupt.funktion && haupt.funktion !== haupt.name
            ? ` (${haupt.funktion})`
            : ""}
        </span>
      )}
      {canAct && (
        <button
          type="button"
          onClick={() => setOpen(true)}
          title="Stimmen die Daten nicht? Hier korrigieren."
          className="flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-xs font-medium text-muted-foreground hover:text-foreground"
        >
          <Pencil className="size-3" />
          {haupt?.telefon ? "ändern" : "eintragen"}
        </button>
      )}
    </p>
  );
}

/**
 * Bestätigungs-Fenster "Auftrag an PDL rausgeben?" — erscheint, wenn die KI
 * in der Anruf-Notiz einen Vor-Ort-Auftrag erkannt hat, oder manuell aus der
 * Erledigt-Liste. Der Text ist editierbar; erst mit Bestätigung geht der
 * Auftrag samt Anrufprotokoll an den Standort.
 */
function PdlAuftragDialog({
  token,
  targetId,
  targetName,
  hubName,
  vorschlag,
  anrufVon,
  ansprechpartner,
  anrufNotiz,
  onClose,
  onDone,
}: {
  token: string;
  targetId: string;
  targetName: string;
  hubName: string | null;
  vorschlag: string;
  anrufVon: string;
  ansprechpartner: string | null;
  anrufNotiz: string | null;
  onClose: () => void;
  onDone?: () => void;
}) {
  const [text, setText] = useState(vorschlag);
  const [busy, setBusy] = useState(false);
  const [fehler, setFehler] = useState<string | null>(null);

  async function senden() {
    if (!text.trim()) return;
    setBusy(true);
    setFehler(null);
    try {
      await teamAction(token, {
        action: "pdl-auftrag",
        target_id: targetId,
        text: text.trim(),
        ansprechpartner: ansprechpartner ?? "",
        anruf_notiz: anrufNotiz ?? "",
      });
      toast.success(
        hubName ? `Auftrag an ${hubName} rausgegeben` : "Auftrag angelegt",
      );
      onDone?.();
      onClose();
    } catch (e) {
      setFehler(e instanceof Error ? e.message : "Fehler");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={onClose}
    >
      <div
        className="flex w-full max-w-lg flex-col gap-3 rounded-xl border bg-card p-5 shadow-lg"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start gap-3">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <Send className="size-5" />
          </span>
          <div className="min-w-0">
            <h3 className="text-base font-semibold">
              Auftrag an PDL rausgeben?
            </h3>
            <p className="mt-0.5 text-sm text-muted-foreground">
              {hubName ? (
                <>
                  Geht an <b className="text-foreground">{hubName}</b> — die PDL
                  sieht den Auftrag samt Anrufprotokoll auf ihrer Standort-Seite.
                </>
              ) : (
                "Diesem Kontakt ist kein Standort zugeordnet — der Auftrag wird ohne Standort angelegt."
              )}
            </p>
          </div>
        </div>

        <label className="flex flex-col gap-1 text-sm">
          <span className="text-xs font-medium">Was soll die PDL tun?</span>
          <Textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={2}
            placeholder="z. B. Flyer vorbeibringen"
          />
        </label>

        {/* Protokoll, das die PDL mitbekommt */}
        <div className="rounded-lg border bg-muted/30 p-3 text-xs">
          <p className="font-medium">Die PDL sieht dazu:</p>
          <p className="mt-1 text-muted-foreground">
            {anrufVon} hat am {new Date().toLocaleDateString("de-DE")} bei{" "}
            <b className="text-foreground">{targetName}</b> angerufen
            {ansprechpartner ? ` (Ansprechpartner: ${ansprechpartner})` : ""}.
            {anrufNotiz ? ` Notiz: „${anrufNotiz}“` : ""}
          </p>
        </div>

        {fehler && <p className="text-sm text-destructive">{fehler}</p>}

        <div className="flex flex-wrap items-center justify-end gap-2">
          <Button type="button" variant="outline" size="sm" onClick={onClose}>
            Abbrechen
          </Button>
          <Button
            type="button"
            size="sm"
            disabled={busy || !text.trim()}
            onClick={senden}
          >
            <Send className="size-3.5" />
            {busy ? "Sende…" : "Auftrag rausgeben"}
          </Button>
        </div>
      </div>
    </div>
  );
}

/**
 * Zeile in "Erledigt": zeigt Name, Anrufer-Tag und Notiz — und lässt den
 * bereits geloggten Anruf nachbearbeiten (Notiz, Ansprechpartner,
 * Wiedervorlage). Aus der Notiz kann direkt ein Vor-Ort-Auftrag an die PDL
 * rausgehen.
 */
function ErledigtRow({
  target: t,
  token,
  canAct,
  memberName,
  onSaved,
}: {
  target: OutboundTarget;
  token: string;
  canAct: boolean;
  memberName: string;
  onSaved: (patch: Partial<OutboundTarget>) => void;
}) {
  const [open, setOpen] = useState(false);
  const [notiz, setNotiz] = useState(t.besuchs_notiz ?? "");
  const [ap, setAp] = useState(t.letzter_ansprechpartner ?? "");
  const [wieder, setWieder] = useState(t.naechster_besuch ?? "");
  const [busy, setBusy] = useState(false);
  const [fehler, setFehler] = useState<string | null>(null);
  const [auftragOffen, setAuftragOffen] = useState(false);

  async function speichern() {
    if (!t.letzter_log_id) {
      setFehler("Zu diesem Kontakt gibt es keinen Log-Eintrag zum Bearbeiten.");
      return;
    }
    setBusy(true);
    setFehler(null);
    try {
      const res = await teamAction(token, {
        action: "anruf-edit",
        contact_id: t.letzter_log_id,
        target_id: t.id,
        notiz,
        ansprechpartner: ap,
        wiedervorlage: wieder,
      });
      onSaved({
        besuchs_notiz: (res.notiz as string | null) ?? null,
        letzter_ansprechpartner: (res.ansprechpartner as string | null) ?? null,
        ...(res.naechster_besuch
          ? { naechster_besuch: String(res.naechster_besuch) }
          : {}),
      });
      setOpen(false);
    } catch (e) {
      setFehler(e instanceof Error ? e.message : "Fehler");
    } finally {
      setBusy(false);
    }
  }

  return (
    <li className="flex flex-col gap-2 px-4 py-2.5 text-sm">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-emerald-700">
          <Check className="size-3.5" />
        </span>
        <span className="font-medium">{t.name}</span>
        <LeadIdChip id={t.id} />
        {/* Wer hat telefoniert? */}
        {t.letzter_von && (
          <span
            className="flex shrink-0 items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary"
            title={`Anruf geloggt von ${t.letzter_von}`}
          >
            <User className="size-3" />
            {t.letzter_von}
          </span>
        )}
        {t.besuchs_notiz && !open && (
          <span
            className="max-w-72 truncate text-xs text-muted-foreground"
            title={t.besuchs_notiz}
          >
            „{t.besuchs_notiz}“
          </span>
        )}
        <span className="ml-auto flex items-center gap-2">
          <span className="text-xs text-muted-foreground">
            wieder dran ab {formatIsoDate(t.naechster_besuch)}
          </span>
          {canAct && (
            <button
              type="button"
              onClick={() => setOpen((s) => !s)}
              className="flex items-center gap-1 rounded-md border px-2 py-1 text-xs font-medium text-muted-foreground hover:text-foreground"
            >
              <Pencil className="size-3" />
              {open ? "Schließen" : "Bearbeiten"}
            </button>
          )}
        </span>
      </div>

      {open && (
        <div className="flex flex-col gap-2 rounded-lg border bg-muted/30 p-3">
          <div className="grid gap-2 sm:grid-cols-2">
            <label className="flex flex-col gap-1 text-xs">
              <span className="font-medium">Ansprechpartner</span>
              <Input
                value={ap}
                onChange={(e) => setAp(e.target.value)}
                placeholder="Wer war am Telefon?"
                className="bg-background"
              />
            </label>
            <label className="flex flex-col gap-1 text-xs">
              <span className="font-medium">Wieder dran ab</span>
              <Input
                type="date"
                value={wieder}
                onChange={(e) => setWieder(e.target.value)}
                className="bg-background"
              />
            </label>
          </div>
          <label className="flex flex-col gap-1 text-xs">
            <span className="font-medium">Notiz zum Anruf</span>
            <Textarea
              value={notiz}
              onChange={(e) => setNotiz(e.target.value)}
              rows={2}
              placeholder="Was wurde besprochen?"
              className="bg-background"
            />
          </label>
          {fehler && <p className="text-xs text-destructive">{fehler}</p>}
          <div className="flex flex-wrap items-center gap-2">
            <Button type="button" size="sm" disabled={busy} onClick={speichern}>
              {busy ? "Speichert…" : "Speichern"}
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => setAuftragOffen(true)}
            >
              <Send className="size-3.5" /> Auftrag an PDL
            </Button>
          </div>
        </div>
      )}

      {auftragOffen && (
        <PdlAuftragDialog
          token={token}
          targetId={t.id}
          targetName={t.name}
          hubName={t.hub}
          vorschlag={t.besuchs_notiz ?? ""}
          anrufVon={t.letzter_von ?? memberName}
          ansprechpartner={t.letzter_ansprechpartner}
          anrufNotiz={t.besuchs_notiz}
          onClose={() => setAuftragOffen(false)}
        />
      )}
    </li>
  );
}

function PdlVersuchButtons({ lead, token }: { lead: InboundLead; token: string }) {
  const hubId = lead.zugewiesen_hub_id ?? lead.vorschlag_hub_id;
  const pdl = lead.zugewiesen_pdl ?? lead.vorschlag_pdl;
  const [meldung, setMeldung] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  if (!hubId) return null;

  async function log(erreicht: boolean) {
    setBusy(true);
    try {
      await teamAction(token, {
        action: "pdl-versuch",
        kind: lead.kind,
        id: lead.id,
        hub_id: hubId,
        erreicht,
      });
      setMeldung(erreicht ? "✓ vermerkt" : "✗ vermerkt");
      setTimeout(() => setMeldung(null), 2500);
    } catch (e) {
      setMeldung(e instanceof Error ? e.message : "Fehler");
    } finally {
      setBusy(false);
    }
  }

  return (
    <span
      className="flex flex-wrap items-center gap-1.5"
      title={`Jeden Anruf-Versuch bei ${pdl ? `PDL ${pdl}` : "der PDL"} hier vermerken — fürs Erreichbarkeits-Ranking im CRM-Admin. Ändert nichts am Lead.`}
    >
      <span className="basis-full text-[11px] font-medium text-muted-foreground">
        PDL angerufen?
      </span>
      <button
        type="button"
        disabled={busy}
        onClick={() => log(true)}
        className="rounded-full border border-emerald-300 bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-800 hover:bg-emerald-100"
      >
        ✓ erreicht
      </button>
      <button
        type="button"
        disabled={busy}
        onClick={() => log(false)}
        className="rounded-full border border-red-200 bg-red-50 px-2 py-0.5 text-[11px] font-semibold text-red-700 hover:bg-red-100"
      >
        ✗ nicht erreicht
      </button>
      {meldung && (
        <span className="text-[11px] text-muted-foreground">{meldung}</span>
      )}
    </span>
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
    // contents: der Wrapper verschwindet aus dem Layout, damit Notiz-Text
    // und Button direkt im Eltern-Flex liegen und der Button sich neben das
    // To-do-Element setzt.
    return (
      <div className="contents">
        {lead.notiz ? (
          <p className="basis-full text-sm whitespace-pre-line text-foreground/85">
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
    // basis-full: das Bearbeiten-Formular bekommt im Eltern-Flex eine
    // eigene volle Zeile.
    <div className="flex basis-full flex-col gap-1.5">
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
 * "Ungültig" — für Leads, die offensichtlich unbrauchbar sind: Fake-Namen,
 * Spam, Unsinns-Adressen, Test-Eintraege.
 *
 * Bewusst getrennt von "Verloren": Verloren heisst "echter Interessent, den
 * wir nicht gewonnen haben" und gehoert in die Conversion-Rate. Ein Fake-Lead
 * war nie ein Interessent — laeuft er als "verloren" mit, sieht die Quote
 * schlechter aus als die Arbeit war.
 *
 * Der gespeicherte Text enthaelt deshalb "kein Neuinteressent"; genau darauf
 * prueft kategorieAusErgebnis() in src/lib/callcenter.ts und nimmt den Lead
 * aus der Interessenten-Auswertung. Bei Agentur-Leads wird zusaetzlich das
 * Melde-Datum vermerkt — dieselbe Konvention wie bei "Nicht im
 * Einzugsbereich", damit der Lead in den Agentur-Rueckweisungen auftaucht
 * und nicht berechnet wird.
 */
function UngueltigButton({
  quelle,
  onSave,
}: {
  quelle: string;
  onSave: (grund: string) => void;
}) {
  const [confirm, setConfirm] = useState(false);
  const istAgentur = quelle === "agentur";

  function speichern(art: string) {
    // "kein Neuinteressent" ist der Schluessel fuer die Auswertung.
    const basis = `kein Neuinteressent — ungültig: ${art}`;
    onSave(
      istAgentur
        ? `${basis} (gemeldet ${new Date().toLocaleDateString("de-DE")})`
        : basis,
    );
  }

  if (!confirm) {
    return (
      <Button
        type="button"
        size="sm"
        variant="ghost"
        className="text-muted-foreground hover:text-red-700"
        title={
          istAgentur
            ? "Offensichtlich unbrauchbarer Lead (Fake-Daten, Spam). Zaehlt nicht als verlorener Interessent und wird der Agentur gemeldet."
            : "Offensichtlich unbrauchbarer Lead (Fake-Daten, Spam). Zaehlt nicht als verlorener Interessent."
        }
        onClick={() => setConfirm(true)}
      >
        <Ban className="size-3.5" /> Ungültig
      </Button>
    );
  }

  return (
    <div className="flex w-full flex-col gap-1.5 rounded-lg border bg-muted/30 p-2.5">
      <p className="text-xs font-medium text-muted-foreground">
        Warum ungültig?{" "}
        <span className="font-normal">
          Zählt nicht als verlorener Interessent
          {istAgentur ? " und wird der Agentur gemeldet" : ""}.
        </span>
      </p>
      <div className="flex flex-wrap items-center gap-1.5">
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={() => speichern("Fake-/Spam-Daten")}
        >
          <Ban className="size-3.5" /> Fake / Spam
        </Button>
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={() => speichern("Test-/Doppel-Eintrag")}
        >
          <Copy className="size-3.5" /> Test / Doppelt
        </Button>
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={() => speichern("kein Anliegen erkennbar")}
        >
          <X className="size-3.5" /> Kein Anliegen
        </Button>
        <Button
          type="button"
          size="sm"
          variant="ghost"
          className="ml-auto text-muted-foreground"
          onClick={() => setConfirm(false)}
        >
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
          variant="outline"
          title="Der Interessent wird bereits von einem anderen Pflegedienst versorgt — echter Bedarf, aber an den Wettbewerb verloren."
          onClick={() => onSave("Anderer Pflegedienst übernimmt")}
        >
          <Building2 className="size-3.5" /> Anderer Pflegedienst
        </Button>
        <Button
          type="button"
          size="sm"
          variant="outline"
          title="Keine oder falsche Telefonnummer/Adresse — der Lead ist nicht erreichbar. Bei Agentur-Leads Grundlage der Reklamation."
          onClick={() => onSave("Kontaktdaten fehlen / falsch")}
        >
          <PhoneOff className="size-3.5" /> Kontaktdaten fehlen / falsch
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
        <Check className="size-3.5" /> Interesse + Beratungstermin
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
 * Gründe, aus denen wir eine Recare-Anfrage bewusst NICHT annehmen —
 * obwohl wir könnten. Feste Auswahl statt Freitext, damit im CRM-Admin
 * auszählbar ist, welche Anfragen sich für uns nicht rechnen.
 */
const RECARE_UNINTERESSANT_GRUENDE = [
  "Behandlungsdauer zu kurz",
  "Leistungen unattraktiv",
  "Aufwand zu hoch",
  "Fahrtweg zu weit",
  "Vergütung zu niedrig",
  "Versorgung passt nicht zu uns",
] as const;

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
  // Eigene Auswahl für "Lead nicht interessant" — bewusst getrennt von
  // "Keine Kapazität": hier könnten wir versorgen, wollen aber nicht.
  const [uninteressantOpen, setUninteressantOpen] = useState(false);
  const [grund, setGrund] = useState("");
  const [grundNotiz, setGrundNotiz] = useState("");
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

  // contents: die Buttons liegen direkt in der Aktionszeile der Karte,
  // damit alles in EINER Reihe steht (wie im Referenz-Layout).
  return (
    <div className="contents">
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
        variant="outline"
        disabled={busy}
        title="Wir könnten versorgen, wollen die Anfrage aber nicht annehmen (z. B. Aufwand lohnt nicht). Grund bitte angeben — daraus sehen wir, welche Recare-Anfragen sich für uns nicht rechnen."
        className="border-amber-300 text-amber-800 hover:bg-amber-50 hover:text-amber-800"
        onClick={() => {
          setUninteressantOpen((s) => !s);
          setFreitextOpen(false);
        }}
      >
        <ThumbsDown className="size-3.5" /> Lead nicht interessant
      </Button>
      <Button
        type="button"
        size="sm"
        variant="ghost"
        disabled={busy}
        className="text-muted-foreground"
        onClick={() => {
          setFreitextOpen((s) => !s);
          setUninteressantOpen(false);
        }}
      >
        Anderes…
      </Button>
      {uninteressantOpen && (
        <div className="flex basis-full flex-col gap-2 rounded-lg border border-amber-300 bg-amber-50/50 p-3">
          <p className="text-xs font-semibold text-amber-900">
            Warum ist die Anfrage für uns nicht interessant?
          </p>
          <div className="flex flex-wrap gap-1.5">
            {RECARE_UNINTERESSANT_GRUENDE.map((g) => (
              <button
                key={g}
                type="button"
                onClick={() => setGrund(grund === g ? "" : g)}
                className={cn(
                  "rounded-full border px-2.5 py-1 text-xs font-medium",
                  grund === g
                    ? "border-amber-500 bg-amber-500 text-white"
                    : "border-amber-300 bg-background text-amber-900 hover:bg-amber-100",
                )}
              >
                {g}
              </button>
            ))}
          </div>
          <Input
            value={grundNotiz}
            onChange={(e) => setGrundNotiz(e.target.value)}
            placeholder="Optional: Details ergänzen"
            className="bg-background"
          />
          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              size="sm"
              disabled={busy || (!grund && !grundNotiz.trim())}
              onClick={() =>
                set(
                  `nicht interessant — ${[grund, grundNotiz.trim()].filter(Boolean).join(" · ")}`,
                  "verloren",
                )
              }
            >
              {busy ? "Speichere…" : "Als nicht interessant schließen"}
            </Button>
            {!grund && !grundNotiz.trim() && (
              <span className="text-[11px] text-amber-800">
                Bitte einen Grund wählen oder eintragen.
              </span>
            )}
          </div>
        </div>
      )}
      {freitextOpen && (
        <div className="flex basis-full flex-col gap-1.5">
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
      {error && (
        <p className="basis-full text-xs text-destructive">{error}</p>
      )}
    </div>
  );
}



/**
 * PDL-Register in der schmalen linken Spalte der Recare-Ansicht. Beim
 * Abarbeiten der Anfragen ruft man staendig Standorte an — die Nummer soll
 * ohne Seitenwechsel danebenstehen. Kompakt gehalten (300px Spalte),
 * scrollt bei vielen Standorten intern.
 */
function PdlRegister({
  eintraege,
}: {
  eintraege: {
    name: string;
    pdl: string | null;
    telefon: string | null;
    email: string | null;
  }[];
}) {
  const [suche, setSuche] = useState("");
  const q = suche.trim().toLowerCase();
  const gefiltert = q
    ? eintraege.filter((e) =>
        [e.name, e.pdl].filter(Boolean).join(" ").toLowerCase().includes(q),
      )
    : eintraege;

  return (
    <div className="flex flex-col gap-2 rounded-xl border bg-card p-4 shadow-sm">
      <p className="flex items-center gap-1.5 text-sm font-semibold">
        <Users className="size-4 text-primary" />
        PDL-Register
      </p>
      <p className="-mt-1 text-xs text-muted-foreground">
        Nummer antippen zum Anrufen — {eintraege.length} Standorte.
      </p>
      <Input
        value={suche}
        onChange={(e) => setSuche(e.target.value)}
        placeholder="Standort oder PDL suchen…"
        className="h-9 bg-background"
      />
      <ul className="flex max-h-[32rem] flex-col divide-y overflow-y-auto">
        {gefiltert.map((e) => (
          <li key={e.name} className="py-2">
            <p className="truncate text-sm font-medium" title={e.name}>
              {e.name}
            </p>
            <p className="truncate text-xs text-muted-foreground">
              {e.pdl ? `PDL ${e.pdl}` : "keine PDL hinterlegt"}
            </p>
            <p className="mt-1 flex flex-col gap-0.5">
              {e.telefon ? (
                <a
                  href={`tel:${e.telefon.replace(/\s/g, "")}`}
                  className="flex items-center gap-1.5 text-xs font-medium text-primary hover:underline"
                >
                  <Phone className="size-3 shrink-0" />
                  {e.telefon}
                </a>
              ) : (
                <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <Phone className="size-3 shrink-0" />
                  keine Nummer
                </span>
              )}
              {e.email && (
                <a
                  href={`mailto:${e.email}`}
                  title={e.email}
                  className="flex items-center gap-1.5 truncate text-xs text-primary hover:underline"
                >
                  <Mail className="size-3 shrink-0" />
                  <span className="truncate">{e.email}</span>
                </a>
              )}
            </p>
          </li>
        ))}
        {gefiltert.length === 0 && (
          <li className="py-2 text-xs text-muted-foreground">
            Kein Standort gefunden.
          </li>
        )}
      </ul>
    </div>
  );
}

/**
 * Nachschlage-Liste aller Standorte mit PDL-Kontakt, direkt auf der
 * Team-Seite. Die Team-Seiten laufen ohne Sidebar — ohne diese Liste
 * käme man von hier gar nicht an die Telefonnummern.
 */
function PdlKontaktliste({
  eintraege,
}: {
  eintraege: {
    name: string;
    pdl: string | null;
    telefon: string | null;
    email: string | null;
  }[];
}) {
  const [suche, setSuche] = useState("");
  const q = suche.trim().toLowerCase();
  const gefiltert = q
    ? eintraege.filter((e) =>
        [e.name, e.pdl, e.telefon].filter(Boolean).join(" ").toLowerCase().includes(q),
      )
    : eintraege;

  return (
    <details className="group rounded-xl border bg-card shadow-sm">
      <summary className="flex cursor-pointer list-none items-center gap-2 p-4 select-none">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
          <Users className="size-4.5" />
        </span>
        <span className="min-w-0">
          <span className="block text-sm font-semibold">
            Alle Standorte &amp; PDL-Nummern ({eintraege.length})
          </span>
          <span className="block text-xs text-muted-foreground">
            Nummer antippen zum Anrufen — immer aktuell
          </span>
        </span>
        <span className="ml-auto text-xs font-medium text-primary group-open:hidden">
          aufklappen
        </span>
      </summary>
      <div className="flex flex-col gap-3 border-t p-4">
        <Input
          value={suche}
          onChange={(e) => setSuche(e.target.value)}
          placeholder="Standort oder PDL-Name suchen…"
          className="bg-background"
        />
        <ul className="grid gap-2 sm:grid-cols-2">
          {gefiltert.map((e) => (
            <li key={e.name} className="rounded-lg border bg-background p-3 text-sm">
              <p className="font-semibold">{e.name}</p>
              <p className="text-xs text-muted-foreground">
                {e.pdl ? `PDL ${e.pdl}` : "keine PDL hinterlegt"}
              </p>
              <p className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1">
                {e.telefon ? (
                  <a
                    href={`tel:${e.telefon.replace(/\s/g, "")}`}
                    className="flex items-center gap-1.5 font-medium text-primary hover:underline"
                  >
                    <Phone className="size-3.5" />
                    {e.telefon}
                  </a>
                ) : (
                  <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <Phone className="size-3.5" />
                    keine Nummer hinterlegt
                  </span>
                )}
                {e.email && (
                  <a
                    href={`mailto:${e.email}`}
                    className="flex items-center gap-1.5 truncate text-xs text-primary hover:underline"
                    title={e.email}
                  >
                    <Mail className="size-3.5 shrink-0" />
                    <span className="truncate">{e.email}</span>
                  </a>
                )}
              </p>
            </li>
          ))}
        </ul>
        {gefiltert.length === 0 && (
          <p className="text-sm text-muted-foreground">Kein Standort gefunden.</p>
        )}
      </div>
    </details>
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
  canAct = true,
  onLogged,
}: {
  target: OutboundTarget;
  index: number;
  today: string;
  token: string;
  memberName: string;
  isDue: boolean;
  /** Nur-Lese-Ansicht (Monitor) blendet Bearbeiten-Aktionen aus. */
  canAct?: boolean;
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
  /** KI-Vorschlag für einen Vor-Ort-Auftrag — öffnet den Bestätigungs-Dialog. */
  const [auftragVorschlag, setAuftragVorschlag] = useState<string | null>(null);

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
        // Direkt mitgeben, sonst fehlt der Name bis zum nächsten Reload.
        letzter_von: memberName,
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
      // Hat die KI einen Vor-Ort-Auftrag erkannt? Dann zur Bestätigung
      // vorlegen — angelegt wird er erst nach Klick des MA.
      const vorschlag = res.pdl_auftrag_vorschlag;
      if (typeof vorschlag === "string" && vorschlag.trim()) {
        setAuftragVorschlag(vorschlag.trim());
      }
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
          {/* Kontaktdaten der Institution — direkt wählbar und korrigierbar */}
          <KontaktDaten
            target={t}
            token={token}
            canAct={canAct}
            onSaved={onLogged}
          />
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
              ? `Zuletzt: ${kontaktArtLabel(t.letzte_kontakt_art) || "Kontakt"} am ${formatIsoDate(t.letzter_besuch)}${t.letzter_von ? ` von ${t.letzter_von}` : ""}${t.besuchs_notiz ? ` — „${t.besuchs_notiz}“` : ""} · wieder dran ab ${formatIsoDate(t.naechster_besuch)}`
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

      {/* KI hat einen Vor-Ort-Auftrag erkannt — MA bestätigt ihn */}
      {auftragVorschlag && (
        <PdlAuftragDialog
          token={token}
          targetId={t.id}
          targetName={t.name}
          hubName={t.hub}
          vorschlag={auftragVorschlag}
          anrufVon={memberName}
          ansprechpartner={ansprechpartner || null}
          anrufNotiz={notiz || null}
          onClose={() => setAuftragVorschlag(null)}
        />
      )}
    </li>
  );
}



/** Anruf-Log-Zeile fürs Outbound-Cockpit (aus buildTeamAnrufe). */
interface AnrufLog {
  datum: string;
  erreicht: boolean;
  bearbeiter: string | null;
}

/**
 * KPI-Zeile der Outbound-Ansicht: Tagesziel als Donut (geloggte Anrufe vs.
 * noch fällige), Gesprächsquote und Zähler — alles aus dem echten Anruf-Log.
 */
function OutboundKpis({
  anrufe,
  faellig,
  today,
}: {
  anrufe: AnrufLog[];
  faellig: number;
  today: string;
}) {
  const heute = anrufe.filter((a) => a.datum === today);
  const erreicht = heute.filter((a) => a.erreicht).length;
  const nicht = heute.length - erreicht;
  const ziel = heute.length + faellig;
  const anteil = ziel > 0 ? heute.length / ziel : 0;
  const R = 30;
  const C = 2 * Math.PI * R;
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-5">
      {/* Tagesziel-Donut */}
      <div className="col-span-2 flex items-center gap-3 rounded-xl border bg-card p-4 shadow-sm sm:col-span-1">
        <svg viewBox="0 0 80 80" className="size-16 shrink-0 -rotate-90">
          <circle cx={40} cy={40} r={R} fill="none" strokeWidth={10} className="stroke-muted" />
          <circle
            cx={40}
            cy={40}
            r={R}
            fill="none"
            strokeWidth={10}
            strokeLinecap="round"
            strokeDasharray={`${C * anteil} ${C}`}
            className="stroke-primary"
          />
        </svg>
        <div className="min-w-0">
          <p className="text-xs text-muted-foreground">Heutiges Ziel</p>
          <p className="text-xl leading-tight font-bold tabular-nums">
            {heute.length} / {ziel}
          </p>
          <p className="text-[11px] text-muted-foreground">
            {Math.round(anteil * 100)} % Tagesziel erreicht
          </p>
        </div>
      </div>
      <StatTile
        icon={Check}
        tone="green"
        coloredValue
        label="Gesprächsquote"
        value={heute.length > 0 ? `${Math.round((erreicht / heute.length) * 100)} %` : "—"}
        sub={`${erreicht} Gespräch${erreicht === 1 ? "" : "e"} heute`}
      />
      <StatTile
        icon={PhoneCall}
        tone="purple"
        label="Anrufe heute"
        value={String(heute.length)}
        sub="geloggt (beide Ausgänge)"
      />
      <StatTile
        icon={X}
        tone="red"
        label="Nicht erreicht"
        value={String(nicht)}
        sub="morgen automatisch wieder fällig"
      />
      <StatTile
        icon={Inbox}
        tone="blue"
        label="Offen in der Liste"
        value={String(faellig)}
        sub="heute fällig (inkl. überfällig)"
      />
    </div>
  );
}

/**
 * Verbindlicher Gesprächsleitfaden für Outbound-Anrufe (Kliniken, Praxen,
 * Apotheken). Wortlaut in `saetze` ist zum Ablesen gedacht, `hinweis`
 * erklärt das Vorgehen. Platzhalter in eckigen Klammern selbst füllen.
 */
const GESPRAECHSLEITFADEN: {
  titel: string;
  saetze: string[];
  hinweis?: string;
}[] = [
  {
    titel: "Begrüßung & richtige Stelle",
    saetze: [
      "Guten Tag, mein Name ist [Name] von der Pflegeunion, einem ambulanten Pflegedienst in [Region]. Spreche ich mit dem Entlassmanagement / Sozialdienst?",
      "Könnten Sie mich bitte mit dem Case Management verbinden?",
    ],
    hinweis:
      "Zweiter Satz nur, falls nein. Namen der Person notieren — gehört ins Anruf-Formular unter „Ansprechpartner“.",
  },
  {
    titel: "Kennen Sie uns schon?",
    saetze: [
      "Darf ich kurz fragen – ist Ihnen die Pflegeunion bereits ein Begriff?",
    ],
    hinweis:
      "Wenn ja: kurz halten, direkt zum Grund. Wenn nein: in einem Satz einordnen.",
  },
  {
    titel: "Grund des Anrufs",
    saetze: [
      "Ich rufe aus zwei Gründen an: Zum einen möchte ich Ihnen unsere aktuell freien Kapazitäten melden, zum anderen eine Erweiterung unseres Leistungsangebots.",
    ],
  },
  {
    titel: "Was uns auszeichnet",
    saetze: [
      "Die Pflegeunion hat ein sehr breites Leistungsspektrum – von Alltagshilfe über Grund- und Behandlungspflege bis hin zur Intensivpflege, dazu Physiotherapie, Ergotherapie und Logopädie sowie Pflegehilfsmittel. Wir begleiten unsere Patientinnen und Patienten ganzheitlich aus einer Hand.",
    ],
    hinweis:
      "Kurz ergänzen: kurzfristige Aufnahmen möglich, verlässliche Rückmeldung, Gebiet [PLZ/Region].",
  },
  {
    titel: "Ziel: nächster Schritt",
    saetze: [
      "Damit Sie uns im passenden Fall parat haben – was wäre Ihnen am liebsten: ich schicke Ihnen kurz eine E-Mail mit unserem Leistungsprofil, unsere Pflegedienstleitung kommt persönlich vorbei und stellt sich Ihnen vor, oder wir bringen Ihnen Infomaterial/Flyer vorbei?",
    ],
    hinweis:
      "Abschluss sichern: E-Mail-Adresse notieren, Termin festhalten oder richtigen Ansprechpartner + Durchwahl erfragen. Ergebnis unten ins Anruf-Formular eintragen.",
  },
  {
    titel: "Neutralität anerkennen",
    saetze: [
      "Die Wahl bleibt selbstverständlich bei der Patientin – wir möchten nur als verfügbare Option auf Ihrem Radar sein.",
    ],
    hinweis: "Wichtig bei Kliniken.",
  },
  {
    titel: "Abschluss",
    saetze: [
      "Vielen Dank für Ihre Zeit! Ich fasse zusammen: [nächster Schritt]. Das schicke ich Ihnen noch heute. Einen schönen Tag!",
    ],
  },
];

/**
 * Rechte Spalte der Outbound-Ansicht: Gesprächsleitfaden, persönliche
 * Schnell-Notiz (bleibt im Browser), Tipp des Tages und Wochen-Performance.
 */
function OutboundSidebar({ anrufe, today }: { anrufe: AnrufLog[]; today: string }) {
  const [notiz, setNotiz] = useState("");
  const [gespeichert, setGespeichert] = useState(false);
  useEffect(() => {
    const saved = window.localStorage?.getItem("outbound-schnellnotiz");
    // eslint-disable-next-line react-hooks/set-state-in-effect -- einmalige Hydration aus localStorage
    if (saved) setNotiz(saved);
  }, []);

  const woche = anrufe.length;
  const erreichtWoche = anrufe.filter((a) => a.erreicht).length;
  const quote = woche > 0 ? Math.round((erreichtWoche / woche) * 100) : 0;
  const heuteN = anrufe.filter((a) => a.datum === today).length;

  return (
    <aside className="flex flex-col gap-3 lg:sticky lg:top-4">
      {/* Gesprächsleitfaden — Wortlaut aufklappbar, damit man ihn beim
          Telefonieren ablesen kann. Schritt 1 ist standardmäßig offen. */}
      <div className="flex flex-col gap-2 rounded-xl border bg-card p-4 shadow-sm">
        <p className="flex items-center gap-1.5 text-sm font-semibold">
          <Headset className="size-4 text-primary" />
          Gesprächsleitfaden
        </p>
        <p className="-mt-1 text-[11px] text-muted-foreground">
          Schritt antippen zum Aufklappen — Wortlaut zum Ablesen.
        </p>
        <ol className="flex flex-col gap-1.5">
          {GESPRAECHSLEITFADEN.map((s, i) => (
            <li key={s.titel}>
              <details
                open={i === 0}
                className="group rounded-lg border bg-background/60"
              >
                <summary className="flex cursor-pointer list-none items-start gap-2 p-2 select-none">
                  <span className="mt-0.5 flex size-4.5 shrink-0 items-center justify-center rounded-full bg-primary/10 text-[10px] font-bold text-primary">
                    {i + 1}
                  </span>
                  <span className="min-w-0 flex-1 text-xs font-medium">
                    {s.titel}
                  </span>
                  <ChevronDown className="mt-0.5 size-3.5 shrink-0 text-muted-foreground transition-transform group-open:rotate-180" />
                </summary>
                <div className="flex flex-col gap-1.5 border-t px-2 py-2 text-[11px] leading-relaxed">
                  {s.saetze.map((satz, n) => (
                    <p
                      key={n}
                      className="rounded border-l-2 border-primary/30 bg-primary/[0.04] py-1 pl-2 text-foreground italic"
                    >
                      „{satz}&ldquo;
                    </p>
                  ))}
                  {s.hinweis && (
                    <p className="text-muted-foreground">{s.hinweis}</p>
                  )}
                </div>
              </details>
            </li>
          ))}
        </ol>
      </div>

      {/* Schnell-Notiz (persönlich, bleibt im Browser) */}
      <div className="flex flex-col gap-2 rounded-xl border bg-card p-4 shadow-sm">
        <p className="flex items-center gap-1.5 text-sm font-semibold">
          <Pencil className="size-4 text-primary" />
          Schnell-Notiz
        </p>
        <Textarea
          value={notiz}
          onChange={(e) => {
            setNotiz(e.target.value);
            setGespeichert(false);
          }}
          rows={3}
          placeholder="Notiz nach dem Anruf schnell erfassen…"
        />
        <Button
          type="button"
          size="sm"
          className="w-full"
          onClick={() => {
            window.localStorage?.setItem("outbound-schnellnotiz", notiz);
            setGespeichert(true);
            setTimeout(() => setGespeichert(false), 2000);
          }}
        >
          {gespeichert ? "Gespeichert ✓" : "Speichern"}
        </Button>
        <p className="text-[10px] text-muted-foreground">
          Nur für dich — bleibt in diesem Browser. Ergebnisse zum Kontakt
          bitte übers Anruf-Formular loggen.
        </p>
      </div>

      {/* Tipp des Tages */}
      <div className="rounded-xl border border-primary/20 bg-primary/[0.05] p-4 text-xs">
        <p className="mb-1 flex items-center gap-1.5 text-sm font-semibold">
          💡 Tipp des Tages
        </p>
        <p className="text-muted-foreground">
          Die besten Zeiten für Anrufe sind zwischen{" "}
          <span className="font-semibold text-foreground">09:00–11:30 Uhr</span>{" "}
          und <span className="font-semibold text-foreground">14:00–16:00 Uhr</span>.
        </p>
      </div>

      {/* Team-Performance der letzten 7 Tage */}
      <div className="flex flex-col gap-2 rounded-xl border bg-card p-4 shadow-sm">
        <p className="text-sm font-semibold">Team-Performance</p>
        <p className="-mt-1 text-[10px] text-muted-foreground">letzte 7 Tage</p>
        <div className="flex flex-col gap-2 text-xs">
          <div>
            <div className="flex justify-between">
              <span>Anrufe</span>
              <span className="font-semibold tabular-nums">
                {woche} <span className="font-normal text-muted-foreground">({heuteN} heute)</span>
              </span>
            </div>
          </div>
          <div>
            <div className="flex justify-between">
              <span>Gespräche (erreicht)</span>
              <span className="font-semibold tabular-nums">
                {erreichtWoche} · {quote} %
              </span>
            </div>
            <div className="mt-1 h-2 overflow-hidden rounded-full bg-muted">
              <div
                className="h-full rounded-full bg-emerald-500"
                style={{ width: `${quote}%` }}
              />
            </div>
          </div>
        </div>
      </div>
    </aside>
  );
}

/**
 * Kanban-Kontaktkarte mit aufklappbarem Verlauf: wann war der letzte
 * Kontakt, was wurde gesagt, von wem — bei Institutionen aus dem
 * Kontakt-Log (on demand geladen), bei Klienten aus dem Lead selbst.
 */
/**
 * Detail-Fenster einer Kontakt-Karte: Kontaktdaten bearbeiten, Kontakt
 * loggen und den bisherigen Verlauf sehen. Für Institutionen (targetId);
 * bei Lead-Karten steht nur der Verlauf zur Verfügung.
 */
function KontaktDetail({
  k,
  token,
  onClose,
}: {
  k: KontaktKarte;
  token: string;
  onClose: () => void;
}) {
  const [tab, setTab] = useState<"log" | "daten">("log");
  // Kontakt loggen
  const [art, setArt] = useState("anruf");
  const [ap, setAp] = useState("");
  const [notiz, setNotiz] = useState("");
  const [wieder, setWieder] = useState("");
  // Stammdaten
  const [telefon, setTelefon] = useState(k.telefon ?? "");
  const [email, setEmail] = useState("");
  const [apName, setApName] = useState("");
  const [busy, setBusy] = useState(false);
  const [fehler, setFehler] = useState<string | null>(null);
  const [erfolg, setErfolg] = useState<string | null>(null);
  const tone = KAT_TONE[k.toneKey] ?? KAT_TONE.sonstiges;

  async function loggen() {
    if (!k.targetId) return;
    setBusy(true);
    setFehler(null);
    try {
      await teamAction(token, {
        action: "kontakt-log",
        target_id: k.targetId,
        quelle: art,
        ansprechpartner: ap,
        notiz,
        wiedervorlage: wieder,
      });
      setErfolg("Kontakt geloggt — erscheint nach dem Neuladen im Verlauf.");
      setNotiz("");
      setAp("");
      setWieder("");
    } catch (e) {
      setFehler(e instanceof Error ? e.message : "Fehler");
    } finally {
      setBusy(false);
    }
  }

  async function datenSpeichern() {
    if (!k.targetId) return;
    setBusy(true);
    setFehler(null);
    try {
      await teamAction(token, {
        action: "kontakt-daten",
        target_id: k.targetId,
        telefon,
        email,
        ansprechpartner: apName,
      });
      setErfolg("Kontaktdaten gespeichert.");
    } catch (e) {
      setFehler(e instanceof Error ? e.message : "Fehler");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 p-4 py-10"
      onClick={onClose}
    >
      <div
        className="flex w-full max-w-2xl flex-col gap-4 rounded-xl border bg-card p-5 shadow-lg"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Kopf */}
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h3 className="flex flex-wrap items-center gap-2 text-lg font-bold tracking-tight">
              {k.name}
              <span
                className={cn(
                  "rounded-full px-2 py-0.5 text-[11px] font-semibold",
                  tone.chip,
                )}
              >
                {k.kategorieLabel}
              </span>
            </h3>
            {k.info && (
              <p className="mt-0.5 text-sm text-muted-foreground">{k.info}</p>
            )}
            {k.meta && (
              <p className={cn("mt-0.5 text-xs", k.metaTone ?? "text-muted-foreground")}>
                {k.meta}
              </p>
            )}
          </div>
          <div className="flex shrink-0 items-center gap-2">
            {k.telefon && (
              <a
                href={`tel:${k.telefon}`}
                className="flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:bg-primary/90"
              >
                <Phone className="size-4" /> Anrufen
              </a>
            )}
            <button
              type="button"
              onClick={onClose}
              aria-label="Schließen"
              className="flex size-8 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
            >
              <X className="size-4" />
            </button>
          </div>
        </div>

        {k.targetId ? (
          <>
            {/* Reiter */}
            <div className="flex gap-1 rounded-lg border bg-muted/40 p-1">
              {(
                [
                  { key: "log", label: "Kontakt loggen" },
                  { key: "daten", label: "Kontaktdaten bearbeiten" },
                ] as const
              ).map((t) => (
                <button
                  key={t.key}
                  type="button"
                  onClick={() => {
                    setTab(t.key);
                    setErfolg(null);
                  }}
                  className={cn(
                    "flex-1 rounded-md px-3 py-1.5 text-sm font-medium",
                    tab === t.key
                      ? "bg-card shadow-sm"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  {t.label}
                </button>
              ))}
            </div>

            {tab === "log" ? (
              <div className="flex flex-col gap-3">
                <div className="grid gap-3 sm:grid-cols-2">
                  <label className="flex flex-col gap-1 text-xs">
                    <span className="font-medium">Was war es?</span>
                    <select
                      value={art}
                      onChange={(e) => setArt(e.target.value)}
                      className={cn(SELECT_CLASS, "h-10 bg-background")}
                    >
                      <option value="anruf">Anruf</option>
                      <option value="besuch">Persönlicher Besuch</option>
                      <option value="flyer">Flyer ausgelegt</option>
                      <option value="box">CM-Box geliefert</option>
                    </select>
                  </label>
                  <label className="flex flex-col gap-1 text-xs">
                    <span className="font-medium">Ansprechpartner</span>
                    <Input
                      value={ap}
                      onChange={(e) => setAp(e.target.value)}
                      placeholder="Mit wem gesprochen?"
                      className="h-10 bg-background"
                    />
                  </label>
                </div>
                <label className="flex flex-col gap-1 text-xs">
                  <span className="font-medium">Notiz</span>
                  <Textarea
                    value={notiz}
                    onChange={(e) => setNotiz(e.target.value)}
                    rows={3}
                    placeholder="Was wurde besprochen?"
                    className="bg-background"
                  />
                </label>
                <label className="flex w-fit flex-col gap-1 text-xs">
                  <span className="font-medium">
                    Wiedervorlage am (optional)
                  </span>
                  <Input
                    type="date"
                    value={wieder}
                    onChange={(e) => setWieder(e.target.value)}
                    className="h-10 bg-background"
                  />
                </label>
                <Button
                  type="button"
                  className="self-start"
                  disabled={busy}
                  onClick={loggen}
                >
                  <Check className="size-4" />
                  {busy ? "Speichert…" : "Kontakt loggen"}
                </Button>
              </div>
            ) : (
              <div className="flex flex-col gap-3">
                <div className="grid gap-3 sm:grid-cols-2">
                  <label className="flex flex-col gap-1 text-xs">
                    <span className="font-medium">Telefon</span>
                    <Input
                      value={telefon}
                      onChange={(e) => setTelefon(e.target.value)}
                      placeholder="z. B. 02374 2400"
                      className="h-10 bg-background"
                    />
                  </label>
                  <label className="flex flex-col gap-1 text-xs">
                    <span className="font-medium">E-Mail</span>
                    <Input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="z. B. info@praxis.de"
                      className="h-10 bg-background"
                    />
                  </label>
                </div>
                <label className="flex flex-col gap-1 text-xs">
                  <span className="font-medium">Ansprechpartner</span>
                  <Input
                    value={apName}
                    onChange={(e) => setApName(e.target.value)}
                    placeholder="z. B. Frau Meier, Sozialdienst"
                    className="h-10 bg-background"
                  />
                </label>
                <p className="text-xs text-muted-foreground">
                  Leere Felder überschreiben nichts, was schon hinterlegt ist —
                  außer Telefon und E-Mail, die werden gesetzt wie eingetragen.
                </p>
                <Button
                  type="button"
                  className="self-start"
                  disabled={busy}
                  onClick={datenSpeichern}
                >
                  {busy ? "Speichert…" : "Speichern"}
                </Button>
              </div>
            )}
          </>
        ) : (
          <p className="rounded-lg border bg-muted/30 p-3 text-sm text-muted-foreground">
            Das ist ein Lead, keine Institution — bearbeiten und loggen geht
            direkt auf der Lead-Karte unter &bdquo;Anstehende Leads&ldquo;.
          </p>
        )}

        {fehler && <p className="text-sm text-destructive">{fehler}</p>}
        {erfolg && (
          <p className="rounded-lg bg-emerald-50 px-3 py-2 text-sm font-medium text-emerald-800">
            {erfolg}
          </p>
        )}

        {/* Verlauf */}
        <div className="border-t pt-3">
          <p className="mb-1 text-sm font-semibold">Bisheriger Verlauf</p>
          <KontaktVerlauf k={k} token={token} />
        </div>
      </div>
    </div>
  );
}

function KanbanKarte({ k, token }: { k: KontaktKarte; token: string }) {
  const [offen, setOffen] = useState(false);
  const [detail, setDetail] = useState(false);
  const tone = KAT_TONE[k.toneKey] ?? KAT_TONE.sonstiges;
  return (
    <li
      className={cn(
        "rounded-lg border border-l-4 bg-card p-2.5 text-sm shadow-sm transition-shadow hover:shadow-md",
        tone.border,
      )}
    >
      {detail && (
        <KontaktDetail k={k} token={token} onClose={() => setDetail(false)} />
      )}
      <div className="flex items-start gap-1.5">
        <div className="flex min-w-0 flex-1 flex-wrap items-center gap-1.5">
          {/* Name öffnet die Detail-Ansicht (bearbeiten + Kontakt loggen) */}
          <button
            type="button"
            onClick={() => setDetail(true)}
            title="Öffnen — bearbeiten & Kontakt loggen"
            className="text-left leading-snug font-semibold hover:text-primary hover:underline"
          >
            {k.name}
          </button>
          <span
            className={cn(
              "rounded-full px-1.5 py-0.5 text-[10px] font-semibold",
              tone.chip,
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
          {k.spalte === "rueckmeldung" && (
            <span title="wartet auf Rückmeldung" aria-hidden>
              ⏳
            </span>
          )}
        </div>
        {k.telefon && (
          <a
            href={`tel:${k.telefon}`}
            title={`${k.name} anrufen`}
            className="flex size-7 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary hover:bg-primary/20"
          >
            <Phone className="size-3.5" />
          </a>
        )}
      </div>
      {k.info && <p className="mt-0.5 text-xs text-muted-foreground">{k.info}</p>}
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
        <p className="mt-0.5 text-[11px] text-amber-700">To-do: {k.todo}</p>
      )}
      <div className="mt-1.5 flex items-center gap-2 border-t pt-1.5">
        <button
          type="button"
          onClick={() => setDetail(true)}
          className="flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-[11px] font-medium text-muted-foreground hover:text-foreground"
        >
          <Pencil className="size-3" />
          Öffnen
        </button>
        <button
          type="button"
          onClick={() => setOffen((o) => !o)}
          className="ml-auto flex items-center gap-1 text-[11px] font-medium text-primary hover:underline"
        >
          {offen ? "Verlauf ausblenden" : "Verlauf anzeigen"}
          <span aria-hidden>{offen ? "▴" : "▾"}</span>
        </button>
      </div>
      {offen && <KontaktVerlauf k={k} token={token} />}
    </li>
  );
}

interface HistorieZeile {
  contact_date: string;
  kontakt_art: string;
  ansprechpartner: string | null;
  note: string | null;
  bearbeiter: string | null;
}

function KontaktVerlauf({ k, token }: { k: KontaktKarte; token: string }) {
  const [rows, setRows] = useState<HistorieZeile[] | null>(null);
  const [fehler, setFehler] = useState<string | null>(null);
  const targetId = k.targetId;
  useEffect(() => {
    if (!targetId) return;
    let aktiv = true;
    teamAction(token, { action: "historie", target_id: targetId })
      .then((r) => {
        // eslint-disable-next-line react-hooks/set-state-in-effect -- async geladen, kein Sync-Setter
        if (aktiv) setRows((r.historie as HistorieZeile[]) ?? []);
      })
      .catch((e) => {
        if (aktiv) setFehler(e instanceof Error ? e.message : "Fehler");
      });
    return () => {
      aktiv = false;
    };
  }, [targetId, token]);

  // Klienten-Lead: Verlauf aus den Lead-Daten selbst.
  if (k.lead) {
    const l = k.lead;
    const eintraege: { zeit: string | null; text: string }[] = [
      {
        zeit: l.datum,
        text: `Eingegangen über ${leadQuelleLabel(l.quelle) || l.quelle}${l.quelle_detail ? ` (${l.quelle_detail})` : ""}`,
      },
      ...(l.erstbearbeitet_at
        ? [
            {
              zeit: l.erstbearbeitet_at,
              text: `Erstbearbeitung${l.bearbeiter ? ` von ${l.bearbeiter}` : ""}`,
            },
          ]
        : []),
      ...(l.zugewiesen_at
        ? [
            {
              zeit: l.zugewiesen_at,
              text: `An ${l.zugewiesen_hub ?? "Standort"} übergeben${l.zugewiesen_pdl ? ` (PDL ${l.zugewiesen_pdl})` : ""}`,
            },
          ]
        : []),
      ...(l.pdl_bestaetigt_at
        ? [
            {
              zeit: l.pdl_bestaetigt_at,
              text: `PDL-Antwort: ${l.pdl_ergebnis ?? "in Versorgung aufgenommen"}`,
            },
          ]
        : []),
    ];
    return (
      <div className="mt-1.5 flex flex-col gap-1.5 text-[11px]">
        {eintraege.map((e, i) => (
          <p key={i} className="flex gap-2">
            <span className="w-20 shrink-0 text-muted-foreground tabular-nums">
              {e.zeit ? exactStamp(e.zeit) : "—"}
            </span>
            <span>{e.text}</span>
          </p>
        ))}
        {l.notiz && (
          <p className="rounded-md bg-muted/50 p-1.5 whitespace-pre-line">{l.notiz}</p>
        )}
        {l.ergebnis && (
          <p className="text-muted-foreground">Ergebnis: {l.ergebnis}</p>
        )}
        {l.todos.length > 0 && (
          <p className="text-amber-700">
            Offene To-dos: {l.todos.map((t) => t.text).join(" · ")}
          </p>
        )}
      </div>
    );
  }

  // Institution: Kontakt-Log vom Server.
  if (fehler) return <p className="mt-1.5 text-[11px] text-destructive">{fehler}</p>;
  if (rows === null)
    return <p className="mt-1.5 text-[11px] text-muted-foreground">Lade Verlauf…</p>;
  if (rows.length === 0)
    return (
      <p className="mt-1.5 text-[11px] text-muted-foreground">
        Noch kein Kontakt geloggt.
      </p>
    );
  return (
    <ul className="mt-1.5 flex flex-col gap-1.5 text-[11px]">
      {rows.map((r, i) => (
        <li key={i} className="flex gap-2">
          <span className="w-14 shrink-0 text-muted-foreground tabular-nums">
            {formatIsoDate(r.contact_date)}
          </span>
          <span className="min-w-0">
            <span className="font-medium">
              {kontaktArtLabel(r.kontakt_art) || r.kontakt_art}
            </span>
            {r.bearbeiter ? ` von ${r.bearbeiter}` : ""}
            {r.ansprechpartner ? ` · mit ${r.ansprechpartner}` : ""}
            {r.note ? (
              <span className="block text-muted-foreground">„{r.note}“</span>
            ) : null}
          </span>
        </li>
      ))}
    </ul>
  );
}
