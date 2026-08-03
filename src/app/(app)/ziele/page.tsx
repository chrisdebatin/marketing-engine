import {
  CalendarClock,
  ListTodo,
  MapPin,
  PhoneCall,
  PhoneOutgoing,
  UserPlus,
  Users,
} from "lucide-react";
import { requireSession } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  anrufErreicht,
  crmStatus,
  formatIsoDate,
  kontaktArtLabel,
  todayIso,
} from "@/lib/crm";
import { splitPdlNames } from "@/lib/pdl";
import { getCallcenterToken } from "@/lib/frontoffice-token";
import { getFollowupWeeks } from "@/lib/settings";
import { type CrmTargetRow } from "@/components/crm-targets-manager";
import { ZieleView } from "@/components/ziele-view";
import { FollowupSettings } from "@/components/followup-settings";
import { CopyLink } from "@/components/copy-link";
import { AnalyzeNotesButton } from "@/components/analyze-notes-button";
import {
  CallcenterCrm,
  type CallcenterContactRow,
} from "@/components/callcenter-crm";
import type {
  KanbanLastContact,
  KanbanTodo,
} from "@/components/crm-kanban";

export const dynamic = "force-dynamic";

function Stat({
  icon: Icon,
  value,
  label,
}: {
  icon: React.ComponentType<{ className?: string }>;
  value: number;
  label: string;
}) {
  return (
    <div className="flex items-center gap-2.5 rounded-lg border bg-card px-3 py-2.5">
      <span className="flex size-8 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
        <Icon className="size-4" />
      </span>
      <div className="min-w-0">
        <div className="text-lg leading-none font-semibold tabular-nums">
          {value}
        </div>
        <div className="mt-1 truncate text-xs text-muted-foreground">
          {label}
        </div>
      </div>
    </div>
  );
}

/**
 * CRM: zentrale Liste der Ziel-Orte (Krankenhäuser, Praxen, …) mit
 * Hub-Zuteilung, Follow-up-Rhythmus und der Call-Center-Anrufliste —
 * eine Seite für alles: Kanban, Verwaltung, Anrufe, Aufgaben.
 */
