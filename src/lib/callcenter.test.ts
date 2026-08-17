import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { kategorieAusErgebnis } from "./callcenter";

/**
 * Sichert die Auswertungs-Logik hinter dem "Ungültig"-Button ab.
 *
 * Der Button speichert den Lead als `verloren`, aber mit einem Ergebnis-Text,
 * der "kein Neuinteressent" enthaelt. Nur daran erkennen die Auswertungen
 * (crm-admin) und kategorieAusErgebnis(), dass der Lead NICHT als verlorener
 * Interessent zaehlen darf — sonst wuerde ein Fake-Lead die Conversion-Rate
 * druecken.
 *
 * Wer den Text im Button aendert, ohne "kein Neuinteressent" beizubehalten,
 * bricht diese Tests — genau das ist ihr Zweck.
 */

/** Texte, die UngueltigButton erzeugt (siehe team-workspace.tsx). */
const UNGUELTIG = [
  "kein Neuinteressent — ungültig: Fake-/Spam-Daten",
  "kein Neuinteressent — ungültig: Test-/Doppel-Eintrag",
  "kein Neuinteressent — ungültig: kein Anliegen erkennbar",
  "kein Neuinteressent — ungültig: Fake-/Spam-Daten (gemeldet 17.08.2026)",
];

/** Bestehende Verlustgruende — muessen weiterhin als Interessent zaehlen. */
const ECHTE_VERLUSTE = [
  "Nicht erreicht",
  "Doch kein Interesse",
  "Kontaktdaten fehlen / falsch",
  "nicht im Einzugsbereich (gemeldet 17.08.2026)",
];

/** Spiegelt den Filter aus src/app/(app)/crm-admin/page.tsx. */
const zaehltAlsNeuinteressent = (ergebnis: string) =>
  !/kein\s+neuinteressent/i.test(ergebnis);

describe("Ungültig-Leads", () => {
  it("zaehlen nicht als Neuinteressent", () => {
    for (const e of UNGUELTIG) {
      assert.equal(
        zaehltAlsNeuinteressent(e),
        false,
        `"${e}" darf die Interessenten-Quote nicht belasten`,
      );
    }
  });

  it("landen nicht in der Kategorie 'neuinteressent'", () => {
    for (const e of UNGUELTIG) {
      assert.notEqual(kategorieAusErgebnis(e), "neuinteressent", e);
    }
  });

  it("werden bei Agentur-Leads mit Melde-Datum vermerkt (Reklamation)", () => {
    const mitDatum = UNGUELTIG.filter((e) => /gemeldet\s+[\d.]+/.test(e));
    assert.ok(
      mitDatum.length > 0,
      "mindestens eine Variante traegt ein Melde-Datum",
    );
    // Gleiches Format wie "nicht im Einzugsbereich" — agentur-rueckweisungen.tsx
    // liest es per /gemeldet\s+([\d.]+)/ aus.
    for (const e of mitDatum) {
      assert.match(e, /gemeldet\s+\d{1,2}\.\d{1,2}\.\d{4}/);
    }
  });
});

describe("Bestehende Verlustgruende (Regression)", () => {
  it("zaehlen weiterhin als Neuinteressent", () => {
    for (const e of ECHTE_VERLUSTE) {
      assert.equal(
        zaehltAlsNeuinteressent(e),
        true,
        `"${e}" ist ein echter, verlorener Interessent`,
      );
    }
  });

  it("behalten die Kategorie 'neuinteressent'", () => {
    for (const e of ECHTE_VERLUSTE) {
      assert.equal(kategorieAusErgebnis(e), "neuinteressent", e);
    }
  });
});

describe("kategorieAusErgebnis — bestehendes Verhalten", () => {
  it("erkennt die bekannten Kategorien unveraendert", () => {
    assert.equal(kategorieAusErgebnis(null), "neuinteressent");
    assert.equal(kategorieAusErgebnis(""), "neuinteressent");
    assert.equal(
      kategorieAusErgebnis("kein Neuinteressent, anonym"),
      "kein_anliegen",
    );
    assert.equal(
      kategorieAusErgebnis("kein Neuinteressent — Bestandskunde"),
      "bestandskunde",
    );
    assert.equal(
      kategorieAusErgebnis("kein Neuinteressent — interner Anruf"),
      "mitarbeiter_intern",
    );
  });
});
