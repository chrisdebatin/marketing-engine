"use client";

import { useEffect, useState } from "react";
import {
  CalendarClock,
  Check,
  Hand,
  Inbox,
  Mail,
  MapPin,
  Phone,
  PhoneCall,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { leadQuelleLabel } from "@/lib/leads";
import { placeKindLabel } from "@/lib/places";
import { formatIsoDate, kontaktArtLabel, todayIso } from "@/lib/crm";

export interface InboundLead {
  kind: "meta" | "call";
  id: string;
  name: string;
  telefon: string | null;
  email: string | null;
  quelle: string;
  quelle_detail: string | null;
  datum: string;
  status: string;
  bearbeiter: string | null;
  notiz: string | null;
  ergebnis: string | null;
  hub: string | null;
  zugewiesen_hub: string | null;
  zugewiesen_at: string | null;
  pdl_bestaetigt_at: string | null;
  pdl_ergebnis: string | null;
  vorschlag_hub_id: string | null;
  /** Düsseldorf/Gevelsberg: Team bucht Termin selbst + legt in MediFox (DUS) an. */
  direct_booking: boolean;
}

export interface OutboundTarget {
  id: string;
  name: string;
  kategorie: string;
  ort: string | null;
  relevanz: number | null;
  hub: string | null;
  letzter_besuch: string | null;
  letzte_kontakt_art: string | null;
  naechster_besuch: string | null;
  besuchs_notiz: string | null;
  exklusiv: boolean;
}

const STATUS_LABEL: Record<string, string> = {
  offen: "offen",
  kontaktiert: "kontaktiert",
  erstgespraech: "Erstgespräch ✓",
  aufgenommen: "aufgenommen ✓",
  verloren: "verloren",
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
  recare: "border-teal-200 bg-teal-50 text-teal-800",
  agentur: "border-amber-200 bg-amber-50 text-amber-800",
  website: "border-sky-200 bg-sky-50 text-sky-800",
  telefon0800: "border-sky-200 bg-sky-50 text-sky-800",
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
  else if (aufgenommen) next = "abgeschlossen ✓";
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
      <div className="flex flex-wrap items-center gap-x-1 gap-y-0.5 text-[11px]">
        {steps.map((s, i) => (
          <span key={s.label} className="flex items-center gap-1">
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
          <span className={next === "abgeschlossen ✓" ? "text-emerald-700" : ""}>{next}</span>
        </p>
      )}
    </div>
  );
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
}) {
  const [tab, setTab] = useState<"inbound" | "outbound">("inbound");
  const [inbound, setInbound] = useState(initialInbound);
  const [outbound, setOutbound] = useState(initialOutbound);
  const [error, setError] = useState<string | null>(null);
  const [showDone, setShowDone] = useState(false);
  const canAct = !monitor || editable;

  // Auto-Aktualisierung: alle 20 Sekunden neu laden — neue Anfragen ploppen
  // oben auf. Pausiert beim Tippen und in Hintergrund-Tabs; der Mail-Abruf
  // selbst ist serverseitig auf 1×/Minute gedrosselt.
  useEffect(() => {
    if (monitor) return;
    const id = setInterval(() => {
      const el = document.activeElement;
      const typing =
        el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement;
      if (!typing && document.visibilityState === "visible") {
        window.location.reload();
      }
    }, 20 * 1000);
    return () => clearInterval(id);
  }, [monitor]);

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
  const dayGroups: { key: string; leads: InboundLead[] }[] = [];
  for (const l of shownInbound) {
    const key = dayKey(l.datum);
    const last = dayGroups[dayGroups.length - 1];
    if (last && last.key === key) last.leads.push(l);
    else dayGroups.push({ key, leads: [l] });
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
      {!monitor && (
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
      </div>
      )}

      {error && <p className="text-sm text-destructive">{error}</p>}

      {(monitor || tab === "inbound") && (
        <div className="flex flex-col gap-2">
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
            <span className="ml-auto text-[11px] text-muted-foreground">
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
              <p className="mt-2 flex items-center gap-2 text-xs font-semibold tracking-wide text-muted-foreground uppercase first:mt-0">
                {dayLabel(g.key)}
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
                  <span className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground tabular-nums">
                    {relTime(l.datum) && l.status === "offen" && (
                      <span
                        className="size-1.5 animate-pulse rounded-full bg-primary"
                        title="neu"
                      />
                    )}
                    {timeOf(l.datum) || "—"}
                    {relTime(l.datum) && (
                      <span className="font-normal">({relTime(l.datum)})</span>
                    )}
                  </span>
                  <span className="font-medium">{l.name}</span>
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
                <p className="flex flex-wrap items-center gap-x-4 gap-y-0.5 text-sm">
                  {l.telefon && (
                    <a
                      href={`tel:${l.telefon}`}
                      className="flex items-center gap-1 text-primary hover:underline"
                    >
                      <Phone className="size-3" />
                      {l.telefon}
                    </a>
                  )}
                  {l.email && (
                    <a
                      href={`mailto:${l.email}`}
                      className="flex items-center gap-1 text-primary hover:underline"
                    >
                      <Mail className="size-3" />
                      {l.email}
                    </a>
                  )}
                  <span className="text-xs text-muted-foreground">
                    {l.datum ? formatIsoDate(l.datum.slice(0, 10)) : ""}
                    {l.hub ? ` · ${l.hub}` : ""}
                  </span>
                </p>
                {l.notiz && (
                  <p className="text-xs text-muted-foreground">„{l.notiz}“</p>
                )}
                {l.ergebnis && (
                  <p className="text-xs font-medium text-emerald-800">
                    Ergebnis: {l.ergebnis}
                  </p>
                )}
                {l.zugewiesen_hub && (
                  <p className="text-xs font-medium">
                    <span className="rounded-full bg-sky-100 px-2 py-0.5 text-sky-800">
                      → übergeben an {l.zugewiesen_hub}
                      {l.zugewiesen_at
                        ? ` am ${new Date(l.zugewiesen_at).toLocaleDateString("de-DE")}`
                        : ""}
                    </span>{" "}
                    {l.pdl_bestaetigt_at ? (
                      <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-emerald-800">
                        PDL bestätigt: {l.pdl_ergebnis ?? "aufgenommen"} ✓
                      </span>
                    ) : (
                      <span className="text-muted-foreground">
                        Rückmeldung der PDL steht aus
                      </span>
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
                          <Check className="size-3.5" /> kontaktiert
                        </Button>
                      )}
                      {["offen", "kontaktiert"].includes(l.status) && (
                        <>
                          {l.direct_booking ? (
                            <ErstgespraechChecklist
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
                {canAct && !l.zugewiesen_hub && l.status !== "verloren" && (
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
      )}

      {!monitor && tab === "outbound" && (
        <ul className="flex flex-col gap-2">
          {sortedOutbound.map((t) => (
            <OutboundRow
              key={t.id}
              target={t}
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
        </ul>
      )}
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
        <X className="size-3.5" /> verloren
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
function ErstgespraechChecklist({ onConfirm }: { onConfirm: () => void }) {
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
        Neukunde in MediFox (DUS-Mandant) angelegt
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
        <Button type="button" size="sm" disabled={busy || !hubId} onClick={assign}>
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

function OutboundRow({
  target: t,
  token,
  memberName,
  isDue,
  onLogged,
}: {
  target: OutboundTarget;
  token: string;
  memberName: string;
  isDue: boolean;
  onLogged: (patch: Partial<OutboundTarget>) => void;
}) {
  const [open, setOpen] = useState(false);
  const [notiz, setNotiz] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function log() {
    setBusy(true);
    setError(null);
    try {
      const res = await teamAction(token, {
        action: "outbound-log",
        target_id: t.id,
        notiz,
      });
      onLogged({
        letzter_besuch: String(res.letzter_besuch),
        letzte_kontakt_art: "anruf",
        naechster_besuch: String(res.naechster_besuch),
        besuchs_notiz: notiz || null,
      });
      setOpen(false);
      setNotiz("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Fehler");
    } finally {
      setBusy(false);
    }
  }

  return (
    <li
      className={cn(
        "flex flex-col gap-2 rounded-xl border bg-card p-3.5 shadow-sm",
        isDue && "border-amber-500/50 bg-amber-500/[0.05]",
      )}
    >
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <span className="font-medium">{t.name}</span>
        <span className="rounded-full border px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
          {placeKindLabel(t.kategorie)}
          {t.exklusiv ? "" : " · gemeinsamer Pool"}
        </span>
        {t.relevanz != null && (
          <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-semibold text-primary">
            Prio {t.relevanz}
          </span>
        )}
        {isDue && (
          <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-semibold text-amber-800">
            fällig
          </span>
        )}
      </div>
      <p className="flex items-center gap-1 text-xs text-muted-foreground">
        <MapPin className="size-3 shrink-0" />
        {[t.ort, t.hub ? `Standort ${t.hub}` : null].filter(Boolean).join(" · ") || "—"}
      </p>
      <p className="flex items-center gap-1 text-xs text-muted-foreground">
        <CalendarClock className="size-3 shrink-0" />
        {t.letzter_besuch
          ? `Zuletzt: ${kontaktArtLabel(t.letzte_kontakt_art) || "Kontakt"} am ${formatIsoDate(t.letzter_besuch)}${t.besuchs_notiz ? ` — „${t.besuchs_notiz}“` : ""} · wieder fällig ab ${formatIsoDate(t.naechster_besuch)}`
          : "Noch kein Kontakt"}
      </p>
      {open ? (
        <div className="flex flex-col gap-2">
          <Textarea
            value={notiz}
            onChange={(e) => setNotiz(e.target.value)}
            rows={2}
            placeholder="Was wurde besprochen? (optional)"
          />
          {error && <p className="text-xs text-destructive">{error}</p>}
          <div className="flex gap-2">
            <Button type="button" size="sm" disabled={busy} onClick={log}>
              {busy ? "Speichere…" : `Anruf loggen (als ${memberName})`}
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
      ) : (
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="self-start"
          onClick={() => setOpen(true)}
        >
          <PhoneCall className="size-3.5" /> Anruf loggen
        </Button>
      )}
    </li>
  );
}
