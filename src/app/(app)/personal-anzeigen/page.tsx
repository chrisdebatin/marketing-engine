import { requireSession } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  PersonalAdsManager,
  type PersonalAdRow,
} from "@/components/personal-ads-manager";

export const dynamic = "force-dynamic";

/**
 * Personal-Anzeigen (Recruiting): welche Stellenanzeigen laufen wo —
 * je Standort oder für alle, auf Meta, Join, Indeed & Co. Laufende
 * Anzeigen erscheinen als Chip auf den Hub-Karten.
 */
export default async function PersonalAnzeigenPage() {
  const session = await requireSession();
  const admin = createAdminClient();

  const { data, error } = await admin
    .from("personal_ads")
    .select("*")
    .order("start_date", { ascending: false });
  const tableMissing = error?.code === "PGRST205" || error?.code === "42P01";

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold">Personal-Anzeigen</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Recruiting-Anzeigen im Überblick: welche Stellen laufen gerade auf
          welcher Plattform (Meta, Join, Indeed, …) — je Standort oder für
          alle. Laufende Anzeigen stehen auch auf den Hub-Karten.
        </p>
      </div>

      {tableMissing ? (
        <p className="rounded-xl border bg-card p-5 text-sm text-muted-foreground shadow-sm">
          Die Tabelle <code>personal_ads</code> fehlt noch — bitte einmal{" "}
          <code>supabase/apply_all_pending.sql</code> im Supabase SQL-Editor
          ausführen.
        </p>
      ) : (
        <PersonalAdsManager
          ads={(data ?? []) as PersonalAdRow[]}
          hubs={session.hubs.map((h) => ({ id: h.id, name: h.name }))}
        />
      )}
    </div>
  );
}
