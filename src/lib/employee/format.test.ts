import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { formatAnnouncementDate, formatShortDate } from "./format";

/**
 * Referenzzeitpunkt: Freitag, 14. August 2026, 12:00 Uhr Berliner Zeit.
 * Bewusst fixiert — kein Date.now() im Test, sonst schlagen die Faelle
 * je nach Ausfuehrungszeitpunkt fehl.
 */
const NOW = new Date("2026-08-14T12:00:00+02:00");

describe("formatAnnouncementDate", () => {
  it("zeigt heute mit Uhrzeit", () => {
    const out = formatAnnouncementDate("2026-08-14T14:30:00+02:00", NOW);
    assert.match(out, /^Heute, \d{2}:\d{2}$/);
    assert.ok(out.includes("14:30"));
  });

  it("zeigt gestern ohne Uhrzeit", () => {
    assert.equal(
      formatAnnouncementDate("2026-08-13T09:00:00+02:00", NOW),
      "Gestern",
    );
  });

  it("zeigt den Wochentag innerhalb der letzten 7 Tage", () => {
    // 11.08.2026 ist ein Dienstag.
    assert.equal(
      formatAnnouncementDate("2026-08-11T09:00:00+02:00", NOW),
      "Dienstag",
    );
  });

  it("zeigt Tag und Monat im selben Jahr", () => {
    assert.equal(
      formatAnnouncementDate("2026-03-02T09:00:00+01:00", NOW),
      "2. März",
    );
  });

  it("zeigt das Jahr bei aelteren Meldungen", () => {
    assert.equal(
      formatAnnouncementDate("2025-08-12T09:00:00+02:00", NOW),
      "12. August 2025",
    );
  });

  it("faellt bei kaputten Werten auf leer zurueck statt zu werfen", () => {
    assert.equal(formatAnnouncementDate("keindatum", NOW), "");
    assert.equal(formatAnnouncementDate("", NOW), "");
  });
});

describe("formatShortDate", () => {
  it("formatiert deutsch", () => {
    assert.equal(formatShortDate("2026-08-14T10:00:00+02:00"), "14.08.2026");
  });

  it("faellt bei kaputten Werten auf leer zurueck", () => {
    assert.equal(formatShortDate("nope"), "");
  });
});
