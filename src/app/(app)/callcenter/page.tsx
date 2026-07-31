import { CalendarClock, ListTodo, PhoneCall, PhoneOutgoing } from "lucide-react";
import { requireSession } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { crmStatus, todayIso } from "@/lib/crm";
import { getCallcenterToken } from "@/lib/frontoffice-token";
import { CopyLink } from "@/components/copy-link";
import {
  CallcenterCrm,
  type CallcenterContactRow,
} from "@/components/callcenter-crm";
import type {
  CrmPersonRow,
  CrmTargetRow,
} from "@/components/crm-targets-manager";

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
 * Call-Center: Klinik-Kontakte auf Basis des zentralen CRM (crm_targets/
 * crm_contacts/crm_persons) — dieselben Daten, mit denen auch die PDLs auf
 * ihren Dashboards arbeiten. Intern plus Team-Link /c/<token> ohne Login.
 */
export default async function CallcenterPage() {
  await requireSession();
  const admin = createAdminClient();
  const ccToken = await getCallcenterToken();

  const cutoff28 = (() => {
    const d = new Date();
    d.setDate(d.getDate() - 28);
    return d.toISOString().slice(0, 10);
  })();

  const [
    { data: targetRows },
    { data: personRows },
    { data: contactRows },
    { data: hubRows },
  ] = await Promise.all([
    admin.from("crm_targets").select("*").order("name").limit(2000),
    admin.from("crm_persons").select("*").order("name").limit(4000),
    admin
      .from("crm_contacts")
      .select("id, target_id, kontakt_art, ansprechpartner, note, contact_date")
      .order("contact_date", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(500),
    admin.from("hubs").select("id, name, pdl_name, pdl_phone").order("name"),
  ]);

  const targets = (targetRows ?? []) as CrmTargetRow[];
  const contacts = (contactRows ?? []) as CallcenterContactRow[];

  const today = todayIso();
  const cutoff7 = (() => {
    const d = new Date();
    d.setDate(d.getDate() - 7);
    return d.toISOString().slice(0, 10);
  })();
  const faellig = targets.filter((t) => crmStatus(t, today) === "faellig").length;
  const nieKontaktiert = targets.filter(
    (t) => crmStatus(t, today) === "erstbesuch",
  ).length;
  const anrufe7 = contacts.filter(
    (c) => c.kontakt_art === "anruf" && c.contact_date >= cutoff7,
  ).length;
  const anrufe28 = contacts.filter(
    (c) => c.kontakt_art === "anruf" && c.contact_date >= cutoff28,
  ).length;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold">Call-Center · Klinik-Kontakte</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Die Anruf-Liste der Kliniken &amp; Co. abarbeiten und jeden Anruf
          loggen. Das Call-Center arbeitet auf dem
          zentralen CRM („Ziele“) — denselben Institutionen, Ansprechpartnern
          und Kontakt-Historien wie die PDLs auf ihren Dashboards.
        </p>
      </div>

      {/* Kennzahlen */}
      <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
        <Stat icon={CalendarClock} value={faellig} label="Anrufe fällig" />
        <Stat
          icon={ListTodo}
          value={nieKontaktiert}
          label="Noch nie kontaktiert"
        />
        <Stat icon={PhoneCall} value={anrufe7} label="Anrufe (7 Tage)" />
        <Stat icon={PhoneCall} value={anrufe28} label="Anrufe (4 Wochen)" />
      </div>

      {/* Team-Link (ohne Login) */}
      <section className="flex flex-col gap-2 rounded-xl border bg-card p-5 shadow-sm">
        <p className="flex items-center gap-1.5 font-semibold">
          <PhoneOutgoing className="size-4 text-primary" />
          Link für das Call-Center-Team
        </p>
        <p className="text-sm text-muted-foreground">
          Diesen Link dem Team schicken — dort gibt es genau diese
          Anruf-Liste (Ansprechpartner, Historie, Anruf-Log) ohne das
          übrige Dashboard. Kein Login nötig.
        </p>
        {ccToken ? (
          <div className="flex flex-wrap items-center gap-2 rounded-lg bg-muted/50 px-3 py-2 text-sm">
            <code className="min-w-0 flex-1 truncate text-xs text-muted-foreground">
              /c/{ccToken}
            </code>
            <CopyLink token={ccToken} prefix="/c" />
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">
            Der Link erscheint, sobald die Tabelle app_settings existiert
            (supabase/apply_all_pending.sql ausführen).
          </p>
        )}
      </section>

      <CallcenterCrm
        targets={targets}
        persons={(personRows ?? []) as CrmPersonRow[]}
        contacts={contacts}
        hubs={hubRows ?? []}
      />
    </div>
  );
}
