# Mitarbeiter-App — Betrieb, Sicherheit, Ausblick

Interne App für ~650 Mitarbeitende an 19 Hubs. Vier Dinge, mehr nicht:
**Anmelden ohne E-Mail · Meldungen lesen · Kunden empfehlen · Pflegedienste (M&A) empfehlen.**

- Mitarbeitende: `/mitarbeiter` (mobil, eigene Shell)
- Verwaltung: `/mitarbeiter-app` (im bestehenden Marketing-Engine-Shell)

---

## 1. Inbetriebnahme (Reihenfolge einhalten)

### 1.1 Migrationen einspielen
Im Supabase-SQL-Editor, in dieser Reihenfolge:

1. `supabase/migrations/0063_employee_app.sql` — Schema, Tabellen, Indizes, Trigger
2. `supabase/migrations/0064_employee_app_rls.sql` — RLS + Grants

### 1.2 Schema freigeben — **ohne diesen Schritt läuft nichts**
**Settings → API → Exposed schemas** um `employee_app` ergänzen und speichern.

PostgREST lehnt ein nicht freigegebenes Schema mit `406 / PGRST106` ab —
**auch für den Service-Role-Key**. Das ist keine Rechtefrage, sondern eine
Routing-Frage: die Anfrage erreicht die Datenbank gar nicht erst.
Fehlt der Schritt, zeigt `/mitarbeiter-app` einen Hinweis statt einer kaputten Seite.

### 1.3 Umgebungsvariablen setzen
Zwei neue, server-seitige Werte (siehe `.env.example`). Je mindestens 16 Zeichen,
in Vercel unter Project → Settings → Environment Variables:

```
EMPLOYEE_CODE_PEPPER=<32 zufällige Bytes>
EMPLOYEE_SESSION_PEPPER=<32 zufällige Bytes>
```

Erzeugen: `node -e "console.log(require('crypto').randomBytes(32).toString('base64url'))"`

> **Diese Werte niemals ändern, solange Zugänge aktiv sind.** Der Code-Pepper
> geht in den Hash der Aktivierungscodes ein, der Session-Pepper in Geräte- und
> Session-Tokens. Ein Wechsel entwertet schlagartig alle Codes, alle Geräte und
> alle Sitzungen — alle 650 Mitarbeitenden müssten neu aktiviert werden.

### 1.4 Mitarbeitende anlegen und Codes ausgeben
Unter `/mitarbeiter-app` → *Mitarbeitende & Zugänge*: anlegen, Hub zuordnen,
**Code erzeugen**. Der Code erscheint **genau einmal** im Klartext — danach
existiert nur noch sein HMAC. Weitergabe über die Hubleitung.

---

## 2. Wie die Anmeldung funktioniert (und warum so)

Mitarbeitende haben keine dienstliche E-Mail, kein Diensthandy, keine SMS.
Klassische Verfahren scheiden damit aus.

```
Aktivierungscode  ──► bindet ein GERÄT (32-Byte-Secret, nur als Hash gespeichert)
       │                        │
       └── einmalig             └── PIN entsperrt NUR dieses Gerät
```

**Der entscheidende Punkt:** Eine 6-stellige PIN hat rechnerisch 10⁶, praktisch
eher ~10⁴ Möglichkeiten (Geburtsdaten, Wiederholungen, Folgen). Als *globales*
Passwort wäre sie über 650 Konten hinweg in Stunden zu brechen.

Deshalb ist die PIN **kein Anmeldemerkmal, sondern eine lokale Entsperrung**:
Die Identität steckt im Geräte-Secret. Es gibt **keinen Endpunkt, der
(Mitarbeiter-Kennung + PIN) entgegennimmt** — ein Angreifer kann von außen also
gar nicht benennen, gegen welches Konto er raten will. Wer die PIN angreifen
will, braucht das entsperrte Telefon in der Hand; dort greift die Sperre nach
5 Fehlversuchen (5 min → 1 h → 24 h).

**Wiederherstellung** (PIN vergessen, Handy neu) läuft ausschließlich über einen
**neuen Code der Hubleitung**. Ein Self-Service-Reset über eine Kennung würde
exakt die Lücke wieder aufreißen, die die Gerätebindung schließt.

### Gespeichert wird
| Wert | Form | Warum |
|---|---|---|
| Aktivierungscode | `HMAC-SHA256(pepper, code)` | deterministisch → per Index auffindbar; ein DB-Dump allein ist ohne Pepper wertlos |
| PIN | `scrypt` (N=16384, r=8, p=1) + Salt je Gerät | langsam gegen Offline-Angriffe; eigenes Salt, damit gleiche PINs nicht als gleiche Hashes auffallen |
| Geräte-Secret, Session-Token | `HMAC-SHA256(pepper, token)` | 256 Bit Zufall, nicht ratbar; im Klartext nur im httpOnly-Cookie |
| IP-Adressen | HMAC, gekürzt | personenbezogen (DSGVO) — nie im Klartext |

