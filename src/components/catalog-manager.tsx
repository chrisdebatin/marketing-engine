"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import {
  createCatalogItem,
  setCatalogItemActive,
} from "@/app/(app)/admin/actions";

export interface CatalogManagerItem {
  id: string;
  key: string;
  name: string;
  description: string | null;
  active: boolean;
}

/** Admin-Pflege des Material-Katalogs für den PDL-Shop (Liste + Neu-Formular). */
export function CatalogManager({ items }: { items: CatalogManagerItem[] }) {
  const [pending, startTransition] = useTransition();
  const [key, setKey] = useState("");
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");

  function toggle(item: CatalogManagerItem) {
    startTransition(async () => {
      const res = await setCatalogItemActive(item.id, !item.active);
      if (res.ok) {
        toast.success(
          !item.active
            ? `„${item.name}“ aktiviert`
            : `„${item.name}“ deaktiviert`,
        );
      } else {
        toast.error(res.error);
      }
    });
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (pending || !key.trim() || !name.trim()) return;
    startTransition(async () => {
      const res = await createCatalogItem({ key, name, description });
      if (res.ok) {
        toast.success("Artikel angelegt");
        setKey("");
        setName("");
        setDescription("");
      } else {
        toast.error(res.error);
      }
    });
  }

  return (
    <div className="flex flex-col gap-5">
      {items.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Noch keine Artikel im Katalog. Lege unten den ersten an.
        </p>
      ) : (
        <ul className="flex flex-col gap-2">
          {items.map((item) => (
            <li
              key={item.id}
              className={cn(
                "flex items-center justify-between gap-3 rounded-lg border bg-card px-3 py-2.5 text-sm",
                !item.active && "opacity-60",
              )}
            >
              <span className="min-w-0">
                <span className="flex flex-wrap items-center gap-2">
                  <span className="truncate font-medium">{item.name}</span>
                  <Badge variant="outline" className="font-mono text-xs">
                    {item.key}
                  </Badge>
                </span>
                {item.description && (
                  <span className="mt-0.5 block truncate text-xs text-muted-foreground">
                    {item.description}
                  </span>
                )}
              </span>
              <Button
                type="button"
                variant={item.active ? "outline" : "secondary"}
                size="sm"
                disabled={pending}
                onClick={() => toggle(item)}
              >
                {item.active ? "Aktiv" : "Inaktiv"}
              </Button>
            </li>
          ))}
        </ul>
      )}

      <form
        onSubmit={submit}
        className="flex flex-col gap-3 border-t pt-4"
      >
        <h3 className="flex items-center gap-2 text-sm font-semibold">
          <Plus className="size-4 text-primary" />
          Neuen Artikel anlegen
        </h3>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="flex flex-col gap-2">
            <Label htmlFor="cat_key">Key</Label>
            <Input
              id="cat_key"
              value={key}
              onChange={(e) => setKey(e.target.value)}
              placeholder="z. B. poster"
              autoComplete="off"
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="cat_name">Name</Label>
            <Input
              id="cat_name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="z. B. Poster A2"
              autoComplete="off"
            />
          </div>
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="cat_desc">Beschreibung (optional)</Label>
          <Input
            id="cat_desc"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Kurze Beschreibung für die PDL"
            autoComplete="off"
          />
        </div>
        <Button
          type="submit"
          className="self-start"
          disabled={pending || !key.trim() || !name.trim()}
        >
          {pending ? "Lege an…" : "Artikel anlegen"}
        </Button>
      </form>
    </div>
  );
}
