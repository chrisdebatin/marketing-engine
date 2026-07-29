"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { extractSollTodos } from "@/app/(app)/online-anzeigen/actions";
import { ImageAttachRow, useImageAttach } from "@/components/image-attach";

/**
 * Schnell-Eingang auf dem Start-Bildschirm: Anfragen der Hubs frei
 * eintippen (Anzeigen, Zeitungsanzeigen, Material …) — die KI zerlegt sie
 * in Aufgaben je Standort, die im Kanban darunter landen.
 */
export function AnfragenCapture() {
  const [pending, startTransition] = useTransition();
  const [text, setText] = useState("");
  const attach = useImageAttach();

  function erfassen() {
    if (pending || text.trim().length < 5) return;
    startTransition(async () => {
      const r = await extractSollTodos(text, attach.images);
      if (r.ok) {
        toast.success(r.message, { duration: 8000 });
        setText("");
        attach.reset();
      } else {
        toast.error(r.message);
      }
    });
  }

  return (
    <div className="flex flex-col gap-2 rounded-xl border border-primary/25 bg-primary/[0.04] p-4">
      <p className="flex items-center gap-1.5 text-sm font-semibold">
        <Sparkles className="size-4 text-primary" />
        Anfragen eintippen — KI sortiert sie in das Kanban
      </p>
      <Textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder={
          "z. B.\n• Attendorn will eine Zeitungsanzeige im Sauerlandkurier\n• Velbert braucht 500 Flyer nach\n• Meta-Anzeige für Tagespflege Duisburg"
        }
        maxLength={5000}
        className="min-h-24 bg-background"
        disabled={pending}
        onPaste={attach.onPaste}
      />
      <ImageAttachRow attach={attach} disabled={pending} />
      <div className="flex flex-wrap items-center gap-2">
        <Button
          type="button"
          size="sm"
          disabled={pending || text.trim().length < 5}
          onClick={erfassen}
        >
          <Sparkles className="size-4" />
          {pending ? "KI liest…" : "Mit KI erfassen"}
        </Button>
        <span className="text-xs text-muted-foreground">
          Ein Eintrag pro Zeile funktioniert am besten — Standort einfach im
          Text nennen.
        </span>
      </div>
    </div>
  );
}
