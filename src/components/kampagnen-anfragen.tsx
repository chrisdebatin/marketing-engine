"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Check, Circle, Inbox, Plus, Trash2 } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import {
  createHubNote,
  deleteHubNote,
  updateHubNote,
} from "@/app/(app)/hubs/note-actions";

export const KAMPAGNEN_TOPIC = "Kampagnen-Anfragen";

export interface AnfrageRow {
  id: string;
  hub_id: string;
  text: string;
  done_at: string | null;
  created_at: string | null;
}

/**
 * Kampagnen-Anfragen: "Attendorn will eine Stellenanzeige" — wird als
 * offenes To-do geloggt (Thema "Kampagnen-Anfragen") und erscheint damit
 * auch auf den Hub-Karten und im Themen-Board.
 */
export function KampagnenAnfragen({
  hubs,
  anfragen,
}: {
  hubs: { id: string; name: string }[];
  anfragen: AnfrageRow[];
}) {
  const [pending, startTransition] = useTransition();
  const [hubId, setHubId] = useState("");
  const [text, setText] = useState("");

  const hubItems = Object.fromEntries(hubs.map((h) => [h.id, h.name]));
  const hubName = (id: string) => hubs.find((h) => h.id === id)?.name ?? "—";

  const offene = anfragen.filter((a) => !a.done_at);
  const erledigte = anfragen.filter((a) => a.done_at).slice(0, 5);

  function add() {
    if (pending) return;
    if (!hubId) {
      toast.error("Standort wählen.");
      return;
    }
    if (!text.trim()) {
      toast.error("Anfrage eintragen.");
      return;
    }
    startTransition(async () => {
      const r = await createHubNote({
        hub_id: hubId,
        text: text.trim(),
        is_todo: true,
        topic_title: KAMPAGNEN_TOPIC,
      });
      if (r.ok) {
        toast.success("Anfrage als To-do geloggt");
        setText("");
      } else {
        toast.error(r.error);
      }
    });
  }

  return (
    <section className="flex flex-col gap-3 rounded-xl border bg-card p-5 shadow-sm">
      <div className="flex flex-wrap items-baseline gap-2">
        <p className="flex items-center gap-1.5 font-semibold">
          <Inbox className="size-4 text-primary" />
          Kampagnen-Anfragen
        </p>
        <span className="text-xs text-muted-foreground">
          z. B. „Attendorn will eine Stellenanzeige&rdquo; — landet als
          offenes To-do hier, auf der Hub-Karte und im Themen-Board.
        </span>
      </div>

      {/* Eintragen */}
      <div className="flex flex-wrap items-center gap-2">
        <Select
          items={hubItems}
          value={hubId}
          onValueChange={(v) => setHubId(v ?? "")}
        >
          <SelectTrigger className="w-56">
            <SelectValue placeholder="Standort wählen" />
          </SelectTrigger>
          <SelectContent>
            {Object.entries(hubItems).map(([value, label]) => (
              <SelectItem key={value} value={value}>
                {label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Input
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Was wird gewünscht? z. B. Stellenanzeige Pflegefachkraft auf Join"
          maxLength={2000}
          className="min-w-64 flex-1"
          onKeyDown={(e) => {
            if (e.key === "Enter") add();
          }}
        />
        <Button type="button" disabled={pending} onClick={add}>
          <Plus className="size-4" />
          {pending ? "Speichere…" : "Anfrage loggen"}
        </Button>
      </div>

      {/* Offene Anfragen */}
      <div className="flex flex-col gap-1">
        <p className="text-sm font-medium">
          Offen ({offene.length})
        </p>
        {offene.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Keine offenen Anfragen. 🎉
          </p>
        ) : (
          <ul className="flex flex-col gap-1">
            {offene.map((a) => (
              <li
                key={a.id}
                className="group/anfrage flex items-start gap-2 rounded-lg bg-muted/50 px-3 py-1.5 text-sm"
              >
                <button
                  type="button"
                  disabled={pending}
                  onClick={() =>
                    startTransition(async () => {
                      const r = await updateHubNote(a.id, { done: true });
                      if (r.ok) toast.success("Anfrage erledigt ✓");
                      else toast.error(r.error);
                    })
                  }
                  className="mt-0.5 shrink-0"
                  aria-label="Als erledigt abhaken"
                  title="Erledigt"
                >
                  <Circle className="size-4 text-muted-foreground hover:text-primary" />
                </button>
                <span className="min-w-0 flex-1">
                  <span className="font-medium">{hubName(a.hub_id)}:</span>{" "}
                  {a.text}
                </span>
                <button
                  type="button"
                  disabled={pending}
                  onClick={() => {
                    if (window.confirm("Anfrage löschen?")) {
                      startTransition(async () => {
                        const r = await deleteHubNote(a.id);
                        if (r.ok) toast.success("Anfrage gelöscht");
                        else toast.error(r.error);
                      });
                    }
                  }}
                  className="shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover/anfrage:opacity-100 hover:text-destructive"
                  aria-label="Anfrage löschen"
                >
                  <Trash2 className="size-3.5" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Zuletzt erledigt */}
      {erledigte.length > 0 && (
        <div className="flex flex-col gap-1 border-t pt-2">
          <p className="text-xs font-medium text-muted-foreground">
            Zuletzt erledigt
          </p>
          <ul className="flex flex-col gap-0.5">
            {erledigte.map((a) => (
              <li
                key={a.id}
                className={cn(
                  "flex items-start gap-2 px-3 text-sm text-muted-foreground line-through",
                )}
              >
                <Check className="mt-0.5 size-4 shrink-0 text-chart-4" />
                <span className="min-w-0">
                  {hubName(a.hub_id)}: {a.text}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
