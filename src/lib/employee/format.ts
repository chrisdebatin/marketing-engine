/**
 * Deutsche Datumsformate fuer die Mitarbeiter-App.
 * Reine Funktionen ohne Server-Abhaengigkeit -> auch im Client nutzbar.
 */

const BERLIN = "Europe/Berlin";

/** "Heute, 14:30" / "Gestern" / "Dienstag" / "12. August" / "12. August 2025" */
export function formatAnnouncementDate(iso: string, now = new Date()): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";

  const dayKey = (x: Date) =>
    new Intl.DateTimeFormat("de-DE", {
      timeZone: BERLIN,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(x);

  const today = dayKey(now);
  const yesterday = dayKey(new Date(now.getTime() - 86_400_000));
  const target = dayKey(d);

  if (target === today) {
    const time = new Intl.DateTimeFormat("de-DE", {
      timeZone: BERLIN,
      hour: "2-digit",
      minute: "2-digit",
    }).format(d);
    return `Heute, ${time}`;
  }
  if (target === yesterday) return "Gestern";

  const diffDays = Math.floor((now.getTime() - d.getTime()) / 86_400_000);
  if (diffDays >= 0 && diffDays < 7) {
    return new Intl.DateTimeFormat("de-DE", {
      timeZone: BERLIN,
      weekday: "long",
    }).format(d);
  }

  const sameYear =
    new Intl.DateTimeFormat("de-DE", { timeZone: BERLIN, year: "numeric" }).format(d) ===
    new Intl.DateTimeFormat("de-DE", { timeZone: BERLIN, year: "numeric" }).format(now);

  return new Intl.DateTimeFormat("de-DE", {
    timeZone: BERLIN,
    day: "numeric",
    month: "long",
    ...(sameYear ? {} : { year: "numeric" }),
  }).format(d);
}

/** Kurzform fuer Listen: "12.08.2026". */
export function formatShortDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return new Intl.DateTimeFormat("de-DE", {
    timeZone: BERLIN,
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(d);
}
