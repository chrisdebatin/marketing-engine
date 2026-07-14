import { z } from "zod";

/**
 * Zod schemas for the `activities.details` jsonb payload, discriminated by type.
 * Adding a new activity type = add a new variant here + a form; no DB migration.
 */

export const flyerDetailsSchema = z.object({
  material_type_id: z.string().uuid({ message: "Material-Art wählen" }),
  menge: z.coerce
    .number()
    .int()
    .positive({ message: "Menge muss größer als 0 sein" }),
});
export type FlyerDetails = z.infer<typeof flyerDetailsSchema>;

export const boxDetailsSchema = z.object({
  anzahl_boxen: z.coerce
    .number()
    .int()
    .positive({ message: "Anzahl Boxen muss größer als 0 sein" }),
});
export type BoxDetails = z.infer<typeof boxDetailsSchema>;

/** Base fields shared by every activity, independent of type. */
const activityBase = {
  hub_id: z.string().uuid({ message: "Hub wählen" }),
  standort_name: z.string().trim().min(1, { message: "Auslage-Ort eingeben" }),
  occurred_on: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, { message: "Datum im Format JJJJ-MM-TT" }),
  note: z.string().trim().max(1000).optional().or(z.literal("")),
};

export const flyerActivitySchema = z.object({
  ...activityBase,
  type: z.literal("flyer"),
  details: flyerDetailsSchema,
});

export const boxActivitySchema = z.object({
  ...activityBase,
  type: z.literal("box"),
  details: boxDetailsSchema,
});

/** Full new-activity payload, validated before it is queued/synced. */
export const activityInputSchema = z.discriminatedUnion("type", [
  flyerActivitySchema,
  boxActivitySchema,
]);
export type ActivityInput = z.infer<typeof activityInputSchema>;

/** Validate a details blob for a known activity type (e.g. server-side re-check). */
export function validateDetails(type: string, details: unknown) {
  switch (type) {
    case "flyer":
      return flyerDetailsSchema.parse(details);
    case "box":
      return boxDetailsSchema.parse(details);
    default:
      throw new Error(`Unbekannter Aktivitätstyp: ${type}`);
  }
}
