import Anthropic from "@anthropic-ai/sdk";
import { NextResponse } from "next/server";
import { requireSession } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  MetaApiError,
  getPageAccessToken,
  getVideoThumbnail,
  metaAdAccountId,
  metaConfigured,
  metaFetch,
  metaPageId,
  uploadAdImage,
  uploadAdVideo,
  waitForVideoReady,
} from "@/lib/meta-api";

export const runtime = "nodejs";
export const maxDuration = 300;

const MODEL = process.env.ANTHROPIC_MODEL || "claude-opus-4-8";
const MAX_TURNS = 15;

// ---- Tools -----------------------------------------------------------------

const tools: Anthropic.Tool[] = [
  {
    name: "get_ad_account",
    description:
      "Basisdaten des Werbekontos: Name, Währung, Status, bisherige Ausgaben.",
    input_schema: { type: "object", properties: {}, additionalProperties: false },
  },
  {
    name: "list_campaigns",
    description:
      "Alle Kampagnen im Werbekonto mit Status, Ziel (objective), Budget und Laufzeit.",
    input_schema: { type: "object", properties: {}, additionalProperties: false },
  },
  {
    name: "list_ad_sets",
    description: "Ad Sets (optional nur einer Kampagne) mit Budget, Optimierungsziel und Targeting.",
    input_schema: {
      type: "object",
      properties: {
        campaign_id: { type: "string", description: "Optional: nur Ad Sets dieser Kampagne." },
      },
      additionalProperties: false,
    },
  },
  {
    name: "list_ads",
    description: "Anzeigen (optional nur eines Ad Sets) mit Status und Creative-ID.",
    input_schema: {
      type: "object",
      properties: {
        adset_id: { type: "string", description: "Optional: nur Ads dieses Ad Sets." },
      },
      additionalProperties: false,
    },
  },
  {
    name: "get_insights",
    description:
      "Performance-Kennzahlen (Spend, Impressions, Reach, Frequency, CPM, CPC, CTR, Leads, Cost per Lead) auf Konto-, Kampagnen-, Ad-Set- oder Ad-Ebene.",
    input_schema: {
      type: "object",
      properties: {
        level: {
          type: "string",
          enum: ["account", "campaign", "adset", "ad"],
          description: "Aggregations-Ebene (Standard: campaign).",
        },
        date_preset: {
          type: "string",
          enum: [
            "today",
            "yesterday",
            "last_7d",
            "last_14d",
            "last_30d",
            "last_90d",
            "this_month",
            "last_month",
            "maximum",
          ],
          description: "Zeitraum-Vorlage (Standard: last_30d).",
        },
        since: { type: "string", description: "Optional: Startdatum JJJJ-MM-TT (statt date_preset)." },
        until: { type: "string", description: "Optional: Enddatum JJJJ-MM-TT." },
        object_id: {
          type: "string",
          description: "Optional: Insights nur für diese Kampagne/dieses Ad Set/diese Ad statt fürs ganze Konto.",
        },
      },
      additionalProperties: false,
    },
  },
  {
    name: "search_locations",
    description:
      "Sucht Geo-Targeting-Schlüssel (Stadt/Region) für einen Ortsnamen, z. B. 'Essen'. Nötig vor create_ad_set mit Städte-Targeting.",
    input_schema: {
      type: "object",
      properties: {
        query: { type: "string", description: "Ortsname, z. B. 'Essen' oder 'Velbert'." },
      },
      required: ["query"],
      additionalProperties: false,
    },
  },
  {
    name: "list_uploaded_creatives",
    description:
      "Listet die in der Marketing-Engine hochgeladenen Werbemittel (Bilder) mit ID, Name und Notiz. Diese IDs werden bei create_ad als creative_upload_id verwendet.",
    input_schema: { type: "object", properties: {}, additionalProperties: false },
  },
  {
    name: "list_lead_forms",
    description:
      "Listet vorhandene Instant-Formulare (Lead-Formulare) der Facebook-Seite. Für Lead-Kampagnen mit destination ON_AD nötig.",
    input_schema: { type: "object", properties: {}, additionalProperties: false },
  },
  {
    name: "create_campaign",
    description:
      "Legt eine neue Kampagne an — IMMER im Status PAUSED. Für Mitarbeiter-/Job-Kampagnen MUSS special_ad_category 'EMPLOYMENT' gesetzt werden.",
    input_schema: {
      type: "object",
      properties: {
        name: { type: "string", description: "Kampagnen-Name nach Namenskonvention." },
        objective: {
          type: "string",
          enum: ["OUTCOME_LEADS", "OUTCOME_TRAFFIC", "OUTCOME_AWARENESS", "OUTCOME_ENGAGEMENT"],
          description: "Kampagnenziel.",
        },
        special_ad_category: {
          type: "string",
          enum: ["NONE", "EMPLOYMENT"],
          description: "EMPLOYMENT bei Stellen-/Recruiting-Kampagnen, sonst NONE.",
        },
      },
      required: ["name", "objective", "special_ad_category"],
      additionalProperties: false,
    },
  },
  {
    name: "create_ad_set",
    description:
      "Legt ein Ad Set an — IMMER PAUSED. Geo-Targeting entweder per address (Umkreis um eine konkrete Adresse, z. B. die Hub-Adresse — Radius ab 1 km, BEVORZUGT für 'X km um den Standort') ODER per city_keys aus search_locations (Stadt-Targeting, Radius min. 17 km). Bei EMPLOYMENT-Kampagnen keine Alters-/Geschlechts-Einschränkung angeben.",
    input_schema: {
      type: "object",
      properties: {
        campaign_id: { type: "string" },
        name: { type: "string" },
        daily_budget_euro: { type: "number", description: "Tagesbudget in Euro, z. B. 20." },
        optimization_goal: {
          type: "string",
          enum: ["LEAD_GENERATION", "LINK_CLICKS", "LANDING_PAGE_VIEWS", "REACH"],
        },
        destination_type: {
          type: "string",
          enum: ["ON_AD", "WEBSITE"],
          description: "ON_AD = Instant-Formular (Lead Ads), WEBSITE = Klick zur Website.",
        },
        address: {
          type: "string",
          description:
            "Volle Adresse als Umkreis-Mittelpunkt (Meta geokodiert selbst), z. B. 'Lange Straße 41-43, 31840 Hessisch-Oldendorf, Deutschland'. Alternative zu city_keys.",
        },
        city_keys: {
          type: "array",
          items: { type: "string" },
          description: "Geo-Keys aus search_locations (Städte). Alternative zu address.",
        },
        radius_km: {
          type: "number",
          description:
            "Umkreis in km (Standard 25). Bei address ab 1 km möglich, bei city_keys min. 17 km.",
        },
        age_min: { type: "integer", description: "Optional, NICHT bei EMPLOYMENT." },
        age_max: { type: "integer", description: "Optional, NICHT bei EMPLOYMENT." },
      },
      required: ["campaign_id", "name", "daily_budget_euro", "optimization_goal"],
      additionalProperties: false,
    },
  },
  {
    name: "create_ad",
    description:
      "Legt Creative + Anzeige in einem Ad Set an — IMMER PAUSED. Nutzt ein hochgeladenes Werbemittel (creative_upload_id aus list_uploaded_creatives); Bilder UND Videos (mp4/mov) werden unterstützt. Hinweis: Meta verarbeitet Videos asynchron — falls das Tool meldet, das Video sei noch in Verarbeitung, kurz warten und den Aufruf wiederholen (das Video wird nicht erneut hochgeladen).",
    input_schema: {
      type: "object",
      properties: {
        adset_id: { type: "string" },
        name: { type: "string" },
        creative_upload_id: {
          type: "string",
          description: "ID eines hochgeladenen Werbemittels (Bild).",
        },
        message: { type: "string", description: "Primärtext der Anzeige." },
        headline: { type: "string", description: "Überschrift (max ~40 Zeichen)." },
        description: { type: "string", description: "Beschreibung (optional)." },
        link_url: { type: "string", description: "Ziel-URL (Website) bzw. Seiten-URL bei Lead Ads." },
        cta_type: {
          type: "string",
          enum: ["LEARN_MORE", "SIGN_UP", "CONTACT_US", "APPLY_NOW", "GET_QUOTE"],
          description: "Call-to-Action-Button.",
        },
        lead_gen_form_id: {
          type: "string",
          description: "Optional: Instant-Formular-ID (aus list_lead_forms) für Lead Ads.",
        },
      },
      required: ["adset_id", "name", "creative_upload_id", "message", "headline", "link_url", "cta_type"],
      additionalProperties: false,
    },
  },
  {
    name: "set_status",
    description:
      "Pausiert oder aktiviert eine Kampagne / ein Ad Set / eine Ad. Aktivieren (ACTIVE) ist NUR erlaubt, wenn der Nutzer es in dieser Unterhaltung ausdrücklich freigegeben hat — dann user_confirmed=true setzen.",
    input_schema: {
      type: "object",
      properties: {
        object_id: { type: "string" },
        status: { type: "string", enum: ["ACTIVE", "PAUSED"] },
        user_confirmed: {
          type: "boolean",
          description: "true NUR nach ausdrücklicher Freigabe des Nutzers im Chat.",
        },
      },
      required: ["object_id", "status"],
      additionalProperties: false,
    },
  },
  {
    name: "update_daily_budget",
    description:
      "Ändert das Tagesbudget eines Ad Sets. Erhöhungen NUR nach ausdrücklicher Freigabe des Nutzers (user_confirmed=true).",
    input_schema: {
      type: "object",
      properties: {
        adset_id: { type: "string" },
        daily_budget_euro: { type: "number" },
        user_confirmed: { type: "boolean" },
      },
      required: ["adset_id", "daily_budget_euro"],
      additionalProperties: false,
    },
  },
];

