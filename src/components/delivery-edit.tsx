"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { updateDelivery } from "@/app/(app)/lieferungen/delivery-actions";

export interface EditableDelivery {
  id: string;
  flyer_count: number;
  aufsteller_count: number;
  box_count: number;
  note: string | null;
}

/**
 * Inline-Korrektur einer erfassten Lieferung (Mengen + Notiz) in der
 * Lieferungs-Liste — z. B. wenn beim Erfassen etwas falsch eingetragen wurde.
 */
export function DeliveryEdit({ delivery }: { delivery: EditableDelivery }) {
  const [open, setOpen] = useState(false);
  const [flyer, setFlyer] = useState(String(delivery.flyer_count));
  const [aufsteller, setAufsteller] = useState(
    String(delivery.aufsteller_count),
  );
  const [boxes, setBoxes] = useState(String(delivery.box_count));
  const [note, setNote] = useState(delivery.note ?? "");
  const [pending, startTransition] = useTransition();

  function save() {
    startTransition(async () => {
      const res = await updateDelivery({
        id: delivery.id,
        flyer_count: flyer,
        aufsteller_count: aufsteller,
        box_count: boxes,
        note,
      });
      if (res.ok) {
        toast.success("Lieferung aktualisiert");
        setOpen(false);
      } else {
        toast.error(res.error);
      }
    });
  }

  if (!open) {
    return (
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="text-muted-foreground"
        onClick={() => setOpen(true)}
        title="Lieferung bearbeiten"
      >
        <Pencil className="size-3.5" />
        Bearbeiten
      </Button>
    );
  }

  return (
    <div className="flex w-full flex-col gap-3 rounded-lg border bg-background p-3 sm:max-w-md">
      <div className="grid grid-cols-3 gap-2">
        {(
          [
            ["Flyer", flyer, setFlyer],
            ["Aufsteller", aufsteller, setAufsteller],
            ["Boxen", boxes, setBoxes],
          ] as const
        ).map(([label, value, set]) => (
          <div key={label} className="flex flex-col gap-1">
            <Label className="text-xs">{label}</Label>
            <Input
              type="number"
              min={0}
              max={99999}
              inputMode="numeric"
              value={value}
              onChange={(e) => set(e.target.value)}
            />
          </div>
        ))}
      </div>
      <div className="flex flex-col gap-1">
        <Label className="text-xs">Notiz (optional)</Label>
        <Input
          value={note}
          onChange={(e) => setNote(e.target.value)}
          maxLength={500}
          autoComplete="off"
        />
      </div>
      <div className="flex items-center gap-2">
        <Button type="button" size="sm" disabled={pending} onClick={save}>
          {pending ? "Speichere…" : "Speichern"}
        </Button>
        <Button
          type="button"
          size="sm"
          variant="ghost"
          disabled={pending}
          onClick={() => setOpen(false)}
        >
          Abbrechen
        </Button>
      </div>
    </div>
  );
}
