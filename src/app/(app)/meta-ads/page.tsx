import { Rocket } from "lucide-react";
import { requireSession } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { MetaAdsAgent } from "@/components/meta-ads-agent";
import { MetaCreatives, type CreativeRow } from "@/components/meta-creatives";

export const dynamic = "force-dynamic";

/**
 * Meta Ads KI — Freitext rein ("Ich brauche Mitarbeiter in Essen"), der
 * Agent baut die Kampagne direkt im Meta-Werbekonto (immer PAUSED) und
 * nutzt die hier hochgeladenen Creatives. Nur für Admins.
 */
export default async function MetaAdsPage() {
  const session = await requireSession();

  if (!session.isAdmin) {
    return (
      <p className="rounded-xl border bg-card p-5 text-sm text-muted-foreground shadow-sm">
        Die Meta-Ads-KI ist nur für Admins freigeschaltet.
      </p>
    );
  }

  const admin = createAdminClient();
  const { data: creatives, error } = await admin
    .from("meta_creatives")
    .select("id, name, url, mime, notiz, created_at")
    .order("created_at", { ascending: false });
  const tableMissing = error?.code === "PGRST205" || error?.code === "42P01";

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center gap-3">
        <span className="flex size-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
          <Rocket className="size-5" />
        </span>
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Meta Ads KI</h1>
          <p className="text-sm text-muted-foreground">
            Sag in Freitext, wo du Kunden oder Mitarbeiter brauchst — der Agent
            baut die Kampagne im Meta-Werbekonto. Alles startet pausiert; live
            geht nichts ohne deine Freigabe im Chat.
          </p>
        </div>
      </div>

      <MetaAdsAgent />

      <section className="flex flex-col gap-3 border-t pt-5">
        <h2 className="text-lg font-semibold">Creatives</h2>
        {tableMissing ? (
          <p className="rounded-xl border bg-card p-5 text-sm text-muted-foreground shadow-sm">
            Die Tabelle <code>meta_creatives</code> fehlt noch — bitte einmal{" "}
            <code>supabase/apply_all_pending.sql</code> im Supabase SQL-Editor
            ausführen.
          </p>
        ) : (
          <MetaCreatives initial={(creatives ?? []) as CreativeRow[]} />
        )}
      </section>
    </div>
  );
}
