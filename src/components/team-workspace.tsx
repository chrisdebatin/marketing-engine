"use client";

import { useState } from "react";
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
  hub: string | null;
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
}: {
  token: string;
  memberName: string;
  inbound: InboundLead[];
  outbound: OutboundTarget[];
}) {
  const [tab, setTab] = useState<"inbound" | "outbound">("inbound");
  const [inbound, setInbound] = useState(initialInbound);
  const [outbound, setOutbound] = useState(initialOutbound);
  const [error, setError] = useState<string | null>(null);
  const [showDone, setShowDone] = useState(false);

  const openInbound = inbound.filter((l) =>
    ["offen", "kontaktiert"].includes(l.status),
  );
  const doneInbound = inbound.length - openInbound.length;

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

  async function setStatus(l: InboundLead, status: string) {
    setError(null);
    try {
      await teamAction(token, { action: "lead-status", kind: l.kind, id: l.id, status });
      setInbound((cur) =>
        cur.map((x) =>
          x.id === l.id ? { ...x, status, bearbeiter: memberName } : x,
        ),
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "Fehler");
    }
  }

  return (
    <div className="flex flex-col gap-4">
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

      {error && <p className="text-sm text-destructive">{error}</p>}

      {tab === "inbound" && (
        <div className="flex flex-col gap-2">
          {doneInbound > 0 && (
            <button
              type="button"
              onClick={() => setShowDone((s) => !s)}
              className="self-start text-xs text-muted-foreground hover:text-foreground"
            >
              {showDone
                ? "Abgeschlossene ausblenden"
                : `${doneInbound} abgeschlossene anzeigen`}
            </button>
          )}
          {(showDone ? inbound : openInbound).length === 0 && (
            <p className="rounded-xl border bg-card p-5 text-sm text-muted-foreground shadow-sm">
              Keine offenen Anfragen. 🎉
            </p>
          )}
          <ul className="flex flex-col gap-2">
            {(showDone ? inbound : openInbound).map((l) => (
              <li
                key={`${l.kind}-${l.id}`}
                className="flex flex-col gap-2 rounded-xl border bg-card p-3.5 shadow-sm"
              >
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                  <span className="font-medium">{l.name}</span>
                  <span className="rounded-full border px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
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
                <div className="flex flex-wrap items-center gap-1.5">
                  {!l.bearbeiter && (
                    <Button type="button" size="sm" onClick={() => claim(l)}>
                      <Hand className="size-3.5" />
                      Übernehmen
                    </Button>
                  )}
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
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        className="border-emerald-300 text-emerald-800 hover:bg-emerald-50"
                        onClick={() =>
                          setStatus(
                            l,
                            l.quelle === "recare" ? "aufgenommen" : "erstgespraech",
                          )
                        }
                      >
                        <Check className="size-3.5" />
                        {l.quelle === "recare"
                          ? "aufgenommen"
                          : "Erstgespräch vereinbart"}
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        className="text-muted-foreground"
                        onClick={() => setStatus(l, "verloren")}
                      >
                        <X className="size-3.5" /> verloren
                      </Button>
                    </>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}

      {tab === "outbound" && (
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