// ---- Tool execution --------------------------------------------------------

const INSIGHT_FIELDS =
  "spend,impressions,reach,frequency,cpm,cpc,ctr,clicks,actions,cost_per_action_type,campaign_name,adset_name,ad_name";

async function runTool(
  name: string,
  input: Record<string, unknown>,
): Promise<unknown> {
  const acct = metaAdAccountId();

  if (name === "get_ad_account") {
    return metaFetch(acct, {
      fields: "name,currency,account_status,amount_spent,spend_cap,timezone_name",
    });
  }

  if (name === "list_campaigns") {
    const r = await metaFetch(`${acct}/campaigns`, {
      fields:
        "id,name,status,effective_status,objective,special_ad_categories,daily_budget,lifetime_budget,created_time,start_time,stop_time",
      limit: "100",
    });
    return r.data ?? [];
  }

  if (name === "list_ad_sets") {
    const parent = input.campaign_id ? String(input.campaign_id) : acct;
    const r = await metaFetch(`${parent}/adsets`, {
      fields:
        "id,name,status,effective_status,campaign_id,daily_budget,optimization_goal,billing_event,destination_type,targeting,learning_stage_info",
      limit: "100",
    });
    return r.data ?? [];
  }

  if (name === "list_ads") {
    const parent = input.adset_id ? String(input.adset_id) : acct;
    const r = await metaFetch(`${parent}/ads`, {
      fields: "id,name,status,effective_status,adset_id,creative{id,thumbnail_url}",
      limit: "100",
    });
    return r.data ?? [];
  }

  if (name === "get_insights") {
    const objectId = input.object_id ? String(input.object_id) : acct;
    const params: Record<string, string> = {
      fields: INSIGHT_FIELDS,
      level: String(input.level ?? "campaign"),
    };
    if (input.since && input.until) {
      params.time_range = JSON.stringify({
        since: String(input.since),
        until: String(input.until),
      });
    } else {
      params.date_preset = String(input.date_preset ?? "last_30d");
    }
    const r = await metaFetch(`${objectId}/insights`, params);
    return r.data ?? [];
  }

  if (name === "search_locations") {
    const r = await metaFetch("search", {
      type: "adgeolocation",
      q: String(input.query ?? ""),
      location_types: JSON.stringify(["city", "region"]),
      country_code: "DE",
      limit: "8",
    });
    return r.data ?? [];
  }

  if (name === "list_uploaded_creatives") {
    const admin = createAdminClient();
    const { data, error } = await admin
      .from("meta_creatives")
      .select("id, name, url, mime, notiz, created_at")
      .order("created_at", { ascending: false });
    if (error) throw new Error("Werbemittel-Katalog nicht ladbar (Tabelle meta_creatives fehlt?).");
    return data ?? [];
  }

  if (name === "list_lead_forms") {
    const pageId = metaPageId();
    if (!pageId) throw new Error("Keine META_PAGE_ID konfiguriert.");
    // leadgen_forms akzeptiert nur einen Page Access Token.
    const pageToken = await getPageAccessToken(pageId);
    const r = await metaFetch(
      `${pageId}/leadgen_forms`,
      { fields: "id,name,status,created_time", limit: "50" },
      "GET",
      pageToken,
    );
    return r.data ?? [];
  }

  if (name === "create_campaign") {
    const special = String(input.special_ad_category ?? "NONE");
    const r = await metaFetch(
      `${acct}/campaigns`,
      {
        name: String(input.name ?? "").slice(0, 200),
        objective: String(input.objective),
        status: "PAUSED", // Sicherheitsregel: nie aktiv anlegen
        buying_type: "AUCTION",
        special_ad_categories: JSON.stringify(special === "NONE" ? [] : [special]),
        // Pflichtfeld bei Kampagnen ohne Kampagnenbudget (Budget liegt bei
        // uns immer am Ad Set): kein Budget-Sharing zwischen Ad Sets.
        is_adset_budget_sharing_enabled: "false",
      },
      "POST",
    );
    return { created_campaign_id: r.id, status: "PAUSED" };
  }

  if (name === "create_ad_set") {
    const cityKeys = Array.isArray(input.city_keys) ? input.city_keys.map(String) : [];
    const address = String(input.address ?? "").trim();
    if (cityKeys.length === 0 && !address) {
      throw new Error("Geo-Targeting fehlt: entweder address oder city_keys angeben.");
    }
    const geoLocations: Record<string, unknown> = address
      ? {
          custom_locations: [
            {
              address_string: address,
              radius: Math.min(Math.max(Number(input.radius_km) || 25, 1), 80),
              distance_unit: "kilometer",
            },
          ],
        }
      : {
          cities: cityKeys.map((key) => ({
            key,
            radius: Math.min(Math.max(Number(input.radius_km) || 25, 17), 80),
            distance_unit: "kilometer",
          })),
        };
    const targeting: Record<string, unknown> = { geo_locations: geoLocations };
    if (input.age_min) targeting.age_min = Number(input.age_min);
    if (input.age_max) targeting.age_max = Number(input.age_max);

    const budgetCents = Math.round(Number(input.daily_budget_euro) * 100);
    if (!Number.isFinite(budgetCents) || budgetCents < 100) {
      throw new Error("Tagesbudget muss mindestens 1 € sein.");
    }

    const params: Record<string, string> = {
      name: String(input.name ?? "").slice(0, 200),
      campaign_id: String(input.campaign_id),
      daily_budget: String(budgetCents),
      billing_event: "IMPRESSIONS",
      optimization_goal: String(input.optimization_goal),
      bid_strategy: "LOWEST_COST_WITHOUT_CAP",
      targeting: JSON.stringify(targeting),
      status: "PAUSED", // Sicherheitsregel
    };
    if (input.destination_type) params.destination_type = String(input.destination_type);
    if (input.optimization_goal === "LEAD_GENERATION") {
      const pageId = metaPageId();
      if (!pageId) throw new Error("Für Lead-Ad-Sets wird META_PAGE_ID benötigt.");
      params.promoted_object = JSON.stringify({ page_id: pageId });
    }
    const r = await metaFetch(`${acct}/adsets`, params, "POST");
    return { created_adset_id: r.id, status: "PAUSED", daily_budget_euro: budgetCents / 100 };
  }

  if (name === "create_ad") {
    const pageId = metaPageId();
    if (!pageId) throw new Error("Keine META_PAGE_ID konfiguriert — ohne Seite keine Anzeige.");

    const admin = createAdminClient();
    const { data: creative } = await admin
      .from("meta_creatives")
      .select("id, name, url, mime, meta_video_id")
      .eq("id", String(input.creative_upload_id))
      .maybeSingle();
    if (!creative) throw new Error("creative_upload_id unbekannt — list_uploaded_creatives nutzen.");

    const callToAction = input.lead_gen_form_id
      ? {
          type: String(input.cta_type),
          value: {
            link: String(input.link_url),
            lead_gen_form_id: String(input.lead_gen_form_id),
          },
        }
      : { type: String(input.cta_type), value: { link: String(input.link_url) } };

    let objectStorySpec: Record<string, unknown>;
    if (creative.mime.startsWith("video/")) {
      // Video: einmal zu Meta hochladen (ID merken für Retries), Verarbeitung
      // abwarten, Thumbnail holen — dann video_data-Creative bauen.
      let videoId = creative.meta_video_id;
      if (!videoId) {
        videoId = await uploadAdVideo(creative.url, creative.name);
        await admin
          .from("meta_creatives")
          .update({ meta_video_id: videoId })
          .eq("id", creative.id);
      }
      await waitForVideoReady(videoId);
      const thumb = await getVideoThumbnail(videoId);
      const videoData: Record<string, unknown> = {
        video_id: videoId,
        image_url: thumb,
        message: String(input.message ?? "").slice(0, 2000),
        title: String(input.headline ?? "").slice(0, 255),
        call_to_action: callToAction,
      };
      if (input.description) {
        videoData.link_description = String(input.description).slice(0, 255);
      }
      objectStorySpec = { page_id: pageId, video_data: videoData };
    } else {
      const imageHash = await uploadAdImage(creative.url);
      const linkData: Record<string, unknown> = {
        message: String(input.message ?? "").slice(0, 2000),
        name: String(input.headline ?? "").slice(0, 255),
        link: String(input.link_url),
        image_hash: imageHash,
        call_to_action: callToAction,
      };
      if (input.description) linkData.description = String(input.description).slice(0, 255);
      objectStorySpec = { page_id: pageId, link_data: linkData };
    }

    const creativeRes = await metaFetch(
      `${acct}/adcreatives`,
      {
        name: `${String(input.name ?? "Creative").slice(0, 150)} — Creative`,
        object_story_spec: JSON.stringify(objectStorySpec),
      },
      "POST",
    );

    const adRes = await metaFetch(
      `${acct}/ads`,
      {
        name: String(input.name ?? "").slice(0, 200),
        adset_id: String(input.adset_id),
        creative: JSON.stringify({ creative_id: creativeRes.id }),
        status: "PAUSED", // Sicherheitsregel
      },
      "POST",
    );
    return {
      created_ad_id: adRes.id,
      creative_id: creativeRes.id,
      used_upload: creative.name,
      status: "PAUSED",
    };
  }

  if (name === "set_status") {
    const status = String(input.status);
    if (status === "ACTIVE" && input.user_confirmed !== true) {
      throw new Error(
        "Aktivieren blockiert: Der Nutzer muss es zuerst ausdrücklich im Chat freigeben. Frage nach und rufe das Tool danach mit user_confirmed=true erneut auf.",
      );
    }
    await metaFetch(String(input.object_id), { status }, "POST");
    return { object_id: input.object_id, new_status: status };
  }

  if (name === "update_daily_budget") {
    if (input.user_confirmed !== true) {
      throw new Error(
        "Budget-Änderung blockiert: Der Nutzer muss sie zuerst ausdrücklich freigeben (user_confirmed=true).",
      );
    }
    const budgetCents = Math.round(Number(input.daily_budget_euro) * 100);
    if (!Number.isFinite(budgetCents) || budgetCents < 100) {
      throw new Error("Tagesbudget muss mindestens 1 € sein.");
    }
    await metaFetch(String(input.adset_id), { daily_budget: String(budgetCents) }, "POST");
    return { adset_id: input.adset_id, daily_budget_euro: budgetCents / 100 };
  }

  throw new Error(`Unbekanntes Tool: ${name}`);
}

