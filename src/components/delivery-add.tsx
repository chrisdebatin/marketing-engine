"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createDelivery } from "@/app/(app)/lieferungen/delivery-actions";

/**
 * Neue Lieferung direkt im Inventar der Hub-Detailseite anlegen
 * (Flyer/Aufsteller/Boxen + Notiz; der Hub steht fest).
 */
export function DeliveryAdd({ hubId }: { hubId: string }) {
  const [open, setOpen] = useState(false);
  const [flyer, setFlyer] = useState("");
  const [aufsteller, setAufsteller] = useState("");
  const [boxes, setBoxes] = useState("");
  const [note, setNote] = useState("");
  const [pending, startTransition] = useTransition();

  const hasAmount =
    [flyer, aufsteller, boxes].some((v) => Math.trunc(Number(v)) > 0);

  function save() {
    startTransition(async () => {
      const res = await createDelivery({
        hub_id: hubId,
        flyer_count: flyer,
        aufsteller_count: aufsteller,
        box_count: boxes,
        note,
      });
      if (res.ok) {
        toast.success("Lieferung hinzugefügt");
        setOpen(false);
        setFlyer("");
        setAufsteller("");
        setBoxes("");
        setNote("");
      } else {
        toast.error(res.error);
      }
    });
  }

  if (!open) {
    return (
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="self-start"
        onClick={() => setOpen(true)}
      >
        <Plus className="size-4" />
        Lieferung hinzufügen
      </Button>
    );
  }

  return (
    <div className="flex flex-col gap-3 rounded-lg border bg-background p-3">
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
              placeholder="0"
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
          placeholder="z. B. Nachlieferung Sommer-Kampagne"
        />
      </div>
      <div className="flex items-center gap-2">
        <Button
          type="button"
          size="sm"
          disabled={pending || !hasAmount}
          onClick={save}
        >
          {pending ? "Speichere…" : "Hinzufügen"}
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
