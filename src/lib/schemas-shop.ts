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
    .min(1, { message: "Mindestens einen Artikel wählen" })
    .max(50, { message: "Zu viele Positionen (max. 50)" }),
  note: z
    .string()
    .trim()
    .max(500, { message: "Notiz zu lang (max. 500 Zeichen)" })
    .optional()
    .or(z.literal("")),
});

export type ShopOrderInput = z.infer<typeof shopOrderInputSchema>;

/**
 * Freie Bestellung der PDL (Material außerhalb des Katalogs).
 * Wird als eigene `orders`-Zeile mit Freitext-Material gespeichert.
 */
export const shopCustomOrderSchema = z.object({
  text: z
    .string()
    .trim()
    .min(1, { message: "Beschreiben, was benötigt wird" })
    .max(200, { message: "Beschreibung zu lang (max. 200 Zeichen)" }),
  quantity: z.coerce
    .number({ message: "Menge eingeben" })
    .int({ message: "Menge muss eine ganze Zahl sein" })
    .positive({ message: "Menge muss größer als 0 sein" })
    .max(9999, { message: "Menge zu groß" }),
  note: z
    .string()
    .trim()
    .max(500, { message: "Notiz zu lang (max. 500 Zeichen)" })
    .optional()
    .or(z.literal("")),
});

export type ShopCustomOrderInput = z.infer<typeof shopCustomOrderSchema>;

/**
 * Verifizierung eines einzelnen Patienten-Eintrags durch die PDL
 * (monatliche Bestätigung: noch da / nicht mehr da).
 */
export const patientVerifySchema = z.object({
  record_id: z.string().uuid({ message: "Ungültige Datensatz-ID" }),
  // 'offen' erlaubt der PDL, eine versehentliche Entscheidung zu korrigieren.
  status: z.enum(["bestaetigt", "nicht_da", "offen"], {
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
 * PDL ergänzt einen Patienten, der in der zentralen Liste fehlt.
 * Der Eintrag wird mit source='pdl' und status='bestaetigt' angelegt.
 */
export const patientAddSchema = z.object({
  batch_id: z.string().uuid({ message: "Ungültige Listen-ID" }),
  display_name: z
    .string()
    .trim()
    .min(1, { message: "Name eingeben" })
    .max(200, { message: "Name zu lang (max. 200 Zeichen)" }),
  reference_id: z
    .string()
    .trim()
    .max(100, { message: "Referenz-ID zu lang (max. 100 Zeichen)" })
    .optional()
    .or(z.literal("")),
});

export type PatientAddInput = z.infer<typeof patientAddSchema>;

/**
 * PDL fragt alle Namen eines Monats ab (Namens-Pool ohne Hub-Zuordnung),
 * um Patienten zu finden, die eigentlich zu ihrem Hub gehören.
 */
export const patientPoolSchema = z.object({
  period: z
    .string()
    .regex(/^\d{4}-\d{2}$/, { message: "Zeitraum im Format JJJJ-MM angeben" }),
});

export type PatientPoolInput = z.infer<typeof patientPoolSchema>;

/**
 * PDL ordnet einen Namen aus dem Monats-Pool ihrem Hub zu — der Eintrag
 * wird in die eigene Monatsliste verschoben (source='pdl', bestätigt).
 */
export const patientClaimSchema = z.object({
  record_id: z.string().uuid({ message: "Ungültige Datensatz-ID" }),
});

export type PatientClaimInput = z.infer<typeof patientClaimSchema>;

/**
 * PDL erfasst einen monatlichen Patienten-Zugang oder -Abgang je
 * SGB-Leistungsart. DSGVO: nur Anzeigename + optionale Referenz-ID.
 */
export const patientFlowSchema = z.object({
  period: z
    .string()
    .regex(/^\d{4}-\d{2}$/, { message: "Zeitraum im Format JJJJ-MM angeben" }),
  flow: z.enum(["zugang", "abgang"], {
    message: "Zugang oder Abgang wählen",
  }),
  leistung: z
    .string()
    .trim()
    .min(1, { message: "Leistung wählen" })
    .max(60, { message: "Ungültige Leistung" }),
  display_name: z
    .string()
    .trim()
    .min(1, { message: "Name eingeben" })
    .max(200, { message: "Name zu lang (max. 200 Zeichen)" }),
  reference_id: z
    .string()
    .trim()
    .max(100, { message: "Referenz-ID zu lang (max. 100 Zeichen)" })
    .optional()
    .or(z.literal("")),
});

export type PatientFlowInput = z.infer<typeof patientFlowSchema>;

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
        display_name: z
          .string()
          .trim()
          .min(1, { message: "Name fehlt" })
          .max(200, { message: "Name zu lang (max. 200 Zeichen)" }),
        reference_id: z
          .string()
          .trim()
          .max(100, { message: "Referenz-ID zu lang (max. 100 Zeichen)" })
          .optional()
          .or(z.literal("")),
      }),
    )
    .min(1, { message: "Mindestens einen Eintrag angeben" })
    .max(500, { message: "Zu viele Einträge (max. 500 pro Liste)" }),
});

export type PatientBatchImportInput = z.infer<typeof patientBatchImportSchema>;
