import { z } from "zod";

/**
 * Eingabevalidierung der Mitarbeiter-App.
 *
 * SICHERHEITSREGEL: Kein Schema enthaelt jemals `staff_id`, `hub_id` oder eine
 * andere Identitaetsangabe. Alle Schemas sind `.strict()` — ein
 * untergeschobenes Feld fuehrt zu 400 statt still uebernommen zu werden.
 * Die Identitaet kommt ausschliesslich aus requireEmployee().
 *
 * Alle Meldungen sind deutsch und richten sich an Pflegekraefte, nicht an
 * Entwickler.
 */

const trimmed = (max: number) => z.string().trim().max(max);

/** Optionales Textfeld: "" wird zu undefined, damit leere Eingaben nicht als Daten landen. */
const optionalText = (max: number) =>
  trimmed(max)
    .transform((v) => (v.length === 0 ? undefined : v))
    .optional();

const telefon = optionalText(40).refine(
  (v) => v === undefined || /^[\d\s+()\/.-]{5,40}$/.test(v),
  { message: "Diese Telefonnummer sieht nicht vollstaendig aus." },
);

const email = optionalText(120).refine(
  (v) => v === undefined || z.string().email().safeParse(v).success,
  { message: "Diese E-Mail-Adresse sieht nicht richtig aus." },
);

/* ------------------------------------------------------------------
 * Authentifizierung
 * ------------------------------------------------------------------ */

export const activationSchema = z
  .object({
    code: z
      .string()
      .trim()
      .min(1, "Bitte gib deinen Aktivierungscode ein.")
      .max(32, "Dieser Code ist zu lang."),
  })
  .strict();

export const pinSchema = z
  .object({
    pin: z
      .string()
      .regex(/^\d{6}$/, "Die PIN besteht aus genau 6 Ziffern."),
  })
  .strict();

/* ------------------------------------------------------------------
 * Empfehlungen
 * ------------------------------------------------------------------ */

export const customerReferralSchema = z
  .object({
    kunde_name: trimmed(120).min(2, "Bitte gib den Namen der Person ein."),
    telefon,
    email,
    ort: optionalText(120),
    beziehung: optionalText(200),
    notiz: optionalText(2000),
    // DSGVO: Der Empfohlene ist eine dritte Person.
    consent: z.literal(true, {
      message: "Bitte bestaetige, dass die Person Bescheid weiss.",
    }),
  })
  .strict();

export const maReferralSchema = z
  .object({
    // Bewusst das EINZIGE Pflichtfeld — auch unvollstaendige Hinweise helfen.
    firma_name: trimmed(160).min(2, "Bitte gib den Namen des Pflegedienstes ein."),
    inhaber_name: optionalText(120),
    telefon,
    email,
    ort: optionalText(120),
    beziehung: optionalText(500),
    notiz: optionalText(2000),
  })
  .strict();

/* ------------------------------------------------------------------
 * Admin
 * ------------------------------------------------------------------ */

export const announcementSchema = z
  .object({
    titel: trimmed(160).min(3, "Bitte gib einen Titel ein."),
    body: trimmed(20000).min(3, "Bitte gib einen Text ein."),
    // Nur https. Ohne Einschraenkung koennte hier eine beliebige externe URL
    // stehen, die dann von allen ~650 Geraeten geladen wird (IP-Abfluss an
    // Dritte) — oder ein data:-URI.
    image_url: optionalText(500).refine(
      (v) => v === undefined || /^https:\/\/\S+$/i.test(v),
      { message: "Bitte eine vollstaendige https-Adresse angeben." },
    ),
    status: z.enum(["draft", "published", "archived"]),
    prioritaet: z.enum(["normal", "wichtig"]),
    publish_at: z.string().datetime().optional(),
  })
  .strict();

export type CustomerReferralInput = z.infer<typeof customerReferralSchema>;
export type MaReferralInput = z.infer<typeof maReferralSchema>;
export type AnnouncementInput = z.infer<typeof announcementSchema>;

/** Erste Fehlermeldung eines Zod-Ergebnisses — fuer knappe API-Antworten. */
export function firstError(error: z.ZodError): string {
  return error.issues[0]?.message ?? "Bitte pruefe deine Eingaben.";
}
