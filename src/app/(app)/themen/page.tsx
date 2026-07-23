import Link from "next/link";
import { BookOpen, Check, Circle, StickyNote } from "lucide-react";
import { requireSession } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { mdColor } from "@/lib/hub-coords";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

function formatDate(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString("de-DE");
}

/**
 * Themen-Übersicht: Ein Thema (z. B. "Recare") betrifft alle Standorte —
 * hier steht der Stand jedes Standorts nebeneinander, inkl. Lücken
 * ("noch kein Stand").
 */
export default async function ThemenPage() {
  const session = await requireSession();
  const admin = createAdminClient();

  // Fallback ?? [] — fehlen Migrationen 0021/0024, darf die Seite nicht crashen.
  const [{ data: topicRows }, { data: noteRows }] = await Promise.all([
    admin.from("note_topics").select("id, title, created_at").order("title"),
    admin.from("hub_notes").select("*").order("created_at", { ascending: false }),
  ]);

  const topics = topicRows ?? [];
  const hubIds = new Set(session.hubs.map((h) => h.id));
  const notes = ((noteRows ?? []) as {
    id: string;
    hub_id: string;
    text: string;
    is_todo: boolean;
    done_at: string | null;
    topic_id?: string | null;
    created_at: string | null;
  }[]).filter((n) => hubIds.has(n.hub_id));

  const hubsSorted = [...session.hubs].sort((a, b) =>
    a.name.localeCompare(b.name, "de"),
  );

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold">Themen</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Ein Thema betrifft alle Standorte — hier siehst du je Thema den
          aktuellen Stand jedes Standorts. Notizen entstehen auf den
          Hub-Detailseiten (Bereich „Notizen &amp; To-dos&rdquo;, Thema
          auswählen oder neu anlegen).
        </p>
      </div>

      {topics.length === 0 && (
        <p className="rounded-xl border bg-card p-5 text-sm text-muted-foreground shadow-sm">
          Noch keine Themen. Lege beim Erstellen einer Standort-Notiz einfach
          „+ Neues Thema…&rdquo; an (z.&nbsp;B. „Recare&rdquo;) — es erscheint
          dann hier mit dem Stand aller Standorte.
        </p>
      )}

      {topics.map((topic) => {
        const topicNotes = notes.filter((n) => n.topic_id === topic.id);
        const byHub = new Map<string, typeof topicNotes>();
        for (const n of topicNotes) {
          const arr = byHub.get(n.hub_id) ?? [];
          arr.push(n);
          byHub.set(n.hub_id, arr);
        }
        const openTodos = topicNotes.filter(
          (n) => n.is_todo && !n.done_at,
        ).length;
        const hubsWithNotes = hubsSorted.filter((h) => byHub.has(h.id));
        const hubsWithout = hubsSorted.filter((h) => !byHub.has(h.id));

        return (
          <section key={topic.id} className="flex flex-col gap-3">
            <div className="flex flex-wrap items-center gap-2">
              <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <BookOpen className="size-4" />
              </span>
              <h2 className="text-lg font-semibold">{topic.title}</h2>
              <span className="text-sm text-muted-foreground">
                {hubsWithNotes.length} von {hubsSorted.length} Standorten mit
                Stand
              </span>
              {openTodos > 0 && (
                <Badge variant="secondary" className="tabular-nums">
                  {openTodos} To-do{openTodos > 1 ? "s" : ""} offen
                </Badge>
              )}
            </div>

            <div className="grid gap-4 lg:grid-cols-2">
              {hubsWithNotes.map((h) => {
                const hubNotes = byHub.get(h.id)!;
                return (
                  <Card key={h.id}>
                    <CardContent className="flex flex-col gap-2 p-4">
                      <Link
                        href={`/hubs/${h.id}`}
                        className="flex items-center gap-2 hover:text-primary"
                      >
                        <span
                          aria-hidden
                          className="size-2.5 rounded-full"
                          style={{ backgroundColor: mdColor(h.responsible_md) }}
                        />
                        <span className="font-semibold">{h.name}</span>
                      </Link>
                      <ul className="flex flex-col gap-1.5">
                        {hubNotes.map((n) => {
                          const done = Boolean(n.done_at);
                          return (
                            <li
                              key={n.id}
                              className="flex items-start gap-2 border-t pt-1.5 text-sm first:border-t-0 first:pt-0"
                            >
                              {n.is_todo ? (
                                done ? (
                                  <Check className="mt-0.5 size-3.5 shrink-0 text-chart-4" />
                                ) : (
                                  <Circle className="mt-0.5 size-3 shrink-0 fill-current text-primary" />
                                )
                              ) : (
                                <StickyNote className="mt-0.5 size-3.5 shrink-0 text-muted-foreground" />
                              )}
                              <span className="min-w-0">
                                <span
                                  className={cn(
                                    "block whitespace-pre-wrap",
                                    done &&
                                      "text-muted-foreground line-through",
                                  )}
                                >
                                  {n.text}
                                </span>
                                <span className="block text-xs text-muted-foreground">
                                  {formatDate(n.created_at)}
                                  {n.is_todo && !done && " · offenes To-do"}
                                  {done && ` · erledigt ${formatDate(n.done_at)}`}
                                </span>
                              </span>
                            </li>
                          );
                        })}
                      </ul>
                    </CardContent>
                  </Card>
                );
              })}
            </div>

            {hubsWithout.length > 0 && (
              <p className="text-xs text-muted-foreground">
                Noch kein Stand:{" "}
                {hubsWithout.map((h, i) => (
                  <span key={h.id}>
                    {i > 0 && ", "}
                    <Link
                      href={`/hubs/${h.id}`}
                      className="underline hover:text-foreground"
                    >
                      {h.name}
                    </Link>
                  </span>
                ))}
              </p>
            )}
          </section>
        );
      })}
    </div>
  );
}
