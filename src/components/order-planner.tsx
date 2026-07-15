"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import {
  Package,
  FileText,
  PanelTop,
  Plus,
  Trash2,
  Building2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { HubTags } from "@/components/md-tag";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import {
  ORDER_MATERIALS,
  ORDER_STATUSES,
  type OrderMaterialKey,
  materialLabel,
  sourceLabel,
} from "@/lib/orders";
import {
  createPlannedOrder,
  setOrderStatus,
  deleteOrder,
} from "@/app/(app)/lieferungen/order-actions";

export interface PlannerOrder {
  id: string;
  hub_id: string | null;
  hub_name: string;
  material: string | null;
  quantity: number | null;
  status: string;
  source: string;
  note: string | null;
  created_at: string;
}

interface HubOption {
  id: string;
  name: string;
  responsible_md?: string | null;
  pdl_name?: string | null;
}

const MATERIAL_ICON: Record<string, typeof Package> = {
  box: Package,
  flyer: FileText,
  aufsteller: PanelTop,
};

const STATUS_STYLE: Record<string, string> = {
  neu: "bg-muted text-muted-foreground",
  in_bearbeitung: "bg-chart-5/15 text-chart-5",
  erledigt: "bg-chart-4/15 text-chart-4",
};

function fmtDate(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime())
    ? ""
    : d.toLocaleString("de-DE", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
}

