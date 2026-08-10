"use client";

import { useState } from "react";
import { Check, Megaphone, Phone, Undo2 } from "lucide-react";
import { cn } from "@/lib/utils";

export interface LeadRow {
  id: string;
  campaign_name: string | null;
  ad_name: string | null;
  created_time: string | null;
  field_data: unknown;
  status: string;
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

export function MetaLeadsList({ initial }: { initial: LeadRow[] }) {
  const [leads, setLeads] = useState(initial);
  const [showDone, setShowDone] = useState(false);

  async function setStatus(id: string, status: "offen" | "kontaktiert") {
    setLeads((cur) => cur.map((l) => (l.id === id ? { ...l, status } : l)));
    await fetch("/api/meta-ads/lead", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, status }),
    });
  }

  const visible = leads.filter((l) => showDone || l.status === "offen");
  const doneCount = leads.length - leads.filter((l) => l.status === "offen").length;

  return (
    <div className="flex flex-col gap-2">
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
      {visible.length === 0 && (
        <p className="rounded-xl border bg-card p-5 text-sm text-muted-foreground shadow-sm">
          Alles abgearbeitet — keine offenen Leads. 🎉
        </p>
      )}
      <ul className="flex flex-col gap-2">
        {visible.map((l) => {
          const name = leadName(l.field_data) ?? "(ohne Name)";
          const phone = fieldValue(l.field_data, "phone", "telefon", "mobil");
          const email = fieldValue(l.field_data, "email", "mail");
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
                  <span className="font-medium">{name}</span>
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
