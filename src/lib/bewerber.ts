/**
 * Bewerbungen aus Meta-Anzeigen und Website: Standort- und Rollen-Erkennung
 * aus dem Kampagnennamen sowie eine ehrliche Vorsortierung.
 *
 * Wichtig zur Aussagekraft: Die Meta-Formulare liefern nur Name, E-Mail und
 * Telefon — keinen Freitext zu Erfahrung oder Qualifikation. Der Score kann
 * deshalb nur bewerten, was vorliegt (Erreichbarkeit + Rolle laut Kampagne)
 * und ist bewusst dreistufig statt einer Prozentzahl, die Genauigkeit
 * vortäuschen würde.
 */

export type BewerberScore = 1 | 2 | 3;

export const SCORE_LABEL: Record<BewerberScore, string> = {
  3: "Hoch",
  2: "Mittel",
  1: "Niedrig",
};

export const SCORE_TONE: Record<BewerberScore, string> = {
  3: "bg-emerald-100 text-emerald-800",
  2: "bg-amber-100 text-amber-800",
  1: "bg-slate-200 text-slate-700",
};

export const BEWERBER_STATUS_LABEL: Record<string, string> = {
  neu: "neu",
  kontaktiert: "kontaktiert",
  gespraech: "Gespräch vereinbart",
  eingestellt: "eingestellt",
  abgesagt: "abgesagt",
};

export const BEWERBER_STATUS_TONE: Record<string, string> = {
  neu: "bg-amber-100 text-amber-800",
  kontaktiert: "bg-blue-100 text-blue-800",
  gespraech: "bg-purple-100 text-purple-800",
  eingestellt: "bg-emerald-100 text-emerald-800",
  abgesagt: "bg-slate-200 text-slate-700",
};

/** Rolle aus dem Meta-Kampagnennamen ("Mitarbeiter-Hameln-Fachkraft-…"). */
export function rolleAusKampagne(campaign: string | null): string | null {
  if (!campaign) return null;
  if (/fachkraft|examiniert/i.test(campaign)) return "Pflegefachkraft";
  if (/lg1|lg2|lg12|helfer/i.test(campaign)) return "Pflegehelfer";
  if (/hauswirtschaft|alltagshilfe/i.test(campaign)) return "Hauswirtschaft";
  return null;
}

/**
 * Standort aus dem Kampagnennamen ableiten ("Mitarbeiter-Kerpen-LG12-…").
 * Vergleicht gegen die echten Hub-Namen; der längste Treffer gewinnt, damit
 * "Alltagshilfe Düsseldorf" nicht fälschlich auf "Düsseldorf" fällt.
 */
export function hubAusKampagne(
  campaign: string | null,
  hubs: { id: string; name: string }[],
): string | null {
  if (!campaign) return null;
  const c = campaign.toLowerCase();
  const treffer = hubs
    .filter((h) => c.includes(h.name.toLowerCase()))
    .sort((a, b) => b.name.length - a.name.length);
  return treffer[0]?.id ?? null;
}

/**
 * Vorsortierung einer Bewerbung. Bewertet ausschließlich, was tatsächlich
 * vorliegt — keine erfundene Eignungsbeurteilung.
 */
export function bewerteBewerbung(b: {
  telefon: string | null;
  email: string | null;
  rolle: string | null;
}): { score: BewerberScore; grund: string } {
  const hatTelefon = (b.telefon ?? "").replace(/\D/g, "").length >= 7;
  const hatMail = /.+@.+\..+/.test(b.email ?? "");
  const gruende: string[] = [];

  // Erreichbarkeit ist das einzige harte Kriterium, das die Daten hergeben.
  let punkte = 0;
  if (hatTelefon) {
    punkte += 2;
    gruende.push("Telefonnummer vorhanden");
  } else {
    gruende.push("keine Telefonnummer");
  }
  if (hatMail) {
    punkte += 1;
    gruende.push("E-Mail vorhanden");
  } else {
    gruende.push("keine E-Mail");
  }
  // Fachkräfte sind der Engpass — höher gewichtet.
  if (b.rolle === "Pflegefachkraft") {
    punkte += 2;
    gruende.push("Fachkraft-Kampagne");
  } else if (b.rolle) {
    punkte += 1;
    gruende.push(`${b.rolle}-Kampagne`);
  }

  const score: BewerberScore = punkte >= 4 ? 3 : punkte >= 2 ? 2 : 1;
  return { score, grund: gruende.join(" · ") };
}

/** Liegezeit in Stunden zwischen Weiterleitung und erster Reaktion. */
export function liegezeitStunden(
  zugewiesen: string,
  erstkontakt: string | null,
  jetzt: number,
): number {
  const start = new Date(zugewiesen).getTime();
  const ende = erstkontakt ? new Date(erstkontakt).getTime() : jetzt;
  return Math.max(0, (ende - start) / 3_600_000);
}

/** "3,5 Std" / "2,1 Tage" — kompakt für Tabellen. */
export function formatLiegezeit(stunden: number): string {
  if (stunden < 1) return `${Math.round(stunden * 60)} Min`;
  if (stunden < 48) return `${stunden.toFixed(1).replace(".", ",")} Std`;
  return `${(stunden / 24).toFixed(1).replace(".", ",")} Tage`;
}