// ---- System-Prompt ---------------------------------------------------------

function buildSystemPrompt(
  hubs: { name: string; region: string | null; address: string | null }[],
  creatives: { name: string; notiz: string | null; mime: string }[],
): string {
  const today = new Date().toISOString().slice(0, 10);
  const hubList = hubs
    .map((h) => `- ${h.name}${h.region ? ` (${h.region})` : ""}${h.address ? ` — ${h.address}` : ""}`)
    .join("\n");
  const creativeList =
    creatives.length > 0
      ? creatives
          .map(
            (c) =>
              `- [${c.mime.startsWith("video/") ? "Video" : "Bild"}] ${c.name}${c.notiz ? ` (${c.notiz})` : ""}`,
          )
          .join("\n")
      : "(noch keine hochgeladen)";

  return `You are an expert Meta Ads performance marketer with full access to our Meta Ads account through the provided tools. Think like a Head of Growth: your goal is profitable lead generation with minimal wasted spend, not blind execution. Today: ${today}. Respond in German (the user is German).

## Context
We advertise German ambulatory care services ("ambulante Pflege") from these hub locations:
${hubList}

Two campaign intents exist:
1. **Kunden** (patients/families → care leads): objective OUTCOME_LEADS, special_ad_category NONE.
2. **Mitarbeiter** (recruiting nurses/caregivers): objective OUTCOME_LEADS or OUTCOME_TRAFFIC, special_ad_category EMPLOYMENT (mandatory — Meta policy). No age/gender targeting for EMPLOYMENT.

Uploaded creatives available (use list_uploaded_creatives for IDs):
${creativeList}

## Freetext campaign flow
When the user says something like "Ich brauche Mitarbeiter in Essen" or "Kunden in Velbert, 15 €/Tag":
1. Infer intent (Kunden/Mitarbeiter), location, budget (default 20 €/day if unsaid — state the assumption).
2. Geo-targeting: if the request references a hub/its address or a radius under 17 km, use create_ad_set's address parameter with the hub address from the context above (custom location, radius from 1 km). Otherwise search_locations for the city key (city radius min 17 km).
3. Create campaign → ad set (default ~25 km radius unless specified) → ad(s), ALL PAUSED, using the best-fitting uploaded creative(s). If lead ads: check list_lead_forms first; if no form exists, build a WEBSITE/traffic setup instead and tell the user a lead form would perform better.
4. Naming convention: [Intent]-[Stadt]-[JJJJ-MM], e.g. "Mitarbeiter-Essen-2026-08".
5. Write persuasive German ad copy: strong hook, emotional benefit, social proof, clear CTA. Never generic. For care: family support, independence, quality of life, trusted local care — NEVER imply the platform knows someone's medical condition. For recruiting: appreciation, fair pay, team, work-life balance — no discriminatory wording.
6. Afterwards summarize exactly what was created (IDs, budget, targeting, copy) and remind the user everything is PAUSED and needs their approval to go live.
If a tool call fails with a Meta policy/API error, adapt and retry sensibly (max 2 retries), otherwise explain the error in plain German.

## Safety rules (hard)
- Every new campaign/ad set/ad is created PAUSED (the tools enforce this).
- Never activate anything or raise budgets without the user's explicit approval in this chat; only then call set_status/update_daily_budget with user_confirmed=true.
- Never delete anything (no tool exists).
- Before any write action, state in one short sentence what you are about to do.

## Analysis & reporting
When asked about performance, pull real numbers via get_insights (never guess) and cover: Spend, Impressions, Reach, Frequency, CPM, CPC, CTR, Leads, Cost per Lead, budget. Explain what is happening, why, what to change, and expected impact; rank opportunities by estimated ROI. Look for: audience overlap, learning-limited ad sets, frequency > 3, weak CTR (< 1 %), expensive CPM, creative fatigue. For reports: executive summary first, then details (top/worst performers, budget waste, biggest opportunities, surprises), and end with "Wenn ich heute nur drei Dinge ändern würde:". Give a confidence estimate for every recommendation.

Prefer analysis over execution. Challenge weak assumptions. Answer concisely in German with concrete numbers.`;
}

