/**
 * Gesprächs-Skripte für beide Teams. Bewusst als Daten und nicht als JSX,
 * damit die Skript-Seite, die CRM-Hilfe und spätere Ausgaben (PDF) aus
 * derselben Quelle lesen — sonst driften die Fassungen auseinander.
 *
 * Ton je Zielgruppe unterschiedlich:
 * - Kliniken/Praxen: sachlich-professionell, Ziel ist der nächste Schritt.
 * - Patientinnen und Patienten: warm und beruhigend, Ziel ist das
 *   kostenlose Erstgespräch. Hier gilt: zuhören schlägt runterrattern.
 */

export interface SkriptSchritt {
  titel: string;
  saetze: string[];
  hinweis?: string;
}

export interface SkriptEinwand {
  einwand: string;
  antwort: string;
}

export interface Skript {
  slug: string;
  titel: string;
  zielgruppe: string;
  /** Wo dieses Skript im CRM gebraucht wird — verbindet Skript mit Lead-Quelle. */
  quellen: string[];
  ton: string;
  ziel: string;
  /** Farbschema der Karte: bewusst semantisch je Zielgruppe. */
  farbe: "blau" | "emerald" | "violett" | "orange";
  kurz?: string;
  schritte: SkriptSchritt[];
  einwaende: SkriptEinwand[];
}

