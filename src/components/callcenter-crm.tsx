"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import {
  BookOpen,
  Building2,
  CalendarClock,
  Check,
  ChevronDown,
  ChevronUp,
  ListChecks,
  Mail,
  MapPin,
  Phone,
  PhoneCall,
  Search,
  UserRound,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { placeKindLabel, PLACE_KINDS } from "@/lib/places";
import {
  anrufErreicht,
  crmStatus,
  formatIsoDate,
  kontaktArtLabel,
  todayIso,
} from "@/lib/crm";
import { collectGeoTags, geoChip } from "@/lib/geo-tags";
import { splitPdlNames, splitPdlPhones } from "@/lib/pdl";
import { logCallcenterCall } from "@/app/(app)/frontoffice/actions";
import type {
  CrmPersonRow,
  CrmTargetRow,
} from "@/components/crm-targets-manager";

export interface CallcenterContactRow {
  id: string;
  target_id: string;
  kontakt_art: string;
  ansprechpartner: string | null;
  note: string | null;
  contact_date: string;
}

export interface CallcenterHub {
  id: string;
  name: string;
  pdl_name: string | null;
  pdl_phone: string | null;
}

/** Nur Ziffern/+ für tel:-Links. */
const telHref = (nummer: string) => `tel:${nummer.replace(/[^\d+]/g, "")}`;

/**
 * Call-Center-Ansicht des CRM, bewusst einfach gehalten: kurze Anleitung,
 * ausklappbarer Gesprächsleitfaden, Anruf-Liste mit klickbaren Nummern,
 * zuständigem Standort (PDL + Telefon) und direktem Anruf-Log.
 */
