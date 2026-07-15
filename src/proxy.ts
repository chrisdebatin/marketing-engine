import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

/**
 * Opt-in-Auth: Der Proxy refresht nur eine ggf. vorhandene Supabase-Session
 * (@supabase/ssr-Muster), erzwingt aber KEINEN Login — ohne Session bleibt
 * die App im Open-Access-Modus (siehe requireSession in src/lib/auth.ts).
 */
export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });

  // Ohne Auth-Cookies gibt es nichts zu refreshen — Request unverändert
  // durchlassen (schneller Pfad für Open-Access-Besucher).
  const hasAuthCookie = request.cookies
    .getAll()
    .some((c) => c.name.startsWith("sb-"));
  if (!hasAuthCookie) return response;

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          );
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  // Refresht abgelaufene Tokens und schreibt sie in die Response-Cookies.
  // Bewusst kein Redirect auf /login — Login ist opt-in.
  await supabase.auth.getUser();

  return response;
}

export const config = {
  matcher: [
    /*
     * Alles außer:
     * - /api/public/* (öffentliche Endpunkte, tokenbasiert)
     * - /h/* und /l/* (öffentliche Share-Links, tokenbasiert)
     * - _next/static, _next/image, statische Assets (sw.js, manifest, icons, …)
     */
    "/((?!api/public|h/|l/|_next/static|_next/image|favicon\\.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|css|js|json|txt|woff2?|map)$).*)",
  ],
};
