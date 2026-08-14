"use client";

import { useState } from "react";
import { toast } from "sonner";
import {
  Package,
  FileText,
  PanelTop,
  Minus,
  Plus,
  Send,
  ShoppingBag,
  ShoppingCart,
  Trash2,
  Wand2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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

/**
 * Feste Farbtöne je Material — gleiche Bedeutung überall auf der Seite,
 * damit die Karten auf einen Blick unterscheidbar sind (Referenz-Look).
 */
const MATERIAL_TONE: Record<string, string> = {
  box: "bg-violet-100 text-violet-600",
  flyer: "bg-emerald-100 text-emerald-600",
  aufsteller: "bg-orange-100 text-orange-600",
};

const STATUS_STYLE: Record<string, string> = {
  neu: "bg-muted text-muted-foreground",
  in_bearbeitung: "bg-chart-5/15 text-chart-5",
  erledigt: "bg-chart-4/15 text-chart-4",
};

function iconFor(key: string | null): typeof Package {
  return MATERIAL_ICON[key ?? ""] ?? Package;
}

function toneFor(key: string | null): string {
  return MATERIAL_TONE[key ?? ""] ?? "bg-primary/10 text-primary";
}

/**
 * Mengen-Stepper: −/+ links und rechts, Zahl in der Mitte. Für PDLs am
 * Tablet deutlich einfacher zu bedienen als ein reines Zahlenfeld — Tippen
 * bleibt aber möglich.
 */
function QuantityStepper({
  value,
  onChange,
  onEnter,
  label,
}: {
  value: string;
  onChange: (v: string) => void;
  onEnter?: () => void;
  label: string;
}) {
  const num = Math.floor(Number(value));
  const current = Number.isFinite(num) && num > 0 ? num : 1;
  const step = (delta: number) =>
    onChange(String(Math.min(Math.max(current + delta, 1), 9999)));

  return (
    <span className="flex items-center gap-1 rounded-lg border bg-background p-0.5">
      <span className="pl-2 pr-1 text-xs font-medium text-muted-foreground">
        Menge
      </span>
      <button
        type="button"
        onClick={() => step(-1)}
        aria-label={`${label}: eins weniger`}
        className="flex size-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
      >
        <Minus className="size-3.5" />
      </button>
      <Input
        type="number"
        min={1}
        max={9999}
        inputMode="numeric"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && onEnter) {
            e.preventDefault();
            onEnter();
          }
        }}
        aria-label={label}
        className="h-7 w-10 border-0 px-0 text-center font-semibold tabular-nums shadow-none focus-visible:ring-0 [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
      />
      <button
        type="button"
        onClick={() => step(1)}
        aria-label={`${label}: eins mehr`}
        className="flex size-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
      >
        <Plus className="size-3.5" />
      </button>
    </span>
  );
}

/** Leichte Illustration für die leere Bestell-Historie (keine externen Assets). */
function EmptyOrdersArt() {
  return (
    <svg
      viewBox="0 0 220 90"
      className="h-20 w-auto shrink-0"
      aria-hidden="true"
      fill="none"
    >
      <path
        d="M8 74c34 10 62-6 74-26 8-13 2-27-9-27-9 0-13 10-8 18 9 15 34 22 58 15"
        stroke="currentColor"
        className="text-primary/25"
        strokeWidth="2"
        strokeDasharray="5 6"
        strokeLinecap="round"
      />
      <path
        d="M150 34l24-10 24 10-24 10-24-10z"
        className="fill-primary/20"
      />
      <path d="M150 34v26l24 10V44l-24-10z" className="fill-primary/35" />
      <path d="M198 34v26l-24 10V44l24-10z" className="fill-primary/25" />
      <path
        d="M136 20l2.5 5.5 5.5 2.5-5.5 2.5-2.5 5.5-2.5-5.5-5.5-2.5 5.5-2.5 2.5-5.5z"
        className="fill-primary/40"
      />
      <path
        d="M206 54l1.8 4 4 1.8-4 1.8-1.8 4-1.8-4-4-1.8 4-1.8 1.8-4z"
        className="fill-primary/30"
      />
    </svg>
  );
}

