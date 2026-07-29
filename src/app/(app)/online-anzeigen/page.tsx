import { BriefcaseBusiness, Rocket } from "lucide-react";
import { requireSession } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { loadOnlineAdsFreitext } from "./actions";
import { OnlineAdsFreitext } from "@/components/online-ads-freitext";
import {
  KampagnenAnfragen,
  type AnfrageRow,
} from "@/components/kampagnen-anfragen";
import {
  MetaAdsManager,
  type MetaAdRow,
} from "@/components/meta-ads-manager";
import {
  PersonalAdsManager,
  type PersonalAdRow,
} from "@/components/personal-ads-manager";

export const dynamic = "force-dynamic";

/**
 * Online Anzeigen — alles an einem Ort: Freitext-Status ("Was läuft
 * gerade?"), Kampagnen-Anfragen als To-dos, Meta-Kampagnen und
 * Personal-Anzeigen.
 */
export default async function OnlineAnzeigenPage() {
  const session = await requireSession();
  const admin = createAdminClient();

  const [freitext, { data: metaRows, error: metaErr }, { data: personalRows, error: persErr }] =
    await Promise.all([
      loadOnlineAdsFreitext(),
      admin.from("meta_ads").select("*").order("start_date", { ascending: false }),
      admin
        .from("personal_ads")
        .select("*")
        .order("start_date", { ascending: false }),
    ]);
  const metaMissing = metaErr?.code === "PGRST205" || metaErr?.code === "42P01";
  const persMissing = persErr?.code === "PGRST205" || persErr?.code === "42P01";

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

  const hubs = session.hubs.map((h) => ({ id: h.id, name: h.name }));
  const missingHint = (table: string) => (
    <p className="rounded-xl border bg-card p-5 text-sm text-muted-foreground shadow-sm">
      Die Tabelle <code>{table}</code> fehlt noch — bitte einmal{" "}
      <code>supabase/apply_all_pending.sql</code> im Supabase SQL-Editor
      ausführen.
    </p>
  );

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold">Online Anzeigen</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Alles an einem Ort: was gerade läuft (Freitext), offene
          Kampagnen-Anfragen sowie Meta-Kampagnen und Personal-Anzeigen im
          Detail. Laufende Anzeigen erscheinen auf den Hub-Karten bzw.
          Hub-Seiten.
        </p>
      </div>

      <OnlineAdsFreitext
        initialText={freitext.text}
        initialUpdatedAt={freitext.updatedAt}
      />

      <KampagnenAnfragen
        hubs={hubs}
        anfragen={(anfrageRows ?? []) as AnfrageRow[]}
      />

      {/* Meta-Kampagnen */}
      <section className="flex flex-col gap-3">
        <h2 className="flex items-center gap-2 text-lg font-semibold">
          <Rocket className="size-4 text-primary" />
          Meta-Kampagnen
        </h2>
        {metaMissing ? (
          missingHint("meta_ads")
        ) : (
          <MetaAdsManager ads={(metaRows ?? []) as MetaAdRow[]} hubs={hubs} />
        )}
      </section>

      {/* Personal-Anzeigen */}
      <section className="flex flex-col gap-3 border-t pt-5">
        <h2 className="flex items-center gap-2 text-lg font-semibold">
          <BriefcaseBusiness className="size-4 text-primary" />
          Personal-Anzeigen
        </h2>
        {persMissing ? (
          missingHint("personal_ads")
        ) : (
          <PersonalAdsManager
            ads={(personalRows ?? []) as PersonalAdRow[]}
            hubs={hubs}
          />
        )}
      </section>
    </div>
  );
}
