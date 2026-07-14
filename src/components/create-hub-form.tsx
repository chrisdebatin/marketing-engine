"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createHub } from "@/app/(app)/admin/actions";

/** Admin form to create a new hub (collapsed by default). */
export function CreateHubForm() {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [region, setRegion] = useState("");
  const [address, setAddress] = useState("");
  const [md, setMd] = useState("");
  const [pending, startTransition] = useTransition();

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (pending || !name.trim()) return;
    startTransition(async () => {
      const res = await createHub({
        name,
        region,
        address,
        responsible_md: md,
      });
      if (res.ok) {
        toast.success("Hub angelegt");
        setName("");
        setRegion("");
        setAddress("");
        setMd("");
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
        variant="outline"
        onClick={() => setOpen(true)}
        className="self-start"
      >
        <Plus className="size-4" />
        Neuen Hub anlegen
      </Button>
    );
  }

  return (
    <form
      onSubmit={submit}
      className="flex flex-col gap-4 rounded-xl border bg-card p-5 shadow-sm"
    >
      <h2 className="flex items-center gap-2 font-semibold">
        <Plus className="size-4 text-primary" />
        Neuen Hub anlegen
      </h2>

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="flex flex-col gap-2 sm:col-span-3">
          <Label htmlFor="hub_name">Name</Label>
          <Input
            id="hub_name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="z. B. Alltagshilfe Musterstadt"
            autoFocus
          />
        </div>
        <div className="flex flex-col gap-2 sm:col-span-3">
          <Label htmlFor="hub_address">Adresse (optional)</Label>
          <Input
            id="hub_address"
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            placeholder="Straße Nr., PLZ Ort"
          />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="hub_region">Region (optional)</Label>
          <Input
            id="hub_region"
            value={region}
            onChange={(e) => setRegion(e.target.value)}
            placeholder="z. B. NRW"
          />
        </div>
        <div className="flex flex-col gap-2 sm:col-span-2">
          <Label htmlFor="hub_md">Verantwortliches MD (optional)</Label>
          <Input
            id="hub_md"
            value={md}
            onChange={(e) => setMd(e.target.value)}
            placeholder="Name des MD"
          />
        </div>
      </div>

      <div className="flex items-center gap-2">
        <Button type="submit" disabled={pending || !name.trim()}>
          {pending ? "Lege an…" : "Hub anlegen"}
        </Button>
        <Button
          type="button"
          variant="ghost"
          onClick={() => setOpen(false)}
          disabled={pending}
        >
          Abbrechen
        </Button>
      </div>
    </form>
  );
}
