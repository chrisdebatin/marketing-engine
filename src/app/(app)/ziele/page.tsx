import { CalendarClock, ListTodo, MapPin, UserPlus, Users } from "lucide-react";
import { requireSession } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { crmStatus, formatIsoDate, kontaktArtLabel, todayIso } from "@/lib/crm";
import { type CrmTargetRow } from "@/components/crm-targets-manager";
import { ZieleView } from "@/components/ziele-view";
import { FollowupSettings } from "@/components/followup-settings";
import { getFollowupWeeks } from "@/lib/settings";

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
 * Hub-Zuteilung und Follow-up-Rhythmus. Enthält auch alle Orte, die die
 * PDLs selbst eingetragen oder per Auslage erfasst haben.
 */
export default async function ZielePage() {
  const session = await requireSession();
  const admin = createAdminClient();
  const followup = await getFollowupWeeks();

  // Fallback ?? [] — fehlt Migration 0026/0041, darf die Seite nicht crashen.
  const [{ data }, { data: contactRows }, { data: personRows }] =
    await Promise.all([
      admin.from("crm_targets").select("*").order("name"),
      admin
        .from("crm_contacts")
        .select("id, hub_id, target_id, kontakt_art, ansprechpartner, note, contact_date")
        .order("contact_date", { ascending: false })
        .order("created_at", { ascending: false })
        .limit(30),
      admin.from("crm_persons").select("*").order("name"),
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

  const hubNameOf = (id: string | null) =>
    session.hubs.find((h) => h.id === id)?.name ?? "—";
  const targetNameOf = (id: string | null) =>
    targets.find((t) => t.id === id)?.name ?? "Gelöschter Ort";

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold">Ziel-Orte (CRM)</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Deine zentrale Liste der Krankenhäuser, Praxen &amp; Co. — aufgeteilt
          auf die Hubs, inklusive aller Orte, die die PDLs selbst eingetragen
          oder per Auslage erfasst haben (Markierung „von PDL&rdquo;). Die PDLs
          arbeiten ihre Liste auf dem eigenen Dashboard ab; Follow-ups werden
          automatisch terminiert.
        </p>
      </div>

      {/* Kennzahlen */}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
        <Stat icon={MapPin} value={targets.length} label="Ziel-Orte gesamt" />
        <Stat icon={CalendarClock} value={faellig} label="Follow-up fällig" />
        <Stat icon={ListTodo} value={erstkontakt} label="Erstkontakt offen" />
        <Stat icon={UserPlus} value={vonPdl} label="Von PDLs eingetragen" />
        <Stat icon={Users} value={kontakte7} label="Kontakte (7 Tage)" />
      </div>

      <FollowupSettings initial={followup} />

      <ZieleView
        targets={targets}
        hubs={session.hubs.map((h) => ({ id: h.id, name: h.name }))}
        persons={personRows ?? []}
      />

      {/* Globales Kontakt-Log über alle Standorte */}
      {(contactRows ?? []).length > 0 && (
        <section className="flex flex-col gap-2 rounded-xl border bg-card p-5 shadow-sm">
          <p className="flex items-center gap-1.5 font-semibold">
            <CalendarClock className="size-4 text-primary" />
            Letzte Kontakte aller Standorte ({(contactRows ?? []).length})
          </p>
          <ul className="flex flex-col gap-1">
            {(contactRows ?? []).map((c) => (
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
