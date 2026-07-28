"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Headset, Plus, Trash2 } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import {
  hubsForBereich,
  LEAD_BEREICHE,
  LEAD_QUELLEN,
  leadBereichLabel,
  leadQuelleLabel,
} from "@/lib/leads";
import { formatIsoDate, todayIso } from "@/lib/crm";

/** Erfassungs-Zeitstempel: "28.07., 14:32" — plus Anruf-Datum, falls rückdatiert. */
function leadStamp(l: { call_date: string; created_at?: string | null }): string {
  if (!l.created_at) return formatIsoDate(l.call_date);
  const d = new Date(l.created_at);
  const stamp = d.toLocaleString("de-DE", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
  const erfasstAm = l.created_at.slice(0, 10);
  return l.call_date && l.call_date !== erfasstAm
    ? `${stamp} (Anruf am ${formatIsoDate(l.call_date)})`
    : stamp;
}
import { createLeadCall, deleteLeadCall } from "@/app/(app)/frontoffice/actions";

export interface LeadRow {
  id: string;
  call_date: string;
  quelle: string;
  bereich?: string | null;
  quelle_detail?: string | null;
  lead_name?: string | null;
  hub_id: string | null;
  notiz: string | null;
  created_at?: string | null;
}

/** Quellen, bei denen ein "Welches Krankenhaus?"-Detail sinnvoll ist. */
const DETAIL_QUELLEN = new Set(["krankenhaus", "recare", "arzt"]);

/**
 * Frontoffice-Erfassung: jeder Interessenten-Anruf wird mit Bereich, Quelle
 * (inkl. Klinik-Detail) und weitergeleitetem Standort geloggt.
 */
export function LeadBoard({
  hubs,
  recent,
  klinikNamen = [],
}: {
  hubs: { id: string; name: string }[];
  recent: LeadRow[];
  /** Bekannte Kliniken aus dem CRM als Vorschläge fürs Quelle-Detail. */
  klinikNamen?: string[];
}) {
  const [pending, startTransition] = useTransition();
  const [bereich, setBereich] = useState("");
  const [andereBereich, setAndereBereich] = useState(false);
  const [customBereich, setCustomBereich] = useState("");
  const [quelle, setQuelle] = useState("");
  const [quelleDetail, setQuelleDetail] = useState("");
  const [leadName, setLeadName] = useState("");
  const [hubId, setHubId] = useState("");
  const [date, setDate] = useState(todayIso());
  const [notiz, setNotiz] = useState("");

  // Standort-Auswahl passend zum gewählten Bereich einschränken
  // (bei "Andere" alle Standorte anbieten).
  const effektiverBereich = andereBereich ? customBereich.trim() : bereich;
  const bereichHubs =
    !andereBereich && bereich ? hubsForBereich(hubs, bereich) : hubs;
  const hubItems = Object.fromEntries(bereichHubs.map((h) => [h.id, h.name]));
  const hubName = (id: string | null) =>
    hubs.find((h) => h.id === id)?.name ?? "—";

  function save() {
    if (pending) return;
    if (!effektiverBereich) {
      toast.error(
        andereBereich
          ? "Bitte den Bereich eintragen."
          : "Bitte Bereich auswählen.",
      );
      return;
    }
    if (!quelle) {
      toast.error("Bitte Quelle auswählen.");
      return;
    }
    if (!leadName.trim()) {
      toast.error("Bitte den Namen des Interessenten eintragen.");
      return;
    }
    startTransition(async () => {
      const r = await createLeadCall({
        quelle,
        bereich: effektiverBereich,
        quelle_detail: DETAIL_QUELLEN.has(quelle) ? quelleDetail : "",
        lead_name: leadName,
        hub_id: hubId,
        call_date: date,
        notiz,
      });
      if (r.ok) {
        toast.success("Lead geloggt");
        setLeadName("");
        setNotiz("");
        setQuelleDetail("");
        // Bereich/Quelle/Standort bleiben stehen — oft mehrere Anrufe in Folge.
      } else {
        toast.error(r.error);
      }
    });
  }

  const chip = (active: boolean) =>
    cn(
      "cursor-pointer rounded-full border px-2.5 py-1 text-sm font-medium transition-colors select-none",
      active
        ? "border-primary bg-primary text-primary-foreground"
        : "bg-background text-muted-foreground hover:text-foreground",
    );

  return (
    <div className="flex flex-col gap-4">
      {/* Erfassung */}
      <div className="flex flex-col gap-3 rounded-xl border border-primary/25 bg-primary/[0.04] p-4">
        <p className="flex items-center gap-1.5 text-sm font-semibold">
          <Headset className="size-4 text-primary" />
          Anruf loggen — Interessent
        </p>

        <div className="flex flex-col gap-1.5">
          <span className="text-xs font-medium text-muted-foreground">
            Bereich (Pflicht)
          </span>
          <div className="flex flex-wrap items-center gap-1.5">
            {LEAD_BEREICHE.map((b) => (
              <button
                key={b.key}
                type="button"
                onClick={() => {
                  setBereich(b.key);
                  setAndereBereich(false);
                  setHubId("");
                }}
                className={chip(!andereBereich && bereich === b.key)}
              >
                Interessent {b.label}
              </button>
            ))}
            <button
              type="button"
              onClick={() => {
                setAndereBereich(true);
                setBereich("");
                setHubId("");
              }}
              className={chip(andereBereich)}
            >
              Andere / selbst eintragen
            </button>
            {andereBereich && (
              <Input
                value={customBereich}
                onChange={(e) => setCustomBereich(e.target.value)}
                placeholder="Bereich eintragen, z. B. Tagespflege"
                autoComplete="off"
                maxLength={100}
                className="w-56 bg-background"
                autoFocus
              />
            )}
          </div>
        </div>

        <div className="flex flex-col gap-1.5">
          <span className="text-xs font-medium text-muted-foreground">
            Woher aufmerksam geworden? (Pflicht)
          </span>
          <div className="flex flex-wrap gap-1.5">
            {LEAD_QUELLEN.map((q) => (
              <button
                key={q.key}
                type="button"
                onClick={() => setQuelle(q.key)}
                className={chip(quelle === q.key)}
              >
                {q.label}
              </button>
            ))}
          </div>
        </div>

        {DETAIL_QUELLEN.has(quelle) && (
          <div className="flex flex-col gap-1.5">
            <span className="text-xs font-medium text-muted-foreground">
              {quelle === "arzt"
                ? "Welche Praxis? (optional)"
                : "Welches Krankenhaus / Case Management? (optional)"}
            </span>
            <Input
              value={quelleDetail}
              onChange={(e) => setQuelleDetail(e.target.value)}
              placeholder="z. B. Klinikum Lippe Detmold, Frau Weber (Sozialdienst)"
              list="lead-klinik-suggestions"
              autoComplete="off"
              maxLength={200}
              className="max-w-md bg-background"
            />
            <datalist id="lead-klinik-suggestions">
              {klinikNamen.map((n) => (
                <option key={n} value={n} />
              ))}
            </datalist>
          </div>
        )}

        <div className="flex flex-wrap items-center gap-2">
          <Input
            value={leadName}
            onChange={(e) => setLeadName(e.target.value)}
            placeholder="Name des Interessenten (Pflicht)"
            autoComplete="off"
            maxLength={200}
            className="min-w-56 flex-1 bg-background"
          />
          <Select
            items={hubItems}
            value={hubId}
            onValueChange={(v) => setHubId(v ?? "")}
          >
            <SelectTrigger className="w-56">
              <SelectValue placeholder="Weitergeleitet an Standort…" />
            </SelectTrigger>
            <SelectContent>
              {Object.entries(hubItems).map(([value, label]) => (
                <SelectItem key={value} value={value}>
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="w-40 bg-background"
          />
          <Input
            value={notiz}
            onChange={(e) => setNotiz(e.target.value)}
            placeholder="Notiz (optional), z. B. Leistung, PLZ…"
            maxLength={500}
            className="min-w-48 flex-1 bg-background"
          />
          <Button type="button" disabled={pending} onClick={save}>
            <Plus className="size-4" />
            {pending ? "Speichere…" : "Lead loggen"}
          </Button>
        </div>
      </div>

      {/* Letzte Einträge */}
      <section className="flex flex-col gap-2 rounded-xl border bg-card p-4 shadow-sm">
        <p className="text-sm font-semibold">
          Letzte Anrufe ({recent.length})
        </p>
        {recent.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Noch keine Leads geloggt.
          </p>
        ) : (
          <ul className="flex flex-col gap-1">
            {recent.map((l) => (
              <li
                key={l.id}
                className="group/lead flex flex-wrap items-baseline gap-x-2 gap-y-0.5 rounded-lg bg-muted/50 px-3 py-1.5 text-sm"
              >
                <span className="shrink-0 text-xs text-muted-foreground tabular-nums">
                  {leadStamp(l)}
                </span>
                {l.bereich && (
                  <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[0.65rem] font-semibold text-primary">
                    {leadBereichLabel(l.bereich)}
                  </span>
                )}
                {l.lead_name && (
                  <span className="font-semibold">{l.lead_name}</span>
                )}
                <span className="font-medium">{leadQuelleLabel(l.quelle)}</span>
                {l.quelle_detail && (
                  <span className="text-muted-foreground">
                    ({l.quelle_detail})
                  </span>
                )}
                <span className="text-muted-foreground">
                  → {hubName(l.hub_id)}
                </span>
                {l.notiz && (
                  <span className="text-xs text-muted-foreground">
                    · {l.notiz}
                  </span>
                )}
                <button
                  type="button"
                  disabled={pending}
                  onClick={() => {
                    if (window.confirm("Lead-Eintrag löschen?")) {
                      startTransition(async () => {
                        const r = await deleteLeadCall(l.id);
                        if (r.ok) toast.success("Eintrag gelöscht");
                        else toast.error(r.error);
                      });
                    }
                  }}
                  className="ml-auto shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover/lead:opacity-100 hover:text-destructive"
                  aria-label="Eintrag löschen"
                >
                  <Trash2 className="size-3.5" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
