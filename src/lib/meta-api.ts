/**
 * Dünner Wrapper um die Meta Marketing API (Graph API). SERVER ONLY.
 *
 * Benötigt in .env.local:
 * - META_ACCESS_TOKEN   — System-User- oder langlebiger User-Token mit ads_management
 * - META_AD_ACCOUNT_ID  — Werbekonto-ID, mit oder ohne "act_"-Präfix
 * - META_PAGE_ID        — Facebook-Seite, in deren Namen Anzeigen laufen (optional,
 *                         dann muss der Agent nach der Page-ID fragen)
 *
 * Graph-Fehlermeldungen werden im Klartext durchgereicht, damit der Agent
 * (und der Nutzer) versteht, was Meta abgelehnt hat.
 */

const GRAPH = "https://graph.facebook.com/v23.0";

export function metaConfigured(): boolean {
  return Boolean(process.env.META_ACCESS_TOKEN && process.env.META_AD_ACCOUNT_ID);
}

export function metaAdAccountId(): string {
  const raw = (process.env.META_AD_ACCOUNT_ID ?? "").trim();
  return raw.startsWith("act_") ? raw : `act_${raw}`;
}

export function metaPageId(): string | null {
  return (process.env.META_PAGE_ID ?? "").trim() || null;
}

export class MetaApiError extends Error {}

/** GET/POST auf die Graph API; wirft MetaApiError mit Metas Fehlermeldung. */
export async function metaFetch(
  path: string,
  params: Record<string, string> = {},
  method: "GET" | "POST" = "GET",
): Promise<Record<string, unknown>> {
  const token = process.env.META_ACCESS_TOKEN ?? "";
  const url = new URL(`${GRAPH}/${path.replace(/^\//, "")}`);

  let init: RequestInit;
  if (method === "GET") {
    for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
    url.searchParams.set("access_token", token);
    init = { method };
  } else {
    const body = new URLSearchParams(params);
    body.set("access_token", token);
    init = { method, body };
  }

  const res = await fetch(url, init);
  const json = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (!res.ok || json.error) {
    const err = (json.error ?? {}) as Record<string, unknown>;
    const msg =
      [err.message, err.error_user_title, err.error_user_msg]
        .filter(Boolean)
        .join(" — ") || `Meta API HTTP ${res.status}`;
    throw new MetaApiError(msg);
  }
  return json;
}

/**
 * Startet den Video-Upload ins Werbekonto: Meta lädt das Video selbst von
 * der öffentlichen URL (file_url) und verarbeitet es asynchron. Gibt die
 * Video-ID zurück — Verarbeitung mit waitForVideoReady abwarten.
 */
export async function uploadAdVideo(videoUrl: string, name: string): Promise<string> {
  const r = await metaFetch(
    `${metaAdAccountId()}/advideos`,
    { file_url: videoUrl, name: name.slice(0, 100) },
    "POST",
  );
  if (!r.id) throw new MetaApiError("Meta hat keine Video-ID zurückgegeben.");
  return String(r.id);
}

/**
 * Wartet, bis Meta das Video fertig verarbeitet hat (Polling). Wirft nach
 * Ablauf des Zeitfensters — der Aufrufer kann es später erneut versuchen,
 * die Video-ID bleibt gültig.
 */
export async function waitForVideoReady(
  videoId: string,
  maxWaitMs = 90_000,
): Promise<void> {
  const start = Date.now();
  for (;;) {
    const r = await metaFetch(videoId, { fields: "status" });
    const status = (r.status ?? {}) as Record<string, unknown>;
    const state = String(status.video_status ?? "");
    if (state === "ready") return;
    if (state === "error") {
      throw new MetaApiError("Meta konnte das Video nicht verarbeiten (Format prüfen).");
    }
    if (Date.now() - start > maxWaitMs) {
      throw new MetaApiError(
        "Video wird bei Meta noch verarbeitet — bitte in 1–2 Minuten erneut versuchen (das Video muss nicht neu hochgeladen werden).",
      );
    }
    await new Promise((r) => setTimeout(r, 5000));
  }
}

/** Vorschaubild eines verarbeiteten Videos (für video_data.image_url nötig). */
export async function getVideoThumbnail(videoId: string): Promise<string> {
  const r = await metaFetch(`${videoId}/thumbnails`, { fields: "uri,is_preferred" });
  const list = (r.data ?? []) as { uri?: string; is_preferred?: boolean }[];
  const pick = list.find((t) => t.is_preferred) ?? list[0];
  if (!pick?.uri) throw new MetaApiError("Kein Video-Vorschaubild verfügbar.");
  return pick.uri;
}

/**
 * Lädt ein Bild (öffentliche URL, z. B. Supabase Storage) ins Werbekonto
 * hoch und gibt den image_hash für Ad-Creatives zurück.
 */
export async function uploadAdImage(imageUrl: string): Promise<string> {
  const imgRes = await fetch(imageUrl);
  if (!imgRes.ok) {
    throw new MetaApiError(`Creative-Bild nicht ladbar (HTTP ${imgRes.status}).`);
  }
  const bytes = Buffer.from(await imgRes.arrayBuffer());

  const form = new FormData();
  form.set("access_token", process.env.META_ACCESS_TOKEN ?? "");
  form.set("bytes", bytes.toString("base64"));

  const res = await fetch(`${GRAPH}/${metaAdAccountId()}/adimages`, {
    method: "POST",
    body: form,
  });
  const json = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (!res.ok || json.error) {
    const err = (json.error ?? {}) as Record<string, unknown>;
    throw new MetaApiError(String(err.message ?? "Bild-Upload zu Meta fehlgeschlagen."));
  }
  const images = (json.images ?? {}) as Record<string, { hash?: string }>;
  const first = Object.values(images)[0];
  if (!first?.hash) throw new MetaApiError("Meta hat keinen image_hash zurückgegeben.");
  return first.hash;
}
