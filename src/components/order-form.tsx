"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Package, FileText, PanelTop } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import {
  ORDER_MATERIALS,
  type OrderMaterialKey,
  materialLabel,
  statusLabel,
} from "@/lib/orders";

interface Order {
  id: string;
  material: string | null;
  quantity: number | null;
  status: string;
  note: string | null;
  created_at: string;
}

const MATERIAL_ICON: Record<OrderMaterialKey, typeof Package> = {
  box: Package,
  flyer: FileText,
  aufsteller: PanelTop,
};

const STATUS_STYLE: Record<string, string> = {
  neu: "bg-muted text-muted-foreground",
  in_bearbeitung: "bg-chart-5/15 text-chart-5",
  erledigt: "bg-chart-4/15 text-chart-4",
};

/** PDL-facing self-service ordering of marketing materials via the hub link. */
export function OrderForm({
  token,
  initial,
}: {
  token: string;
  initial: Order[];
}) {
  const [orders, setOrders] = useState<Order[]>(initial);
  const [material, setMaterial] = useState<OrderMaterialKey>("box");
  const [quantity, setQuantity] = useState("");
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (saving) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/public/order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, material, quantity, note }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Bestellung fehlgeschlagen.");
        return;
      }
      setOrders((o) => [data.order as Order, ...o]);
      setQuantity("");
      setNote("");
      toast.success("Bestellung aufgegeben");
    } catch {
      setError("Netzwerkfehler.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex flex-col gap-5">
      <form
        onSubmit={submit}
        className="flex flex-col gap-4 rounded-xl border bg-card p-5 shadow-sm"
      >
        <div className="flex flex-col gap-2">
          <Label>Material</Label>
          <div className="grid grid-cols-1 gap-1 rounded-lg bg-muted p-1 sm:grid-cols-3">
            {ORDER_MATERIALS.map(({ key, label }) => {
              const Icon = MATERIAL_ICON[key];
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
          <Label htmlFor="menge">Menge</Label>
          <Input
            id="menge"
            type="number"
            min={1}
            inputMode="numeric"
            value={quantity}
            onChange={(e) => setQuantity(e.target.value)}
            placeholder="z. B. 10"
            className="max-w-40"
          />
        </div>

        <div className="flex flex-col gap-2">
          <Label htmlFor="note">Notiz (optional)</Label>
          <Input
            id="note"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="z. B. dringend, bis Ende der Woche"
            autoComplete="off"
          />
        </div>

        {error && <p className="text-sm text-destructive">{error}</p>}
        <Button type="submit" disabled={saving || !quantity.trim()}>
          {saving ? "Sende…" : "Bestellung aufgeben"}
        </Button>
      </form>

      <div className="flex flex-col gap-2">
        <h2 className="text-sm font-medium">Deine Bestellungen ({orders.length})</h2>
        {orders.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Noch keine Bestellungen aufgegeben.
          </p>
        ) : (
          <ul className="flex flex-col gap-2">
            {orders.map((o) => {
              const Icon =
                MATERIAL_ICON[o.material as OrderMaterialKey] ?? Package;
              return (
                <li
                  key={o.id}
                  className="flex items-center justify-between gap-3 rounded-lg border bg-card px-3 py-2.5 text-sm"
                >
                  <span className="flex min-w-0 items-center gap-2.5">
                    <span className="flex size-7 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
                      <Icon className="size-4" />
                    </span>
                    <span className="min-w-0">
                      <span className="block truncate font-medium">
                        {o.quantity != null ? `${o.quantity}× ` : ""}
                        {materialLabel(o.material)}
                      </span>
                      {o.note && (
                        <span className="block truncate text-xs text-muted-foreground">
                          {o.note}
                        </span>
                      )}
                    </span>
                  </span>
                  <span
                    className={cn(
                      "shrink-0 rounded-full px-2 py-0.5 text-xs font-medium",
                      STATUS_STYLE[o.status] ?? "bg-muted text-muted-foreground",
                    )}
                  >
                    {statusLabel(o.status)}
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
