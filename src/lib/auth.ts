import { createAdminClient } from "@/lib/supabase/admin";
import type { Hub, Profile } from "@/lib/types";

export interface SessionContext {
  userId: string;
  email: string | null;
  profile: Profile;
  hubs: Hub[];
  isAdmin: boolean;
}

const FALLBACK_PROFILE: Profile = {
  id: "",
  name: "Admin",
  role: "admin",
  created_at: "",
};

/**
 * Open-access mode: the app requires no login. Every visitor acts as the admin
 * and sees all hubs. Reads use the service-role client so this works regardless
 * of RLS. (See migration 0008_open_access.sql.)
 */
export async function requireSession(): Promise<SessionContext> {
  const admin = createAdminClient();

  const [{ data: profile }, { data: hubs }] = await Promise.all([
    admin
      .from("profiles")
      .select("*")
      .eq("role", "admin")
      .order("created_at")
      .limit(1)
      .maybeSingle(),
    admin.from("hubs").select("*").order("name"),
  ]);

  const resolved = (profile as Profile | null) ?? FALLBACK_PROFILE;

  return {
    userId: resolved.id,
    email: null,
    profile: resolved,
    hubs: (hubs as Hub[] | null) ?? [],
    isAdmin: true,
  };
}
