"use client";

import { useState } from "react";
import { toast } from "sonner";
import {
  Package,
  FileText,
  PanelTop,
  ShoppingCart,
  Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { materialLabel, statusLabel } from "@/lib/orders";

export interface ShopCatalogItem {
  key: string;
  name: string;
  description: string | null;
}

export interface ShopOrderItemLine {
  material_key: string;
  quantity: number;
  name?: string;
}

export interface OrderWithItems {
  id: string;
  material: string | null;
  quantity: number | null;
  status: string;
  note: string | null;
  created_at: string;
  items?: ShopOrderItemLine[];
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

function iconFor(key: string | null): typeof Package {
  return MATERIAL_ICON[key ?? ""] ?? Package;
}

/** PDL-facing online shop: catalog cards + cart + order history. No login. */
export function OrderShop({
  token,
  catalog,
  initial,
}: {
  token: string;
  catalog: ShopCatalogItem[];
  initial: OrderWithItems[];
}) {
  const [orders, setOrders] = useState<OrderWithItems[]>(initial);
  // Draft quantities typed into the catalog cards (per material key).
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  // Cart: material_key -> quantity.
  const [cart, setCart] = useState<Map<string, number>>(new Map());
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const nameByKey = new Map(catalog.map((c) => [c.key, c.name]));
  const itemName = (key: string, fallback?: string) =>
    nameByKey.get(key) ?? fallback ?? materialLabel(key);

  const cartEntries = [...cart.entries()];
  const cartTotal = cartEntries.reduce((s, [, q]) => s + q, 0);

  function addToCart(key: string) {
    const qty = Math.floor(Number(drafts[key] ?? ""));
    if (!Number.isFinite(qty) || qty < 1) {
      toast.error("Bitte eine Menge größer als 0 eingeben.");
      return;
    }
    setCart((c) => {
      const next = new Map(c);
      next.set(key, Math.min((next.get(key) ?? 0) + qty, 9999));
      return next;
    });
    setDrafts((d) => ({ ...d, [key]: "" }));
    setError(null);
  }

  function setCartQty(key: string, value: string) {
    const qty = Math.floor(Number(value));
    setCart((c) => {
      const next = new Map(c);
      if (!Number.isFinite(qty) || qty < 1) next.set(key, 0);
      else next.set(key, Math.min(qty, 9999));
      return next;
    });
  }

  function removeFromCart(key: string) {
    setCart((c) => {
      const next = new Map(c);
      next.delete(key);
      return next;
    });
  }

  async function submit() {
    if (saving) return;
    const items = cartEntries
      .filter(([, q]) => q > 0)
      .map(([material_key, quantity]) => ({ material_key, quantity }));
    if (items.length === 0) {
      setError("Der Warenkorb ist leer.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/public/shop-order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, items, note }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Bestellung fehlgeschlagen.");
        return;
      }
      setOrders((o) => [data.order as OrderWithItems, ...o]);
      setCart(new Map());
      setNote("");
      toast.success("Bestellung abgesendet");
    } catch {
      setError("Netzwerkfehler.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex flex-col gap-5">
      {/* Catalog */}
      <div className="grid gap-3 sm:grid-cols-2">
        {catalog.map((item) => {
          const Icon = iconFor(item.key);
          const inCart = cart.get(item.key);
          return (
            <div
              key={item.key}
              className="flex flex-col gap-3 rounded-xl border bg-card p-5 shadow-sm"
            >
              <div className="flex items-start gap-3">
                <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <Icon className="size-4.5" />
                </span>
                <div className="min-w-0">
                  <h3 className="flex flex-wrap items-center gap-2 leading-tight font-semibold">
                    {item.name}
                    {inCart ? (
                      <Badge variant="secondary">{inCart} im Warenkorb</Badge>
                    ) : null}
                  </h3>
                  {item.description && (
                    <p className="mt-0.5 text-sm text-muted-foreground">
                      {item.description}
                    </p>
                  )}
                </div>
              </div>
              <div className="mt-auto flex items-center gap-2">
                <Input
                  type="number"
                  min={1}
                  max={9999}
                  inputMode="numeric"
                  value={drafts[item.key] ?? ""}
                  onChange={(e) =>
                    setDrafts((d) => ({ ...d, [item.key]: e.target.value }))
                  }
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      addToCart(item.key);
                    }
                  }}
                  placeholder="Menge"
                  aria-label={`Menge für ${item.name}`}
                  className="w-24"
                />
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => addToCart(item.key)}
                  disabled={!(drafts[item.key] ?? "").trim()}
                >
                  <ShoppingCart className="size-4" />
                  In den Warenkorb
                </Button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Cart */}
      {cartEntries.length > 0 && (
        <div className="flex flex-col gap-4 rounded-xl border bg-card p-5 shadow-sm">
          <h3 className="flex items-center gap-2 font-semibold">
            <ShoppingCart className="size-4 text-primary" />
            Warenkorb
            <Badge variant="secondary">{cartTotal} Artikel</Badge>
          </h3>
          <ul className="flex flex-col gap-2">
            {cartEntries.map(([key, qty]) => {
              const Icon = iconFor(key);
              return (
                <li
                  key={key}
                  className="flex items-center justify-between gap-3 rounded-lg border bg-background px-3 py-2 text-sm"
                >
                  <span className="flex min-w-0 items-center gap-2.5">
                    <span className="flex size-7 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
                      <Icon className="size-4" />
                    </span>
                    <span className="truncate font-medium">
                      {itemName(key)}
                    </span>
                  </span>
                  <span className="flex shrink-0 items-center gap-1.5">
                    <Input
                      type="number"
                      min={1}
                      max={9999}
                      inputMode="numeric"
                      value={qty > 0 ? String(qty) : ""}
                      onChange={(e) => setCartQty(key, e.target.value)}
                      aria-label={`Menge für ${itemName(key)}`}
                      className="h-8 w-20"
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="size-8 text-muted-foreground hover:text-destructive"
                      onClick={() => removeFromCart(key)}
                      aria-label={`${itemName(key)} entfernen`}
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  </span>
                </li>
              );
            })}
          </ul>

          <div className="flex flex-col gap-2">
            <Label htmlFor="shop_note">Notiz (optional)</Label>
            <Input
              id="shop_note"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="z. B. dringend, bis Ende der Woche"
              autoComplete="off"
            />
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}
          <Button
            type="button"
            onClick={submit}
            disabled={saving || cartTotal === 0}
          >
            {saving ? "Sende…" : "Bestellung absenden"}
          </Button>
        </div>
      )}
      {cartEntries.length === 0 && error && (
        <p className="text-sm text-destructive">{error}</p>
      )}

      {/* History */}
      <div className="flex flex-col gap-2">
        <h2 className="text-sm font-medium">
          Deine Bestellungen ({orders.length})
        </h2>
        {orders.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Noch keine Bestellungen aufgegeben.
          </p>
        ) : (
          <ul className="flex flex-col gap-2">
            {/* Offene zuerst, dann in Bearbeitung, erledigte unten; innerhalb
                bleibt created_at desc durch stabile Sortierung erhalten. */}
            {[...orders]
              .sort(
                (a, b) =>
                  (a.status === "neu" ? 0 : a.status === "in_bearbeitung" ? 1 : 2) -
                  (b.status === "neu" ? 0 : b.status === "in_bearbeitung" ? 1 : 2),
              )
              .map((o) => {
              const hasItems = (o.items?.length ?? 0) > 0;
              const Icon = hasItems
                ? o.items!.length === 1
                  ? iconFor(o.items![0].material_key)
                  : ShoppingCart
                : iconFor(o.material);
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
                      {hasItems ? (
                        o.items!.map((it) => (
                          <span
                            key={it.material_key}
                            className="block truncate font-medium"
                          >
                            {it.quantity}×{" "}
                            {itemName(it.material_key, it.name)}
                          </span>
                        ))
                      ) : (
                        <span className="block truncate font-medium">
                          {o.quantity != null ? `${o.quantity}× ` : ""}
                          {materialLabel(o.material)}
                        </span>
                      )}
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