export const SKRIPTE: Skript[] = [
  {
    slug: "krankenhaus",
    titel: "Outbound — Krankenhäuser & Sozialdienst",
    zielgruppe: "Case Manager, Entlassmanagement, Sozialdienst",
    quellen: ["Outbound-Anrufe", "Krankenhaus/Sozialdienst"],
    ton: "Sachlich-professionell. Auf Augenhöhe, kurz, ohne Verkaufsfloskeln.",
    ziel: "E-Mail mit Leistungsprofil, persönlicher Besuch der PDL oder Infomaterial.",
    farbe: "blau",
    kurz:
      "Guten Tag, mein Name ist [Name] von der Pflegeunion, einem ambulanten Pflegedienst in [Region]. Ich rufe an, weil wir aktuell freie Kapazitäten haben. Was uns auszeichnet, ist unser sehr breites Leistungsspektrum — von Alltagshilfe über Grund- und Behandlungspflege bis zur Intensivpflege, alles aus einer Hand. Wir nehmen kurzfristig auf und melden verlässlich zurück, auch Absagen zeitnah. Ich würde Ihnen gern unser Leistungsprofil per E-Mail schicken oder kurz persönlich vorbeikommen — was passt Ihnen besser?",
    schritte: [
      {
        titel: "Begrüßung & richtige Stelle",
        saetze: [
          "Guten Tag, mein Name ist [Name] von der Pflegeunion, einem ambulanten Pflegedienst in [Region]. Spreche ich mit dem Entlassmanagement / Sozialdienst?",
          "Könnten Sie mich bitte mit dem Case Management verbinden?",
        ],
        hinweis:
          "Zweiter Satz nur, falls nein. Namen der Person notieren — gehört ins Anruf-Formular unter „Ansprechpartner“.",
      },
      {
        titel: "Kennen Sie uns schon?",
        saetze: ["Darf ich kurz fragen — ist Ihnen die Pflegeunion bereits ein Begriff?"],
        hinweis: "Wenn ja: kurz halten, direkt zum Grund. Wenn nein: in einem Satz einordnen.",
      },
      {
        titel: "Grund des Anrufs",
        saetze: [
          "Ich rufe aus zwei Gründen an: Zum einen möchte ich Ihnen unsere aktuell freien Kapazitäten melden, zum anderen eine Erweiterung unseres Leistungsangebots.",
        ],
      },
      {
        titel: "Was uns auszeichnet",
        saetze: [
          "Die Pflegeunion hat ein sehr breites Leistungsspektrum — von Alltagshilfe über Grund- und Behandlungspflege bis hin zur Intensivpflege. Wir begleiten unsere Patientinnen und Patienten ganzheitlich aus einer Hand.",
        ],
        hinweis:
          "Kurz ergänzen: kurzfristige Aufnahmen möglich, verlässliche Rückmeldung, Gebiet [PLZ/Region]. Therapie und Hilfsmittel nur nennen, wenn am Standort verfügbar (siehe Hinweis oben).",
      },
      {
        titel: "Ziel: nächster Schritt",
        saetze: [
          "Damit Sie uns im passenden Fall parat haben — was wäre Ihnen am liebsten: ich schicke Ihnen kurz eine E-Mail mit unserem Leistungsprofil, unsere Pflegedienstleitung kommt persönlich vorbei, oder wir bringen Ihnen Infomaterial vorbei?",
        ],
        hinweis:
          "Abschluss sichern: E-Mail-Adresse notieren, Termin festhalten oder richtigen Ansprechpartner + Durchwahl erfragen. Ergebnis ins Anruf-Formular eintragen.",
      },
      {
        titel: "Neutralität anerkennen",
        saetze: [
          "Die Wahl bleibt selbstverständlich bei der Patientin — wir möchten nur als verfügbare Option auf Ihrem Radar sein.",
        ],
        hinweis: "Wichtig bei Kliniken: Sie dürfen keinen Anbieter bevorzugen.",
      },
      {
        titel: "Abschluss",
        saetze: [
          "Vielen Dank für Ihre Zeit! Ich fasse zusammen: [nächster Schritt]. Das schicke ich Ihnen noch heute. Einen schönen Tag!",
        ],
      },
    ],
    einwaende: [
      {
        einwand: "Wir haben feste Partner.",
        antwort:
          "Das verstehe ich gut. Gerade wenn Ihre Partner mal keine Kapazität haben, sind wir eine verlässliche Rückfalloption — soll ich Ihnen das Profil für den Fall der Fälle schicken?",
      },
      {
        einwand: "Schicken Sie einfach eine E-Mail.",
        antwort:
          "Sehr gern — an welche Adresse darf ich das schicken? Und an wen richte ich es am besten?",
      },
      {
        einwand: "Dafür bin ich nicht zuständig.",
        antwort:
          "Kein Problem — wer wäre denn bei Ihnen die richtige Ansprechperson? Und haben Sie vielleicht die Durchwahl?",
      },
      {
        einwand: "Wir melden uns, wenn wir etwas brauchen.",
        antwort:
          "Gern. Damit Sie uns dann direkt zur Hand haben, schicke ich Ihnen einmal unser Profil mit Telefonnummer — passt das?",
      },
    ],
  },
  {
    slug: "patienten",
    titel: "Patienten-Leads — Meta & Lead-Agentur",
    zielgruppe: "Interessentinnen und Interessenten, die selbst angefragt haben",
    quellen: ["Meta", "Lead-Agentur"],
    ton: "Warm und beruhigend. Nicht verkaufen — zuhören, beruhigen, führen.",
    ziel: "Kostenloses, unverbindliches Erstgespräch (telefonisch oder zu Hause).",
    farbe: "emerald",
    schritte: [
      {
        titel: "Einstieg — auf den Lead beziehen",
        saetze: [
          "Guten Tag Frau/Herr [Name], mein Name ist [Name] von der Pflegeunion. Sie hatten sich nach Unterstützung in der Pflege erkundigt — deshalb melde ich mich gern persönlich bei Ihnen.",
        ],
        hinweis:
          "Die Person hat selbst angefragt. Kein Kaltakquise-Ton, keine Rechtfertigung für den Anruf.",
      },
      {
        titel: "Bedarf verstehen — kurz fragen, dann zuhören",
        saetze: [
          "Damit ich Ihnen richtig weiterhelfen kann: Geht es um Sie selbst oder um einen Angehörigen?",
          "Und welche Art von Unterstützung wäre gerade am wichtigsten?",
        ],
        hinweis:
          "Der wichtigste Schritt. Ausreden lassen, nicht unterbrechen. Antworten direkt in die Lead-Karte eintragen — Bereich, Pflegegrad, Situation.",
      },
      {
        titel: "Was die Pflegeunion bietet",
        saetze: [
          "Das Schöne bei uns ist: Sie bekommen alles aus einer Hand. Von Alltagshilfe und Grundpflege bis hin zur medizinischen Behandlungspflege. Wir begleiten Sie ganzheitlich und mit festen Bezugspersonen, damit Sie sich nicht um alles einzeln kümmern müssen.",
        ],
        hinweis:
          "Nur auf den genannten Bedarf eingehen, nicht das ganze Portfolio herunterbeten. Therapie und Hilfsmittel nur zusagen, wenn am Standort wirklich verfügbar.",
      },
      {
        titel: "Beruhigen — Finanzierung & Aufwand",
        saetze: [
          "Um die Organisation und die Kosten kümmern wir uns gemeinsam mit Ihnen — wir unterstützen auch beim Pflegegrad-Antrag und klären die Kostenübernahme mit der Kasse. Für Sie soll das so unkompliziert wie möglich sein.",
        ],
        hinweis: "Häufigste Sorge. Von sich aus ansprechen, bevor gefragt wird.",
      },
      {
        titel: "Nächster Schritt — das Ziel",
        saetze: [
          "Am besten machen wir ein kostenloses, unverbindliches Erstgespräch — telefonisch oder bei Ihnen zu Hause —, damit wir den Bedarf in Ruhe anschauen. Würde Ihnen [Tag/Zeit] passen?",
        ],
        hinweis:
          "Konkreten Termin vorschlagen, nicht „melden Sie sich gern“. Zwei Optionen wirken besser als eine offene Frage.",
      },
      {
        titel: "Abschluss",
        saetze: [
          "Wunderbar, dann halte ich [Termin] fest. Sie erreichen mich jederzeit unter [Telefon]. Ich freue mich, dass wir Sie unterstützen dürfen.",
        ],
        hinweis: "Termin sofort in der Lead-Karte festhalten, sonst geht er verloren.",
      },
    ],
    einwaende: [
      {
        einwand: "Ich muss erst mit der Familie sprechen.",
        antwort:
          "Sehr gern gemeinsam — soll ich einen Termin vorschlagen, an dem Ihre Tochter oder Ihr Sohn dabei ist?",
      },
      {
        einwand: "Was kostet das?",
        antwort:
          "Vieles übernimmt die Pflege- oder Krankenkasse, gerade mit Pflegegrad. Im Erstgespräch schauen wir, was Ihnen zusteht — und helfen beim Antrag.",
      },
      {
        einwand: "Ich bin mir noch nicht sicher.",
        antwort:
          "Kein Problem, das Erstgespräch ist kostenlos und unverbindlich. Danach entscheiden Sie ganz in Ruhe.",
      },
      {
        einwand: "Wir haben schon jemanden.",
        antwort:
          "Verstehe. Falls Sie zusätzliche Leistungen brauchen — etwa Therapie oder Hilfsmittel —, sind wir gern da.",
      },
      {
        einwand: "Jetzt passt es gerade nicht.",
        antwort:
          "Selbstverständlich. Wann darf ich Sie noch einmal kurz erreichen — eher vormittags oder nachmittags?",
      },
    ],
  },
  {
    slug: "recare",
    titel: "Recare-Anfragen — Rückruf in der Klinik",
    zielgruppe: "Sozialdienst der anfragenden Klinik",
    quellen: ["Recare"],
    ton: "Kurz, verbindlich, schnell. Die Klinik wartet auf eine Zu- oder Absage.",
    ziel: "Verbindliche Rückmeldung: Aufnahme zusagen oder zeitnah absagen.",
    farbe: "violett",
    schritte: [
      {
        titel: "Einstieg mit Bezug zur Anfrage",
        saetze: [
          "Guten Tag, [Name] von der Pflegeunion. Sie hatten uns über Recare eine Anfrage geschickt — Anfrage [Kennung], Patient [Initialen]. Ich melde mich dazu zurück.",
        ],
        hinweis:
          "Kennung immer nennen, die Sozialdienste bearbeiten viele Anfragen parallel.",
      },
      {
        titel: "Bedarf klären",
        saetze: [
          "Damit ich das richtig einordne: Welche Leistungen werden gebraucht, und ab wann?",
          "Ist schon ein Entlassdatum absehbar?",
        ],
        hinweis:
          "Bereich (Alltagshilfe / Ambulant / Intensiv), Startdatum und Ort sind entscheidend für die Zuordnung zum Standort.",
      },
      {
        titel: "Rückmeldung geben",
        saetze: [
          "Wir können die Versorgung übernehmen — ich gebe das direkt an unsere Pflegedienstleitung in [Standort] weiter, sie meldet sich bei Ihnen.",
          "Leider können wir das in diesem Fall nicht übernehmen. Ich wollte Ihnen aber schnell Bescheid geben, damit Sie weiterplanen können.",
        ],
        hinweis:
          "Auch die Absage ist ein Ergebnis — zeitnah und ehrlich. Genau das unterscheidet uns von anderen Diensten.",
      },
      {
        titel: "Abschluss",
        saetze: [
          "Vielen Dank — und melden Sie sich gern jederzeit direkt bei uns, wenn Sie etwas Passendes haben.",
        ],
        hinweis:
          "Ergebnis sofort in der Lead-Karte festhalten, sonst bleibt die Anfrage offen stehen.",
      },
    ],
    einwaende: [
      {
        einwand: "Der Patient ist schon versorgt.",
        antwort:
          "Alles klar, danke für die Rückmeldung — dann schließe ich die Anfrage. Melden Sie sich gern beim nächsten Fall.",
      },
      {
        einwand: "Wir brauchen noch heute eine Zusage.",
        antwort:
          "Verstanden — ich kläre das sofort mit der Pflegedienstleitung und melde mich innerhalb von [Zeitfenster] zurück.",
      },
    ],
  },
];

export function skriptBySlug(slug: string): Skript | undefined {
  return SKRIPTE.find((s) => s.slug === slug);
}
