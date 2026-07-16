/**
 * Öffentliche Basis-URL für Share-Links (PDL-Links etc.).
 *
 * `window.location.origin` liefert im lokalen Dev-Betrieb `http://localhost:3000`
 * — solche Links darf man nie an PDLs schicken. Ist `NEXT_PUBLIC_APP_URL`
 * gesetzt (die feste Produktions-Domain, z. B. https://marketing-engine.vercel.app),
 * gewinnt sie immer; sonst Fallback auf den aktuellen Origin.
 *
 * Der Login-Redirect (auth/callback) nutzt bewusst weiterhin den echten
 * Origin, damit der Magic-Link im Dev-Betrieb zurück auf localhost führt.
 */
export function publicBaseUrl(): string {
  const configured = process.env.NEXT_PUBLIC_APP_URL?.trim();
  if (configured) return configured.replace(/\/+$/, "");
  return window.location.origin;
}
