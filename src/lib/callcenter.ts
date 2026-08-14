/**
 * Auswertungs-Helfer für die Callcenter-Analyse. Einzige Datenquelle sind
 * die Benachrichtigungs-Mails der Telefonanlage über verpasste Anrufe
 * (lead_calls mit quelle = "telefon0800"). Angenommene Anrufe erzeugen keine
 * Mail und liegen dem System deshalb nicht vor.
 */

export type CallKategorie =
  | "neuinteressent"
  | "bestandskunde"
  | "mitarbeiter_intern"
  | "sonstiges"
  | "kein_anliegen";

/**
 * Uhrzeit des Anrufs aus dem Notiz-Text lesen. Die Mail enthält den
 * Zeitpunkt im Klartext, z. B. "… um Freitag, 14. August 2026 um 13:53 · …".
 * Fällt auf den Eingang der Mail zurück, wenn nichts Verwertbares drinsteht.
 */
export function stundeAusNotiz(
  notiz: string | null,
  fallbackIso: string | null,
): number | null {
  // Letztes "um HH:MM" gewinnt — davor steht oft das Datum ("um Freitag, …").
  const treffer = [...(notiz ?? "").matchAll(/\bum\s+(\d{1,2}):(\d{2})\b/g)];
  const letzte = treffer[treffer.length - 1];
  if (letzte) {
    const h = Number(letzte[1]);
    if (Number.isFinite(h) && h >= 0 && h <= 23) return h;
  }
  if (fallbackIso) {
    const d = new Date(fallbackIso);
    if (!Number.isNaN(d.getTime())) return d.getHours();
  }
  return null;
}

/**
 * Kategorie aus dem Ergebnis-Text der KI-Vorsortierung ableiten. Erst die
 * Vorsortierung selbst erkennen ("kein Neuinteressent …"), dann die
 * Unterkategorie — bei Altbestand fehlt die Klammer, der Anruf ist aber
 * trotzdem keine Neuanfrage.
 */
export function kategorieAusErgebnis(ergebnis: string | null): CallKategorie {
  const e = ergebnis ?? "";
  if (!/kein\s+neuinteressent/i.test(e)) return "neuinteressent";
  if (/kein anliegen|anonym/i.test(e)) return "kein_anliegen";
  if (/bestandskunde/i.test(e)) return "bestandskunde";
  if (/mitarbeiter|intern/i.test(e)) return "mitarbeiter_intern";
  return "sonstiges";
}