Klartext von Codes, PINs und Tokens wird **nirgends protokolliert**.

---

## 3. Wo die Autorisierung sitzt

**Im Server-Code — und nur dort.** Das ist keine Stilfrage, sondern folgt aus
der Lage: Die Routen arbeiten mit dem Service-Role-Client, der `BYPASSRLS` hat.
Die Datenbank prüft für ihn **keine** Zeilenrechte.

> **Eiserne Regel:** `staff_id` kommt **immer** aus `requireEmployee()`,
> **niemals** aus Body, Query oder Header.

Abgesichert durch:
- Alle Zod-Schemas sind `.strict()` und enthalten **kein** `staff_id`/`hub_id`.
  Ein untergeschobenes Feld ist ein `400`, keine stille Übernahme.
- Jede Lese-Query filtert explizit `.eq("staff_id", ctx.staffId)`.
- `requireEmployee()` prüft bei **jeder** Anfrage Session, Gerät *und*
  Mitarbeiterstatus. Wer gesperrt wird, verliert den Zugang beim nächsten
  Aufruf — nicht erst beim Ablauf der Sitzung.

Was ein Entwickler hier falsch machen kann, ist genau eine Zeile:
`staff_id` aus dem Request lesen. Das wäre sofort eine vollständige IDOR über
alle 650 Mitarbeitenden. Deshalb die `.strict()`-Schemas als struktureller Riegel.

### Drei Schichten schützen die Daten
1. **RLS an, keine Policies** → Default ist *deny* für `anon`/`authenticated`.
2. **Grants entzogen** → scheitert schon vor der RLS-Prüfung.
3. **Default Privileges** → auch *künftige* Tabellen im Schema sind ab Geburt gesperrt.

Schicht 2 und 3 sind nicht redundant: In diesem Projekt wurde RLS **38-mal** per
`disable row level security` wieder abgeschaltet. Die entzogenen Grants
überleben ein solches `disable`. Das ist der eigentliche Grund für das eigene Schema —
`public` trägt die Supabase-Standard-Grants für `anon`, und genau die sind der
Grund, warum dort heute mit dem öffentlichen Key gelesen *und geschrieben*
werden kann.

> **Verboten:** Views oder `SECURITY DEFINER`-Funktionen in `public`, die
> `employee_app` lesen. Sie laufen mit den Rechten ihres Owners und würden
> alle drei Schichten aushebeln.

---

### Der Admin-Bereich verlangt eine echte Anmeldung

`/mitarbeiter-app` prüft **nicht nur** `isAdmin`, sondern zusätzlich
`loggedIn` — also eine echte Supabase-Session.

Grund: Im Open-Access-Modus liefert `requireSession()` für *anonyme* Besucher
`isAdmin: true`. Ein bloßes `if (!session.isAdmin)` wäre hier wirkungslos
gewesen — und diese Seite kann mehr als das übrige CRM: sie erzeugt
**Aktivierungscodes im Klartext**. Wer daran käme, könnte sich als beliebiger
der 650 Mitarbeitenden aktivieren.

Die Seite ist deshalb bewusst *nicht* vom Open-Access-Modus abhängig: sie
bleibt auch dann geschützt, wenn dieser Modus bestehen bleibt.

---

## 4. Offene Baustelle: das bestehende CRM

**Nicht durch diese Arbeit verursacht, aber vor dem Rollout zu klären.**

`0008_open_access.sql` hat RLS abgeschaltet; `requireSession()` behandelt
anonyme Besucher als Admin. Nachgemessen am Produktivsystem:

| Test (nur mit dem öffentlichen anon-Key) | Ergebnis |
|---|---|
| `GET /rest/v1/hubs` | **200**, echte Daten |
| `GET /rest/v1/profiles` | **200**, echte Daten |
| `POST /rest/v1/hubs` | **201 Created** — anonymes Schreiben |

Dahinter: 408 CRM-Institutionen, 57 Lead-Calls, 48 Meta-Leads.
Zusätzlich sind `/crm-admin`, `/ziele` usw. **ohne Login** erreichbar.

Die Mitarbeiter-App verursacht das nicht — sie verändert aber das Risiko:
Der anon-Key steckt in jedem Browser-Bundle, und mit dem Rollout bekommen ihn
650 Menschen statt einer Handvoll.

**Empfohlene Reihenfolge vor dem Rollout:**
1. `requireSession()` fail-closed machen (kein Admin-Fallback ohne Session).
2. Route-Group `(app)` hinter einen echten Login stellen.
3. RLS auf den `public`-Tabellen wieder aktivieren, Policies nachziehen.
4. Die geteilten Team-Tokens (`/f/`, `/c/`) rotieren.

