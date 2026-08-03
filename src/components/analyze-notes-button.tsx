"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { analyzeCallNotes } from "@/app/(app)/frontoffice/actions";

/**
 * Admin: bestehende Call-Center-Notizen nachträglich per KI auswerten und
 * daraus To-dos für die PDLs anlegen (neue Anrufe werden automatisch
 * ausgewertet — der Button ist für den Alt-Bestand).
 */
export function AnalyzeNotesButton() {
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<string | null>(null);

  function run() {
    if (pending) return;
    startTransition(async () => {
      const r = await analyzeCallNotes();
      setResult(r.message);
      if (r.ok) toast.success("Auswertung abgeschlossen");
      else toast.error(r.message);
    });
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={pending}
        onClick={run}
      >
        <Sparkles className="size-4" />
        {pending ? "Werte aus… (kann 1–2 Min dauern)" : "Alte Notizen mit KI auswerten"}
      </Button>
      {result && (
        <span className="text-xs break-words text-muted-foreground">
          {result}
        </span>
      )}
    </div>
  );
}
