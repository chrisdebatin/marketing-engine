"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Mail, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { triggerWeeklyMails } from "@/app/(app)/admin/actions";

/**
 * Manuelles Auslösen der Wochen-Mails (MD-Update / PDL-Reminder) aus dem
 * Admin — gleiche Logik wie der Montags-Cron, zum Testen und Nachholen.
 */
export function WeeklyMailButtons() {
  const [pending, startTransition] = useTransition();
  const [lastResult, setLastResult] = useState<string | null>(null);

  function run(kind: "md" | "pdl") {
    if (pending) return;
    if (
      !window.confirm(
        kind === "md"
          ? "MD-Updates jetzt an alle MDs mit hinterlegter E-Mail senden?"
          : "PDL-Reminder jetzt an alle Standorte mit fälligen Orten senden?",
      )
    ) {
      return;
    }
    startTransition(async () => {
      const r = await triggerWeeklyMails(kind);
      setLastResult(r.message);
      if (r.ok) toast.success("Versand abgeschlossen");
      else toast.error("Versand mit Problemen — Details unten.");
    });
  }

  return (
    <div className="flex flex-col gap-2 border-t pt-3">
      <p className="text-sm font-medium">
        Wochen-Mails (automatisch jeden Montag 8:00 Uhr)
      </p>
      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={pending}
          onClick={() => run("md")}
        >
          <Send className="size-4" />
          {pending ? "Sende…" : "MD-Updates jetzt senden"}
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={pending}
          onClick={() => run("pdl")}
        >
          <Mail className="size-4" />
          {pending ? "Sende…" : "PDL-Reminder jetzt senden"}
        </Button>
      </div>
      {lastResult && (
        <p className="text-xs break-words text-muted-foreground">
          {lastResult}
        </p>
      )}
    </div>
  );
}
