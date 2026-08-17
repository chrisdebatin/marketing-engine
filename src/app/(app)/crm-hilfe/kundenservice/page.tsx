import Link from "next/link";
import {
  AlertTriangle,
  ArrowLeft,
  CalendarCheck,
  Clock,
  Info,
  Lightbulb,
  Users,
} from "lucide-react";
import { PageHeader } from "@/components/page-header";
import {
  Bild,
  Fall,
  FallListe,
  Hinweis,
  Kapitel,
  Klick,
  Schritt,
  Schritte,
  Zwischentitel,
} from "@/components/handbuch";

export const metadata = {
  title: "Handbuch Kundenservice — CRM-Hilfe",
};

/**
 * Handbuch für Belinda & Adelina (Inbound-Leads). Inhaltlich deckungsgleich
 * mit src/lib/crm-wissen.ts — ändert sich der Prozess, beide nachziehen.
 */
export default function HandbuchKundenservicePage() {
  return (
    <div className="flex max-w-4xl flex-col gap-5">
      <Link
        href="/crm-hilfe"
        className="flex w-fit items-center gap-1.5 text-sm font-medium text-primary hover:underline"
      >
        <ArrowLeft className="size-4" />
        Zurück zur CRM-Hilfe
      </Link>

      <PageHeader
        icon={Users}
        eyebrow="Handbuch Kundenservice"
        title="Belinda & Adelina — Anfragen bearbeiten"
        description="Menschen melden sich bei uns: über Meta-Anzeigen, die Website, die 0800-Nummer oder die Lead-Agentur. Dein Job: annehmen, Daten vervollständigen, an den passenden Standort übergeben. Diese Seite kannst du ausdrucken."
      />

      {/* ---------------------------------------------------------------- */}
      <Kapitel
        nummer={1}
        titel="So sieht deine Seite aus"
        untertitel="Du hast einen eigenen Link. Kein Login, kein Passwort — Link öffnen, fertig."
      >
        <Bild
          src="/handbuch/ks-01-uebersicht.png"
          alt="Die Kundenservice-Seite mit den Reitern Anfragen, Anrufliste und Kontakte"
          caption="Oben dein Name, darunter die drei Reiter. Links das Formular für angenommene Anrufe, rechts deine Leads."
        />

        <Zwischentitel>Die drei Reiter oben</Zwischentitel>
        <ul className="flex flex-col gap-2 text-sm leading-relaxed">
          <li>
            <Klick>Anfragen</Klick> — hier arbeitest du fast immer. Die Zahl
            daneben sagt, wie viele Leads offen sind.
          </li>
          <li>
            <Klick>Anrufliste</Klick> — geplante Wiedervorlagen.
          </li>
          <li>
            <Klick>Kontakte</Klick> — das gemeinsame Verzeichnis. Wenn jemand
            anruft: hier suchen.
          </li>
        </ul>

        <Zwischentitel>Und darunter drei Listen</Zwischentitel>
        <ul className="flex flex-col gap-2 text-sm leading-relaxed">
          <li>
            <Klick>Offene Leads</Klick> — alles, was jetzt zu tun ist. Deine
            Arbeitsliste.
          </li>
          <li>
            <Klick>Hängt bei PDL</Klick> — schon übergeben, wartet auf
            Rückmeldung vom Standort.
          </li>
          <li>
            <Klick>Geschlossen</Klick> — erfolgreich aufgenommen.
          </li>
        </ul>
        <p className="text-sm leading-relaxed text-muted-foreground">
          Ganz unten auf der Seite gibt es noch den Bereich{" "}
          <strong className="text-foreground">Alte &amp; abgelehnte Leads</strong>{" "}
          zum Aufklappen — dort landen verlorene und von der KI vorsortierte
          Anrufe.
        </p>
      </Kapitel>

      {/* ---------------------------------------------------------------- */}
      <Kapitel
        nummer={2}
        titel="Dein Tagesablauf"
        untertitel="Morgens in dieser Reihenfolge — dann fällt nichts hinten runter."
      >
        <Schritte>
          <Schritt n={1} titel="Deinen Link öffnen">
            Der Reiter <Klick>Anfragen</Klick> und die Liste{" "}
            <Klick>Offene Leads</Klick> sind schon ausgewählt. Die Liste
            aktualisiert sich von allein.
          </Schritt>
          <Schritt n={2} titel="Von oben nach unten arbeiten">
            Neueste Leads stehen oben. Schau zuerst auf die Uhr-Anzeige oben
            rechts an jeder Karte: <strong>rot geht vor gelb geht vor grau</strong>.
          </Schritt>
          <Schritt n={3} titel="Lead übernehmen, bevor du anrufst">
            Auf <Klick>Übernehmen</Klick> klicken. Dein Name steht dann auf dem
            Lead — so ruft die Kollegin nicht dieselbe Person nochmal an.
          </Schritt>
          <Schritt n={4} titel="Anrufen und die 6 Schritte durchgehen">
            Siehe Kapitel 4. Nach jedem Gespräch den passenden Button klicken,
            damit der Stand stimmt.
          </Schritt>
          <Schritt n={5} titel="Zwischendurch die Anrufliste prüfen">
            Im Reiter <Klick>Anrufliste</Klick> stehen die Rückrufe, die du dir
            selbst gelegt hast.
          </Schritt>
          <Schritt n={6} titel="Anrufe, die du selbst annimmst, sofort eintragen">
            Links im Formular <strong>Inbound-Anruf loggen</strong> Name,
            Telefonnummer und Anliegen eintragen und auf{" "}
            <Klick>Als Lead anlegen</Klick> klicken. Der Anruf erscheint sofort
            als offener Lead.
          </Schritt>
        </Schritte>

        <Hinweis ton="gelb" icon={Clock} titel="Neue Leads haben immer Vorrang">
          Oben rechts auf jeder Karte läuft eine Uhr. Sie zeigt, wie lange die
          Person schon auf eine Antwort wartet:{" "}
          <strong>ab 15 Minuten wird sie gelb, ab 1 Stunde rot</strong>. Ein
          frischer Lead ist wichtiger als jede Routineaufgabe — wer schnell
          zurückruft, gewinnt den Kunden.
        </Hinweis>
      </Kapitel>

      {/* ---------------------------------------------------------------- */}
      <Kapitel
        nummer={3}
        titel="Die Lead-Karte lesen"
        untertitel="Alles, was du für ein Gespräch brauchst, steht auf einer Karte."
      >
        <Bild
          src="/handbuch/ks-02-leadkarte.png"
          alt="Eine einzelne Lead-Karte mit Kontaktdaten, Prozessschritten und Buttons"
          caption="Von oben nach unten: Name und Uhr · Kontaktdaten · zuständige PDL · das Anliegen · die 6 Schritte · die Buttons."
        />
        <ul className="flex flex-col gap-2 text-sm leading-relaxed">
          <li>
            <strong>Ganz oben:</strong> Name der Person, die Lead-Nummer, der
            Status und die Uhr.
          </li>
          <li>
            <strong>Darunter:</strong> woher der Lead kam (z. B. Lead-Agentur,
            meta, 0800-Anruf).
          </li>
          <li>
            <strong>Der weiße Kasten:</strong> Telefon, E-Mail, Adresse/Ort,
            Eingang. Das <strong>Stift-Symbol oben rechts</strong> in diesem
            Kasten ist der Weg, um Daten nachzutragen.
          </li>
          <li>
            <strong>Der blaue Streifen:</strong> welche PDL zuständig ist, mit
            Durchwahl.
          </li>
          <li>
            <strong>Der Fließtext:</strong> worum es geht. Mit{" "}
            <Klick>Notiz bearbeiten</Klick> ergänzt du, was du im Gespräch
            erfährst.
          </li>
          <li>
            <strong>Die Kette mit Zahlen:</strong> die 6 Prozess-Schritte. Grün
            = erledigt, blau = hier stehst du gerade.
          </li>
          <li>
            <strong>Nächster Schritt:</strong> in blau — genau das ist jetzt zu
            tun. Wenn du unsicher bist, lies diese Zeile.
          </li>
        </ul>
      </Kapitel>

      {/* ---------------------------------------------------------------- */}
      <Kapitel
        nummer={4}
        titel="Die 6 Schritte — und was du jeweils klickst"
        untertitel="Jeder Lead läuft diese Kette entlang. Du klickst nach dem Gespräch."
      >
        <Schritte>
          <Schritt n={1} titel="Eingegangen">
            Passiert automatisch, sobald der Lead reinkommt.{" "}
            <em>Du klickst nichts.</em>
          </Schritt>
          <Schritt n={2} titel="Kontaktiert">
            Du hast die Person am Telefon erreicht. Klicke{" "}
            <Klick>Kontaktiert</Klick>.
          </Schritt>
          <Schritt n={3} titel="Daten aufgenommen">
            Sobald <strong>Name UND Adresse/Ort</strong> eingetragen sind, geht
            dieser Schritt von allein auf grün. Fehlt etwas, erscheint an der
            Karte ein <strong>gelbes To-do</strong>. Dann oben im weißen
            Datenkasten auf das <strong>Stift-Symbol</strong> klicken und
            nachtragen.
          </Schritt>
          <Schritt n={4} titel="Interesse bestätigt">
            Die Person will die Versorgung wirklich. Klicke{" "}
            <Klick>Interesse bestätigt</Klick>.
          </Schritt>
          <Schritt n={5} titel="Übergeben">
            Unten den richtigen Standort auswählen und übergeben. Der Lead
            wandert in die Liste <Klick>Hängt bei PDL</Klick>.
          </Schritt>
          <Schritt n={6} titel="Aufgenommen">
            Die PDL bestätigt, dass sie versorgt.{" "}
            <em>Das macht die PDL, nicht du.</em> Der Lead landet in{" "}
            <Klick>Geschlossen</Klick>.
          </Schritt>
        </Schritte>

        <Hinweis
          ton="lila"
          icon={CalendarCheck}
          titel="Sonderfall Düsseldorf und Gevelsberg"
        >
          <p>
            Nur bei diesen beiden Standorten darfst du{" "}
            <strong>selbst einen Beratungstermin vereinbaren</strong>. Dort gibt
            es in der Kette einen Extra-Schritt{" "}
            <strong>„Beratungstermin vereinbart“</strong> und statt{" "}
            <Klick>Interesse bestätigt</Klick> heißt der Button{" "}
            <Klick>Interesse + Beratungstermin</Klick>.
          </p>
          <p className="mt-2">
            Nach dem Klick musst du <strong>zwei Häkchen</strong> setzen —
            bestätigen kannst du erst, wenn beide gesetzt sind:
          </p>
          <ol className="mt-1.5 ml-5 list-decimal space-y-1">
            <li>Termin im Beraterinnen-Kalender gebucht</li>
            <li>Neukunde in MediFox (DUS-Mandant) angelegt — mit der Lead-ID als Referenz</li>
          </ol>
          <p className="mt-2">
            Erst dann auf <Klick>Bestätigen</Klick>. Bei allen anderen
            Standorten gibt es diesen Schritt nicht.
          </p>
        </Hinweis>

        <Hinweis ton="gruen" icon={Info} titel="Recare-Anfragen laufen kürzer">
          Anfragen aus Kliniken kommen schon mit Patientendaten und haben nur 4
          Schritte: <strong>Eingegangen → PDL-Klärung → Übergeben →
          Aufgenommen</strong>. Diese Anfragen bearbeitet normalerweise Davina.
        </Hinweis>
      </Kapitel>

      {/* ---------------------------------------------------------------- */}
      <Kapitel
        nummer={5}
        titel="Was tun, wenn …"
        untertitel="Die Fälle, die im Alltag am häufigsten vorkommen."
      >
        <FallListe>
          <Fall frage="Niemand geht ans Telefon">
            Leg dir eine Wiedervorlage: <Klick>To-do mit Wiedervorlage</Klick>{" "}
            an der Karte. Der Lead taucht dann im Reiter{" "}
            <Klick>Anrufliste</Klick> wieder auf. Erst wenn mehrere Versuche
            nichts bringen, auf <Klick>Verloren</Klick> und als Grund{" "}
            <strong>„Nicht erreicht“</strong> wählen.
          </Fall>

          <Fall frage="Es fehlen Daten (kein Ort, keine Adresse)">
            An der Karte steht dann ein gelbes To-do. Im weißen Datenkasten oben
            auf das <strong>Stift-Symbol rechts</strong> klicken und Adresse
            bzw. Ort nachtragen. Der Schritt „Daten aufgenommen“ wird
            automatisch grün.
          </Fall>

          <Fall frage="Die Telefonnummer stimmt nicht oder fehlt ganz">
            <Klick>Verloren</Klick> klicken und als Grund{" "}
            <strong>„Kontaktdaten fehlen / falsch“</strong> wählen. Wichtig: Bei
            Leads von der Agentur ist genau dieser Grund die Grundlage unserer
            wöchentlichen Reklamation.
          </Fall>

          <Fall frage="Ich habe versehentlich den falschen Schritt geklickt">
            Kein Problem, nichts geht verloren. Rechts neben der Zeile{" "}
            <strong>„Nächster Schritt“</strong> steht ein Zurück-Button — je
            nach Stand heißt er <Klick>zurück auf Offen</Klick>,{" "}
            <Klick>zurück auf Kontaktiert</Klick> oder{" "}
            <Klick>Übergabe zurücknehmen</Klick>. Einmal klicken, der Lead geht
            einen Schritt zurück.
          </Fall>

          <Fall frage="Der Ort liegt nicht in unserem Einzugsbereich">
            Dafür gibt es einen eigenen Button:{" "}
            <Klick>Nicht im Einzugsbereich</Klick>. Bitte immer diesen benutzen
            und <strong>nicht</strong> „Verloren“ — bei Agentur-Leads ist das
            die Grundlage der Reklamation. Dafür zahlen wir nicht.
          </Fall>

          <Fall frage="Der Lead ist offensichtlich Spam oder ein Test">
            <Klick>Ungültig</Klick> klicken und den Grund wählen:{" "}
            <strong>Fake / Spam</strong>, <strong>Test / Doppelt</strong> oder{" "}
            <strong>Kein Anliegen</strong>.
          </Fall>

          <Fall frage="Ein Lead wurde zu Unrecht geschlossen">
            Ganz unten den Bereich{" "}
            <strong>Alte &amp; abgelehnte Leads</strong> aufklappen, den Lead
            suchen und auf <Klick>wieder öffnen</Klick> klicken. Er steht dann
            wieder in deiner offenen Liste.
          </Fall>

          <Fall frage="Ein Bestandskunde ruft an und will mehr Leistung">
            Das ist ein <strong>Neuinteressent</strong>, kein Bestandskunde —
            z. B. jemand, der zusätzlich Insulingabe braucht. Bitte ganz normal
            als Lead bearbeiten, das ist zusätzlicher Umsatz.
          </Fall>
        </FallListe>

        <Hinweis
          ton="rot"
          icon={AlertTriangle}
          titel="„Verloren“ braucht immer einen Grund"
        >
          Du kannst nur auswählen zwischen{" "}
          <strong>Nicht erreicht</strong>, <strong>Doch kein Interesse</strong>,{" "}
          <strong>Kontaktdaten fehlen / falsch</strong> oder einer eigenen
          Angabe im Freitext. Ohne Grund kein „Verloren“ — daraus entstehen
          unsere Auswertungen.
        </Hinweis>
      </Kapitel>

      {/* ---------------------------------------------------------------- */}
      <Kapitel
        nummer={6}
        titel="Der Reiter Kontakte"
        untertitel="Das gemeinsame Verzeichnis von Kundenservice und Call-Center."
      >
        <Bild
          src="/handbuch/ks-03-kontakte.png"
          alt="Die Kontakte-Übersicht mit Suchfeld und fünf Spalten"
          caption="Große Suche oben, darunter fünf Spalten. Jede Karte zeigt den letzten Stand zum Kontakt."
        />

        <Zwischentitel>Die fünf Spalten</Zwischentitel>
        <ul className="flex flex-col gap-1.5 text-sm leading-relaxed">
          <li>
            <strong>Heute in Kontakt</strong> — heute gesprochen, bearbeitet
            oder eingegangen
          </li>
          <li>
            <strong>Demnächst geplant</strong> — morgen bis in 7 Tagen dran
          </li>
          <li>
            <strong>Rückmeldung ausstehend</strong> — wartet auf PDL-Antwort
            oder ein To-do ist fällig
          </li>
          <li>
            <strong>Zuletzt in Kontakt</strong> — vergangene Kontakte, neueste
            zuerst
          </li>
          <li>
            <strong>Noch nie in Kontakt</strong> — noch kein Gespräch, nach
            Priorität sortiert
          </li>
        </ul>

        <Zwischentitel>So benutzt du die Kontakte</Zwischentitel>
        <Schritte>
          <Schritt n={1} titel="Suchen">
            Ins große Suchfeld oben tippen. Es findet Name, Ort, Telefonnummer
            und E-Mail.
          </Schritt>
          <Schritt n={2} titel="Karte öffnen">
            Auf den Namen oder auf <Klick>Öffnen</Klick> klicken. Es geht ein
            Fenster auf.
          </Schritt>
          <Schritt n={3} titel="Kontakt loggen">
            Im Reiter <Klick>Kontakt loggen</Klick> auswählen, was es war:
            Anruf, Persönlicher Besuch, Flyer ausgelegt oder CM-Box geliefert.
            Notiz dazu, speichern.
          </Schritt>
          <Schritt n={4} titel="Kontaktdaten korrigieren">
            Im Reiter <Klick>Kontaktdaten bearbeiten</Klick> lassen sich
            Telefon, E-Mail und Ansprechpartner ändern.
          </Schritt>
        </Schritte>
        <p className="text-sm leading-relaxed text-muted-foreground">
          Unter den beiden Reitern steht immer der bisherige Verlauf: wann, was
          und von wem. So siehst du sofort, ob eine Kollegin dort schon war.
        </p>
      </Kapitel>

      {/* ---------------------------------------------------------------- */}
      <Kapitel
        nummer={7}
        titel="Was die KI dir schon abnimmt"
        untertitel="Damit du weißt, warum manche Leads gar nicht erst auftauchen."
      >
        <ul className="flex flex-col gap-2 text-sm leading-relaxed">
          <li>
            <strong>Verpasste 0800-Anrufe:</strong> Die KI liest die Mail der
            Telefonanlage und sortiert vor. Nur echte Neuinteressenten werden zu
            offenen Leads.
          </li>
          <li>
            <strong>Aussortiert werden:</strong> Bestandskunden, interne Anrufe
            und anonyme Anrufe ohne Anliegen. Die stehen unter{" "}
            <strong>Alte &amp; abgelehnte Leads</strong> — falls doch mal etwas
            falsch einsortiert wurde, holst du es mit{" "}
            <Klick>wieder öffnen</Klick> zurück.
          </li>
          <li>
            <strong>Automatisch erkannt</strong> werden außerdem Recare-Mails,
            Website-Anfragen und Bewerbungen.
          </li>
        </ul>

        <Hinweis ton="blau" icon={Lightbulb} titel="Du hast eine Frage zur Bedienung?">
          Auf der Seite <strong>CRM-Hilfe</strong> kannst du in eigenen Worten
          fragen — die Antwort kommt aus genau dieser Anleitung.
        </Hinweis>
      </Kapitel>

      <Link
        href="/crm-hilfe"
        className="flex w-fit items-center gap-1.5 text-sm font-medium text-primary hover:underline"
      >
        <ArrowLeft className="size-4" />
        Zurück zur CRM-Hilfe
      </Link>
    </div>
  );
}
