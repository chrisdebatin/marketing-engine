# Planungsbasis: Standorte, Cluster, Marken (Stammdaten)

**Quelle Standortdaten:** `supabase/seed.sql` (24 Hubs, Name + verantwortliche MD) — belegt, nicht geschätzt.
**Stand:** 27.07.2026

## Die 24 Hubs = Standort × Leistungsmarke

| # | Hub | Cluster | Physischer Ort | Marke | Verantw. MD |
|---|-----|---------|----------------|-------|-------------|
| 1 | Düsseldorf | A | Düsseldorf | Ambulant | Marcel Müller |
| 2 | Alltagshilfe Düsseldorf | A | Düsseldorf | Alltagshilfe | Heiko Matamaru |
| 3 | Duisburg | A | Duisburg | Ambulant | Sebastian Fliegel |
| 4 | Alltagshilfe Duisburg | A | Duisburg | Alltagshilfe | Heiko Matamaru |
| 5 | Tagespflege Duisburg | A | Duisburg | Tagespflege | Sebastian Fliegel |
| 6 | Velbert | A | Velbert | Ambulant | Melanie Martens |
| 7 | Kerpen | A | Kerpen | Ambulant | Marcel Müller |
| 8 | Dorsten | B | Dorsten | Ambulant | Ben Etzrodt |
| 9 | Tagespflege Dorsten | B | Dorsten | Tagespflege | Ben Etzrodt |
| 10 | Alltagshilfe Dorsten | B | Dorsten | Alltagshilfe | Heiko Matamaru |
| 11 | Gevelsberg | B | Gevelsberg | Ambulant | Melanie Martens |
| 12 | Iserlohn | C | Iserlohn | Ambulant | Sebastian Fliegel |
| 13 | Alltagshilfe Iserlohn | C | Iserlohn | Alltagshilfe | Heiko Matamaru |
| 14 | Neuenrade | C | Neuenrade | Ambulant | Sebastian Fliegel |
| 15 | Alltagshilfe Neuenrade | C | Neuenrade | Alltagshilfe | Heiko Matamaru |
| 16 | Attendorn | C | Attendorn | Ambulant | Sebastian Fliegel |
| 17 | Hameln | D | Hameln | Ambulant | Ben Etzrodt |
| 18 | Hessisch-Oldendorf | D | Hessisch-Oldendorf | Ambulant | Ben Etzrodt |
| 19 | Rinteln | D | Rinteln | Ambulant | Ben Etzrodt |
| 20 | Bad Pyrmont | D | Bad Pyrmont | Ambulant | Ben Etzrodt |
| 21 | Bad Nenndorf | D | Bad Nenndorf | Ambulant | Ben Etzrodt |
| 22 | Bad Oeynhausen | D | Bad Oeynhausen | Ambulant | Ben Etzrodt |
| 23 | Alverdissen | D | Alverdissen (Barntrup/Lippe) | Ambulant | Ben Etzrodt |
| 24 | Pflegeunion Intensiv | — | überregional / mobil | Intensiv | Rachid Sabi |

## Physische Orte für die Mediaplanung (16 + Intensiv)

Werbung wird **pro Ort** geschaltet, nicht pro Hub — mehrere Marken teilen sich dieselben Printtitel.

- **Cluster A – Rheinschiene/Niederrhein:** Düsseldorf, Duisburg, Velbert, Kerpen
- **Cluster B – Ruhr/Emscher:** Dorsten, Gevelsberg
- **Cluster C – Märkisches Sauerland:** Iserlohn, Neuenrade, Attendorn *(Lüdenscheid siehe unten)*
- **Cluster D – Weserbergland/Schaumburg:** Hameln, Hessisch-Oldendorf, Rinteln, Bad Pyrmont, Bad Nenndorf, Bad Oeynhausen, Alverdissen
- **Pflegeunion Intensiv:** überregional (kein einzelner Ort)

## Mehrmarken-Orte = Dauerpräsenz-Kandidaten

Regel aus dem Auftrag: Standorte mit **Tagespflege** und **Intensivpflege** bekommen Dauerpräsenz (Auslastung hängt direkt).

| Ort | Marken am Ort | Anzahl | Dauerpräsenz? |
|-----|---------------|--------|---------------|
| **Duisburg** | Ambulant + Alltagshilfe + **Tagespflege** | 3 | **Ja** (Tagespflege) |
| **Dorsten** | Ambulant + Alltagshilfe + **Tagespflege** | 3 | **Ja** (Tagespflege) |
| **Pflegeunion Intensiv** | Intensiv (überregional) | 1 | **Ja** (Intensiv) |
| Düsseldorf | Ambulant + Alltagshilfe | 2 | Welle (hoch priorisiert) |
| Iserlohn | Ambulant + Alltagshilfe | 2 | Welle |
| Neuenrade | Ambulant + Alltagshilfe | 2 | Welle |
| übrige 10 Orte | Ambulant | 1 | Welle |

## Offene Klärpunkte (zu verifizieren)

1. **Lüdenscheid** steht in der Cluster-Vorgabe (C), hat aber **keinen Hub** in `seed.sql`. → Ist dort ein Standort? Wenn nein, aus dem Mediaplan streichen.
2. **Pflegeunion Intensiv**: Einzugsgebiet/Bundesland für die überregionale Belegung klären (bestimmt, welche Titel/Umfelder sinnvoll sind — z. B. Fachumfeld statt Lokalteil).
3. **Entlastungsbetrag §45b** in den Anzeigentexten mit **131 €/Monat** (Stand 2026) angesetzt — vor Schaltung final bestätigen.
4. **Absender/Impressum & lokale Rufnummern/Kennwörter** je Titel für das Lead-Tracking — von dir zu liefern (Platzhalter `[TEL]`).