export function CallcenterCrm({
  targets,
  persons,
  contacts,
  hubs = [],
}: {
  targets: CrmTargetRow[];
  persons: CrmPersonRow[];
  contacts: CallcenterContactRow[];
  hubs?: CallcenterHub[];
}) {
  const [pending, startTransition] = useTransition();
  const today = todayIso();

  const personsByTarget = new Map<string, CrmPersonRow[]>();
  for (const p of persons) {
    const arr = personsByTarget.get(p.target_id) ?? [];
    arr.push(p);
    personsByTarget.set(p.target_id, arr);
  }
  const contactsByTarget = new Map<string, CallcenterContactRow[]>();
  for (const c of contacts) {
    const arr = contactsByTarget.get(c.target_id) ?? [];
    arr.push(c);
    contactsByTarget.set(c.target_id, arr);
  }

  // Tagesliste: 30 Anrufe pro Tag — heute bereits angerufene zählen mit.
  const TAGESZIEL = 30;
  const anrufeHeute = contacts.filter(
    (c) => c.kontakt_art === "anruf" && c.contact_date === today,
  );
  const heuteAngerufen = new Set(anrufeHeute.map((c) => c.target_id));
  const heuteErreicht = new Set(
    anrufeHeute.filter((c) => anrufErreicht(c.note)).map((c) => c.target_id),
  );

  /**
   * Zuständiger Standort einer Klinik: die Hub-Zuteilung aus dem CRM;
   * fehlt sie, der Standort, dessen Name zum Ort/Geo-Tag passt.
   */
  function hubFor(t: CrmTargetRow): CallcenterHub | null {
    if (t.hub_id) {
      const direct = hubs.find((h) => h.id === t.hub_id);
      if (direct) return direct;
    }
    const city = `${t.geo_tag ?? ""} ${t.ort ?? ""}`.toLowerCase();
    if (!city.trim()) return null;
    return (
      hubs.find((h) => {
        const hubCity = h.name
          .replace(/^(Alltagshilfe|Tagespflege|Tagespflgege)\s+/i, "")
          .toLowerCase();
        return hubCity.length >= 4 && city.includes(hubCity);
      }) ?? null
    );
  }

  // Filter
  const [query, setQuery] = useState("");
  const [geoFilter, setGeoFilter] = useState("");
  const [katFilter, setKatFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState<
    "anrufen" | "erstbesuch" | "alle"
  >("alle");
  const [skriptOpen, setSkriptOpen] = useState(false);

  // Anruf-Log-Formular (je aufgeklapptem Ziel)
  const [openId, setOpenId] = useState<string | null>(null);
  const [erreicht, setErreicht] = useState(true);
  const [ansprechpartner, setAnsprechpartner] = useState("");
  const [note, setNote] = useState("");
  const [savePerson, setSavePerson] = useState(false);
  const [pFunktion, setPFunktion] = useState("");
  const [pTelefon, setPTelefon] = useState("");

  function openLog(id: string) {
    setOpenId(openId === id ? null : id);
    setErreicht(true);
    setAnsprechpartner("");
    setNote("");
    setSavePerson(false);
    setPFunktion("");
    setPTelefon("");
  }

  function save(t: CrmTargetRow) {
    startTransition(async () => {
      const res = await logCallcenterCall({
        target_id: t.id,
        ansprechpartner,
        note,
        erreicht,
        neue_person:
          savePerson && ansprechpartner.trim()
            ? {
                name: ansprechpartner,
                funktion: pFunktion,
                telefon: pTelefon,
              }
            : undefined,
      });
      if (res.ok) {
        toast.success(
          erreicht ? "Anruf geloggt" : "Als „nicht erreicht“ geloggt",
        );
        setOpenId(null);
      } else {
        toast.error(res.error);
      }
    });
  }

  const geoTags = collectGeoTags(targets);
  const q = query.trim().toLowerCase();
  const filtered = targets.filter((t) => {
    if (q) {
      const personText = (personsByTarget.get(t.id) ?? [])
        .map((p) => `${p.name} ${p.telefon ?? ""}`)
        .join(" ");
      const hay =
        `${t.name} ${t.ort ?? ""} ${t.geo_tag ?? ""} ${t.ansprechpartner ?? ""} ${personText}`.toLowerCase();
      if (!hay.includes(q)) return false;
    }
    if (geoFilter && (t.geo_tag ?? "") !== geoFilter) return false;
    if (katFilter && (t.kategorie ?? "sonstiges") !== katFilter) return false;
    if (statusFilter !== "alle") {
      const s = crmStatus(t, today);
      // „Jetzt anrufen“ = fällige UND noch nie kontaktierte Institutionen.
      if (statusFilter === "anrufen" && s === "geplant") return false;
      if (statusFilter === "erstbesuch" && s !== "erstbesuch") return false;
    }
    return true;
  });

  const statusRank = (t: CrmTargetRow) => {
    const s = crmStatus(t, today);
    return s === "faellig" ? 0 : s === "erstbesuch" ? 1 : 2;
  };
  const sorted = [...filtered].sort(
    (a, b) =>
      statusRank(a) - statusRank(b) ||
      (a.naechster_besuch ?? "9999").localeCompare(b.naechster_besuch ?? "9999") ||
      a.name.localeCompare(b.name, "de"),
  );

  // Die heutigen Targets: fällige + noch nie kontaktierte, abzüglich der
  // bereits angerufenen, aufgefüllt bis zum Tagesziel.
  const tagesQueue = targets
    .filter(
      (t) => crmStatus(t, today) !== "geplant" && !heuteAngerufen.has(t.id),
    )
    .sort(
      (a, b) =>
        statusRank(a) - statusRank(b) ||
        (a.naechster_besuch ?? "9999").localeCompare(
          b.naechster_besuch ?? "9999",
        ) ||
        a.name.localeCompare(b.name, "de"),
    );
  const tagesliste = tagesQueue.slice(
    0,
    Math.max(0, TAGESZIEL - heuteAngerufen.size),
  );
  const erledigteHeute = targets.filter((t) => heuteAngerufen.has(t.id));

  const chip = (active: boolean) =>
    cn(
      "cursor-pointer rounded-full border px-2.5 py-1 text-xs font-medium transition-colors select-none",
      active
        ? "border-primary bg-primary text-primary-foreground"
        : "bg-card text-muted-foreground hover:text-foreground",
    );

  return (
    <div className="flex flex-col gap-4">
      {/* So funktioniert's */}
      <div className="flex flex-col gap-2 rounded-xl border border-primary/25 bg-primary/[0.04] p-4">
        <p className="flex items-center gap-1.5 text-sm font-semibold">
          <ListChecks className="size-4 text-primary" />
          So funktioniert&apos;s — in 3 Schritten
        </p>
        <ol className="flex list-decimal flex-col gap-1 pl-5 text-sm text-muted-foreground">
          <li>
            <span className="font-medium text-foreground">Oben anfangen:</span>{" "}
            Die Liste ist automatisch sortiert — was oben steht, ist jetzt
            dran. Auf die Telefonnummer tippen, um zu wählen.
          </li>
          <li>
            <span className="font-medium text-foreground">
              Nach dem Leitfaden sprechen:
            </span>{" "}
            Den Gesprächsleitfaden unten aufklappen. Ziel: den Sozialdienst
            erreichen, uns vorstellen, Ansprechpartner mit Durchwahl notieren.
          </li>
          <li>
            <span className="font-medium text-foreground">
              Sofort loggen:
            </span>{" "}
            Direkt nach jedem Gespräch auf „Anruf loggen“ — auch wenn niemand
            erreicht wurde. Der nächste Anruf-Termin wird automatisch gesetzt.
          </li>
        </ol>
        <p className="text-xs text-muted-foreground">
          Tipp: Arbeitet ihr zu mehreren, teilt euch die Regionen über die
          Regions-Filter unten auf — so ruft niemand dieselbe Klinik doppelt
          an.
        </p>
      </div>

      {/* Targets für heute (Tagesziel) */}
      <div className="flex flex-col gap-3 rounded-xl border border-primary/30 bg-card p-4 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="flex items-center gap-1.5 text-sm font-semibold">
            <PhoneCall className="size-4 text-primary" />
            Targets für heute
          </p>
          <p className="text-sm text-muted-foreground tabular-nums">
            <span className="font-semibold text-foreground">
              {heuteAngerufen.size}
            </span>
            /{TAGESZIEL} angerufen ·{" "}
            <span className="font-semibold text-foreground">
              {heuteErreicht.size}
            </span>{" "}
            erreicht
          </p>
        </div>
        <div className="h-2 overflow-hidden rounded-full bg-muted">
          <div
            className="h-full rounded-full bg-primary transition-all"
            style={{
              width: `${Math.min(100, Math.round((heuteAngerufen.size / TAGESZIEL) * 100))}%`,
            }}
          />
        </div>
        {erledigteHeute.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {erledigteHeute.map((t) => (
              <span
                key={t.id}
                className={cn(
                  "flex items-center gap-1 rounded-full px-2 py-0.5 text-[0.7rem] font-medium",
                  heuteErreicht.has(t.id)
                    ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400"
                    : "bg-amber-500/15 text-amber-700 dark:text-amber-400",
                )}
              >
                <Check className="size-3" />
                {t.name}
                {!heuteErreicht.has(t.id) && " (nicht erreicht)"}
              </span>
            ))}
          </div>
        )}
        {tagesliste.length === 0 ? (
          <p className="rounded-lg bg-muted/50 p-3 text-sm text-muted-foreground">
            {heuteAngerufen.size >= TAGESZIEL
              ? `Tagesziel geschafft — alle ${TAGESZIEL} Anrufe erledigt. 🎉`
              : "Keine offenen Targets mehr — alles Fällige und Neue ist abtelefoniert."}
          </p>
        ) : (
          <ul className="flex flex-col gap-2">{tagesliste.map(renderCard)}</ul>
        )}
      </div>

      {/* Gesprächsleitfaden */}
      <div className="flex flex-col gap-2 rounded-xl border bg-card p-4 shadow-sm">
        <button
          type="button"
          onClick={() => setSkriptOpen((v) => !v)}
          className="flex cursor-pointer items-center gap-1.5 text-sm font-semibold"
        >
          <BookOpen className="size-4 text-primary" />
          Gesprächsleitfaden (Skript)
          {skriptOpen ? (
            <ChevronUp className="size-4 text-muted-foreground" />
          ) : (
            <ChevronDown className="size-4 text-muted-foreground" />
          )}
        </button>
        {skriptOpen && (
          <div className="flex flex-col gap-3 text-sm">
            <div>
              <p className="font-medium">1. Begrüßung &amp; durchstellen lassen</p>
              <p className="mt-0.5 rounded-lg bg-muted/50 p-2.5 text-muted-foreground italic">
                „Guten Tag, mein Name ist [dein Name] von der Pflegeunion.
                Könnten Sie mich bitte mit dem Sozialdienst bzw. dem
                Case Management verbinden?“
              </p>
            </div>
            <div>
              <p className="font-medium">2. Kurz vorstellen (max. 2 Sätze)</p>
              <p className="mt-0.5 rounded-lg bg-muted/50 p-2.5 text-muted-foreground italic">
                „Wir sind die Pflegeunion — ambulante Pflege, Intensivpflege,
                Alltagshilfe und Tagespflege, mit Standorten in Ihrer Region.
                Wir haben aktuell freie Kapazitäten und können Patientinnen
                und Patienten aus der Entlassung kurzfristig übernehmen.“
              </p>
            </div>
            <div>
              <p className="font-medium">3. Die drei Kernfragen</p>
              <ul className="mt-0.5 flex list-disc flex-col gap-1 pl-5 text-muted-foreground">
                <li>
                  „Wer ist bei Ihnen für die Überleitung zuständig — und wie
                  erreiche ich die Person direkt?“ (Name + Durchwahl notieren!)
                </li>
                <li>
                  „Wie läuft die Patientenüberleitung bei Ihnen ab — dürfen
                  wir Ihnen Infomaterial oder unsere Kontaktbox zukommen
                  lassen?“
                </li>
                <li>
                  „Haben Sie aktuell Patientinnen oder Patienten, für die eine
                  Versorgung gesucht wird?“
                </li>
              </ul>
            </div>
            <div>
              <p className="font-medium">4. Übergabe an den Standort</p>
              <p className="mt-0.5 rounded-lg bg-muted/50 p-2.5 text-muted-foreground italic">
                „Für konkrete Patienten erreichen Sie unsere
                Pflegedienstleitung direkt — ich gebe Ihnen die Nummer.“
              </p>
              <p className="mt-1 text-muted-foreground">
                → Die zuständige PDL mit Telefonnummer steht auf jeder Karte
                unten („Zuständiger Standort“). Diese Nummer weitergeben.
              </p>
            </div>
            <div>
              <p className="font-medium">Wenn Einwände kommen</p>
              <ul className="mt-0.5 flex list-disc flex-col gap-1 pl-5 text-muted-foreground">
                <li>
                  „Wir haben schon Partner“ → „Verstehe ich gut. Gerade bei
                  kurzfristigen Entlassungen oder vollen Partnern sind wir
                  eine schnelle zweite Option — darf ich Ihnen einfach unsere
                  Kontaktdaten dalassen?“
                </li>
                <li>
                  „Keine Zeit“ → „Kein Problem — wann passt es besser? Ich
                  rufe gern erneut an.“ (Beim Loggen „Nicht erreicht“ wählen —
                  Wiedervorlage kommt automatisch.)
                </li>
              </ul>
            </div>
            <div>
              <p className="font-medium">5. Abschluss</p>
              <p className="mt-0.5 text-muted-foreground">
                Bedanken, Namen wiederholen, auflegen — und sofort loggen:
                Mit wem gesprochen? Was vereinbart? Neuen Ansprechpartner
                speichern, wenn du einen Namen bekommen hast.
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Suche & Filter — alle Institutionen (zum Nachschlagen) */}
      <div className="flex flex-col gap-2 rounded-xl border bg-card p-4 shadow-sm">
        <p className="text-sm font-semibold">
          Alle Institutionen — Suche &amp; Filter
        </p>
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Suchen: Klinik, Ort, Ansprechpartner, Telefon…"
          className="w-full"
          autoComplete="off"
        />
        <div className="flex flex-wrap items-center gap-1.5">
          {(
            [
              ["anrufen", "Jetzt anrufen (fällig + neu)"],
              ["erstbesuch", "Noch nie kontaktiert"],
              ["alle", "Alle anzeigen"],
            ] as const
          ).map(([value, label]) => (
            <button
              key={value}
              type="button"
              onClick={() => setStatusFilter(value)}
              className={chip(statusFilter === value)}
            >
              {label}
            </button>
          ))}
          <span className="mx-1 h-4 w-px bg-border" aria-hidden />
          {PLACE_KINDS.map((p) => (
            <button
              key={p.key}
              type="button"
              onClick={() => setKatFilter(katFilter === p.key ? "" : p.key)}
              className={chip(katFilter === p.key)}
            >
              {p.label}
            </button>
          ))}
        </div>
        {geoTags.length > 0 && (
          <div className="flex flex-wrap items-center gap-1.5">
            <MapPin className="size-3.5 text-muted-foreground" />
            <button
              type="button"
              onClick={() => setGeoFilter("")}
              className={chip(geoFilter === "")}
            >
              Alle Regionen
            </button>
            {geoTags.slice(0, 15).map(({ tag, count }) => (
              <button
                key={tag}
                type="button"
                onClick={() => setGeoFilter(geoFilter === tag ? "" : tag)}
                className={`cursor-pointer rounded-full px-2.5 py-1 text-xs font-medium select-none ${geoChip(tag)} ${
                  geoFilter === tag ? "ring-2 ring-primary" : ""
                }`}
              >
                {tag} ({count})
              </button>
            ))}
          </div>
        )}
        <p className="text-xs text-muted-foreground">
          {sorted.length} in der Liste — fällige zuerst. Filter antippen zum
          Ein-/Ausschalten.
        </p>
      </div>

      {/* Anruf-Liste */}
      {sorted.length === 0 ? (
        <p className="rounded-xl border bg-card p-5 text-sm text-muted-foreground shadow-sm">
          {targets.length === 0
            ? "Noch keine Institutionen im CRM — das Team importiert sie unter „Ziel-Orte“."
            : katFilter
              ? `Nichts gefunden — der Kategorie-Filter „${placeKindLabel(katFilter)}“ ist aktiv. Ihn oben antippen zum Abwählen oder „Alle anzeigen“ wählen.`
              : "Nichts gefunden — Suche leeren oder oben „Alle anzeigen“ wählen."}
        </p>
      ) : (
        <ul className="flex flex-col gap-2">
          {sorted.slice(0, 100).map(renderCard)}
          {sorted.length > 100 && (
            <p className="text-center text-xs text-muted-foreground">
              {sorted.length - 100} weitere — Suche oder Filter nutzen.
            </p>
          )}
        </ul>
      )}
    </div>
  );

  function renderCard(t: CrmTargetRow) {
    const open = openId === t.id;
            const status = crmStatus(t, today);
            const history = (contactsByTarget.get(t.id) ?? []).slice(0, 5);
            const targetPersons = personsByTarget.get(t.id) ?? [];
            const hub = hubFor(t);
            const pdlNamen = splitPdlNames(hub?.pdl_name ?? null);
            const pdlTelefon = splitPdlPhones(hub?.pdl_phone ?? null)[0] ?? null;
            const hauptnummer = targetPersons.find((p) => p.telefon)?.telefon;
            return (
              <li
                key={t.id}
                className="flex flex-col gap-2 rounded-xl border bg-card px-4 py-3 shadow-sm"
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="flex flex-wrap items-center gap-1.5 font-medium">
                      {t.name}
                      {t.geo_tag && (
                        <span
                          className={`rounded-full px-2 py-0.5 text-[0.65rem] font-semibold ${geoChip(t.geo_tag)}`}
                        >
                          {t.geo_tag}
                        </span>
                      )}
                      {status === "faellig" && (
                        <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-[0.65rem] font-semibold text-amber-700 dark:text-amber-400">
                          fällig seit {formatIsoDate(t.naechster_besuch)}
                        </span>
                      )}
                      {status === "erstbesuch" && (
                        <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[0.65rem] font-semibold text-primary">
                          noch nie kontaktiert
                        </span>
                      )}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {[placeKindLabel(t.kategorie), t.adresse, t.ort]
                        .filter(Boolean)
                        .join(" · ")}
                    </p>

                    {/* Wen anrufen? */}
                    {targetPersons.map((p) => (
                      <p
                        key={p.id}
                        className="mt-0.5 flex flex-wrap items-center gap-x-2 text-sm"
                      >
                        <span className="flex items-center gap-1 text-muted-foreground">
                          <UserRound className="size-3.5" />
                          {p.name}
                          {p.funktion ? ` (${p.funktion})` : ""}
                        </span>
                        {p.telefon && (
                          <a
                            href={telHref(p.telefon)}
                            className="flex items-center gap-1 font-semibold text-primary hover:underline"
                          >
                            <Phone className="size-3.5" />
                            {p.telefon}
                          </a>
                        )}
                        {p.email && (
                          <a
                            href={`mailto:${p.email}`}
                            className="flex items-center gap-1 text-xs text-primary hover:underline"
                          >
                            <Mail className="size-3" />
                            {p.email}
                          </a>
                        )}
                      </p>
                    ))}
                    {targetPersons.length === 0 && t.ansprechpartner && (
                      <p className="mt-0.5 flex items-center gap-1 text-sm text-muted-foreground">
                        <UserRound className="size-3.5" />
                        {t.ansprechpartner}
                      </p>
                    )}

                    {/* Zuständiger Standort: dahin werden Patienten vermittelt */}
                    {hub && (
                      <p className="mt-1 flex flex-wrap items-center gap-x-2 rounded-lg bg-muted/50 px-2 py-1 text-xs">
                        <span className="flex items-center gap-1 font-medium">
                          <Building2 className="size-3" />
                          Zuständiger Standort: {hub.name}
                        </span>
                        {pdlNamen.length > 0 && (
                          <span className="text-muted-foreground">
                            PDL: {pdlNamen.join(", ")}
                          </span>
                        )}
                        {pdlTelefon && (
                          <a
                            href={telHref(pdlTelefon)}
                            className="flex items-center gap-1 font-semibold text-primary hover:underline"
                          >
                            <Phone className="size-3" />
                            {pdlTelefon}
                          </a>
                        )}
                        <span className="w-full text-muted-foreground">
                          → Diese Nummer bei konkreten Patienten an die Klinik
                          weitergeben.
                        </span>
                      </p>
                    )}

                    {t.letzter_besuch && (
                      <p className="mt-1 text-xs text-muted-foreground">
                        <CalendarClock className="mr-1 inline size-3" />
                        Zuletzt: {kontaktArtLabel(t.letzte_kontakt_art) ||
                          "Kontakt"}{" "}
                        am {formatIsoDate(t.letzter_besuch)}
                        {t.besuchs_notiz ? ` — „${t.besuchs_notiz}“` : ""}
                      </p>
                    )}
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-1.5">
                    {hauptnummer ? (
                      <Button size="sm" render={<a href={telHref(hauptnummer)} />}>
                        <PhoneCall className="size-4" />
                        {hauptnummer}
                      </Button>
                    ) : (
                      <Button
                        size="sm"
                        variant="outline"
                        render={
                          <a
                            href={`https://www.google.com/search?q=${encodeURIComponent(
                              `${t.name} ${t.ort ?? ""} Telefonnummer`.trim(),
                            )}`}
                            target="_blank"
                            rel="noreferrer"
                          />
                        }
                      >
                        <Search className="size-4" />
                        Nummer suchen
                      </Button>
                    )}
                    <Button
                      type="button"
                      size="sm"
                      variant={open ? "secondary" : "outline"}
                      onClick={() => openLog(t.id)}
                    >
                      Anruf loggen
                      {open ? (
                        <ChevronUp className="size-3.5" />
                      ) : (
                        <ChevronDown className="size-3.5" />
                      )}
                    </Button>
                  </div>
                </div>

                {open && (
                  <div className="flex flex-col gap-2.5 rounded-lg border bg-background p-3">
                    <p className="text-xs text-muted-foreground">
                      Kurz festhalten, wie der Anruf lief — mehr braucht es
                      nicht. Bei „Nicht erreicht“ steht die Klinik nach 3
                      Tagen (nächster Werktag) automatisch wieder oben in der
                      Liste.
                    </p>
                    <div className="flex flex-wrap items-center gap-1.5">
                      {(
                        [
                          [true, "Erreicht"],
                          [false, "Nicht erreicht"],
                        ] as const
                      ).map(([value, label]) => (
                        <button
                          key={String(value)}
                          type="button"
                          onClick={() => setErreicht(value)}
                          className={chip(erreicht === value)}
                        >
                          {label}
                        </button>
                      ))}
                    </div>
                    <div className="flex flex-wrap items-center gap-1.5">
                      {targetPersons.map((p) => (
                        <button
                          key={p.id}
                          type="button"
                          onClick={() => setAnsprechpartner(p.name)}
                          className={chip(ansprechpartner === p.name)}
                        >
                          {p.name}
                        </button>
                      ))}
                      <Input
                        value={ansprechpartner}
                        onChange={(e) => setAnsprechpartner(e.target.value)}
                        placeholder="Mit wem gesprochen? (Name)"
                        autoComplete="off"
                        maxLength={200}
                        className="w-64 bg-background"
                      />
                    </div>
                    {erreicht &&
                      ansprechpartner.trim() &&
                      !targetPersons.some(
                        (p) =>
                          p.name.trim().toLowerCase() ===
                          ansprechpartner.trim().toLowerCase(),
                      ) && (
                        <div className="flex flex-wrap items-center gap-2">
                          <label className="flex cursor-pointer items-center gap-1.5 text-sm select-none">
                            <input
                              type="checkbox"
                              checked={savePerson}
                              onChange={(e) => setSavePerson(e.target.checked)}
                              className="size-4 accent-primary"
                            />
                            Als neuen Ansprechpartner speichern
                          </label>
                          {savePerson && (
                            <>
                              <Input
                                value={pFunktion}
                                onChange={(e) => setPFunktion(e.target.value)}
                                placeholder="Funktion, z. B. Sozialdienst"
                                maxLength={120}
                                className="w-56 bg-background"
                              />
                              <Input
                                value={pTelefon}
                                onChange={(e) => setPTelefon(e.target.value)}
                                placeholder="Durchwahl/Telefon"
                                maxLength={60}
                                className="w-44 bg-background"
                              />
                            </>
                          )}
                        </div>
                      )}
                    <Textarea
                      value={note}
                      onChange={(e) => setNote(e.target.value)}
                      rows={2}
                      maxLength={1000}
                      placeholder={
                        erreicht
                          ? "Gesprächsnotiz (Pflicht): Was wurde besprochen? Nächste Schritte?"
                          : "Notiz (optional), z. B. Mailbox, Rückruf erbeten…"
                      }
                    />
                    <Button
                      type="button"
                      size="sm"
                      className="self-start"
                      disabled={pending || (erreicht && !note.trim())}
                      onClick={() => save(t)}
                    >
                      {pending ? "Speichere…" : "Anruf speichern"}
                    </Button>

                    {history.length > 0 && (
                      <div className="flex flex-col gap-1 border-t pt-2">
                        <p className="text-xs font-semibold text-muted-foreground">
                          Bisherige Kontakte
                        </p>
                        {history.map((c) => (
                          <p
                            key={c.id}
                            className="text-xs text-muted-foreground"
                          >
                            {formatIsoDate(c.contact_date)} ·{" "}
                            {kontaktArtLabel(c.kontakt_art)}
                            {c.ansprechpartner ? ` · ${c.ansprechpartner}` : ""}
                            {c.note ? ` — „${c.note}“` : ""}
                          </p>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </li>
    );
  }
}
