/**
 * Wissensbasis für die CRM-Hilfe: Diese Beschreibung bekommt Claude als
 * Kontext, damit Fragen wie "Was mache ich, wenn niemand rangeht?" aus dem
 * tatsächlichen Prozess beantwortet werden — nicht aus Allgemeinwissen.
 *
 * Beim Ändern von Abläufen im CRM bitte auch hier nachziehen, sonst
 * antwortet die Hilfe veraltet.
 */
export const CRM_WISSEN = `
# Das CRM der Pflegeunion — Funktionsweise

## Zwei Teams, zwei Aufgaben
- **Belinda & Adelina (Kundenservice)**: bearbeiten INBOUND-Leads —
  Menschen, die sich bei uns melden (Meta-Anzeigen, Website, 0800-Anrufe,
  Lead-Agentur "Pflegehilfe Direkt"). Ziel: Interessent aufnehmen, Daten
  vervollständigen, an den passenden Standort (PDL) übergeben.
- **Davina (Call-Center)**: bearbeitet Recare-Anfragen von Kliniken und
  macht OUTBOUND-Anrufe bei Krankenhäusern, Praxen, Apotheken, um die
  Pflegeunion bekannt zu machen und Zuweisungen zu bekommen.
- Jede Person hat einen eigenen Link, kein Login und kein Passwort.
- Die Kontakte-Übersicht ist bei allen gleich — dort findet man zu jeder
  Institution den letzten Stand.

## Der Lead-Prozess (Inbound, 6 Schritte)
1. **Eingegangen** — Lead kommt automatisch rein.
2. **Kontaktiert** — jemand hat den Interessenten erreicht.
3. **Daten aufgenommen** — Name UND Adresse/Ort sind erfasst. Fehlt etwas,
   erscheint ein gelbes To-do an der Karte. Nachtragen über das
   Stift-Symbol oben rechts im Datenblock.
4. **Interesse bestätigt** — die Person will die Versorgung wirklich.
5. **Übergeben** — Lead ist an einen Standort/PDL gegangen.
6. **Aufgenommen** — die PDL hat bestätigt, dass versorgt wird.

Sonderfall: Nur bei **Düsseldorf und Gevelsberg** darf das Callcenter
selbst Beratungstermine vereinbaren. Dort gibt es einen zusätzlichen
Schritt "Beratungstermin vereinbart", und vor dem Klick müssen zwei
Häkchen gesetzt werden (Termin im Kalender + Neukunde in MediFox).

Recare-Leads laufen verkürzt: Eingegangen → PDL-Klärung → Übergeben →
Aufgenommen. Sie kommen schon mit Patientendaten von der Klinik.

## Wichtige Regeln
- **Timer oben rechts**: zeigt, wie lange ein Lead unbeantwortet ist. Ab
  15 Minuten wird er gelb, ab 1 Stunde rot. Neue Leads haben Vorrang vor
  Routineaufgaben.
- **Übernehmen** setzt den eigenen Namen auf den Lead, damit niemand
  doppelt anruft.
- **Schritt versehentlich geklickt?** Rechts neben "Nächster Schritt"
  steht ein Zurück-Button ("zurück auf Offen", "Übergabe zurücknehmen").
- **Verloren** braucht immer einen Grund: Nicht erreicht, Doch kein
  Interesse, Kontaktdaten fehlen/falsch, oder Freitext.
- **Nicht im Einzugsbereich** ist ein eigener Button. Bei Agentur-Leads
  ist das die Grundlage der wöchentlichen Reklamation — dafür zahlen wir
  nicht.

## Outbound-Anrufe (Davina)
- Der Reiter **Wiedervorlagen IST die Anrufliste**: oben "Heute dran",
  darunter die kommenden Tage. Von oben nach unten abtelefonieren.
- Beim Loggen: "Erreicht?" ja/nein ist Pflicht. **Nicht erreicht** →
  der Kontakt steht morgen automatisch wieder auf der Liste.
- Die Notiz wird von der KI gelesen: "in 2 Wochen nochmal anrufen" wird
  automatisch zum Wiedervorlage-Datum, Aufgaben werden zu To-dos.
- Sagt man im Gespräch etwas vor Ort zu ("Flyer vorbeibringen"), erkennt
  die KI das und fragt: **"Auftrag an PDL rausgeben?"** Nach Bestätigung
  sieht die PDL den Auftrag samt Anrufprotokoll auf ihrer Standort-Seite.
- Der **Gesprächsleitfaden** rechts hat 7 Schritte mit dem genauen
  Wortlaut zum Ablesen — Schritt antippen zum Aufklappen.
- Auf jeder Anrufkarte steht, ob eine PDL dort schon Flyer oder eine
  CM-Box abgegeben hat. Das ist ein guter Gesprächseinstieg.

## Recare (Davina)
- Anfragen von Kliniken kommen automatisch per Mail rein.
- Auf der Karte steht ein Kasten "unsere Beziehung": ob wir dort schon
  waren, ob wir schon angerufen haben, wie viele Patienten von dort kamen.
- Ablauf: PDL des passenden Standorts anrufen, Kapazität klären, dann
  "Übergeben + PDL informieren".
- Antwortet die PDL nicht: Button "PDL nicht erreicht". Im ⋮-Menü oben
  rechts lässt sich zusätzlich jeder Anrufversuch vermerken — daraus
  entsteht das Erreichbarkeits-Ranking der PDLs.
- Passt die Anfrage nicht: "Keine Kapazität", "Pat. abgelehnt" (im
  ⋮-Menü) oder "Nicht im Einzugsbereich".

## Kontakte (beide Teams)
- Kanban mit Spalten: heute in Kontakt, demnächst geplant, Rückmeldung
  ausstehend, zuletzt in Kontakt, noch nie in Kontakt.
- Große Suche oben findet Name, Ort, Telefon, E-Mail.
- Karte anklicken (auf den Namen oder "Öffnen") öffnet ein Fenster mit
  zwei Reitern: **Kontakt loggen** (Anruf/Besuch/Flyer/Box mit Notiz) und
  **Kontaktdaten bearbeiten** (Telefon, E-Mail, Ansprechpartner).
  Darunter steht der bisherige Verlauf: wann, was, von wem.

## Was die KI automatisch macht
- Verpasste 0800-Anrufe: liest die Mail der Telefonanlage und sortiert
  vor. Nur echte Neuinteressenten werden zu offenen Leads. Bestandskunden,
  interne Anrufe und anonyme Anrufe ohne Anliegen werden geschlossen und
  stehen unter "Alte & abgelehnte Leads".
- Wichtig: Will ein Bestandskunde MEHR Leistung (z. B. zusätzlich
  Insulingabe), ist das ein Neuinteressent — das ist zusätzlicher Umsatz.
- Recare-Mails, Website-Anfragen und Bewerbungen werden ebenfalls
  automatisch erkannt und einsortiert.

## Über uns — was wir Anrufern sagen
Die Pflegeunion ist ein ambulanter Pflegedienst mit 25 Standorten. Unser
Argument gegenüber Kliniken und Kunden ist das breite Leistungsspektrum
aus einer Hand: Alltagshilfe, Grund- und Behandlungspflege, Intensivpflege,
dazu Physiotherapie, Ergotherapie, Logopädie und Pflegehilfsmittel.
Dazu: kurzfristige Aufnahmen möglich, verlässliche Rückmeldung.
Der vollständige Wortlaut steht im Gesprächsleitfaden in der Anrufliste
(7 Schritte, zum Aufklappen).

## Standorte und Ansprechpartner
Alle Standorte mit PDL-Name, Telefonnummer und E-Mail stehen unter
"PDL-Verzeichnis" in der Seitenleiste. Die Liste kommt direkt aus dem
System und ist damit immer aktuell — es gibt bewusst keine verteilte
Datei, die veralten könnte. Fehlt eine Nummer, kann sie unter "Hubs"
ergänzt werden.

## Welche Leistungsbereiche gibt es?
Beim Erfassen eines Leads wird der Bereich gewählt:
- **Alltagshilfe** — Hauswirtschaft, Betreuung, Entlastungsleistungen
- **Ambulant** — Grund- und Behandlungspflege zuhause
- **Intensiv** — Intensivpflege, Beatmung
Ist nichts davon eindeutig, bleibt es bei "Pflege (allgemein)".

## Kapazitäten der Standorte
Die Standorte melden wöchentlich, wie viele Plätze frei sind (Seite
"Kapazität"). Wichtig: Die Meldungen sind aktuell sehr lückenhaft — verlass
dich nicht allein darauf. Im Zweifel bei der PDL anrufen und direkt fragen.

## Wo finde ich was?
- **Anstehende Leads**: alles, was jetzt zu tun ist.
- **Hängt bei PDL**: übergeben, wartet auf Rückmeldung des Standorts.
- **Geschlossen**: erfolgreich aufgenommen.
- **Alte & abgelehnte Leads** (unten): verlorene und vorsortierte Anrufe.
  Von dort kann man einen Lead per "wieder öffnen" zurückholen.
`.trim();
