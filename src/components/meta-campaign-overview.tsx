import { Radio } from "lucide-react";
import { metaAdAccountId, metaConfigured, metaFetch } from "@/lib/meta-api";

interface CampaignRow {
  id: string;
  name: string;
  effective_status: string;
  objective: string;
}
interface AdsetRow {
  campaign_id: string;
  daily_budget?: string;
  effective_status: string;
}
interface InsightRow {
  campaign_id: string;
  spend?: string;
  impressions?: string;
  actions?: { action_type: string; value: string }[];
}

function leadsFrom(actions?: { action_type: string; value: string }[]): number {
  if (!actions) return 0;
  const lead =
    actions.find((a) => a.action_type === "lead") ??
    actions.find((a) => a.action_type === "onsite_conversion.lead_grouped");
  return lead ? Number(lead.value) || 0 : 0;
}

const euro = (n: number) =>
  n.toLocaleString("de-DE", { style: "currency", currency: "EUR" });

/**
 * Live-Übersicht direkt aus der Meta-API: welche Kampagnen laufen gerade,
 * mit Tagesbudget und Ausgaben/Leads der letzten 7 Tage. Server-gerendert
 * bei jedem Seitenaufruf (Seite ist force-dynamic).
 */
export async function MetaCampaignOverview() {
  if (!metaConfigured()) return null;

  let campaigns: CampaignRow[];
  let adsets: AdsetRow[];
  let insights: InsightRow[];
  try {
    const acct = metaAdAccountId();
    const [c, a, i] = await Promise.all([
      metaFetch(`${acct}/campaigns`, {
        fields: "id,name,effective_status,objective",
        limit: "50",
      }),
      metaFetch(`${acct}/adsets`, {
        fields: "campaign_id,daily_budget,effective_status",
        limit: "100",
      }),
      // Metas Preset "last_7d" zählt OHNE heute — junge Kampagnen zeigen
      // dann 0. Deshalb expliziter Zeitraum: letzte 7 Tage inkl. heute.
      metaFetch(`${acct}/insights`, {
        level: "campaign",
        time_range: JSON.stringify({
          since: new Date(Date.now() - 6 * 86400_000).toISOString().slice(0, 10),
          until: new Date().toISOString().slice(0, 10),
        }),
        fields: "campaign_id,spend,impressions,actions",
      }),
    ]);
    campaigns = (c.data ?? []) as CampaignRow[];
    adsets = (a.data ?? []) as AdsetRow[];
    insights = (i.data ?? []) as InsightRow[];
  } catch (err) {
    return (
      <p className="rounded-xl border bg-card p-4 text-sm text-muted-foreground shadow-sm">
        Kampagnen-Übersicht nicht ladbar (Meta-API:{" "}
        {err instanceof Error ? err.message : "Fehler"}).
      </p>
    );
  }

  if (campaigns.length === 0) return null;

  const live = campaigns.filter((c) => c.effective_status === "ACTIVE");
  const paused = campaigns.length - live.length;
  const budgetOf = (id: string) => {
    const own = adsets.filter((s) => s.campaign_id === id);
    const activeSum =
      own
        .filter((s) => s.effective_status === "ACTIVE")
        .reduce((sum, s) => sum + (Number(s.daily_budget) || 0), 0) / 100;
    const totalSum =
      own.reduce((sum, s) => sum + (Number(s.daily_budget) || 0), 0) / 100;
    // Kampagne live, aber alle Ad Sets pausiert → Budget trotzdem zeigen,
    // mit Hinweis, dass nichts ausgeliefert wird.
    return { budget: activeSum > 0 ? activeSum : totalSum, delivering: activeSum > 0 };
  };
  const insightOf = (id: string) => insights.find((i) => i.campaign_id === id);

  return (
    <section className="flex flex-col gap-3">
      <h2 className="flex items-center gap-2 text-lg font-semibold">
        <Radio className="size-4 text-primary" />
        Kampagnen
        {live.length > 0 && (
          <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-semibold text-emerald-800">
            {live.length} live
          </span>
        )}
      </h2>

      {live.length === 0 ? (
        <p className="rounded-xl border bg-card p-4 text-sm text-muted-foreground shadow-sm">
          Aktuell läuft keine Kampagne
          {paused > 0 && ` (${paused} pausiert)`}.
        </p>
      ) : (
        <ul className="grid gap-3 lg:grid-cols-2">
          {live.map((c) => {
            const ins = insightOf(c.id);
            const spend = Number(ins?.spend) || 0;
            const leads = leadsFrom(ins?.actions);
            const { budget, delivering } = budgetOf(c.id);
            return (
              <li
                key={c.id}
                className="flex flex-col gap-2 rounded-xl border bg-card p-4 shadow-sm"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="truncate font-medium" title={c.name}>
                    {c.name}
                  </span>
                  <span className="flex shrink-0 items-center gap-1.5 rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-semibold text-emerald-800">
                    <span className="size-1.5 animate-pulse rounded-full bg-emerald-600" />
                    live
                  </span>
                </div>
                <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm sm:grid-cols-4">
                  <div>
                    <dt className="text-xs text-muted-foreground">Tagesbudget</dt>
                    <dd className="font-medium">
                      {budget > 0 ? euro(budget) : "—"}
                      {!delivering && budget > 0 && (
                        <span className="block text-[11px] font-normal text-amber-600">
                          Ad Set pausiert
                        </span>
                      )}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs text-muted-foreground">Ausgaben 7 T.</dt>
                    <dd className="font-medium">{euro(spend)}</dd>
                  </div>
                  <div>
                    <dt className="text-xs text-muted-foreground">Leads 7 T.</dt>
                    <dd className="font-medium">{leads}</dd>
                  </div>
                  <div>
                    <dt className="text-xs text-muted-foreground">Kosten/Lead</dt>
                    <dd className="font-medium">
                      {leads > 0 ? euro(spend / leads) : "—"}
                    </dd>
                  </div>
                </dl>
                {c.objective && (
                  <p className="text-xs text-muted-foreground">
                    Ziel: {c.objective.replace("OUTCOME_", "").toLowerCase()}
                  </p>
                )}
              </li>
            );
          })}
        </ul>
      )}
      {live.length > 0 && paused > 0 && (
        <p className="text-xs text-muted-foreground">
          {paused} weitere Kampagne{paused === 1 ? "" : "n"} pausiert — Details
          beim Agenten erfragen.
        </p>
      )}
    </section>
  );
}
