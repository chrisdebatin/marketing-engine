import { requireSession } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  KampagnenAnfragen,
  type AnfrageRow,
} from "@/components/kampagnen-anfragen";
import {
  MetaAdsManager,
  type MetaAdRow,
} from "@/components/meta-ads-manager";

export const dynamic = "force-dynamic";

/**
 * Meta Ads: manuell gepflegte Übersicht der laufenden, geplanten und
 * beendeten Kampagnen — allgemeine (gruppenweit) und lokale (je Standort).
 * Laufende lokale Kampagnen erscheinen zusätzlich als Box auf der
 * jeweiligen Hub-Detailseite.
 */
export default async function MetaAdsPage() {
  const session = await requireSession();
  const admin = createAdminClient();

  const { data, error } = await admin
    .from("meta_ads")
    .select("*")
    .order("start_date", { ascending: false });
  const tableMissing = error?.code === "PGRST205" || error?.code === "42P01";

  // Kampagnen-Anfragen: To-dos unter dem Thema "Kampagnen-Anfragen".
  const { data: anfrageTopic } = await admin
    .from("note_topics")
    .select("id")
    .ilike("title", "Kampagnen-Anfragen")
    .maybeSingle();
  const { data: anfrageRows } = anfrageTopic
    ? await admin
        .from("hub_notes")
        .select("id, hub_id, text, done_at, created_at")
        .eq("topic_id", anfrageTopic.id)
        .eq("is_todo", true)
        .order("created_at", { ascending: false })
        .limit(100)
    : { data: [] };


  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold">Meta Ads</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Welche Meta-Kampagnen (Facebook/Instagram) laufen gerade —
          allgemeine für die ganze Gruppe und lokale je Standort. Laufende
          Kampagnen werden auf der jeweiligen Hub-Seite angezeigt.
        </p>
      </div>

      <KampagnenAnfragen
        hubs={session.hubs.map((h) => ({ id: h.id, name: h.name }))}
        anfragen={(anfrageRows ?? []) as AnfrageRow[]}
      />

      {tableMissing ? (
        <p className="rounded-xl border bg-card p-5 text-sm text-muted-foreground shadow-sm">
          Die Tabelle <code>meta_ads</code> fehlt noch — bitte einmal{" "}
          <code>supabase/apply_all_pending.sql</code> im Supabase SQL-Editor
          ausführen.
        </p>
      ) : (
        <MetaAdsManager
          ads={(data ?? []) as MetaAdRow[]}
          hubs={session.hubs.map((h) => ({ id: h.id, name: h.name }))}
        />
      )}
    </div>
  );
}
