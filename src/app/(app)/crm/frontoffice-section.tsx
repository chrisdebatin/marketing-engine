import { Headset, TrendingUp, Users } from "lucide-react";
import { requireSession } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { LeadBoard, type LeadRow } from "@/components/lead-board";
import { LEAD_BEREICHE, leadQuelleLabel } from "@/lib/leads";
import { getFrontofficeToken } from "@/lib/frontoffice-token";
import { CopyLink } from "@/components/copy-link";
import { capacityWeekStart } from "@/lib/capacity";

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

/** Inbound-Leads (ehemals Frontoffice-Tab) — Sektion der CRM-Seite. */
export async function FrontofficeSection() {
  const session = await requireSession();
  const admin = createAdminClient();

  const cutoff28 = (() => {
    const d = new Date();
    d.setDate(d.getDate() - 28);
    return d.toISOString().slice(0, 10);
  })();
  const weekStart = capacityWeekStart();

  const foToken = await getFrontofficeToken();
  const { data: klinikRows } = await admin
    .from("crm_targets")
    .select("name")
    .eq("kategorie", "krankenhaus")
    .order("name")
    .limit(400);
  const klinikNamen = [...new Set((klinikRows ?? []).map((k) => k.name))].slice(0, 250);

  const { data: rows, error } = await admin
    .from("lead_calls")
    .select("*")
    .gte("call_date", cutoff28)
    .order("call_date", { ascending: false })
    .order("created_at", { ascending: false });
  const tableMissing = error?.code === "PGRST205" || error?.code === "42P01";
  const leads = (rows ?? []) as LeadRow[];

  const dieseWoche = leads.filter((l) => l.call_date >= weekStart).length;
  const heute = leads.filter(
    (l) => l.call_date === new Date().toISOString().slice(0, 10),
  ).length;

  const byBereich = new Map<string, number>();
  for (const l of leads) {
    const b = (l.bereich ?? "") || "ohne";
    byBereich.set(b, (byBereich.get(b) ?? 0) + 1);
  }

  const byQuelle = new Map<string, number>();
  const byHub = new Map<string, number>();
  for (const l of leads) {
    byQuelle.set(l.quelle, (byQuelle.get(l.quelle) ?? 0) + 1);
    const key = l.hub_id ?? "—";
    byHub.set(key, (byHub.get(key) ?? 0) + 1);
  }
  const quelleRows = [...byQuelle.entries()].sort((a, b) => b[1] - a[1]);
  const maxQuelle = Math.max(1, ...quelleRows.map(([, n]) => n));
  const hubName = (id: string) =>
    session.hubs.find((h) => h.id === id)?.name ?? "Nicht zugeordnet";
  const hubRows = [...byHub.entries()]
    .map(([id, n]) => ({ name: id === "—" ? "Nicht weitergeleitet" : hubName(id), n }))
    .sort((a, b) => b.n - a.n);

  return (
    <div className="flex flex-col gap-6">
      {tableMissing ? (
        <p className="rounded-xl border bg-card p-5 text-sm text-muted-foreground shadow-sm">
          Die Tabelle <code>lead_calls</code> fehlt noch — bitte einmal{" "}
          <code>supabase/apply_all_pending.sql</code> im Supabase SQL-Editor
          ausführen.
        </p>
      ) : (
        <>
          {/* Kennzahlen */}
          <div className="grid grid-cols-2 gap-2 lg:grid-cols-3">
            <Stat icon={Headset} value={heute} label="Leads heute" />
            <Stat icon={TrendingUp} value={dieseWoche} label="Leads diese Woche" />
            <Stat icon={Users} value={leads.length} label="Leads letzte 4 Wochen" />
          </div>
          <div className="grid grid-cols-3 gap-2">
            {LEAD_BEREICHE.map((b) => (
              <Stat
                key={b.key}
                icon={Headset}
                value={byBereich.get(b.key) ?? 0}
                label={`${b.label} (4 Wochen)`}
              />
            ))}
          </div>

          {/* Callcenter-Link (einer für das ganze Team) */}
          <section className="flex flex-col gap-2 rounded-xl border bg-card p-5 shadow-sm">
            <p className="font-semibold">Link für das Callcenter</p>
            <p className="text-sm text-muted-foreground">
              Diesen einen Link dem Callcenter-Team schicken — dort gibt es
              nur die Lead-Erfassung (Bereich wird pro Anruf gewählt), ohne
              das übrige Dashboard. Kein Login nötig.
            </p>
            {foToken ? (
              <div className="flex flex-wrap items-center gap-2 rounded-lg bg-muted/50 px-3 py-2 text-sm">
                <code className="min-w-0 flex-1 truncate text-xs text-muted-foreground">
                  /f/{foToken}
                </code>
                <CopyLink token={foToken} prefix="/f" />
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                Der Link erscheint, sobald die Tabelle app_settings existiert
                (supabase/apply_all_pending.sql ausführen).
              </p>
            )}
          </section>

          <LeadBoard
            hubs={session.hubs.map((h) => ({ id: h.id, name: h.name }))}
            recent={leads.slice(0, 30)}
            klinikNamen={klinikNamen}
          />

          {/* Auswertung: Quellen (letzte 4 Wochen) */}
          {quelleRows.length > 0 && (
            <section className="flex flex-col gap-2 rounded-xl border bg-card p-5 shadow-sm">
              <p className="font-semibold">
                Woher kommen die Leads? (letzte 4 Wochen)
              </p>
              <ul className="flex flex-col gap-1.5">
                {quelleRows.map(([q, n]) => (
                  <li key={q} className="flex items-center gap-2">
                    <span className="w-44 shrink-0 truncate text-sm text-muted-foreground">
                      {leadQuelleLabel(q)}
                    </span>
                    <span className="h-4 min-w-0 flex-1">
                      <span
                        className="block h-full rounded-r-[4px] bg-primary/70"
                        style={{ width: `${(n / maxQuelle) * 100}%` }}
                      />
                    </span>
                    <span className="w-8 shrink-0 text-right text-sm font-semibold tabular-nums">
                      {n}
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {/* Auswertung: Weiterleitung je Standort */}
          {hubRows.length > 0 && (
            <section className="flex flex-col gap-2 rounded-xl border bg-card p-5 shadow-sm">
              <p className="font-semibold">
                Weitergeleitet an (letzte 4 Wochen)
              </p>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[320px] text-sm">
                  <thead>
                    <tr className="border-b text-left text-xs text-muted-foreground">
                      <th className="py-1.5 pr-2 font-medium">Standort</th>
                      <th className="px-2 py-1.5 font-medium">Leads</th>
                    </tr>
                  </thead>
                  <tbody>
                    {hubRows.map((r) => (
                      <tr key={r.name} className="border-b last:border-b-0">
                        <td className="py-1.5 pr-2 font-medium">{r.name}</td>
                        <td className="px-2 py-1.5 font-semibold tabular-nums">
                          {r.n}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          )}
        </>
      )}
    </div>
  );
}
