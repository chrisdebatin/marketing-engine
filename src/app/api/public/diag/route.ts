import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";

// TEMPORÄRER Diagnose-Endpunkt (wird nach Klärung wieder entfernt):
// meldet NUR Key-Formate (nie Werte), den Supabase-Projekt-Host und die
// konkrete Fehlermeldung einer Service-Client-Testabfrage.
export async function GET() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";
  const service = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";

  const fmt = (v: string) =>
    v === ""
      ? "LEER"
      : v.startsWith("sb_publishable_")
        ? "sb_publishable (neu)"
        : v.startsWith("sb_secret_")
          ? "sb_secret (neu)"
          : v.startsWith("eyJ")
            ? "jwt (alt)"
            : `unbekannt (${v.length} Zeichen)`;

  let hubsCount: number | null = null;
  let dbError: string | null = null;
  try {
    const admin = createAdminClient();
    const { count, error } = await admin
      .from("hubs")
      .select("id", { count: "exact", head: true });
    hubsCount = count;
    dbError = error ? `${error.code ?? "?"}: ${error.message}` : null;
  } catch (e) {
    dbError = `throw: ${e instanceof Error ? e.message : String(e)}`;
  }

  return NextResponse.json({
    supabaseProjekt: url.replace(/^https?:\/\//, "").split(".")[0] || "LEER",
    anonKeyFormat: fmt(anon),
    serviceKeyFormat: fmt(service),
    hubsCount,
    dbError,
  });
}
