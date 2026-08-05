import Image from "next/image";
import { ExternalLink, LayoutGrid } from "lucide-react";
import { metaAdAccountId, metaConfigured, metaFetch } from "@/lib/meta-api";
import { cn } from "@/lib/utils";

interface CampaignRow {
  id: string;
  name: string;
  effective_status: string;
  objective?: string;
  created_time?: string;
}
interface AdsetRow {
  campaign_id: string;
  daily_budget?: string;
  effective_status: string;
}
interface AdRow {
  campaign_id: string;
  creative?: {
    thumbnail_url?: string;
    object_story_spec?: {
      link_data?: { link?: string };
      video_data?: { call_to_action?: { value?: { link?: string } } };
    };
  };
}

function adLink(ad: AdRow): string | null {
  const spec = ad.creative?.object_story_spec;
  return (
    spec?.link_data?.link ??
    spec?.video_data?.call_to_action?.value?.link ??
    null
  );
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

const STATUS_LABEL: Record<string, string> = {
  ACTIVE: "live",
  PAUSED: "pausiert",
  CAMPAIGN_PAUSED: "pausiert",
  ARCHIVED: "archiviert",
  DELETED: "gelöscht",
  IN_PROCESS: "in Prüfung",
  WITH_ISSUES: "Problem",
};

/**
 * Kachel-Übersicht ALLER Kampagnen (unter dem Chat): Status, Tagesbudget,
 * Lifetime-Stats und Mini-Vorschauen der Anzeigen-Creatives — alles live
 * aus der Meta-API.
 */
export async function MetaCampaignGrid() {
  if (!metaConfigured()) return null;

  let campaigns: CampaignRow[];
  let adsets: AdsetRow[];
  let ads: AdRow[];
  let insights: InsightRow[];
  try {
    const acct = metaAdAccountId();
    const [c, a, ad, i] = await Promise.all([
      metaFetch(`${acct}/campaigns`, {
        fields: "id,name,effective_status,objective,created_time",
        limit: "50",
      }),
      metaFetch(`${acct}/adsets`, {
        fields: "campaign_id,daily_budget,effective_status",
        limit: "200",
      }),
      metaFetch(`${acct}/ads`, {
        fields: "campaign_id,creative{thumbnail_url,object_story_spec}",
        limit: "200",
      }),
      metaFetch(`${acct}/insights`, {
        level: "campaign",
        date_preset: "maximum",
        fields: "campaign_id,spend,impressions,actions",
      }),
    ]);
    campaigns = (c.data ?? []) as CampaignRow[];
    adsets = (a.data ?? []) as AdsetRow[];
    ads = (ad.data ?? []) as AdRow[];
    insights = (i.data ?? []) as InsightRow[];
  } catch {
    return null; // Übersicht oben zeigt Fehler bereits an
  }

  const visible = campaigns.filter(
    (c) => !["ARCHIVED", "DELETED"].includes(c.effective_status),
  );
  if (visible.length === 0) return null;

  const order = (s: string) => (s === "ACTIVE" ? 0 : 1);
  visible.sort(
    (a, b) =>
      order(a.effective_status) - order(b.effective_status) ||
      (b.created_time ?? "").localeCompare(a.created_time ?? ""),
  );

  return (
    <section className="flex flex-col gap-3 border-t pt-5">
      <h2 className="flex items-center gap-2 text-lg font-semibold">
        <LayoutGrid className="size-4 text-primary" />
        Alle Kampagnen
      </h2>
      <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {visible.map((c) => {
          const active = c.effective_status === "ACTIVE";
          const ins = insights.find((i) => i.campaign_id === c.id);
          const spend = Number(ins?.spend) || 0;
          const impressions = Number(ins?.impressions) || 0;
          const leads = leadsFrom(ins?.actions);
          const budget =
            adsets
              .filter(
                (s) =>
                  s.campaign_id === c.id &&
                  (active ? s.effective_status === "ACTIVE" : true),
              )
              .reduce((sum, s) => sum + (Number(s.daily_budget) || 0), 0) / 100;
          const campaignAds = ads.filter((a) => a.campaign_id === c.id);
          const thumbs = campaignAds
            .filter((a) => a.creative?.thumbnail_url)
            .map((a) => a.creative!.thumbnail_url!)
            .slice(0, 4);
          const links = [
            ...new Set(campaignAds.map(adLink).filter(Boolean) as string[]),
          ];
          return (
            <li
              key={c.id}
              className="flex flex-col gap-2.5 rounded-xl border bg-card p-4 shadow-sm"
            >
              <div className="flex items-start justify-between gap-2">
                <span className="min-w-0 truncate text-sm font-medium" title={c.name}>
                  {c.name}
                </span>
                <span
                  className={cn(
                    "flex shrink-0 items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-semibold",
                    active
                      ? "bg-emerald-100 text-emerald-800"
                      : "bg-muted text-muted-foreground",
                  )}
                >
                  {active && (
                    <span className="size-1.5 animate-pulse rounded-full bg-emerald-600" />
                  )}
                  {STATUS_LABEL[c.effective_status] ?? c.effective_status.toLowerCase()}
                </span>
              </div>

              {thumbs.length > 0 ? (
                <div className="flex gap-1.5">
                  {thumbs.map((t, i) => (
                    <Image
                      key={i}
                      src={t}
                      alt=""
                      width={64}
                      height={64}
                      unoptimized
                      className="size-14 rounded-md border object-cover"
                    />
                  ))}
                </div>
              ) : (
                <p className="text-xs text-muted-foreground">Noch keine Anzeigen.</p>
              )}

              {links.length > 0 && (
                <p className="flex min-w-0 items-center gap-1 text-xs">
                  <ExternalLink className="size-3 shrink-0 text-muted-foreground" />
                  {links.map((l, i) => (
                    <a
                      key={l}
                      href={l}
                      target="_blank"
                      rel="noreferrer"
                      className="truncate text-primary hover:underline"
                      title={l}
                    >
                      {l.replace(/^https?:\/\/(www\.)?/, "")}
                      {i < links.length - 1 && ","}
                    </a>
                  ))}
                </p>
              )}

              <dl className="mt-auto grid grid-cols-4 gap-x-2 gap-y-0.5 text-sm">
                <dt className="col-start-1 row-start-1 text-[11px] text-muted-foreground">
                  Budget/Tag
                </dt>
                <dd className="col-start-1 row-start-2 font-medium">
                  {budget > 0 ? euro(budget) : "—"}
                </dd>
                <dt className="col-start-2 row-start-1 text-[11px] text-muted-foreground">
                  Ausgaben
                </dt>
                <dd className="col-start-2 row-start-2 font-medium">{euro(spend)}</dd>
                <dt className="col-start-3 row-start-1 text-[11px] text-muted-foreground">
                  Impress.
                </dt>
                <dd className="col-start-3 row-start-2 font-medium">
                  {impressions.toLocaleString("de-DE")}
                </dd>
                <dt className="col-start-4 row-start-1 text-[11px] text-muted-foreground">
                  Leads (CPL)
                </dt>
                <dd className="col-start-4 row-start-2 font-medium">
                  {leads}
                  {leads > 0 && (
                    <span className="text-xs font-normal text-muted-foreground">
                      {" "}
                      ({euro(spend / leads)})
                    </span>
                  )}
                </dd>
              </dl>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
