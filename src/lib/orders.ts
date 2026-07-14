import { z } from "zod";

/**
 * Bestellbare Marketing-Materialien. `key` wird in `orders.material` gespeichert;
 * `label` ist die deutsche Anzeige. Neue Materialien = hier ergänzen (kein
 * DB-Change nötig, da `orders.material` ein Text-Feld ist).
 */
export const ORDER_MATERIALS = [
  { key: "box", label: "Case-Management-Box" },
  { key: "flyer", label: "Flyer" },
  { key: "aufsteller", label: "Flyer-Aufsteller (Plexiglas)" },
] as const;

export type OrderMaterialKey = (typeof ORDER_MATERIALS)[number]["key"];

export const ORDER_MATERIAL_KEYS = ORDER_MATERIALS.map((m) => m.key) as [
  OrderMaterialKey,
  ...OrderMaterialKey[],
];

/** Anzeige-Label für einen Material-Key; unbekannte (z. B. aus E-Mail) unverändert. */
export function materialLabel(material: string): string {
  return ORDER_MATERIALS.find((m) => m.key === material)?.label ?? material;
}

/**
 * Workflow-Status einer Bestellung. Gespeichert wird `key`; `neu` = offen.
 */
export const ORDER_STATUSES = [
  { key: "neu", label: "Offen" },
  { key: "in_bearbeitung", label: "In Bearbeitung" },
  { key: "erledigt", label: "Erledigt" },
] as const;

export type OrderStatusKey = (typeof ORDER_STATUSES)[number]["key"];

export const ORDER_STATUS_KEYS = ORDER_STATUSES.map((s) => s.key) as [
  OrderStatusKey,
  ...OrderStatusKey[],
];

export function statusLabel(status: string): string {
  return ORDER_STATUSES.find((s) => s.key === status)?.label ?? status;
}

/** Offene Bestellung = noch nicht erledigt. */
export function isOpenStatus(status: string): boolean {
  return status !== "erledigt";
}

/** Quelle einer Bestellung. */
export function sourceLabel(source: string): string {
  switch (source) {
    case "pdl":
      return "PDL-Anfrage";
    case "plan":
      return "Geplant";
    case "admin":
      return "Admin";
    case "email":
      return "E-Mail";
    default:
      return source;
  }
}

/** Eingabe für eine neue Bestellung (PDL-Link oder Admin). */
export const orderInputSchema = z.object({
  material: z.enum(ORDER_MATERIAL_KEYS, { message: "Material wählen" }),
  quantity: z.coerce
    .number({ message: "Menge eingeben" })
    .int()
    .positive({ message: "Menge muss größer als 0 sein" })
    .max(9999, { message: "Menge zu groß" }),
  note: z.string().trim().max(500).optional().or(z.literal("")),
});

export type OrderInput = z.infer<typeof orderInputSchema>;
