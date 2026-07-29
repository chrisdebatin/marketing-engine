"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { ClipboardList, NotebookPen } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  saveOnlineAdsFreitext,
  type FreitextKey,
} from "@/app/(app)/online-anzeigen/actions";

/**
 * Freitext-Status: "Was läuft gerade?" bzw. "Was soll laufen?" — schnelle
 * Übersicht in eigenen Worten, ergänzend zu den strukturierten Listen.
 */
export function OnlineAdsFreitext({
  settingKey,
  title,
  placeholder,
  initialText,
  initialUpdatedAt,
}: {
  settingKey: FreitextKey;
  title: string;
  placeholder: string;
  initialText: string;
  initialUpdatedAt: string | null;
}) {
  const [pending, startTransition] = useTransition();
  const [text, setText] = useState(initialText);
  const [updatedAt, setUpdatedAt] = useState(initialUpdatedAt);
  const [dirty, setDirty] = useState(false);
  const Icon = settingKey === "soll" ? ClipboardList : NotebookPen;

  function save() {
    startTransition(async () => {
      const r = await saveOnlineAdsFreitext(settingKey, text);
      if (r.ok) {
        toast.success("Gespeichert");
        setDirty(false);
        if (r.updatedAt) setUpdatedAt(r.updatedAt);
      } else {
        toast.error(r.error ?? "Fehler");
      }
    });
  }

  return (
    <div className="flex flex-col gap-2 rounded-xl border border-primary/25 bg-primary/[0.04] p-4">
      <div className="flex flex-wrap items-baseline gap-2">
        <p className="flex items-center gap-1.5 text-sm font-semibold">
          <Icon className="size-4 text-primary" />
          {title}
        </p>
        {updatedAt && (
          <span className="text-xs text-muted-foreground">
            zuletzt aktualisiert{" "}
            {new Date(updatedAt).toLocaleString("de-DE", {
              day: "2-digit",
              month: "2-digit",
              hour: "2-digit",
              minute: "2-digit",
            })}
          </span>
        )}
      </div>
      <Textarea
        value={text}
        onChange={(e) => {
          setText(e.target.value);
          setDirty(true);
        }}
        placeholder={placeholder}
        maxLength={5000}
        className="min-h-28 flex-1 bg-background"
        disabled={pending}
      />
      <div>
        <Button
          type="button"
          size="sm"
          disabled={pending || !dirty}
          onClick={save}
        >
          {pending ? "Speichere…" : "Speichern"}
        </Button>
      </div>
    </div>
  );
}