// ---- Route -----------------------------------------------------------------

type ChatTurn = { role: "user" | "assistant"; text: string };

export async function POST(req: Request) {
  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json(
      { error: "Kein ANTHROPIC_API_KEY konfiguriert (.env.local, danach Dev-Server neu starten)." },
      { status: 503 },
    );
  }
  if (!metaConfigured()) {
    return NextResponse.json(
      {
        error:
          "Meta-API nicht konfiguriert: META_ACCESS_TOKEN und META_AD_ACCOUNT_ID in .env.local eintragen (Token mit ads_management aus dem Meta Business Manager), danach Dev-Server neu starten.",
      },
      { status: 503 },
    );
  }

  const session = await requireSession();
  if (!session.isAdmin) {
    return NextResponse.json({ error: "Nur für Admins." }, { status: 403 });
  }

  const body = (await req.json().catch(() => ({}))) as { messages?: ChatTurn[] };
  const turns = (body.messages ?? [])
    .filter((t) => (t.role === "user" || t.role === "assistant") && typeof t.text === "string")
    .slice(-20);
  if (turns.length === 0 || turns[turns.length - 1].role !== "user") {
    return NextResponse.json({ error: "Keine Nachricht übergeben." }, { status: 400 });
  }

  const admin = createAdminClient();
  const [{ data: hubs }, { data: creatives }] = await Promise.all([
    admin.from("hubs").select("name, region, address").order("name"),
    admin
      .from("meta_creatives")
      .select("name, notiz, mime")
      .order("created_at", { ascending: false }),
  ]);

  const system = buildSystemPrompt(hubs ?? [], creatives ?? []);
  const client = new Anthropic();
  const messages: Anthropic.MessageParam[] = turns.map((t) => ({
    role: t.role,
    content: t.text,
  }));

  try {
    for (let i = 0; i < MAX_TURNS; i++) {
      const response = await client.messages.create({
        model: MODEL,
        max_tokens: 4096,
        system,
        tools,
        messages,
      });

      if (response.stop_reason !== "tool_use") {
        const answer = response.content
          .filter((b): b is Anthropic.TextBlock => b.type === "text")
          .map((b) => b.text)
          .join("\n")
          .trim();
        return NextResponse.json({ answer });
      }

      messages.push({ role: "assistant", content: response.content });

      const toolResults: Anthropic.ToolResultBlockParam[] = [];
      for (const block of response.content) {
        if (block.type !== "tool_use") continue;
        try {
          const out = await runTool(block.name, (block.input ?? {}) as Record<string, unknown>);
          toolResults.push({
            type: "tool_result",
            tool_use_id: block.id,
            content: JSON.stringify(out),
          });
        } catch (err) {
          toolResults.push({
            type: "tool_result",
            tool_use_id: block.id,
            content:
              err instanceof MetaApiError
                ? `Meta API Fehler: ${err.message}`
                : err instanceof Error
                  ? err.message
                  : "Unbekannter Fehler",
            is_error: true,
          });
        }
      }
      messages.push({ role: "user", content: toolResults });
    }

    return NextResponse.json({
      answer:
        "Die Aufgabe brauchte zu viele Schritte auf einmal. Bitte formuliere sie kleiner (z. B. erst Kampagne, dann Anzeigen).",
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Agent-Fehler" },
      { status: 500 },
    );
  }
}