export default async function ZielePage() {
  const session = await requireSession();
  const admin = createAdminClient();
  const followup = await getFollowupWeeks();
  const ccToken = await getCallcenterToken();

  const cutoff14 = (() => {
    const d = new Date();
    d.setDate(d.getDate() - 14);
    return d.toISOString().slice(0, 10);
  })();

  // Fallback ?? [] — fehlende Migrationen dürfen die Seite nicht crashen.
  const [
    { data },
    { data: contactRows },
    { data: personRows },
    { data: todoRows },
    { data: callRows },
  ] = await Promise.all([
    admin.from("crm_targets").select("*").order("name"),
    admin
      .from("crm_contacts")
      .select(
        "id, hub_id, target_id, kontakt_art, ansprechpartner, note, contact_date",
      )
      .order("contact_date", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(1000),
    admin.from("crm_persons").select("*").order("name"),
    admin
      .from("crm_todos")
      .select("id, target_id, hub_id, art, aufgabe, besprochen, created_at")
      .eq("status", "offen")
      .order("created_at", { ascending: false })
      .limit(200),
    // Für die Tagesstatistik: alle geloggten Anrufe der letzten 14 Tage.
    admin
      .from("crm_contacts")
      .select("id, note, contact_date")
      .eq("kontakt_art", "anruf")
      .gte("contact_date", cutoff14)
      .limit(3000),
  ]);

  const hubIds = new Set(session.hubs.map((h) => h.id));
  const targets = ((data ?? []) as CrmTargetRow[]).filter(
    (t) => t.hub_id === null || hubIds.has(t.hub_id),
  );

  const today = todayIso();
  const cutoff7 = (() => {
    const d = new Date();
    d.setDate(d.getDate() - 7);
    return d.toISOString().slice(0, 10);
  })();
  const faellig = targets.filter((t) => crmStatus(t, today) === "faellig").length;
  const erstkontakt = targets.filter(
    (t) => crmStatus(t, today) === "erstbesuch",
  ).length;
  const vonPdl = targets.filter((t) =>
    /Von der PDL/i.test(t.note ?? ""),
  ).length;
  const kontakte7 = (contactRows ?? []).filter(
    (c) => c.contact_date >= cutoff7,
  ).length;

  const hubOf = (id: string | null) =>
    session.hubs.find((h) => h.id === id) ?? null;
  const hubNameOf = (id: string | null) => hubOf(id)?.name ?? "—";
  const targetNameOf = (id: string | null) =>
    targets.find((t) => t.id === id)?.name ?? "Gelöschter Ort";

  // Für die Kanban-Karten: letzte Aktion je Ort (wer, was, wann) …
  const lastByTarget: Record<string, KanbanLastContact> = {};
  for (const c of contactRows ?? []) {
    if (c.kontakt_art === "lead") continue;
    if (lastByTarget[c.target_id]) continue;
    const hub = hubOf(c.hub_id);
    lastByTarget[c.target_id] = {
      art: c.kontakt_art,
      date: c.contact_date,
      hubName: hub?.name ?? null,
      pdl: splitPdlNames(hub?.pdl_name ?? null)[0] ?? null,
      ansprechpartner: c.ansprechpartner,
      note: c.note,
    };
  }
  // … und die offenen Aufgaben je Ort.
  const todosByTarget: Record<string, KanbanTodo[]> = {};
  for (const t of todoRows ?? []) {
    (todosByTarget[t.target_id] ??= []).push({
      art: t.art,
      aufgabe: t.aufgabe,
      besprochen: t.besprochen,
    });
  }

  // Tagesstatistik Call-Center: angerufen & erreicht pro Tag.
  const proTag = new Map<string, { anrufe: number; erreicht: number }>();
  for (const c of callRows ?? []) {
    const e = proTag.get(c.contact_date) ?? { anrufe: 0, erreicht: 0 };
    e.anrufe += 1;
    if (anrufErreicht(c.note)) e.erreicht += 1;
    proTag.set(c.contact_date, e);
  }
  if (!proTag.has(today)) proTag.set(today, { anrufe: 0, erreicht: 0 });
  const tage = [...proTag.entries()].sort((a, b) => b[0].localeCompare(a[0]));

  const callcenterTab = (
    <div className="flex flex-col gap-4">
      {/* Tagesstatistik */}
      <section className="flex flex-col gap-2 rounded-xl border bg-card p-4 shadow-sm">
        <p className="flex items-center gap-1.5 text-sm font-semibold">
          <PhoneCall className="size-4 text-primary" />
          Anrufe pro Tag (14 Tage)
        </p>
        <div className="overflow-x-auto">
          <table className="w-full max-w-md text-sm">
            <thead>
              <tr className="text-left text-xs text-muted-foreground">
                <th className="py-1 pr-4 font-medium">Tag</th>
                <th className="py-1 pr-4 text-right font-medium">Angerufen</th>
                <th className="py-1 pr-4 text-right font-medium">Erreicht</th>
                <th className="py-1 text-right font-medium">Quote</th>
              </tr>
            </thead>
            <tbody>
              {tage.map(([tag, s]) => (
                <tr key={tag} className="border-t">
                  <td className="py-1 pr-4">
                    {new Date(`${tag}T00:00:00`).toLocaleDateString("de-DE", {
                      weekday: "short",
                      day: "2-digit",
                      month: "2-digit",
                    })}
                    {tag === today ? " (heute)" : ""}
                  </td>
                  <td className="py-1 pr-4 text-right tabular-nums">
                    {s.anrufe}
                  </td>
                  <td className="py-1 pr-4 text-right tabular-nums">
                    {s.erreicht}
                  </td>
                  <td className="py-1 text-right text-muted-foreground tabular-nums">
                    {s.anrufe > 0
                      ? `${Math.round((s.erreicht / s.anrufe) * 100)} %`
                      : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="text-xs text-muted-foreground">
          Zählt alle geloggten Anrufe (Call-Center + PDLs). „Erreicht“ =
          nicht als „Nicht erreicht“ geloggt.
        </p>
        <AnalyzeNotesButton />
      </section>

      {/* Team-Link (ohne Login) */}
      {ccToken && (
        <section className="flex flex-col gap-2 rounded-xl border bg-card p-4 shadow-sm">
          <p className="flex items-center gap-1.5 text-sm font-semibold">
            <PhoneOutgoing className="size-4 text-primary" />
            Link für das Call-Center-Team
          </p>
          <div className="flex flex-wrap items-center gap-2 rounded-lg bg-muted/50 px-3 py-2 text-sm">
            <code className="min-w-0 flex-1 truncate text-xs text-muted-foreground">
              /c/{ccToken}
            </code>
            <CopyLink token={ccToken} prefix="/c" />
          </div>
        </section>
      )}

      <CallcenterCrm
        targets={targets}
        persons={personRows ?? []}
        contacts={(contactRows ?? []) as CallcenterContactRow[]}
        hubs={session.hubs.map((h) => ({
          id: h.id,
          name: h.name,
          pdl_name: h.pdl_name,
          pdl_phone: h.pdl_phone,
        }))}
      />
    </div>
  );

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold">CRM &amp; Call-Center</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Alles an einem Ort: die Kanban-Pipeline mit offenen Aufgaben, die
          Verwaltung der Ziel-Orte und die Anrufliste des Call-Centers. Jede
          Karte zeigt die letzte Aktion, die letzte Notiz und die nächste
          fällige Aktion — Aufgaben aus Gesprächsnotizen erkennt die KI
          automatisch.
        </p>
      </div>

      {/* Kennzahlen */}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
        <Stat icon={MapPin} value={targets.length} label="Ziel-Orte gesamt" />
        <Stat icon={CalendarClock} value={faellig} label="Follow-up fällig" />
        <Stat icon={ListTodo} value={erstkontakt} label="Erstkontakt offen" />
        <Stat
          icon={ListTodo}
          value={(todoRows ?? []).length}
          label="Offene Aufgaben"
        />
        <Stat icon={UserPlus} value={vonPdl} label="Von PDLs eingetragen" />
        <Stat icon={Users} value={kontakte7} label="Kontakte (7 Tage)" />
      </div>

      <FollowupSettings initial={followup} />

      <ZieleView
        targets={targets}
        hubs={session.hubs.map((h) => ({ id: h.id, name: h.name }))}
        persons={personRows ?? []}
        todosByTarget={todosByTarget}
        lastByTarget={lastByTarget}
        callcenter={callcenterTab}
      />

      {/* Globales Kontakt-Log über alle Standorte */}
      {(contactRows ?? []).length > 0 && (
        <section className="flex flex-col gap-2 rounded-xl border bg-card p-5 shadow-sm">
          <p className="flex items-center gap-1.5 font-semibold">
            <CalendarClock className="size-4 text-primary" />
            Letzte Kontakte aller Standorte
          </p>
          <ul className="flex flex-col gap-1">
            {(contactRows ?? []).slice(0, 30).map((c) => (
              <li
                key={c.id}
                className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5 rounded-lg bg-muted/50 px-3 py-1.5 text-sm"
              >
                <span className="shrink-0 text-xs text-muted-foreground tabular-nums">
                  {formatIsoDate(c.contact_date)}
                </span>
                <span className="font-medium">
                  {kontaktArtLabel(c.kontakt_art) || c.kontakt_art}
                </span>
                <span className="min-w-0">— {targetNameOf(c.target_id)}</span>
                <span className="text-xs text-muted-foreground">
                  · {hubNameOf(c.hub_id)}
                </span>
                {c.ansprechpartner && (
                  <span className="text-xs text-muted-foreground">
                    · {c.ansprechpartner}
                  </span>
                )}
                {c.note && (
                  <span className="w-full text-xs text-muted-foreground">
                    „{c.note}“
                  </span>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
