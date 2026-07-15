import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import type { Hub, Profile } from "@/lib/types";

export interface SessionContext {
  userId: string;
  email: string | null;
  profile: Profile;
  hubs: Hub[];
  isAdmin: boolean;
  /** true, wenn eine echte Supabase-Session existiert (Opt-in-Login). */
  loggedIn?: boolean;
}

const FALLBACK_PROFILE: Profile = {
  id: "",
  name: "Admin",
  role: "admin",
  created_at: "",
};

/**
 * Opt-in auth on top of open-access mode:
 *
 * - WITHOUT a logged-in session the app behaves exactly as before: every
 *   visitor acts as the admin and sees all hubs (see 0008_open_access.sql).
 * - WITH a logged-in session the real profile is loaded: role 'admin' sees
 *   all hubs; role 'md'/'employee' sees only the hubs from user_hubs.
 *
 * Reads use the service-role client so this works regardless of RLS
 * (RLS is disabled; scoping is enforced server-side via session.hubs).
 */
export async function requireSession(): Promise<SessionContext> {
  const admin = createAdminClient();

  // Opt-in: is there a real Supabase session?
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) {
    const { data: profileData } = await admin
      .from("profiles")
      .select("*")
      .eq("id", user.id)
      .maybeSingle();

    // Fail-closed fallback: logged-in user without profiles row gets the
    // most restrictive role (no hubs until user_hubs rows exist).
    const profile: Profile = (profileData as Profile | null) ?? {
      id: user.id,
      name: user.email ?? null,
      role: "md",
      created_at: "",
    };
    const isAdmin = profile.role === "admin";

    let hubs: Hub[] = [];
    if (isAdmin) {
      const { data } = await admin.from("hubs").select("*").order("name");
      hubs = (data as Hub[] | null) ?? [];
    } else {
      // Two simple queries — no embedded-relation selects (hand-written types).
      const { data: userHubs } = await admin
        .from("user_hubs")
        .select("hub_id")
        .eq("user_id", user.id);
      const hubIds = (userHubs ?? []).map((r) => r.hub_id);
      if (hubIds.length > 0) {
        const { data } = await admin
          .from("hubs")
          .select("*")
          .in("id", hubIds)
          .order("name");
        hubs = (data as Hub[] | null) ?? [];
      }
    }

    return {
      userId: user.id,
      email: user.email ?? null,
      profile,
      hubs,
      isAdmin,
      loggedIn: true,
    };
  }

  // Open-access mode (unchanged): no login required, every visitor acts as
  // the admin and sees all hubs.
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
    loggedIn: false,
  };
}
