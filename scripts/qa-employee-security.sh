#!/usr/bin/env bash
# Sicherheits-Smoketest der Mitarbeiter-App.
#
# Prueft die Dinge, die sich NICHT im Unit-Test abbilden lassen:
#  A) Sind die employee_app-Tabellen mit dem oeffentlichen anon-Key erreichbar?
#     (Das ist der wichtigste Test: RLS ist im uebrigen Projekt deaktiviert.)
#  B) Verlangen die /api/employee/*-Routen eine gueltige Session?
#  C) Wird eine untergeschobene staff_id abgewiesen?
#
# Aufruf:  npm run test:security          (Server muss auf $BASE laufen)
set -uo pipefail

cd "$(dirname "$0")/.."
[ -f .env.local ] && set -a && . ./.env.local && set +a

BASE="${BASE:-http://localhost:3000}"
URL="${NEXT_PUBLIC_SUPABASE_URL:-}"
ANON="${NEXT_PUBLIC_SUPABASE_ANON_KEY:-}"

pass=0; fail=0
ok()   { printf "  \033[32mOK\033[0m   %s\n" "$1"; pass=$((pass+1)); }
bad()  { printf "  \033[31mFAIL\033[0m %s\n" "$1"; fail=$((fail+1)); }

echo
echo "A) employee_app-Tabellen mit dem oeffentlichen anon-Key"
echo "   Erwartung: KEIN 200. Weder lesen noch schreiben."
if [ -z "$URL" ] || [ -z "$ANON" ]; then
  echo "   uebersprungen (NEXT_PUBLIC_SUPABASE_URL/ANON_KEY fehlen)"
else
  for t in staff activation_codes devices sessions announcements \
           announcement_reads customer_referrals ma_referrals \
           auth_attempts audit_events; do
    # Accept-Profile adressiert das Schema employee_app.
    code=$(curl -s -o /dev/null -w "%{http_code}" \
      "$URL/rest/v1/$t?select=*&limit=1" \
      -H "apikey: $ANON" -H "Authorization: Bearer $ANON" \
      -H "Accept-Profile: employee_app")
    if [ "$code" = "200" ]; then
      bad "LESEN von employee_app.$t liefert 200 — Daten sind oeffentlich!"
    else
      ok "lesen  employee_app.$t -> HTTP $code"
    fi

    code=$(curl -s -o /dev/null -w "%{http_code}" -X POST \
      "$URL/rest/v1/$t" \
      -H "apikey: $ANON" -H "Authorization: Bearer $ANON" \
      -H "Content-Profile: employee_app" \
      -H "Content-Type: application/json" -d '{}')
    if [ "$code" = "201" ] || [ "$code" = "200" ]; then
      bad "SCHREIBEN in employee_app.$t moeglich (HTTP $code)!"
    else
      ok "schreiben employee_app.$t -> HTTP $code"
    fi
  done
fi

echo
echo "B) /api/employee/* ohne Session"
echo "   Erwartung: 401 (niemals 200, niemals 500)."
for path in \
  "/api/employee/announcements" \
  "/api/employee/referrals/customer" \
  "/api/employee/referrals/ma"; do
  code=$(curl -s -o /dev/null -w "%{http_code}" "$BASE$path")
  if [ "$code" = "401" ]; then ok "GET $path -> 401"; else bad "GET $path -> $code (erwartet 401)"; fi
done

code=$(curl -s -o /dev/null -w "%{http_code}" -X POST \
  "$BASE/api/employee/referrals/ma" \
  -H "Content-Type: application/json" -d '{"firma_name":"Test"}')
if [ "$code" = "401" ]; then ok "POST ma-Empfehlung ohne Session -> 401"; else bad "POST ohne Session -> $code"; fi

echo
echo "C) Untergeschobene Identitaet"
echo "   Erwartung: 400 (Zod .strict()) oder 401 — niemals 201."
code=$(curl -s -o /dev/null -w "%{http_code}" -X POST \
  "$BASE/api/employee/referrals/ma" \
  -H "Content-Type: application/json" \
  -d '{"firma_name":"Test","staff_id":"00000000-0000-0000-0000-000000000000"}')
if [ "$code" = "201" ]; then bad "staff_id aus dem Body akzeptiert (HTTP 201)!"; else ok "staff_id im Body -> HTTP $code"; fi

echo
echo "D) Login ohne Geraet"
echo "   Erwartung: 401 — es gibt keinen PIN-Login ohne gebundenes Geraet."
code=$(curl -s -o /dev/null -w "%{http_code}" -X POST \
  "$BASE/api/employee/login" \
  -H "Content-Type: application/json" -d '{"pin":"123456"}')
if [ "$code" = "401" ]; then ok "PIN-Login ohne Geraet -> 401"; else bad "PIN-Login ohne Geraet -> $code"; fi

echo
echo "E) Kaputte Eingaben"
echo "   Erwartung: 400/401 — niemals 500."
for body in '{}' 'null' '{"pin":["1","2"]}' '{"code":123}' 'nichtjson'; do
  code=$(curl -s -o /dev/null -w "%{http_code}" -X POST \
    "$BASE/api/employee/activate" \
    -H "Content-Type: application/json" -d "$body")
  if [ "$code" = "500" ]; then bad "activate mit '$body' -> 500"; else ok "activate mit '$body' -> HTTP $code"; fi
done

echo
echo "-----------------------------------------"
printf "bestanden: %s   fehlgeschlagen: %s\n" "$pass" "$fail"
[ "$fail" -eq 0 ] || exit 1