Schritt 1 und 2 sind die wirksamsten und am wenigsten invasiven.

---

## 5. Was getestet ist

```bash
npm test           # Unit-Tests (Krypto, PIN-Regeln, Datumsformate)
npm run lint
npx tsc --noEmit
npm run build
npm run test:security   # Server muss laufen: npm run dev
```

`npm run test:security` prüft die Dinge, die Unit-Tests nicht abbilden:
- alle 10 `employee_app`-Tabellen mit dem anon-Key, lesend **und** schreibend
- `/api/employee/*` ohne Session → 401
- untergeschobene `staff_id` → kein 201
- PIN-Login ohne Gerät → 401
- kaputte Eingaben → 400, niemals 500

Nach **jeder** neuen Migration erneut ausführen: Eine neu angelegte Tabelle erbt
die Sperren nur, wenn sie im Schema `employee_app` liegt.

---

## 6. Später: Capacitor (iOS)

Erst wenn die Web-App im Alltag stabil läuft.

**Statischer Export ist ausgeschlossen** — die App nutzt Server Components,
Server Actions und ~30 API-Routen. Der richtige Weg ist deshalb
**`server.url`**: Die native Hülle lädt die deployte Web-App.

```ts
// capacitor.config.ts (Entwurf)
const config: CapacitorConfig = {
  appId: "de.igsg.mitarbeiter",
  appName: "Mitarbeiter",
  webDir: "public/capacitor-shell",
  server: { url: "https://<domain>/mitarbeiter", cleartext: false },
};
```

Schritte: Web-App deployen → `npm i @capacitor/core @capacitor/cli @capacitor/ios`
→ `npx cap add ios` → Bundle-ID, Name, Icon, Splash → in Xcode auf einem echten
iPhone testen → Archive → App Store Connect.

**Bereits dafür vorbereitet:**
- Kein `next/image` in der Mitarbeiter-App (keine Abhängigkeit vom Vercel-Optimizer).
- Kein Dexie/IndexedDB, kein Service Worker unter `/mitarbeiter` (bewusst online-only).
- `readDeviceSecret()` akzeptiert neben dem Cookie auch den Header `x-emp-device`
  — für den Fall, dass WKWebView-Cookies durch ITP verloren gehen. Das Secret
  gehört dann in den iOS-Keychain, nicht in `localStorage`.
- Keine Capacitor-Imports im gemeinsamen Code.

### Push-Benachrichtigungen (noch nicht gebaut)
Die Meldungs-Architektur muss dafür **nicht** geändert werden. Nötig wären:

1. Apple Developer Account → APNs-Key (.p8), Team-ID, Key-ID
2. `@capacitor/push-notifications`, Capability *Push Notifications* in Xcode
3. Neue Tabelle `employee_app.push_tokens`
   (`staff_id`, `token`, `platform`, `created_at`, `revoked_at`) — RLS wie überall
4. Route `POST /api/employee/push/register` (Identität aus der Session)
5. Beim Veröffentlichen einer Meldung: Tokens der Zielgruppe laden und an APNs
   senden (serverseitig, z. B. per Cron oder direkt in `setAnnouncementStatus`)
6. Zielgruppen-Logik ist bereits vorhanden: `target_scope` +
   `target_hub_ids`/`target_regions`/`target_rollen` in `announcements`

---

## 7. Datenschutz

- **Datensparsamkeit:** Über Mitarbeitende werden Name, Hub, optional
  Personalnummer gespeichert — kein Geburtsdatum, keine Adresse, keine
  privaten Kontaktdaten.
- **Einwilligung Dritter:** Bei Kunden-Empfehlungen bestätigt der Mitarbeitende,
  dass die empfohlene Person Bescheid weiß. `consent_at` und `consent_version`
  werden mitgeschrieben. (M&A-Empfehlungen betreffen geschäftliche Kontakte.)
- **IP-Adressen** nur als HMAC, für die Brute-Force-Erkennung.
- **Protokolliert** werden sicherheitsrelevante Ereignisse (Login, Sperre,
  Aktivierung, Statusänderung) in `audit_events` — ohne Geheimnisse.
- **Löschen:** `staff` löschen entfernt per `on delete cascade` Codes, Geräte,
  Sitzungen und Lesemarken. Empfehlungen hängen an `on delete restrict`, damit
  eingegangene Hinweise nicht unbemerkt verschwinden — dort ist eine bewusste
  Entscheidung nötig (anonymisieren statt löschen).
- **Aufräumen:** `purgeOldAttempts()` (in `rate-limit.ts`) löscht Login-Versuche
  älter als 30 Tage; kann an den bestehenden Cron gehängt werden.
