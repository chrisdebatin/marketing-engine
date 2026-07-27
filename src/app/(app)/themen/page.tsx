import { requireSession } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  ThemenBoard,
  type NoteRow,
} from "@/components/themen-board";

export const dynamic = "force-dynamic";

/**
 * Themen-Board: Ein Thema (z. B. "Recare") betrifft alle Standorte — hier
 * steht der Stand jedes Standorts nebeneinander, direkt bearbeitbar:
 * Themen anlegen/umbenennen/löschen, Notizen/To-dos eintragen und abhaken.
 */
export default async function ThemenPage() {
  const session = await requireSession();
  const admin = createAdminClient();

  // Fallback ?? [] — fehlen Migrationen 0021/0024, darf die Seite nicht crashen.
  const [{ data: topicRows }, { data: noteRows }] = await Promise.all([
    admin.from("note_topics").select("id, title, created_at").order("title"),
    admin.from("hub_notes").select("*").order("created_at", { ascending: false }),
  ]);

  const hubIds = new Set(session.hubs.map((h) => h.id));
  const notes = ((noteRows ?? []) as NoteRow[]).filter((n) =>
    hubIds.has(n.hub_id),
  );

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold">Themen</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Ein Thema betrifft alle Standorte — hier siehst und pflegst du den
          Stand jedes Standorts direkt: Thema anlegen, Notizen und To-dos
          eintragen, abhaken. Alles erscheint auch auf den Hub-Detailseiten.
        </p>
      </div>

      <ThemenBoard
        topics={(topicRows ?? []).map((t) => ({ id: t.id, title: t.title }))}
        notes={notes}
        hubs={session.hubs.map((h) => ({
          id: h.id,
          name: h.name,
          responsible_md: h.responsible_md,
        }))}
      />
    </div>
  );
}
