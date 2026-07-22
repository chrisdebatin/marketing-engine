import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Outlook-/Microsoft-Graph-Anbindung (delegated OAuth, Authorization Code).
 *
 * Benötigte Env-Variablen (siehe .env.example):
 * - MS_CLIENT_ID      App-Registrierung (Entra ID / Azure AD)
 * - MS_CLIENT_SECRET  Client-Secret der App-Registrierung
 * - MS_TENANT_ID      Tenant-ID (oder "common")
 * - NEXT_PUBLIC_APP_URL  Basis-URL für die Redirect-URI
 *
 * Der Refresh-Token liegt in `ms_oauth_tokens` (Service-Role-only) und
 * verlässt den Server nie.
 */

const SCOPES = "offline_access User.Read Mail.Read Mail.Send";

function tenant(): string {
  return process.env.MS_TENANT_ID || "common";
}

export function outlookConfigured(): boolean {
  return Boolean(process.env.MS_CLIENT_ID && process.env.MS_CLIENT_SECRET);
}

export function redirectUri(): string {
  const base = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  return `${base.replace(/\/$/, "")}/api/outlook/callback`;
}

/** Login-URL für den Verbinden-Button. */
export function authUrl(state: string): string {
  const params = new URLSearchParams({
    client_id: process.env.MS_CLIENT_ID ?? "",
    response_type: "code",
    redirect_uri: redirectUri(),
    response_mode: "query",
    scope: SCOPES,
    state,
    prompt: "select_account",
  });
  return `https://login.microsoftonline.com/${tenant()}/oauth2/v2.0/authorize?${params}`;
}

interface TokenResponse {
  access_token: string;
  refresh_token?: string;
  error?: string;
  error_description?: string;
}

async function tokenRequest(body: URLSearchParams): Promise<TokenResponse> {
  const res = await fetch(
    `https://login.microsoftonline.com/${tenant()}/oauth2/v2.0/token`,
    {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body,
    },
  );
  return (await res.json()) as TokenResponse;
}

/** Code aus dem OAuth-Callback eintauschen und Refresh-Token speichern. */
export async function exchangeCodeAndStore(
  code: string,
): Promise<{ ok: true; email: string | null } | { ok: false; error: string }> {
  const tokens = await tokenRequest(
    new URLSearchParams({
      client_id: process.env.MS_CLIENT_ID ?? "",
      client_secret: process.env.MS_CLIENT_SECRET ?? "",
      grant_type: "authorization_code",
      code,
      redirect_uri: redirectUri(),
      scope: SCOPES,
    }),
  );
  if (!tokens.refresh_token || !tokens.access_token) {
    console.error("outlook: token exchange failed:", tokens.error);
    return { ok: false, error: tokens.error_description ?? "Token-Fehler." };
  }

  // Kontoname fürs Anzeigen im Admin.
  let email: string | null = null;
  try {
    const me = await fetch("https://graph.microsoft.com/v1.0/me", {
      headers: { Authorization: `Bearer ${tokens.access_token}` },
    });
    const body = (await me.json()) as {
      mail?: string;
      userPrincipalName?: string;
    };
    email = body.mail ?? body.userPrincipalName ?? null;
  } catch {
    // Anzeige-Name ist optional.
  }

  const admin = createAdminClient();
  const { error } = await admin.from("ms_oauth_tokens").upsert({
    id: "default",
    account_email: email,
    refresh_token: tokens.refresh_token,
    updated_at: new Date().toISOString(),
  });
  if (error) {
    if (error.code === "PGRST205" || error.code === "42P01") {
      return {
        ok: false,
        error:
          "Tabelle ms_oauth_tokens fehlt — bitte supabase/apply_all_pending.sql ausführen.",
      };
    }
    return { ok: false, error: "Token konnte nicht gespeichert werden." };
  }
  return { ok: true, email };
}

/** Verbundenes Konto (oder null). */
export async function connectedAccount(): Promise<string | null> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("ms_oauth_tokens")
    .select("account_email")
    .eq("id", "default")
    .maybeSingle();
  return data ? (data.account_email ?? "verbunden") : null;
}

/** Access-Token über den gespeicherten Refresh-Token holen (mit Rotation). */
export async function getAccessToken(): Promise<string | null> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("ms_oauth_tokens")
    .select("refresh_token")
    .eq("id", "default")
    .maybeSingle();
  if (!data) return null;

  const tokens = await tokenRequest(
    new URLSearchParams({
      client_id: process.env.MS_CLIENT_ID ?? "",
      client_secret: process.env.MS_CLIENT_SECRET ?? "",
      grant_type: "refresh_token",
      refresh_token: data.refresh_token,
      scope: SCOPES,
    }),
  );
  if (!tokens.access_token) {
    console.error("outlook: refresh failed:", tokens.error);
    return null;
  }
  if (tokens.refresh_token && tokens.refresh_token !== data.refresh_token) {
    await admin
      .from("ms_oauth_tokens")
      .update({
        refresh_token: tokens.refresh_token,
        updated_at: new Date().toISOString(),
      })
      .eq("id", "default");
  }
  return tokens.access_token;
}

export interface OutlookMail {
  id: string;
  subject: string;
  from: string;
  fromAddress: string;
  receivedAt: string;
  preview: string;
  webLink: string;
  isRead: boolean;
}

/**
 * Letzte Mails, an denen eine der Adressen beteiligt ist (gesendet oder
 * empfangen), neueste zuerst.
 */
export async function mailsWith(
  addresses: string[],
  top = 8,
): Promise<OutlookMail[] | null> {
  if (addresses.length === 0) return [];
  const token = await getAccessToken();
  if (!token) return null;

  const results = new Map<string, OutlookMail>();
  for (const addr of addresses.slice(0, 3)) {
    const params = new URLSearchParams({
      $search: `"participants:${addr}"`,
      $select: "id,subject,from,receivedDateTime,bodyPreview,webLink,isRead",
      $top: String(top),
    });
    const res = await fetch(
      `https://graph.microsoft.com/v1.0/me/messages?${params}`,
      { headers: { Authorization: `Bearer ${token}` } },
    );
    if (!res.ok) continue;
    const body = (await res.json()) as {
      value?: {
        id: string;
        subject: string | null;
        from?: { emailAddress?: { name?: string; address?: string } };
        receivedDateTime: string;
        bodyPreview?: string;
        webLink?: string;
        isRead?: boolean;
      }[];
    };
    for (const m of body.value ?? []) {
      results.set(m.id, {
        id: m.id,
        subject: m.subject ?? "(kein Betreff)",
        from: m.from?.emailAddress?.name ?? m.from?.emailAddress?.address ?? "",
        fromAddress: m.from?.emailAddress?.address ?? "",
        receivedAt: m.receivedDateTime,
        preview: (m.bodyPreview ?? "").slice(0, 160),
        webLink: m.webLink ?? "",
        isRead: m.isRead ?? true,
      });
    }
  }
  return [...results.values()]
    .sort((a, b) => b.receivedAt.localeCompare(a.receivedAt))
    .slice(0, top);
}
