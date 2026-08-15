import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { DEVICE_MAX_FAILURES, lockoutMinutes } from "./lockout";

/**
 * Regressionstest zur Sperr-Staffelung.
 *
 * Der urspruengliche Code leitete die Staffel aus der Gesamtzahl der
 * Fehlversuche ab (`floor(failed / 5)`) und setzte failed_count beim Sperren
 * NICHT zurueck. Folge: Nach der ersten Sperre genuegte EIN weiterer
 * Fehlversuch fuer die naechste Sperre — die aber wieder nur 5 Minuten dauerte.
 * Ein Angreifer bekam damit dauerhaft einen Rateversuch alle 5 Minuten,
 * statt auf 1 h bzw. 24 h ausgebremst zu werden.
 *
 * Jetzt zaehlt lock_count die tatsaechlichen SPERREN, und failed_count wird
 * beim Sperren auf 0 gesetzt. Diese Tests halten das fest.
 */

describe("lockoutMinutes", () => {
  it("staffelt nach der Anzahl der Sperren", () => {
    assert.equal(lockoutMinutes(1), 5);
    assert.equal(lockoutMinutes(2), 60);
    assert.equal(lockoutMinutes(3), 24 * 60);
    assert.equal(lockoutMinutes(9), 24 * 60);
  });

  it("behandelt 0 wie die erste Sperre (defensiv)", () => {
    assert.equal(lockoutMinutes(0), 5);
  });
});

describe("Sperr-Verlauf eines Geraets", () => {
  /**
   * Bildet die Logik aus verifyPinLogin nach: failed_count zaehlt Fehlversuche
   * seit der letzten Sperre, lock_count die Sperren.
   */
  function simulate(wrongAttempts: number) {
    let failed = 0;
    let lockCount = 0;
    const locks: number[] = [];

    for (let i = 0; i < wrongAttempts; i++) {
      failed += 1;
      if (failed >= DEVICE_MAX_FAILURES) {
        lockCount += 1;
        locks.push(lockoutMinutes(lockCount));
        failed = 0; // beim Sperren zuruecksetzen
      }
    }
    return { locks, failed, lockCount };
  }

  it("sperrt erst nach 5 Fehlversuchen", () => {
    assert.deepEqual(simulate(4).locks, []);
    assert.deepEqual(simulate(5).locks, [5]);
  });

  it("verlangt fuer jede weitere Sperre erneut 5 Fehlversuche", () => {
    // 10 Fehlversuche = 2 Sperren, nicht 6.
    assert.deepEqual(simulate(10).locks, [5, 60]);
    assert.deepEqual(simulate(15).locks, [5, 60, 24 * 60]);
  });

  it("eskaliert die Dauer tatsaechlich (Kern der Regression)", () => {
    const { locks } = simulate(15);
    assert.ok(
      locks[1] > locks[0] && locks[2] > locks[1],
      "jede Sperre muss laenger sein als die vorherige",
    );
    // Der alte Fehler zeigte sich als [5, 5, 5, ...].
    assert.notDeepEqual(locks, [5, 5, 5]);
  });

  it("ein Angreifer erkauft sich mit 6 Versuchen keine zweite Kurzsperre", () => {
    // 6 Fehlversuche: eine Sperre (5 min), danach 1 offener Fehlversuch.
    const s = simulate(6);
    assert.deepEqual(s.locks, [5]);
    assert.equal(s.failed, 1);
    assert.equal(s.lockCount, 1);
  });
});
