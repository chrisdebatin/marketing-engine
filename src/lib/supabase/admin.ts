import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/types";

/**
 * Service-role Supabase client — bypasses RLS. SERVER ONLY.
 * Used exclusively for the token-based public delivery link (recipients have
 * no account), where access is gated by the secret share_token, not by RLS.
 * Never import this into a Client Component.
 */
export function createAdminClient() {
  return createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
}
