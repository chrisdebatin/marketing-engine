"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import {
  CalendarClock,
  ChevronDown,
  ChevronUp,
  Mail,
  MapPin,
  Phone,
  PhoneCall,
  UserRound,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { placeKindLabel, PLACE_KINDS } from "@/lib/places";
import {
  crmStatus,
  formatIsoDate,
  kontaktArtLabel,
  todayIso,
} from "@/lib/crm";
import { collectGeoTags, geoChip } from "@/lib/geo-tags";
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

/**
 * Call-Center-Ansicht des CRM: Anruf-Liste aller Institutionen mit
 * Geo-Tag-/Kategorie-Filter, Ansprechpartnern (klickbare Rufnummern),
 * Kontakt-Historie und direktem Anruf-Log.
 */
export function CallcenterCrm({
  targets,
  persons,
  contacts,
}: {
  targets: CrmTargetRow[];
  persons: CrmPersonRow[];
  contacts: CallcenterContactRow[];
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

  // Filter
  const [query, setQuery] = useState("");
  const [geoFilter, setGeoFilter] = useState("");
  // Das Call-Center macht primär Klinik-Kontakte — Start-Filter Krankenhaus.
  const [katFilter, setKatFilter] = useState("krankenhaus");
  const [statusFilter, setStatusFilter] = useState<
    "faellig" | "erstbesuch" | "alle"
  >("faellig");
  const [recareFilter, setRecareFilter] = useState<
    "" | "partner" | "kein" | "unbekannt"
  >("");

  // Anruf-Log-Formular (je aufgeklapptem Ziel)
  const [openId, setOpenId] = useState<string | null>(null);
  const [erreicht, setErreicht] = useState(true);
  const [ansprechpartner, setAnsprechpartner] = useState("");
  const [note, setNote] = useState("");
  const [recare, setRecare] = useState("");
  const [savePerson, setSavePerson] = useState(false);
  const [pFunktion, setPFunktion] = useState("");
  const [pTelefon, setPTelefon] = useState("");

  function openLog(id: string) {
    setOpenId(openId === id ? null : id);
    setErreicht(true);
    setAnsprechpartner("");
    setNote("");
    setRecare("");
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
        recare: erreicht ? recare : "",
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
    if (statusFilter !== "alle" && crmStatus(t, today) !== statusFilter) {
      return false;
    }
    if (recareFilter) {
      const r = t.recare_partner ?? null;
      if (recareFilter === "partner" && r !== true) return false;
      if (recareFilter === "kein" && r !== false) return false;
      if (recareFilter === "unbekannt" && r !== null) return false;
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

  const faelligGesamt = targets.filter(
    (t) => crmStatus(t, today) === "faellig",
  ).length;
  const offenGesamt = targets.filter(
    (t) => crmStatus(t, today) === "erstbesuch",
  ).length;

  const chip = (active: boolean) =>
    cn(
      "cursor-pointer rounded-full border px-2.5 py-1 text-xs font-medium transition-colors select-none",
      active
        ? "border-primary bg-primary/10 text-primary"
        : "text-muted-foreground hover:text-foreground",
    );

  return (
    <div className="flex flex-col gap-4">
      {/* Filter */}
      <div className="flex flex-col gap-2 rounded-xl border bg-card p-4 shadow-sm">
        <div className="flex flex-wrap items-center gap-2">
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Suchen: Institution, Ort, Ansprechpartner, Telefon…"
            className="min-w-56 flex-1"
            autoComplete="off"
          />
          <span className="text-xs text-muted-foreground">
            {faelligGesamt} fällig · {offenGesamt} nie kontaktiert
          </span>
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          {(
            [
              ["faellig", "Jetzt anrufen (fällig)"],
              ["erstbesuch", "Noch nie kontaktiert"],
              ["alle", "Alle"],
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
          <button
            type="button"
            onClick={() => setKatFilter("")}
            className={chip(katFilter === "")}
          >
            Alle Kategorien
          </button>
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
          <span className="mx-1 h-4 w-px bg-border" aria-hidden />
          {(
            [
              ["", "Recare: alle"],
              ["partner", "Recare-Partner"],
              ["kein", "kein Recare"],
              ["unbekannt", "Recare unklar"],
            ] as const
          ).map(([value, label]) => (
            <button
              key={value || "alle"}
              type="button"
              onClick={() => setRecareFilter(value)}
              className={chip(recareFilter === value)}
            >
              {label}
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
      </div>

      {/* Anruf-Liste */}
      {sorted.length === 0 ? (
        <p className="rounded-xl border bg-card p-5 text-sm text-muted-foreground shadow-sm">
          {targets.length === 0
            ? "Noch keine Institutionen im CRM — das Team importiert sie unter „Ziel-Orte“."
            : "Keine Institution passt zu Suche/Filter."}
        </p>
      ) : (
        <ul className="flex flex-col gap-2">
          {sorted.slice(0, 100).map((t) => {
            const open = openId === t.id;
            const status = crmStatus(t, today);
            const history = (contactsByTarget.get(t.id) ?? []).slice(0, 5);
            const targetPersons = personsByTarget.get(t.id) ?? [];
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
                      {(t.recare_partner ?? null) === true && (
                        <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-[0.65rem] font-semibold text-emerald-700 dark:text-emerald-300">
                          Recare-Partner
                        </span>
                      )}
                      {(t.recare_partner ?? null) === false && (
                        <span className="rounded-full bg-destructive/10 px-2 py-0.5 text-[0.65rem] font-semibold text-destructive">
                          kein Recare
                        </span>
                      )}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {[placeKindLabel(t.kategorie), t.adresse, t.ort]
                        .filter(Boolean)
                        .join(" · ")}
                    </p>
                    {targetPersons.map((p) => (
                      <p
                        key={p.id}
                        className="mt-0.5 flex flex-wrap items-center gap-x-2 text-xs text-muted-foreground"
                      >
                        <span className="flex items-center gap-1">
                          <UserRound className="size-3" />
                          {p.name}
                          {p.funktion ? ` (${p.funktion})` : ""}
                        </span>
                        {p.telefon && (
                          <a
                            href={`tel:${p.telefon.replace(/[^\d+]/g, "")}`}
                            className="flex items-center gap-1 font-medium text-primary hover:underline"
                          >
                            <Phone className="size-3" />
                            {p.telefon}
                          </a>
                        )}
                        {p.email && (
                          <a
                            href={`mailto:${p.email}`}
                            className="flex items-center gap-1 text-primary hover:underline"
                          >
                            <Mail className="size-3" />
                            {p.email}
                          </a>
                        )}
                      </p>
                    ))}
                    {targetPersons.length === 0 && t.ansprechpartner && (
                      <p className="mt-0.5 flex items-center gap-1 text-xs text-muted-foreground">
                        <UserRound className="size-3" />
                        {t.ansprechpartner}
                      </p>
                    )}
                    {t.letzter_besuch && (
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        <CalendarClock className="mr-1 inline size-3" />
                        {kontaktArtLabel(t.letzte_kontakt_art) || "Kontakt"} am{" "}
                        {formatIsoDate(t.letzter_besuch)}
                        {t.besuchs_notiz ? ` — „${t.besuchs_notiz}“` : ""}
                      </p>
                    )}
                  </div>
                  <Button
                    type="button"
                    size="sm"
                    variant={open ? "secondary" : "default"}
                    onClick={() => openLog(t.id)}
                  >
                    <PhoneCall className="size-4" />
                    Anruf loggen
                    {open ? (
                      <ChevronUp className="size-3.5" />
                    ) : (
                      <ChevronDown className="size-3.5" />
                    )}
                  </Button>
                </div>

                {open && (
                  <div className="flex flex-col gap-2.5 rounded-lg border bg-background p-3">
                    <div className="flex flex-wrap items-center gap-1.5">
                      {(
                        [
                          [true, "Erreicht"],
                          [false, "Nicht erreicht (in 3 Tagen wieder)"],
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
                    {erreicht && (
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className="text-xs font-medium text-muted-foreground">
                          Recare-Partner?
                        </span>
                        {(
                          [
                            ["", "Nicht besprochen"],
                            ["ja", "Ja, Partner"],
                            ["nein", "Nein"],
                          ] as const
                        ).map(([value, label]) => (
                          <button
                            key={value || "offen"}
                            type="button"
                            onClick={() => setRecare(value)}
                            className={chip(recare === value)}
                          >
                            {label}
                          </button>
                        ))}
                      </div>
                    )}
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
                        placeholder="Gesprochen mit… (Name)"
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
                            Als Ansprechpartner speichern
                          </label>
                          {savePerson && (
                            <>
                              <Input
                                value={pFunktion}
                                onChange={(e) => setPFunktion(e.target.value)}
                                placeholder="Funktion, z. B. Case Management"
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
                          ? "Gesprächsnotiz (Pflicht): Was wurde besprochen, nächste Schritte…"
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
                          Letzte Kontakte
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
          })}
          {sorted.length > 100 && (
            <p className="text-center text-xs text-muted-foreground">
              {sorted.length - 100} weitere — Suche/Filter nutzen.
            </p>
          )}
        </ul>
      )}
    </div>
  );
}