export function OrderPlanner({
  orders,
  hubs,
}: {
  orders: PlannerOrder[];
  hubs: HubOption[];
}) {
  const [pending, startTransition] = useTransition();

  const [hubId, setHubId] = useState(hubs[0]?.id ?? "");
  const [material, setMaterial] = useState<OrderMaterialKey>("box");
  const [quantity, setQuantity] = useState("");
  const [note, setNote] = useState("");
  const [creating, setCreating] = useState(false);

  function onCreate(e: React.FormEvent) {
    e.preventDefault();
    if (creating) return;
    setCreating(true);
    startTransition(async () => {
      const res = await createPlannedOrder({
        hub_id: hubId,
        material,
        quantity,
        note,
      });
      setCreating(false);
      if (res.ok) {
        toast.success("Zur Planung hinzugefügt");
        setQuantity("");
        setNote("");
      } else {
        toast.error(res.error);
      }
    });
  }

  function changeStatus(id: string, status: string) {
    startTransition(async () => {
      const res = await setOrderStatus(id, status);
      if (!res.ok) toast.error(res.error);
    });
  }

  function remove(id: string) {
    startTransition(async () => {
      const res = await deleteOrder(id);
      if (res.ok) toast.success("Eintrag gelöscht");
      else toast.error(res.error);
    });
  }

  const open = orders.filter((o) => o.status !== "erledigt");
  const done = orders.filter((o) => o.status === "erledigt");

  // Group open orders by hub (Standort): what still needs to go to each location.
  const metaById = new Map(hubs.map((h) => [h.id, h]));
  const groupMap = new Map<string, PlannerOrder[]>();
  for (const o of open) {
    const key = o.hub_id ?? o.hub_name;
    const arr = groupMap.get(key);
    if (arr) arr.push(o);
    else groupMap.set(key, [o]);
  }
  const openGroups = [...groupMap.entries()]
    .map(([key, items]) => {
      const meta = metaById.get(key);
      return {
        key,
        name: meta?.name ?? items[0].hub_name,
        md: meta?.responsible_md ?? null,
        pdl: meta?.pdl_name ?? null,
        items,
      };
    })
    .sort((a, b) => a.name.localeCompare(b.name, "de"));

  return (
    <div className="flex flex-col gap-4">
      <form
        onSubmit={onCreate}
        className="flex flex-col gap-4 rounded-xl border bg-card p-5 shadow-sm"
      >
        <h2 className="flex items-center gap-2 font-semibold">
          <Plus className="size-4 text-primary" />
          Auslieferung planen
        </h2>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-2">
            <Label>Hub</Label>
            <Select
              items={Object.fromEntries(hubs.map((h) => [h.id, h.name]))}
              value={hubId}
              onValueChange={(v) => setHubId(v ?? "")}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Hub wählen" />
              </SelectTrigger>
              <SelectContent>
                {hubs.map((h) => (
                  <SelectItem key={h.id} value={h.id}>
                    {h.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="plan_qty">Menge</Label>
            <Input
              id="plan_qty"
              type="number"
              min={1}
              inputMode="numeric"
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              placeholder="z. B. 10"
            />
          </div>
        </div>

        <div className="flex flex-col gap-2">
          <Label>Material</Label>
          <div className="grid grid-cols-1 gap-1 rounded-lg bg-muted p-1 sm:grid-cols-3">
            {ORDER_MATERIALS.map(({ key, label }) => {
              const Icon = MATERIAL_ICON[key] ?? Package;
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => setMaterial(key)}
                  className={cn(
                    "flex items-center justify-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                    material === key
                      ? "bg-background text-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  <Icon className="size-4 shrink-0" />
                  <span className="truncate">{label}</span>
                </button>
              );
            })}
          </div>
        </div>

        <div className="flex flex-col gap-2">
          <Label htmlFor="plan_note">Notiz (optional)</Label>
          <Input
            id="plan_note"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="z. B. bis Freitag ausliefern"
            autoComplete="off"
          />
        </div>

        <Button
          type="submit"
          className="self-start"
          disabled={creating || pending || !quantity.trim() || !hubId}
        >
          {creating ? "Füge hinzu…" : "Zur Planung hinzufügen"}
        </Button>
      </form>

      <section className="flex flex-col gap-3">
        <h2 className="text-sm font-medium text-muted-foreground">
          Offen · {open.length} in {openGroups.length}{" "}
          {openGroups.length === 1 ? "Standort" : "Standorten"}
        </h2>
        {open.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Nichts offen. Plane oben eine Auslieferung.
          </p>
        ) : (
          <div className="flex flex-col gap-5">
            {openGroups.map((g) => (
              <div key={g.key} className="flex flex-col gap-2">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="flex size-6 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
                    <Building2 className="size-3.5" />
                  </span>
                  <h3 className="font-semibold">{g.name}</h3>
                  <HubTags md={g.md} pdl={g.pdl} />
                  <Badge variant="secondary">{g.items.length}</Badge>
                </div>
                <ul className="flex flex-col gap-2.5 sm:pl-8">
                  {g.items.map((o) => (
                    <OrderRowItem
                      key={o.id}
                      o={o}
                      onStatus={changeStatus}
                      onRemove={remove}
                      pending={pending}
                    />
                  ))}
                </ul>
              </div>
            ))}
          </div>
        )}
      </section>

      {done.length > 0 && (
        <section className="flex flex-col gap-2">
          <h2 className="text-sm font-medium text-muted-foreground">
            Erledigt ({done.length})
          </h2>
          <ul className="flex flex-col gap-2.5">
            {done.map((o) => (
              <OrderRowItem
                key={o.id}
                o={o}
                onStatus={changeStatus}
                onRemove={remove}
                pending={pending}
                showHub
                muted
              />
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

function OrderRowItem({
  o,
  onStatus,
  onRemove,
  pending,
  showHub,
  muted,
}: {
  o: PlannerOrder;
  onStatus: (id: string, status: string) => void;
  onRemove: (id: string) => void;
  pending: boolean;
  showHub?: boolean;
  muted?: boolean;
}) {
  const Icon = MATERIAL_ICON[o.material ?? ""] ?? Package;
  return (
    <li
      className={cn(
        "flex flex-col gap-3 rounded-xl border bg-card p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between",
        muted && "opacity-70",
      )}
    >
      <div className="flex min-w-0 items-start gap-3">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
          <Icon className="size-4.5" />
        </span>
        <div className="min-w-0">
          <p className="font-medium">
            {o.quantity != null ? `${o.quantity}× ` : ""}
            {materialLabel(o.material)}
          </p>
          <p className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-sm text-muted-foreground">
            {showHub && (
              <>
                <span className="truncate font-medium text-foreground/80">
                  {o.hub_name}
                </span>
                <span aria-hidden>·</span>
              </>
            )}
            <span>{sourceLabel(o.source)}</span>
            {o.created_at && (
              <>
                <span aria-hidden>·</span>
                <span>{fmtDate(o.created_at)}</span>
              </>
            )}
          </p>
          {o.note && (
            <p className="mt-0.5 truncate text-sm text-muted-foreground">
              „{o.note}&rdquo;
            </p>
          )}
        </div>
      </div>

      <div className="flex shrink-0 items-center gap-2">
        <div className="flex items-center gap-1 rounded-lg bg-muted p-1">
          {ORDER_STATUSES.map((s) => (
            <button
              key={s.key}
              type="button"
              disabled={pending || o.status === s.key}
              onClick={() => onStatus(o.id, s.key)}
              className={cn(
                "rounded-md px-2.5 py-1 text-xs font-medium whitespace-nowrap transition-colors disabled:cursor-default",
                o.status === s.key
                  ? STATUS_STYLE[s.key]
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {s.label}
            </button>
          ))}
        </div>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="size-8 text-muted-foreground hover:text-destructive"
          disabled={pending}
          onClick={() => onRemove(o.id)}
          aria-label="Eintrag löschen"
        >
          <Trash2 className="size-4" />
        </Button>
      </div>
    </li>
  );
}