/** Illustration neben der Schritt-für-Schritt-Anleitung. */
export function StepsArt() {
  return (
    <svg
      viewBox="0 0 150 120"
      className="hidden h-28 w-auto shrink-0 sm:block"
      aria-hidden="true"
      fill="none"
    >
      {/* offener Karton */}
      <path d="M28 62l47-16 47 16v42l-47 16-47-16V62z" className="fill-primary/15" />
      <path d="M75 46v76l47-16V62L75 46z" className="fill-primary/25" />
      <path d="M28 62l47 16 47-16-47-16-47 16z" className="fill-primary/35" />
      {/* Blätter/Flyer, die herausschauen */}
      <rect
        x="52"
        y="14"
        width="30"
        height="38"
        rx="3"
        className="fill-white stroke-primary/40"
        strokeWidth="2"
      />
      <path
        d="M58 24h18M58 31h18M58 38h11"
        stroke="currentColor"
        className="text-primary/40"
        strokeWidth="2"
        strokeLinecap="round"
      />
      <rect
        x="84"
        y="22"
        width="30"
        height="30"
        rx="3"
        className="fill-amber-100 stroke-amber-400/60"
        strokeWidth="2"
      />
      <circle cx="93" cy="32" r="3.5" className="fill-amber-400/70" />
      <path d="M86 47l9-9 7 7 5-4 6 6v3H86v-3z" className="fill-amber-400/50" />
      {/* Funkeln */}
      <path
        d="M126 18l2 4.4 4.4 2-4.4 2-2 4.4-2-4.4-4.4-2 4.4-2 2-4.4z"
        className="fill-primary/40"
      />
      <path
        d="M22 40l1.5 3.3 3.3 1.5-3.3 1.5L22 49.6l-1.5-3.3-3.3-1.5 3.3-1.5L22 40z"
        className="fill-primary/30"
      />
    </svg>
  );
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
  // Freie Bestellung (Material außerhalb des Katalogs)
  const [customText, setCustomText] = useState("");
  const [customBeschreibung, setCustomBeschreibung] = useState("");
  const [customFormat, setCustomFormat] = useState("");
  const [customKontakt, setCustomKontakt] = useState("");
  const [customQty, setCustomQty] = useState("1");
  const [customSaving, setCustomSaving] = useState(false);

  const nameByKey = new Map(catalog.map((c) => [c.key, c.name]));
  const itemName = (key: string, fallback?: string) =>
    nameByKey.get(key) ?? fallback ?? materialLabel(key);

  const cartEntries = [...cart.entries()];
  const cartTotal = cartEntries.reduce((s, [, q]) => s + q, 0);

  const draftOf = (key: string) => drafts[key] ?? "1";

  function addToCart(key: string) {
    const qty = Math.floor(Number(draftOf(key)));
    if (!Number.isFinite(qty) || qty < 1) {
      toast.error("Bitte eine Menge größer als 0 eingeben.");
      return;
    }
    setCart((c) => {
      const next = new Map(c);
      next.set(key, Math.min((next.get(key) ?? 0) + qty, 9999));
      return next;
    });
    setDrafts((d) => ({ ...d, [key]: "1" }));
    setError(null);
    toast.success(`${qty}× ${itemName(key)} im Warenkorb`);
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

  async function submitCustom() {
    const text = customText.trim();
    const qty = Math.floor(Number(customQty));
    if (!text || customSaving) return;
    if (!Number.isFinite(qty) || qty < 1) {
      toast.error("Bitte eine Menge größer als 0 eingeben.");
      return;
    }
    setCustomSaving(true);
    try {
      const res = await fetch("/api/public/shop-order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          token,
          custom: {
            text,
            quantity: qty,
            beschreibung: customBeschreibung,
            format: customFormat,
            kontakt: customKontakt,
          },
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.order) {
        toast.error(data.error ?? "Bestellung fehlgeschlagen.");
        return;
      }
      setOrders((o) => [data.order as OrderWithItems, ...o]);
      setCustomText("");
      setCustomBeschreibung("");
      setCustomFormat("");
      setCustomKontakt("");
      setCustomQty("1");
      toast.success("Bestellung abgesendet");
    } catch {
      toast.error("Netzwerkfehler.");
    } finally {
      setCustomSaving(false);
    }
  }

  return (
    <div className="flex flex-col gap-5">
      {/* ── Katalog: eine Karte je Material ── */}
      <div className="grid gap-4 md:grid-cols-3">
        {catalog.map((item) => {
          const Icon = iconFor(item.key);
          const inCart = cart.get(item.key);
          return (
            <div
              key={item.key}
              className="flex flex-col gap-4 rounded-xl border bg-card p-5 shadow-sm"
            >
              <div className="flex items-start gap-3">
                <span
                  className={cn(
                    "flex size-11 shrink-0 items-center justify-center rounded-xl",
                    toneFor(item.key),
                  )}
                >
                  <Icon className="size-5" />
                </span>
                <div className="min-w-0">
                  <h3 className="flex flex-wrap items-center gap-2 text-base leading-tight font-semibold">
                    {item.name}
                    {inCart ? (
                      <Badge variant="secondary">{inCart} im Warenkorb</Badge>
                    ) : null}
                  </h3>
                  {item.description && (
                    <p className="mt-1 text-sm leading-snug text-muted-foreground">
                      {item.description}
                    </p>
                  )}
                </div>
              </div>
              {/* Stepper links, Button rechts — bleibt auch schmal einzeilig */}
              <div className="mt-auto flex items-center justify-between gap-2 border-t pt-3">
                <QuantityStepper
                  value={draftOf(item.key)}
                  onChange={(v) =>
                    setDrafts((d) => ({ ...d, [item.key]: v }))
                  }
                  onEnter={() => addToCart(item.key)}
                  label={`Menge für ${item.name}`}
                />
                <Button
                  type="button"
                  variant="outline"
                  className="shrink-0 border-primary/40 px-3 text-primary hover:bg-primary/5 hover:text-primary"
                  onClick={() => addToCart(item.key)}
                >
                  <ShoppingCart className="size-4" />
                  <span className="hidden sm:inline">In den Warenkorb</span>
                  <span className="sm:hidden">Warenkorb</span>
                </Button>
              </div>
            </div>
          );
        })}
      </div>

      {/* ── Freie Bestellung: Material, das nicht im Katalog steht ── */}
      <div className="flex flex-col gap-4 rounded-xl border bg-card p-5 shadow-sm">
        <div className="flex items-start gap-3">
          <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <Wand2 className="size-5" />
          </span>
          <div className="min-w-0">
            <h3 className="text-base leading-tight font-semibold">
              Etwas anderes benötigt?
            </h3>
            <p className="mt-1 text-sm text-muted-foreground">
              Beschreiben Sie frei, welches Material Sie brauchen — das
              Marketing-Team kümmert sich darum.
            </p>
          </div>
        </div>

        {/* Zeile 1: Was + Beschreibung · Zeile 2: Format + Kontakt */}
        <div className="grid gap-x-5 gap-y-4 md:grid-cols-2">
          <div className="flex flex-col gap-1.5">
            <Label className="text-xs font-medium">Was wird benötigt?</Label>
            <Input
              value={customText}
              onChange={(e) => setCustomText(e.target.value)}
              placeholder="z. B. Visitenkarten, Kugelschreiber, Plakate"
              autoComplete="off"
              maxLength={200}
              className="h-10"
            />
          </div>
          <div className="flex flex-col gap-1.5 md:row-span-2">
            <Label className="text-xs font-medium">
              Beschreibung (optional)
            </Label>
            <Textarea
              value={customBeschreibung}
              onChange={(e) => setCustomBeschreibung(e.target.value)}
              placeholder="Beschreiben Sie möglichst genau, was Sie brauchen — z. B. Text/Motiv, Anlass, gewünschter Liefertermin …"
              rows={4}
              maxLength={2000}
              className="min-h-[5.5rem] flex-1"
            />
          </div>
          {/* Format & Kontakt teilen sich die linke Spalte nebeneinander */}
          <div className="grid gap-x-5 gap-y-4 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <Label className="text-xs font-medium">Format (optional)</Label>
              <Input
                value={customFormat}
                onChange={(e) => setCustomFormat(e.target.value)}
                placeholder="z. B. DIN A4, A2"
                autoComplete="off"
                maxLength={100}
                className="h-10"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label className="text-xs font-medium">
                Kontakt für Rückfragen
              </Label>
              <Input
                value={customKontakt}
                onChange={(e) => setCustomKontakt(e.target.value)}
                placeholder="Name + Telefon"
                autoComplete="off"
                maxLength={200}
                className="h-10"
              />
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <QuantityStepper
            value={customQty}
            onChange={setCustomQty}
            onEnter={() => void submitCustom()}
            label="Menge für freie Bestellung"
          />
          <Button
            type="button"
            onClick={() => void submitCustom()}
            disabled={customSaving || !customText.trim()}
          >
            <Send className="size-4" />
            {customSaving ? "Sende…" : "Direkt bestellen"}
          </Button>
          {!customText.trim() && (
            <span className="text-xs text-muted-foreground">
              Bitte oben eintragen, was Sie brauchen.
            </span>
          )}
        </div>
      </div>

      {/* ── Warenkorb ── */}
      {cartEntries.length > 0 && (
        <div className="flex flex-col gap-4 rounded-xl border-2 border-primary/30 bg-card p-5 shadow-sm">
          <h3 className="flex items-center gap-2 text-base font-semibold">
            <ShoppingCart className="size-4.5 text-primary" />
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
                    <span
                      className={cn(
                        "flex size-8 shrink-0 items-center justify-center rounded-lg",
                        toneFor(key),
                      )}
                    >
                      <Icon className="size-4" />
                    </span>
                    <span className="truncate font-medium">
                      {itemName(key)}
                    </span>
                  </span>
                  <span className="flex shrink-0 items-center gap-1.5">
                    <QuantityStepper
                      value={qty > 0 ? String(qty) : "1"}
                      onChange={(v) => setCartQty(key, v)}
                      label={`Menge für ${itemName(key)}`}
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

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="shop_note" className="text-xs font-medium">
              Notiz (optional)
            </Label>
            <Input
              id="shop_note"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="z. B. dringend, bis Ende der Woche"
              autoComplete="off"
              className="h-10"
            />
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}
          <Button
            type="button"
            size="lg"
            onClick={submit}
            disabled={saving || cartTotal === 0}
          >
            <Send className="size-4" />
            {saving ? "Sende…" : "Bestellung absenden"}
          </Button>
        </div>
      )}
      {cartEntries.length === 0 && error && (
        <p className="text-sm text-destructive">{error}</p>
      )}

      {/* ── Bestell-Historie ── */}
      <div className="flex flex-col gap-4 rounded-xl border bg-card p-5 shadow-sm">
        <div className="flex items-center gap-3">
          <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <ShoppingBag className="size-5" />
          </span>
          <div className="min-w-0">
            <h2 className="text-base leading-tight font-semibold">
              Deine Bestellungen ({orders.length})
            </h2>
            {orders.length === 0 && (
              <p className="mt-1 text-sm text-muted-foreground">
                Noch keine Bestellungen aufgegeben.
              </p>
            )}
          </div>
          {orders.length === 0 && (
            <span className="ml-auto text-primary">
              <EmptyOrdersArt />
            </span>
          )}
        </div>

        {orders.length > 0 && (
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
                const tone = hasItems
                  ? o.items!.length === 1
                    ? toneFor(o.items![0].material_key)
                    : "bg-primary/10 text-primary"
                  : toneFor(o.material);
                return (
                  <li
                    key={o.id}
                    className="flex items-center justify-between gap-3 rounded-lg border bg-background px-3 py-2.5 text-sm"
                  >
                    <span className="flex min-w-0 items-center gap-2.5">
                      <span
                        className={cn(
                          "flex size-8 shrink-0 items-center justify-center rounded-lg",
                          tone,
                        )}
                      >
                        <Icon className="size-4" />
                      </span>
                      <span className="min-w-0">
                        {hasItems ? (
                          o.items!.map((it) => (
                            <span
                              key={it.material_key}
                              className="block truncate font-medium"
                            >
                              {it.quantity}× {itemName(it.material_key, it.name)}
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
                        "shrink-0 rounded-full px-2.5 py-1 text-xs font-medium",
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
