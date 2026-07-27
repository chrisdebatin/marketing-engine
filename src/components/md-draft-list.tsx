"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { FileText, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { sendMdDraft } from "@/app/(app)/admin/actions";

export interface MdDraftView {
  md: string;
  email: string | null;
  subject: string;
  html: string;
  hubNames: string[];
}

/**
 * MD-Wochen-Updates als Entwürfe: pro MD die fertige Mail (individuell mit
 * seinen Standorten) zur Durchsicht — Versand erst nach Klick, optional mit
 * persönlicher Anmerkung, die oben in die Mail eingefügt wird.
 */
export function MdDraftList({
  drafts,
  canSend,
}: {
  drafts: MdDraftView[];
  canSend: boolean;
}) {
  const [pending, startTransition] = useTransition();
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [sentTo, setSentTo] = useState<Set<string>>(new Set());
  const [result, setResult] = useState<string | null>(null);

  function send(d: MdDraftView) {
    if (pending) return;
    if (!d.email) {
      toast.error(`Für ${d.md} ist keine MD-E-Mail hinterlegt (Admin → Hub-Formular).`);
      return;
    }
    if (!window.confirm(`Entwurf jetzt an ${d.md} <${d.email}> senden?`)) return;
    startTransition(async () => {
      const r = await sendMdDraft(d.md, notes[d.md]);
      setResult(r.message);
      if (r.ok) {
        toast.success(`Gesendet an ${d.md}`);
        setSentTo((prev) => new Set(prev).add(d.md));
      } else {
        toast.error(r.message);
      }
    });
  }

  if (drafts.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        Keine MDs gefunden — Hubs brauchen einen eingetragenen MD.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      {drafts.map((d) => (
        <details key={d.md} className="group rounded-xl border bg-card shadow-sm">
          <summary className="flex cursor-pointer list-none flex-wrap items-center gap-2 px-4 py-3 select-none">
            <FileText className="size-4 shrink-0 text-primary" />
            <span className="font-medium">{d.md}</span>
            <span className="text-xs text-muted-foreground">
              {d.hubNames.join(", ")}
            </span>
            {sentTo.has(d.md) ? (
              <Badge className="ml-auto" variant="secondary">
                ✓ gesendet
              </Badge>
            ) : d.email ? (
              <Badge className="ml-auto" variant="outline">
                Entwurf → {d.email}
              </Badge>
            ) : (
              <Badge className="ml-auto border-destructive/40 text-destructive" variant="outline">
                keine E-Mail hinterlegt
              </Badge>
            )}
          </summary>
          <div className="flex flex-col gap-2.5 border-t px-4 py-3">
            <p className="text-sm">
              <span className="text-muted-foreground">Betreff:</span>{" "}
              <span className="font-medium">{d.subject}</span>
            </p>
            {/* Eigene, server-generierte Mail — kein Fremd-HTML. */}
            <div
              className="max-h-96 overflow-auto rounded-lg border bg-white p-4 text-sm dark:bg-muted/30"
              dangerouslySetInnerHTML={{ __html: d.html }}
            />
            <Textarea
              value={notes[d.md] ?? ""}
              onChange={(e) =>
                setNotes((prev) => ({ ...prev, [d.md]: e.target.value }))
              }
              placeholder="Persönliche Anmerkung (optional) — wird oben in die Mail eingefügt, z. B. „Starke Woche in Dorsten!“"
              maxLength={1000}
              className="min-h-16"
              disabled={pending}
            />
            <div>
              <Button
                type="button"
                size="sm"
                disabled={pending || !canSend || !d.email}
                onClick={() => send(d)}
              >
                <Send className="size-4" />
                {pending
                  ? "Sende…"
                  : sentTo.has(d.md)
                    ? "Erneut senden"
                    : `Freigeben & an ${d.md} senden`}
              </Button>
            </div>
          </div>
        </details>
      ))}
      {result && (
        <p className="text-xs break-words text-muted-foreground">{result}</p>
      )}
    </div>
  );
}
