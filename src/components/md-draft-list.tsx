"use client";

import { useEffect, useState, useTransition } from "react";
import { toast } from "sonner";
import { Check, ChevronRight, FileText, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { sendMdDraft } from "@/app/(app)/admin/actions";

export interface MdDraftView {
  md: string;
  email: string | null;
  subject: string;
  html: string;
  hubNames: string[];
}

/**
 * MD-Wochen-Updates als Review-Cockpit: links alle Entwürfe, rechts die
 * Vorschau des ausgewählten. Freigeben springt automatisch zum nächsten
 * offenen Entwurf; „Alle offenen senden“ schickt den Rest in einem Rutsch
 * (eine Rückfrage statt einer pro Mail). Ohne Freigabe wird nichts versendet.
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
  const [failed, setFailed] = useState<Record<string, string>>({});
  const [selected, setSelected] = useState<string | null>(
    drafts.find((d) => d.email)?.md ?? drafts[0]?.md ?? null,
  );
  const [bulk, setBulk] = useState<{ pos: number; total: number } | null>(null);

  const current = drafts.find((d) => d.md === selected) ?? null;
  const offen = drafts.filter((d) => d.email && !sentTo.has(d.md));

  function nextOpenAfter(md: string): string | null {
    const i = drafts.findIndex((d) => d.md === md);
    const danach = [...drafts.slice(i + 1), ...drafts.slice(0, Math.max(i, 0))];
    return danach.find((d) => d.email && !sentTo.has(d.md))?.md ?? null;
  }

  function send(d: MdDraftView) {
    if (pending || !canSend) return;
    if (!d.email) {
      toast.error(
        `Für ${d.md} ist keine MD-E-Mail hinterlegt (Admin → Hub-Formular).`,
      );
      return;
    }
    startTransition(async () => {
      const r = await sendMdDraft(d.md, notes[d.md]);
      if (r.ok) {
        toast.success(`Gesendet an ${d.md}`);
        setSentTo((prev) => new Set(prev).add(d.md));
        setFailed((prev) => {
          const n = { ...prev };
          delete n[d.md];
          return n;
        });
        const nxt = nextOpenAfter(d.md);
        if (nxt) setSelected(nxt);
      } else {
        setFailed((prev) => ({ ...prev, [d.md]: r.message }));
        toast.error(r.message);
      }
    });
  }

  function sendAll() {
    if (pending || !canSend || offen.length === 0) return;
    if (
      !window.confirm(
        `${offen.length === 1 ? "1 offenen Entwurf" : `${offen.length} offene Entwürfe`} jetzt senden?`,
      )
    ) {
      return;
    }
    const liste = offen;
    startTransition(async () => {
      let ok = 0;
      for (let i = 0; i < liste.length; i++) {
        const d = liste[i];
        setBulk({ pos: i + 1, total: liste.length });
        setSelected(d.md);
        const r = await sendMdDraft(d.md, notes[d.md]);
        if (r.ok) {
          ok++;
          setSentTo((prev) => new Set(prev).add(d.md));
        } else {
          setFailed((prev) => ({ ...prev, [d.md]: r.message }));
        }
      }
      setBulk(null);
      if (ok === liste.length) toast.success(`Alle ${ok} Entwürfe gesendet.`);
      else toast.error(`${ok} gesendet, ${liste.length - ok} mit Fehler — rote Markierung in der Liste.`);
    });
  }

  // Tastatur: ↑/↓ Entwurf wechseln, ⌘/Strg+Enter aktuellen freigeben.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
        if (current) {
          e.preventDefault();
          send(current);
        }
        return;
      }
      const tag = (e.target as HTMLElement | null)?.tagName;
      if (tag === "TEXTAREA" || tag === "INPUT") return;
      if (e.key === "ArrowDown" || e.key === "ArrowUp") {
        e.preventDefault();
        const i = drafts.findIndex((d) => d.md === selected);
        const j =
          e.key === "ArrowDown"
            ? Math.min(drafts.length - 1, i + 1)
            : Math.max(0, i - 1);
        setSelected(drafts[j]?.md ?? selected);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected, drafts, pending, notes, sentTo, canSend]);

  if (drafts.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        Keine MDs gefunden — Hubs brauchen einen eingetragenen MD.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {/* Fortschritt + Alles senden */}
      <div className="flex flex-wrap items-center gap-2">
        <p className="text-sm text-muted-foreground">
          <span className="font-semibold text-foreground">{sentTo.size}</span>/
          {drafts.length} gesendet
          {offen.length > 0 && ` · ${offen.length} offen`}
        </p>
        {bulk && (
          <Badge variant="secondary">
            Sende {bulk.pos}/{bulk.total}…
          </Badge>
        )}
        <span className="ml-auto hidden text-xs text-muted-foreground sm:inline">
          ↑/↓ wechseln · ⌘/Strg+Enter freigeben
        </span>
        <Button
          type="button"
          size="sm"
          disabled={pending || !canSend || offen.length === 0}
          onClick={sendAll}
        >
          <Send className="size-4" />
          Alle offenen senden ({offen.length})
        </Button>
      </div>

      <div className="grid gap-3 lg:grid-cols-[280px_minmax(0,1fr)]">
        {/* Entwurfs-Liste */}
        <ul className="flex max-h-56 flex-col gap-1 overflow-auto lg:max-h-[560px]">
          {drafts.map((d) => (
            <li key={d.md}>
              <button
                type="button"
                onClick={() => setSelected(d.md)}
                className={cn(
                  "flex w-full cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-left text-sm transition-colors",
                  selected === d.md
                    ? "border-primary bg-primary/5"
                    : "bg-card hover:bg-muted/50",
                )}
              >
                {sentTo.has(d.md) ? (
                  <Check className="size-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
                ) : (
                  <FileText
                    className={cn(
                      "size-4 shrink-0",
                      d.email ? "text-primary" : "text-muted-foreground",
                    )}
                  />
                )}
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-medium">{d.md}</span>
                  <span className="block truncate text-xs text-muted-foreground">
                    {d.email ?? "keine E-Mail hinterlegt"}
                  </span>
                </span>
                {failed[d.md] && (
                  <span
                    className="size-2 shrink-0 rounded-full bg-destructive"
                    title={failed[d.md]}
                  />
                )}
              </button>
            </li>
          ))}
        </ul>

        {/* Vorschau + Freigabe */}
        {current && (
          <div className="flex min-w-0 flex-col gap-2.5 rounded-xl border bg-card p-4 shadow-sm">
            <div className="flex flex-wrap items-center gap-2">
              <p className="font-medium">{current.md}</p>
              <span className="text-xs text-muted-foreground">
                {current.hubNames.join(", ")}
              </span>
              {sentTo.has(current.md) ? (
                <Badge className="ml-auto" variant="secondary">
                  ✓ gesendet
                </Badge>
              ) : current.email ? (
                <Badge className="ml-auto" variant="outline">
                  Entwurf → {current.email}
                </Badge>
              ) : (
                <Badge
                  className="ml-auto border-destructive/40 text-destructive"
                  variant="outline"
                >
                  keine E-Mail hinterlegt
                </Badge>
              )}
            </div>
            <p className="text-sm">
              <span className="text-muted-foreground">Betreff:</span>{" "}
              <span className="font-medium">{current.subject}</span>
            </p>
            {/* Eigene, server-generierte Mail — kein Fremd-HTML. */}
            <div
              className="max-h-72 overflow-auto rounded-lg border bg-white p-4 text-sm dark:bg-muted/30"
              dangerouslySetInnerHTML={{ __html: current.html }}
            />
            {failed[current.md] && (
              <p className="text-sm text-destructive">{failed[current.md]}</p>
            )}
            <Textarea
              value={notes[current.md] ?? ""}
              onChange={(e) =>
                setNotes((prev) => ({ ...prev, [current.md]: e.target.value }))
              }
              placeholder="Persönliche Anmerkung (optional) — wird oben in die Mail eingefügt, z. B. „Starke Woche in Dorsten!“"
              maxLength={1000}
              className="min-h-16"
              disabled={pending}
            />
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                size="sm"
                disabled={pending || !canSend || !current.email}
                onClick={() => send(current)}
              >
                <Send className="size-4" />
                {pending
                  ? "Sende…"
                  : sentTo.has(current.md)
                    ? "Erneut senden"
                    : "Freigeben & senden"}
              </Button>
              {nextOpenAfter(current.md) && (
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={pending}
                  onClick={() => setSelected(nextOpenAfter(current.md))}
                >
                  Überspringen
                  <ChevronRight className="size-4" />
                </Button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
