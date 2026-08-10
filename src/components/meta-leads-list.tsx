"use client";

import { useState } from "react";
import { Check, Phone, Undo2 } from "lucide-react";
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

function fieldValue(fd: unknown, ...names: string[]): string | null {
  if (!Array.isArray(fd)) return null;
  for (const n of names) {
    const f = (fd as Field[]).find((x) => x.name?.toLowerCase().includes(n));
    if (f?.values?.[0]) return f.values[0];
  }
  return null;
}

/** Restliche Formularfelder (ohne Name/Telefon/E-Mail) als Text. */
function extraFields(fd: unknown): string[] {
  if (!Array.isArray(fd)) return [];
  const known = ["name", "phone", "email", "telefon"];
  return (fd as Field[])
    .filter((f) => !known.some((k) => f.name?.toLowerCase().includes(k)))
    .map((f) => `${f.name?.replace(/_/g, " ")}: ${f.values?.join(", ")}`);
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
          const name = fieldValue(l.field_data, "full_name", "name") ?? "(ohne Name)";
          const phone = fieldValue(l.field_data, "phone", "telefon");
          const email = fieldValue(l.field_data, "email");
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
                <div className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5">
                  <span className="font-medium">{name}</span>
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
                  {l.campaign_name && ` · ${l.campaign_name}`}
                  {extraFields(l.field_data).map((x) => ` · ${x}`)}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setStatus(l.id, done ? "offen" : "kontaktiert")}
                className={cn(
                  "flex shrink-0 items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors",
                  done
                    ? "text-muted-foreground hover:text-foreground"
                    : "border-emerald-200 bg-emerald-50 text-emerald-800 hover:bg-emerald-100",
                )}
              >
                {done ? (
                  <>
                    <Undo2 className="size-3.5" /> zurück auf offen
                  </>
                ) : (
                  <>
                    <Check className="size-3.5" /> kontaktiert
                  </>
                )}
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
