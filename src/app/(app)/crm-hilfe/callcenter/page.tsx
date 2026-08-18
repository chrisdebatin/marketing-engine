import Link from "next/link";
import {
  ArrowLeft,
  ClipboardList,
  Heart,
  Info,
  Lightbulb,
  Phone,
  Sparkles,
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
  title: "Handbuch Call-Center — CRM-Hilfe",
};

/**
 * Handbuch für Devina (Recare-Anfragen + Outbound-Anrufe). Inhaltlich
 * deckungsgleich mit src/lib/crm-wissen.ts — ändert sich der Prozess,
 * beide nachziehen.
 */
export default function HandbuchCallcenterPage() {
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
        icon={Phone}
        eyebrow="Handbuch Call-Center"
        title="Devina — Recare und Anrufe"
        description="Du hast zwei Aufgaben: Anfragen bearbeiten — von Kliniken (Recare), aus Meta-Anzeigen und von der Lead-Agentur — und Krankenhäuser, Praxen und Apotheken anrufen, damit die Pflegeunion bekannt wird und Zuweisungen kommen. Diese Seite kannst du ausdrucken."
      />

      {/* ---------------------------------------------------------------- */}
      <Kapitel
        nummer={1}
        titel="So sieht deine Seite aus"
        untertitel="Du hast einen eigenen Link. Kein Login, kein Passwort — Link öffnen, fertig."
      >
        <Bild
          src="/handbuch/cc-01-uebersicht.png"
          alt="Die Call-Center-Seite mit den Reitern Anfragen, Anrufliste und Kontakte"
          caption="Oben dein Name, darunter die drei Reiter. Im Reiter „Anfragen“ stehen die Recare-Anfragen der Kliniken."
        />

        <Zwischentitel>Die drei Reiter oben</Zwischentitel>
        <ul className="flex flex-col gap-2 text-sm leading-relaxed">
          <li>
            <Klick>Anfragen</Klick> — die Recare-Anfragen aus den Kliniken.
          </li>
          <li>
            <Klick>Anrufliste</Klick> — deine Outbound-Anrufe. Die Zahl daneben
            (z. B. „220 fällig“) sagt, wie viele Anrufe heute dran sind.
          </li>
          <li>
            <Klick>Kontakte</Klick> — das gemeinsame Verzeichnis mit dem
            Kundenservice.
          </li>
        </ul>
      </Kapitel>

      {/* ---------------------------------------------------------------- */}
      <Kapitel
        nummer={2}
        titel="Dein Tagesablauf"
        untertitel="Recare zuerst, danach telefonieren."
      >
        <Schritte>
          <Schritt n={1} titel="Deinen Link öffnen und auf Anfragen schauen">
            Recare-Anfragen kommen automatisch per Mail von den Kliniken rein.
            Sie haben Vorrang — dort wartet ein Patient auf eine Zusage.
          </Schritt>
          <Schritt n={2} titel="Auf die Uhr achten">
            Oben rechts an jeder Karte läuft eine Uhr. Sie zeigt, wie lange die
            Anfrage unbeantwortet ist:{" "}
            <strong>ab 15 Minuten gelb, ab 1 Stunde rot</strong>. Rot zuerst.
          </Schritt>
          <Schritt n={3} titel="Anfrage übernehmen">
            <Klick>Übernehmen</Klick> klicken, damit dein Name draufsteht und
            niemand doppelt anruft.
          </Schritt>
          <Schritt n={4} titel="Recare abarbeiten">
            PDL anrufen, Kapazität klären, übergeben — siehe Kapitel 3.
          </Schritt>
          <Schritt n={5} titel="Danach in die Anrufliste wechseln">
            Reiter <Klick>Anrufliste</Klick>, Unter-Reiter{" "}
            <Klick>Wiedervorlagen</Klick>. Von oben nach unten abtelefonieren —
            siehe Kapitel 4.
          </Schritt>
          <Schritt n={6} titel="Jeden Anruf sofort loggen">
            Auch wenn niemand rangeht. Sonst weiß morgen niemand, dass du es
            versucht hast.
          </Schritt>
        </Schritte>
      </Kapitel>

      {/* ---------------------------------------------------------------- */}
      <Kapitel
        nummer={3}
        titel="Recare-Anfragen abarbeiten"
        untertitel="Eine Klinik sucht einen Pflegedienst für einen Patienten. Du klärst, ob wir das können."
      >
        <Bild
          src="/handbuch/cc-03-recare.png"
          alt="Eine Recare-Karte mit dem Kasten „unsere Beziehung“ und den Buttons"
          caption="Die Recare-Karte: Kontaktdaten, zuständige PDL, der Kasten „unsere Beziehung“, das Anliegen, die 4 Schritte, die Buttons."
        />

        <Hinweis ton="gruen" icon={Heart} titel="Der Kasten „unsere Beziehung“">
          <p>
            Auf jeder Recare-Karte steht ein blauer Kasten mit dem Titel{" "}
            <strong>„… — unsere Beziehung“</strong>. Er zeigt dir in drei
            Angaben, wie gut wir diese Klinik schon kennen:
          </p>
          <ul className="mt-2 ml-5 list-disc space-y-1">
            <li>
              <strong>Vor Ort:</strong> ob eine PDL dort schon war
            </li>
            <li>
              <strong>Angerufen:</strong> ob wir dort schon angerufen haben
            </li>
            <li>
              <strong>Patienten von dort:</strong> wie viele Patienten schon von
              dieser Klinik kamen
            </li>
          </ul>
          <p className="mt-2">
            Lies das <strong>vor</strong> dem Anruf — steht dort „erste Anfrage
            dieser Klinik“, ist das ein guter Anlass, sich freundlich
            vorzustellen.
          </p>
        </Hinweis>

        <Zwischentitel>Der Ablauf in vier Schritten</Zwischentitel>
        <Schritte>
          <Schritt n={1} titel="Eingegangen">
            Die Anfrage kommt automatisch aus der Klinik-Mail — mit
            Patientendaten. <em>Du klickst nichts.</em>
          </Schritt>
          <Schritt n={2} titel="PDL-Klärung">
            Im blauen Streifen steht der zuständige Standort mit Name und
            Nummer der PDL. <strong>Diese PDL rufst du an</strong> und fragst,
            ob Kapazität da ist.
          </Schritt>
          <Schritt n={3} titel="Übergeben">
            Sagt die PDL zu: unten bei{" "}
            <strong>„An Standort übergeben“</strong> den Standort auswählen
            (meistens steht der richtige schon als Vorschlag da) und auf{" "}
            <Klick>Übergeben + PDL informieren</Klick> klicken. Die PDL bekommt
            dann Bescheid.
          </Schritt>
          <Schritt n={4} titel="Aufgenommen">
            Die PDL bestätigt, dass sie versorgt. <em>Das macht die PDL.</em>
          </Schritt>
        </Schritte>

        <Zwischentitel>Wenn es nicht glatt läuft</Zwischentitel>
        <FallListe>
          <Fall frage="Die PDL geht nicht ans Telefon">
            Klicke <Klick>PDL nicht erreicht</Klick>. Zusätzlich kannst du im{" "}
            <strong>⋮-Menü oben rechts</strong> an der Karte jeden einzelnen
            Anrufversuch vermerken. Daraus entsteht das
            Erreichbarkeits-Ranking der PDLs — bitte wirklich jeden Versuch
            eintragen.
          </Fall>
          <Fall frage="Die PDL hat keine Kapazität">
            Klicke <Klick>Keine Kapazität</Klick>.
          </Fall>
          <Fall frage="Die PDL lehnt den Patienten ab">
            Im <strong>⋮-Menü oben rechts</strong> gibt es{" "}
            <Klick>Pat. abgelehnt</Klick>.
          </Fall>
          <Fall frage="Die Klinik liegt außerhalb unseres Gebiets">
            Klicke <Klick>Nicht im Einzugsbereich</Klick>.
          </Fall>
          <Fall frage="Ich habe versehentlich abgelehnt">
            Ganz unten den Bereich{" "}
            <strong>Abgelehnte Recare-Anfragen</strong> aufklappen und auf{" "}
            <Klick>wieder öffnen</Klick> klicken.
          </Fall>
        </FallListe>
      </Kapitel>

      {/* ---------------------------------------------------------------- */}
      <Kapitel
        nummer={4}
        titel="Die Anrufliste — dein Telefontag"
        untertitel="Der Unter-Reiter „Wiedervorlagen“ IST die Anrufliste. Mehr musst du dir nicht merken."
      >
        <Bild
          src="/handbuch/cc-02-anrufliste.png"
          alt="Die Anrufliste mit dem Unter-Reiter Wiedervorlagen, dem Abschnitt „Heute dran“ und dem Gesprächsleitfaden rechts"
          caption="So sieht die Anrufliste aus: links die fälligen Kontakte unter „Heute dran“, rechts der Gesprächsleitfaden zum Aufklappen."
        />

        <Schritte>
          <Schritt n={1} titel="Reiter Anrufliste öffnen">
            Dort gibt es zwei Unter-Reiter: <Klick>Wiedervorlagen</Klick> (deine
            Arbeitsliste) und <Klick>Erledigt</Klick> (was du heute schon
            geschafft hast).
          </Schritt>
          <Schritt n={2} titel="Bei „Heute dran“ anfangen">
            Ganz oben steht der Abschnitt <strong>Heute dran</strong>, überfällige
            Kontakte stehen darin ganz oben. Darunter kommen die nächsten Tage.
          </Schritt>
          <Schritt n={3} titel="Von oben nach unten abtelefonieren">
            Nicht springen, nicht aussuchen. Die Reihenfolge ist schon die
            richtige.
          </Schritt>
          <Schritt n={4} titel="Vor dem Anruf die Karte lesen">
            Auf jeder Anrufkarte steht, ob eine PDL dort schon{" "}
            <strong>Flyer</strong> oder eine <strong>CM-Box</strong> abgegeben
            hat. Das ist ein guter Gesprächseinstieg: „Meine Kollegin war bei
            Ihnen und hat Flyer dagelassen …“
          </Schritt>
          <Schritt n={5} titel="Anrufen und loggen">
            Siehe Kapitel 5. Steht ganz unten{" "}
            <strong>„Alles abtelefoniert“</strong>, bist du für heute durch.
          </Schritt>
        </Schritte>
      </Kapitel>

      {/* ---------------------------------------------------------------- */}
      <Kapitel
        nummer={5}
        titel="Einen Anruf loggen"
        untertitel="Nach jedem Anruf — auch wenn niemand rangegangen ist."
      >
        <Schritte>
          <Schritt n={1} titel="Auf „Anruf loggen“ klicken">
            Es öffnet sich ein Fenster mit zwei großen Kacheln.
          </Schritt>
          <Schritt n={2} titel="Erreicht: ja oder nein? (Pflicht)">
            Links <Klick>Ja, gesprochen</Klick> oder{" "}
            <Klick>Nicht erreicht</Klick> anklicken. Erst danach kannst du
            speichern — der Button heißt sonst „Erst ‚Erreicht?‘ beantworten“.
          </Schritt>
          <Schritt n={3} titel="Ansprechpartner eintragen">
            Mit wem hast du gesprochen? Zum Beispiel „Frau Meier, Sozialdienst“.
          </Schritt>
          <Schritt n={4} titel="Notiz schreiben">
            Was wurde besprochen? Schreib ganz normal, wie du sprichst — siehe
            den Kasten unten.
          </Schritt>
          <Schritt n={5} titel="Speichern">
            Der Button unten heißt <strong>Speichern (als Devina)</strong>.
          </Schritt>
        </Schritte>

        <Hinweis
          ton="gelb"
          icon={Phone}
          titel="Nicht erreicht? Dann kommt der Kontakt morgen von allein wieder"
        >
          Wenn du <strong>Nicht erreicht</strong> wählst, steht der Kontakt
          morgen automatisch wieder auf deiner Liste. Du musst dir nichts
          notieren und nichts selbst planen.
        </Hinweis>

        <Hinweis
          ton="lila"
          icon={Sparkles}
          titel="Was die KI aus deiner Notiz macht"
        >
          <p>
            Die Notiz wird mitgelesen. Schreib einfach in normalen Sätzen, was
            besprochen wurde:
          </p>
          <ul className="mt-2 ml-5 list-disc space-y-1">
            <li>
              „<strong>in 2 Wochen nochmal anrufen</strong>“ → wird automatisch
              zum Wiedervorlage-Datum. Du musst kein Datum eintippen.
            </li>
            <li>
              „<strong>Flyer schicken</strong>“ → wird automatisch zu einem
              To-do.
            </li>
          </ul>
          <p className="mt-2">
            Wenn du doch ein festes Datum willst, gibt es darunter das Feld{" "}
            <strong>„Wiedervorlage am“</strong>. Lässt du es leer, entscheidet
            die Notiz.
          </p>
        </Hinweis>

        <Hinweis
          ton="blau"
          icon={ClipboardList}
          titel="Der Dialog „Auftrag an PDL rausgeben?“"
        >
          <p>
            Hast du im Gespräch etwas <strong>vor Ort</strong> zugesagt — zum
            Beispiel „wir bringen Flyer vorbei“ — erkennt die KI das und fragt
            nach dem Speichern:{" "}
            <strong>„Auftrag an PDL rausgeben?“</strong>
          </p>
          <ol className="mt-2 ml-5 list-decimal space-y-1">
            <li>
              Im Feld <strong>„Was soll die PDL tun?“</strong> steht meist schon
              der richtige Text — bei Bedarf ändern.
            </li>
            <li>
              Auf <Klick>Auftrag rausgeben</Klick> klicken.
            </li>
          </ol>
          <p className="mt-2">
            Die PDL sieht den Auftrag danach{" "}
            <strong>samt deinem Anrufprotokoll</strong> auf ihrer
            Standort-Seite. Du musst niemanden extra informieren. Passt es
            nicht, klickst du einfach <Klick>Abbrechen</Klick> — der Anruf ist
            trotzdem gespeichert.
          </p>
        </Hinweis>
      </Kapitel>

      {/* ---------------------------------------------------------------- */}
      <Kapitel
        nummer={6}
        titel="Der Gesprächsleitfaden"
        untertitel="Rechts neben der Anrufliste — mit dem Wortlaut zum Ablesen."
      >
        <p className="text-sm leading-relaxed">
          Du musst nichts auswendig lernen. Rechts steht der{" "}
          <strong>Gesprächsleitfaden</strong> mit 7 Schritten.{" "}
          <strong>Tippe einen Schritt an, dann klappt er auf</strong> und du
          siehst den genauen Wortlaut, den du vorlesen kannst.
        </p>

        <Zwischentitel>Die 7 Schritte im Überblick</Zwischentitel>
        <ol className="flex flex-col gap-1.5 text-sm leading-relaxed">
          {[
            "Begrüßung & richtige Stelle",
            "Kennen Sie uns schon?",
            "Grund des Anrufs",
            "Was uns auszeichnet",
            "Ziel: nächster Schritt",
            "Neutralität anerkennen",
            "Abschluss",
          ].map((titel, i) => (
            <li key={titel} className="flex items-center gap-2.5">
              <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-[12px] font-bold text-primary tabular-nums">
                {i + 1}
              </span>
              <span className="font-medium">{titel}</span>
            </li>
          ))}
        </ol>

        <Hinweis ton="blau" icon={Info} titel="Der genaue Wortlaut steht im CRM">
          Er wird gelegentlich angepasst. Deshalb steht er nicht in diesem
          Handbuch — lies ihn immer direkt im aufgeklappten Schritt neben der
          Anrufliste ab, dann ist er garantiert aktuell.
        </Hinweis>
      </Kapitel>

      {/* ---------------------------------------------------------------- */}
      <Kapitel
        nummer={7}
        titel="Der Reiter Kontakte"
        untertitel="Das gemeinsame Verzeichnis — hier findest du zu jeder Institution den letzten Stand."
      >
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

        <Zwischentitel>So benutzt du sie</Zwischentitel>
        <Schritte>
          <Schritt n={1} titel="Suchen">
            Das große Suchfeld oben findet Name, Ort, Telefonnummer und E-Mail.
            Wenn dich jemand zurückruft: hier nachsehen, was zuletzt war.
          </Schritt>
          <Schritt n={2} titel="Karte öffnen">
            Auf den Namen oder auf <Klick>Öffnen</Klick> klicken.
          </Schritt>
          <Schritt n={3} titel="Kontakt loggen">
            Im Reiter <Klick>Kontakt loggen</Klick> auswählen, was es war:
            Anruf, Persönlicher Besuch, Flyer ausgelegt oder CM-Box geliefert.
          </Schritt>
          <Schritt n={4} titel="Kontaktdaten pflegen">
            Im Reiter <Klick>Kontaktdaten bearbeiten</Klick> Telefon, E-Mail und
            Ansprechpartner korrigieren. Falsche Nummern kosten dich morgen
            Zeit — gleich richtigstellen.
          </Schritt>
        </Schritte>
        <p className="text-sm leading-relaxed text-muted-foreground">
          Unter den Reitern steht der bisherige Verlauf: wann, was und von wem.
        </p>

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
