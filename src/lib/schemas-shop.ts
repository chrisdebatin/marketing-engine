import { z } from "zod";

/**
 * Eingabe für eine Warenkorb-Bestellung im PDL-Online-Shop.
 * Der Bestellkopf landet in `orders` (material = null), die Positionen
 * in `order_items` (material_key referenziert `material_catalog.key`).
 */
export const shopOrderInputSchema = z.object({
  items: z
    .array(
      z.object({
        material_key: z.string().min(1, { message: "Material wählen" }),
        quantity: z.coerce
          .number({ message: "Menge eingeben" })
          .int({ message: "Menge muss eine ganze Zahl sein" })
          .positive({ message: "Menge muss größer als 0 sein" })
          .max(9999, { message: "Menge zu groß" }),
      }),
    )
    .min(1, { message: "Mindestens einen Artikel wählen" }),
  note: z
    .string()
    .trim()
    .max(500, { message: "Notiz zu lang (max. 500 Zeichen)" })
    .optional()
    .or(z.literal("")),
});

export type ShopOrderInput = z.infer<typeof shopOrderInputSchema>;

/**
 * Verifizierung eines einzelnen Patienten-Eintrags durch die PDL
 * (monatliche Bestätigung: noch da / nicht mehr da).
 */
export const patientVerifySchema = z.object({
  record_id: z.string().uuid({ message: "Ungültige Datensatz-ID" }),
  status: z.enum(["bestaetigt", "nicht_da"], {
    message: "Status wählen (bestätigt oder nicht da)",
  }),
  note: z
    .string()
    .trim()
    .max(500, { message: "Notiz zu lang (max. 500 Zeichen)" })
    .optional()
    .or(z.literal("")),
});

export type PatientVerifyInput = z.infer<typeof patientVerifySchema>;

/**
 * Import einer monatlichen Patientenliste (ein Batch pro Hub und Monat).
 * DSGVO — Datenminimierung: nur Anzeigename + optionale Referenz-ID.
 */
export const patientBatchImportSchema = z.object({
  hub_id: z.string().uuid({ message: "Ungültige Hub-ID" }),
  period: z
    .string()
    .regex(/^\d{4}-\d{2}$/, { message: "Zeitraum im Format JJJJ-MM angeben" }),
  entries: z
    .array(
      z.object({
        display_name: z.string().trim().min(1, { message: "Name fehlt" }),
        reference_id: z
          .string()
          .trim()
          .max(100, { message: "Referenz-ID zu lang (max. 100 Zeichen)" })
          .optional()
          .or(z.literal("")),
      }),
    )
    .min(1, { message: "Mindestens einen Eintrag angeben" }),
});

export type PatientBatchImportInput = z.infer<typeof patientBatchImportSchema>;
