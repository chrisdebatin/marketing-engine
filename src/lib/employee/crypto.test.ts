/**
 * Tests der Krypto-Primitive. Bewusst node:test statt vitest — kein Bundler,
 * keine Config, laeuft mit `npm test` direkt gegen die TS-Quellen (tsx).
 */
import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";

import {
  CODE_ALPHABET,
  activationCodeHint,
  formatActivationCode,
  generateActivationCode,
  generateToken,
  hashActivationCode,
  hashIp,
  hashPin,
  hashToken,
  isWeakPin,
  isWellFormedActivationCode,
  normalizeActivationCode,
  verifyPin,
} from "./crypto";

describe("Aktivierungscode", () => {
  it("erzeugt Codes in der richtigen Form", () => {
    for (let i = 0; i < 50; i++) {
      const code = generateActivationCode();
      assert.match(code, /^[A-Z2-9]{4}-[A-Z2-9]{4}-[A-Z2-9]{2}$/);
      assert.ok(isWellFormedActivationCode(normalizeActivationCode(code)));
    }
  });

  it("verwendet keine verwechselbaren Zeichen", () => {
    for (const forbidden of ["I", "L", "O", "U", "0", "1"]) {
      assert.ok(
        !CODE_ALPHABET.includes(forbidden),
        `${forbidden} darf nicht im Alphabet sein`,
      );
    }
    // Auch ueber viele Ziehungen darf nie ein verbotenes Zeichen auftauchen.
    const many = Array.from({ length: 200 }, () => generateActivationCode()).join("");
    assert.ok(!/[ILOU01]/.test(many.replace(/-/g, "")));
  });

  it("normalisiert Kleinschreibung, Leerzeichen und Bindestriche", () => {
    const raw = "ABCDEFGHJK";
    assert.equal(normalizeActivationCode("abcd-efgh-jk"), raw);
    assert.equal(normalizeActivationCode("  ABCD EFGH JK  "), raw);
    assert.equal(normalizeActivationCode("ABCD-EFGH-JK"), raw);
  });

  it("weist falsch geformte Codes ab", () => {
    assert.ok(!isWellFormedActivationCode(""));
    assert.ok(!isWellFormedActivationCode("ABC"));
    assert.ok(!isWellFormedActivationCode("ABCDEFGHJKL")); // zu lang
    assert.ok(!isWellFormedActivationCode("ABCDEFGHJ0")); // 0 nicht im Alphabet
    assert.ok(!isWellFormedActivationCode("ABCDEFGHJI")); // I nicht im Alphabet
  });

  it("hasht deterministisch und ist damit per Index suchbar", () => {
    const a = hashActivationCode("ABCDEFGHJK");
    const b = hashActivationCode("ABCDEFGHJK");
    assert.equal(a, b, "gleicher Code -> gleicher Hash (Lookup moeglich)");
    assert.notEqual(a, hashActivationCode("ABCDEFGHJM"));
    assert.match(a, /^[0-9a-f]{64}$/);
    assert.ok(!a.includes("ABCDEFGHJK"), "Klartext darf nicht im Hash stehen");
  });

  it("liefert einen 2-stelligen Hinweis", () => {
    assert.equal(activationCodeHint("ABCDEFGHJK"), "JK");
  });

  it("formatiert in Vierergruppen", () => {
    assert.equal(formatActivationCode("ABCDEFGHJK"), "ABCD-EFGH-JK");
  });
});

