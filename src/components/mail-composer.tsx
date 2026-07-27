"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { sendAdminMail } from "@/app/(app)/admin/actions";

export interface MailHubOption {
  id: string;
  name: string;
  /** Anzahl hinterlegter PDL-Adressen (0 = nicht wählbar). */
  pdlCount: number;
  mdEmail: string | null;
  md: string | null;
}

/**
 * Freie Update-Mail aus dem Admin: Empfänger wählen (PDLs je Standort,
 * alle MDs, zusätzliche Adressen wie Geschäftsführung), Betreff + Text,
 * Versand einzeln pro Empfänger über SMTP/Outlook.
 */
export function MailComposer({ hubs }: { hubs: MailHubOption[] }) {
  const [pending, startTransition] = useTransition();
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [pdlIds, setPdlIds] = useState<Set<string>>(new Set());
  const [includeMds, setIncludeMds] = useState(false);
  const [extra, setExtra] = useState("");
  const [result, setResult] = useState<string | null>(null);

  const selectableHubs = hubs.filter((h) => h.pdlCount > 0);
  const mdEmails = new Set(
    hubs.map((h) => (h.mdEmail ?? "").toLowerCase()).filter((e) => e.includes("@")),
  );
  const extraCount = extra.split(/[,;\s]+/).filter((e) => e.includes("@")).length;
  const pdlCount = selectableHubs
    .filter((h) => pdlIds.has(h.id))
    .reduce((s, h) => s + h.pdlCount, 0);
  const totalCount = pdlCount + (includeMds ? mdEmails.size : 0) + extraCount;

  function togglePdl(id: string) {
    setPdlIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function send() {
    if (pending) return;
    if (!subject.trim() || !body.trim()) {
      toast.error("Betreff und Nachricht angeben.");
      return;
    }
    if (totalCount === 0) {
      toast.error("Mindestens einen Empfänger wählen.");
      return;
    }
    if (
      !window.confirm(
        `Mail „${subject.trim()}“ jetzt an ca. ${totalCount} Empfänger senden?`,
      )
    ) {
      return;
    }
    startTransition(async () => {
      const r = await sendAdminMail({
        subject,
        body,
        pdlHubIds: [...pdlIds],
        includeMds,
        extra,
      });
      setResult(r.message);
      if (r.ok) {
        toast.success("Versand abgeschlossen");
        setSubject("");
        setBody("");
      } else {
        toast.error("Versand mit Problemen — Details unten.");
      }
    });
  }

  const chip = (active: boolean) =>
    cn(
      "cursor-pointer rounded-full border px-2.5 py-1 text-xs font-medium transition-colors select-none",
      active
        ? "border-primary bg-primary/10 text-primary"
        : "text-muted-foreground hover:text-foreground",
    );

  return (
    <div className="flex flex-col gap-3">
      {/* Empfänger */}
      <div className="flex flex-col gap-1.5">
        <Label className="text-xs">
          An PDLs (Standorte anklicken
          {selectableHubs.length > 0 ? " — nur Hubs mit PDL-E-Mail" : ""})
        </Label>
        {selectableHubs.length === 0 ? (
          <p className="text-xs text-muted-foreground">
            Kein Hub hat eine PDL-E-Mail hinterlegt.
          </p>
        ) : (
          <div className="flex flex-wrap gap-1.5">
            <button
              type="button"
              className={chip(pdlIds.size === selectableHubs.length)}
              onClick={() =>
                setPdlIds(
                  pdlIds.size === selectableHubs.length
                    ? new Set()
                    : new Set(selectableHubs.map((h) => h.id)),
                )
              }
            >
              Alle PDLs
            </button>
            {selectableHubs.map((h) => (
              <button
                key={h.id}
                type="button"
                className={chip(pdlIds.has(h.id))}
                onClick={() => togglePdl(h.id)}
              >
                {h.name}
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-1.5">
        <Label className="w-full text-xs sm:w-auto">Außerdem an:</Label>
        <button
          type="button"
          className={chip(includeMds)}
          onClick={() => setIncludeMds((v) => !v)}
        >
          Alle MDs ({mdEmails.size} mit E-Mail)
        </button>
        <Input
          value={extra}
          onChange={(e) => setExtra(e.target.value)}
          placeholder="Weitere Empfänger, z. B. Geschäftsführung (Komma-getrennt)"
          className="min-w-56 flex-1"
          autoComplete="off"
        />
      </div>

      {/* Inhalt */}
      <Input
        value={subject}
        onChange={(e) => setSubject(e.target.value)}
        placeholder="Betreff, z. B. Marketing-Update Juli"
        maxLength={200}
        disabled={pending}
      />
      <Textarea
        value={body}
        onChange={(e) => setBody(e.target.value)}
        placeholder={
          "Nachricht — Leerzeile = neuer Absatz.\nGrußformel und Kontaktdaten werden automatisch angehängt."
        }
        className="min-h-36"
        maxLength={8000}
        disabled={pending}
      />

      <div className="flex flex-wrap items-center gap-2">
        <Button
          type="button"
          disabled={pending || totalCount === 0 || !subject.trim() || !body.trim()}
          onClick={send}
        >
          <Send className="size-4" />
          {pending
            ? "Sende…"
            : `Senden${totalCount > 0 ? ` an ca. ${totalCount} Empfänger` : ""}`}
        </Button>
        <span className="text-xs text-muted-foreground">
          Jeder Empfänger erhält eine eigene Mail (keine sichtbare Verteilerliste).
        </span>
      </div>
      {result && (
        <p className="text-xs break-words text-muted-foreground">{result}</p>
      )}
    </div>
  );
}
