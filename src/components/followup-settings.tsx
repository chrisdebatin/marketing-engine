"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Settings2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { KONTAKT_ARTEN } from "@/lib/crm";
import type { FollowupWeeks } from "@/lib/settings";
import { updateFollowupWeeks } from "@/app/(app)/ziele/actions";

/**
 * Globaler Follow-up-Rhythmus je Kontakt-Art: Nach Box/Flyer standardmäßig
 * 8 Wochen bis zum nächsten Termin, nach Besuch/Anruf 4 — hier einstellbar,
 * gilt für alle künftig geloggten Kontakte.
 */
export function FollowupSettings({ initial }: { initial: FollowupWeeks }) {
  const [pending, startTransition] = useTransition();
  const [weeks, setWeeks] = useState<FollowupWeeks>(initial);

  function save() {
    startTransition(async () => {
      const r = await updateFollowupWeeks(weeks);
      if (r.ok) toast.success("Follow-up-Rhythmus gespeichert");
      else toast.error(r.error);
    });
  }

  return (
    <details className="group rounded-xl border bg-card shadow-sm">
      <summary className="flex cursor-pointer list-none items-center gap-2 px-5 py-3.5 text-sm font-semibold select-none">
        <Settings2 className="size-4 text-primary" />
        Follow-up-Rhythmus
        <span className="text-xs font-normal text-muted-foreground">
          Box/Flyer: {weeks.box}/{weeks.flyer} Wochen · Besuch/Anruf:{" "}
          {weeks.besuch}/{weeks.anruf}
        </span>
        <span className="ml-auto text-xs font-normal text-muted-foreground group-open:hidden">
          einstellen
        </span>
      </summary>
      <div className="flex flex-col gap-3 border-t px-5 py-4">
        <p className="text-sm text-muted-foreground">
          Nach wie vielen Wochen soll der nächste Termin fällig werden? Gilt
          für alle Standorte und alle künftig geloggten Kontakte.
        </p>
        <div className="flex flex-wrap items-end gap-3">
          {KONTAKT_ARTEN.map((k) => (
            <label key={k.key} className="flex flex-col gap-1 text-xs">
              <span className="text-muted-foreground">{k.label}</span>
              <span className="flex items-center gap-1.5">
                <Input
                  type="number"
                  min={1}
                  max={52}
                  inputMode="numeric"
                  value={weeks[k.key as keyof FollowupWeeks]}
                  onChange={(e) =>
                    setWeeks((prev) => ({
                      ...prev,
                      [k.key]: Math.trunc(Number(e.target.value)) || 1,
                    }))
                  }
                  className="w-20"
                />
                Wochen
              </span>
            </label>
          ))}
          <Button type="button" size="sm" disabled={pending} onClick={save}>
            {pending ? "Speichere…" : "Speichern"}
          </Button>
        </div>
      </div>
    </details>
  );
}