describe("PIN-Hashing", () => {
  it("verifiziert die korrekte PIN", () => {
    const stored = hashPin("482913");
    assert.ok(verifyPin("482913", stored));
  });

  it("lehnt die falsche PIN ab", () => {
    const stored = hashPin("482913");
    assert.ok(!verifyPin("482914", stored));
    assert.ok(!verifyPin("", stored));
    assert.ok(!verifyPin("4829130", stored));
  });

  it("nutzt pro PIN ein eigenes Salt", () => {
    const a = hashPin("482913");
    const b = hashPin("482913");
    assert.notEqual(a, b, "gleiche PIN -> unterschiedlicher Hash");
    // Beide muessen dennoch verifizieren.
    assert.ok(verifyPin("482913", a));
    assert.ok(verifyPin("482913", b));
  });

  it("speichert die PIN nicht im Klartext", () => {
    const stored = hashPin("482913");
    assert.ok(!stored.includes("482913"));
    assert.match(stored, /^scrypt\$[0-9a-f]{32}\$[0-9a-f]{128}$/);
  });

  it("faellt bei kaputtem oder fehlendem Hash sicher auf false zurueck", () => {
    assert.ok(!verifyPin("482913", null));
    assert.ok(!verifyPin("482913", ""));
    assert.ok(!verifyPin("482913", "kaputt"));
    assert.ok(!verifyPin("482913", "scrypt$zz$zz"));
    assert.ok(!verifyPin("482913", "bcrypt$aa$bb"));
  });
});

describe("Schwache PINs", () => {
  it("lehnt Wiederholungen ab", () => {
    for (const pin of ["000000", "111111", "999999", "555555"]) {
      assert.ok(isWeakPin(pin), `${pin} muss abgelehnt werden`);
    }
  });

  it("lehnt Folgen ab", () => {
    for (const pin of ["123456", "654321", "234567", "098765", "890123"]) {
      assert.ok(isWeakPin(pin), `${pin} muss abgelehnt werden`);
    }
  });

  it("lehnt Muster ab", () => {
    for (const pin of ["121212", "123123", "112233"]) {
      assert.ok(isWeakPin(pin), `${pin} muss abgelehnt werden`);
    }
  });

  it("lehnt Geburtsdaten ab", () => {
    for (const pin of ["011990", "251985", "310porridge".slice(0, 6)]) {
      if (/^\d{6}$/.test(pin)) {
        assert.ok(isWeakPin(pin), `${pin} muss abgelehnt werden`);
      }
    }
    assert.ok(isWeakPin("011990"));
    assert.ok(isWeakPin("241278"));
  });

  it("lehnt Nicht-Ziffern und falsche Laengen ab", () => {
    assert.ok(isWeakPin("12345"));
    assert.ok(isWeakPin("1234567"));
    assert.ok(isWeakPin("12a456"));
    assert.ok(isWeakPin(""));
  });

  it("akzeptiert unauffaellige PINs", () => {
    for (const pin of ["482913", "739502", "628471", "905312"]) {
      assert.ok(!isWeakPin(pin), `${pin} sollte erlaubt sein`);
    }
  });
});

describe("Tokens", () => {
  it("erzeugt unterschiedliche Tokens mit ausreichend Entropie", () => {
    const seen = new Set<string>();
    for (let i = 0; i < 200; i++) seen.add(generateToken());
    assert.equal(seen.size, 200, "keine Kollisionen");
    // 32 Bytes base64url -> 43 Zeichen
    assert.equal(generateToken().length, 43);
  });

  it("hasht Tokens deterministisch und ohne Klartext", () => {
    const token = generateToken();
    assert.equal(hashToken(token), hashToken(token));
    assert.notEqual(hashToken(token), hashToken(generateToken()));
    assert.ok(!hashToken(token).includes(token));
  });

  it("hasht IPs und laesst null durch", () => {
    assert.equal(hashIp(null), null);
    const h = hashIp("192.168.0.1");
    assert.ok(h && !h.includes("192.168"));
    assert.equal(hashIp("192.168.0.1"), h, "deterministisch");
    assert.notEqual(hashIp("192.168.0.2"), h);
  });
});

describe("Pepper-Pflicht", () => {
  const saved = process.env.EMPLOYEE_CODE_PEPPER;
  before(() => {
    process.env.EMPLOYEE_CODE_PEPPER = "";
  });
  after(() => {
    process.env.EMPLOYEE_CODE_PEPPER = saved;
  });

  it("wirft ohne Pepper einen klaren Fehler statt still unsicher zu werden", () => {
    assert.throws(
      () => hashActivationCode("ABCDEFGHJK"),
      /EMPLOYEE_CODE_PEPPER/,
    );
  });
});
