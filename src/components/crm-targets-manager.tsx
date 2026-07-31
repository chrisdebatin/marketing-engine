"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import {
  Building2,
  CalendarClock,
  Import,
  Mail,
  MapPin,
  Pencil,
  Phone,
  Plus,
  Trash2,
  UserRound,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { PLACE_KINDS, placeKindLabel } from "@/lib/places";
import {
  crmStatus,
  formatIsoDate,
  kontaktArtLabel,
  PLAN_ARTEN,
  planLabel,
  relevanzOf,
  todayIso,
} from "@/lib/crm";
import {
  createCrmPerson,
  createCrmTarget,
  deleteCrmPerson,
  deleteCrmTarget,
  importCrmTargets,
  updateCrmTarget,
} from "@/app/(app)/ziele/actions";
import { collectGeoTags, geoChip } from "@/lib/geo-tags";
import { CrmCsvImport } from "@/components/crm-csv-import";

export interface CrmTargetRow {
  id: string;
  hub_id: string | null;
  name: string;
  kategorie: string | null;
  adresse: string | null;
  ort: string | null;
  note: string | null;
  intervall_wochen: number;
  letzter_besuch: string | null;
  naechster_besuch: string | null;
  besuchs_notiz: string | null;
  ansprechpartner?: string | null;
  letzte_kontakt_art?: string | null;
  recare_partner?: boolean | null;
  plan?: string | null;
  relevanz?: number | null;
  geo_tag?: string | null;
}

export interface CrmPersonRow {
  id: string;
  target_id: string;
  name: string;
  funktion: string | null;
  telefon: string | null;
  email: string | null;
  notiz: string | null;
}

export interface HubOption {
  id: string;
  name: string;
}

const HUB_NONE = "__none__";
const KAT_NONE = "__none__";
const PLAN_NONE = "__none__";
const REL_NONE = "__none__";

function StatusBadge({ t }: { t: CrmTargetRow }) {
  const status = crmStatus(t, todayIso());
  if (status === "erstbesuch") {
    return (
      <Badge className="border-primary/40 bg-primary/10 text-primary" variant="outline">
        Erstbesuch ausstehend
      </Badge>
    );
  }
  if (status === "faellig") {
    return (
      <Badge
        variant="outline"
        className="border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-400"
      >
        Follow-up fällig seit {formatIsoDate(t.naechster_besuch)}
      </Badge>
    );
  }
  return (
    <Badge variant="outline" className="text-muted-foreground">
      wieder ab {formatIsoDate(t.naechster_besuch)}
    </Badge>
  );
}

/** Zentrale CRM-Liste: Ziel-Orte anlegen/importieren, Hubs zuteilen, pflegen. */
export function CrmTargetsManager({
  targets,
  hubs,
  persons = [],
}: {
  targets: CrmTargetRow[];
  hubs: HubOption[];
  persons?: CrmPersonRow[];
}) {
  const [pending, startTransition] = useTransition();

  const personsByTarget = new Map<string, CrmPersonRow[]>();
  for (const p of persons) {
    const arr = personsByTarget.get(p.target_id) ?? [];
    arr.push(p);
    personsByTarget.set(p.target_id, arr);
  }

  const hubItems: Record<string, string> = {
    [HUB_NONE]: "Noch keinem Hub zugeteilt",
    ...Object.fromEntries(hubs.map((h) => [h.id, h.name])),
  };
  const katItems: Record<string, string> = {
    [KAT_NONE]: "Kategorie (optional)",
    ...Object.fromEntries(PLACE_KINDS.map((p) => [p.key, p.label])),
  };
  const planItems = {
    [PLAN_NONE]: "To-do (optional)",
    ...Object.fromEntries(PLAN_ARTEN.map((p) => [p.key, p.label])),
  };
  const relItems = {
    [REL_NONE]: "Prio (optional)",
    "1": "Prio 1 — hoch",
    "2": "Prio 2 — mittel",
    "3": "Prio 3 — niedrig",
  };

  // Neuer Ziel-Ort
  const [name, setName] = useState("");
  const [kategorie, setKategorie] = useState(KAT_NONE);
  const [plan, setPlan] = useState(PLAN_NONE);
  const [adresse, setAdresse] = useState("");
  const [ort, setOrt] = useState("");
  const [hubId, setHubId] = useState(HUB_NONE);
  const [intervall, setIntervall] = useState("4");
  const [note, setNote] = useState("");

  // Bulk-Import
  const [importOpen, setImportOpen] = useState(false);
  const [importText, setImportText] = useState("");
  const [importHub, setImportHub] = useState(HUB_NONE);

  // Suche & Filter
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<
    "alle" | "faellig" | "erstbesuch" | "geplant"
  >("alle");
  const [prioFilter, setPrioFilter] = useState<0 | 1 | 2 | 3>(0);
  const [nurPdl, setNurPdl] = useState(false);
  const [geoFilter, setGeoFilter] = useState("");

  // Bearbeiten
  const [editId, setEditId] = useState<string | null>(null);
  const [edit, setEdit] = useState<CrmTargetRow | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  // Neuer Ansprechpartner (im Bearbeiten-Bereich)
  const [pName, setPName] = useState("");
  const [pFunktion, setPFunktion] = useState("");
  const [pTelefon, setPTelefon] = useState("");
  const [pEmail, setPEmail] = useState("");

  function addPerson(targetId: string) {
    startTransition(async () => {
      const res = await createCrmPerson({
        target_id: targetId,
        name: pName,
        funktion: pFunktion,
        telefon: pTelefon,
        email: pEmail,
      });
      if (res.ok) {
        toast.success("Ansprechpartner gespeichert");
        setPName("");
        setPFunktion("");
        setPTelefon("");
        setPEmail("");
      } else {
        toast.error(res.error);
      }
    });
  }

  function removePerson(id: string) {
    startTransition(async () => {
      const res = await deleteCrmPerson(id);
      if (res.ok) toast.success("Ansprechpartner gelöscht");
      else toast.error(res.error);
    });
  }

  function create() {
    startTransition(async () => {
      const res = await createCrmTarget({
        hub_id: hubId === HUB_NONE ? "" : hubId,
        name,
        kategorie: kategorie === KAT_NONE ? "" : kategorie,
        adresse,
        ort,
        note,
        plan: plan === PLAN_NONE ? "" : plan,
        intervall_wochen: intervall,
      });
      if (res.ok) {
        toast.success("Ziel-Ort angelegt");
        setName("");
        setAdresse("");
        setOrt("");
        setNote("");
      } else {
        toast.error(res.error);
      }
    });
  }

  function runImport() {
    startTransition(async () => {
      const res = await importCrmTargets({
        hub_id: importHub === HUB_NONE ? "" : importHub,
        text: importText,
        intervall_wochen: intervall,
      });
      if (res.ok) {
        toast.success(`${res.created} Ziel-Orte importiert`);
        setImportText("");
        setImportOpen(false);
      } else {
        toast.error(res.error);
      }
    });
  }

  function saveEdit() {
    if (!edit) return;
    startTransition(async () => {
      const res = await updateCrmTarget(edit.id, {
        hub_id: edit.hub_id ?? "",
        name: edit.name,
        kategorie: edit.kategorie ?? "",
        adresse: edit.adresse ?? "",
        ort: edit.ort ?? "",
        note: edit.note ?? "",
        plan: edit.plan ?? "",
        relevanz: edit.relevanz ?? "",
        intervall_wochen: edit.intervall_wochen,
        geo_tag: edit.geo_tag ?? "",
      });
      if (res.ok) {
        toast.success("Ziel-Ort aktualisiert");
        setEditId(null);
        setEdit(null);
      } else {
        toast.error(res.error);
      }
    });
  }

  function remove(id: string) {
    startTransition(async () => {
      const res = await deleteCrmTarget(id);
      if (res.ok) {
        toast.success("Ziel-Ort gelöscht");
        setConfirmDeleteId(null);
      } else {
        toast.error(res.error);
      }
    });
  }

  // Suche + Filter über alle Ziele, dann Gruppierung.
  const isPdlAdded = (t: CrmTargetRow) => /Von der PDL/i.test(t.note ?? "");
  const q = query.trim().toLowerCase();
  const geoTags = collectGeoTags(targets);
  const filtered = targets.filter((t) => {
    if (q) {
      const personText = (personsByTarget.get(t.id) ?? [])
        .map((p) => `${p.name} ${p.telefon ?? ""}`)
        .join(" ");
      const hay =
        `${t.name} ${t.ort ?? ""} ${t.adresse ?? ""} ${t.ansprechpartner ?? ""} ${t.geo_tag ?? ""} ${personText}`.toLowerCase();
      if (!hay.includes(q)) return false;
    }
    if (statusFilter !== "alle" && crmStatus(t, todayIso()) !== statusFilter) {
      return false;
    }
    if (prioFilter !== 0 && relevanzOf(t) !== prioFilter) return false;
    if (nurPdl && !isPdlAdded(t)) return false;
    if (geoFilter && (t.geo_tag ?? "") !== geoFilter) return false;
    return true;
  });

  // Gruppierung: je Hub (alphabetisch), "Nicht zugeteilt" zuerst (Handlungsbedarf).
  const hubName = (id: string | null) =>
    hubs.find((h) => h.id === id)?.name ?? null;
  const groups = new Map<string, CrmTargetRow[]>();
  for (const t of filtered) {
    const key = t.hub_id ?? HUB_NONE;
    const arr = groups.get(key) ?? [];
    arr.push(t);
    groups.set(key, arr);
  }
  const groupKeys = [...groups.keys()].sort((a, b) => {
    if (a === HUB_NONE) return -1;
    if (b === HUB_NONE) return 1;
    return (hubName(a) ?? "").localeCompare(hubName(b) ?? "", "de");
  });

  const statusRank = (t: CrmTargetRow) => {
    const s = crmStatus(t, todayIso());
    return s === "faellig" ? 0 : s === "erstbesuch" ? 1 : 2;
  };

  const cnFilterChip = (active: boolean) =>
    `cursor-pointer rounded-full border px-2.5 py-1 text-xs font-medium transition-colors select-none ${
      active
        ? "border-primary bg-primary/10 text-primary"
        : "text-muted-foreground hover:text-foreground"
    }`;

  return (
    <div className="flex flex-col gap-5">
      {/* Neuer Ziel-Ort */}
      <div className="flex flex-col gap-3 rounded-2xl border bg-card p-5 shadow-sm">
        <div className="flex items-center justify-between gap-2">
          <h2 className="flex items-center gap-2 font-semibold">
            <Building2 className="size-4 text-primary" />
            Neuen Ziel-Ort anlegen
          </h2>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setImportOpen((v) => !v)}
          >
            <Import className="size-4" />
            Liste importieren
          </Button>
        </div>

        {importOpen && (
          <div className="flex flex-col gap-2 rounded-lg border bg-background p-3">
            <p className="text-sm text-muted-foreground">
              Eine Zeile pro Ziel-Ort: <code>Name; Adresse; Ort</code> (Adresse
              und Ort optional). Alle Zeilen werden dem gewählten Hub
              zugeteilt.
            </p>
            <Select
              items={hubItems}
              value={importHub}
              onValueChange={(v) => setImportHub(v ?? HUB_NONE)}
            >
              <SelectTrigger className="w-full sm:w-72">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(hubItems).map(([value, label]) => (
                  <SelectItem key={value} value={value}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Textarea
              value={importText}
              onChange={(e) => setImportText(e.target.value)}
              rows={6}
              placeholder={
                "Klinikum Maria Hilf; Viersener Str. 450; Mönchengladbach\nSt. Elisabeth Krankenhaus; ...; ..."
              }
            />
            <Button
              type="button"
              size="sm"
              className="self-start"
              disabled={pending || !importText.trim()}
              onClick={runImport}
            >
              {pending ? "Importiere…" : "Importieren"}
            </Button>
            <p className="mt-1 text-sm font-medium">
              Oder: CSV-Datei mit Spalten-Zuordnung
            </p>
            <CrmCsvImport hubs={hubs} />
          </div>
        )}

        <div className="flex flex-col gap-2 sm:flex-row">
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Name, z. B. Klinikum Maria Hilf"
            autoComplete="off"
            className="sm:flex-1"
            maxLength={200}
          />
          <Select
            items={katItems}
            value={kategorie}
            onValueChange={(v) => setKategorie(v ?? KAT_NONE)}
          >
            <SelectTrigger className="sm:w-56">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Object.entries(katItems).map(([value, label]) => (
                <SelectItem key={value} value={value}>
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select
            items={planItems}
            value={plan}
            onValueChange={(v) => setPlan(v ?? PLAN_NONE)}
          >
            <SelectTrigger className="sm:w-56">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Object.entries(planItems).map(([value, label]) => (
                <SelectItem key={value} value={value}>
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row">
          <Input
            value={adresse}
            onChange={(e) => setAdresse(e.target.value)}
            placeholder="Adresse (Straße + Nr.)"
            autoComplete="off"
            className="sm:flex-1"
            maxLength={200}
          />
          <Input
            value={ort}
            onChange={(e) => setOrt(e.target.value)}
            placeholder="Ort/Stadt"
            autoComplete="off"
            className="sm:w-56"
            maxLength={120}
          />
        </div>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <Select
            items={hubItems}
            value={hubId}
            onValueChange={(v) => setHubId(v ?? HUB_NONE)}
          >
            <SelectTrigger className="sm:w-72">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Object.entries(hubItems).map(([value, label]) => (
                <SelectItem key={value} value={value}>
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <div className="flex items-center gap-2">
            <Label className="text-xs whitespace-nowrap">
              Follow-up alle
            </Label>
            <Input
              type="number"
              min={1}
              max={52}
              inputMode="numeric"
              value={intervall}
              onChange={(e) => setIntervall(e.target.value)}
              className="w-20"
            />
            <span className="text-sm text-muted-foreground">Wochen</span>
          </div>
          <Input
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Interne Notiz (optional)"
            autoComplete="off"
            className="sm:flex-1"
            maxLength={1000}
          />
        </div>
        <Button
          type="button"
          size="sm"
          className="self-start"
          disabled={pending || !name.trim()}
          onClick={create}
        >
          <Plus className="size-4" />
          {pending ? "Speichere…" : "Ziel-Ort anlegen"}
        </Button>
      </div>

      {/* Suche & Filter */}
      {targets.length > 0 && (
        <div className="flex flex-col gap-2 rounded-2xl border bg-card p-4 shadow-sm">
          <div className="flex flex-wrap items-center gap-2">
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Suchen: Name, Ort, Adresse, Ansprechpartner…"
              className="min-w-56 flex-1"
              autoComplete="off"
            />
            <label className="flex cursor-pointer items-center gap-1.5 text-sm select-none">
              <input
                type="checkbox"
                checked={nurPdl}
                onChange={(e) => setNurPdl(e.target.checked)}
                className="size-4 accent-primary"
              />
              nur von PDLs eingetragene
            </label>
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            {(
              [
                ["alle", "Alle"],
                ["faellig", "Follow-up fällig"],
                ["erstbesuch", "Erstkontakt offen"],
                ["geplant", "Erledigt/geplant"],
              ] as const
            ).map(([value, label]) => (
              <button
                key={value}
                type="button"
                onClick={() => setStatusFilter(value)}
                className={cnFilterChip(statusFilter === value)}
              >
                {label}
              </button>
            ))}
            <span className="mx-1 h-4 w-px bg-border" aria-hidden />
            {([0, 1, 2, 3] as const).map((v) => (
              <button
                key={v}
                type="button"
                onClick={() => setPrioFilter(v)}
                className={cnFilterChip(prioFilter === v)}
              >
                {v === 0 ? "Alle Prios" : `Prio ${v}`}
              </button>
            ))}
            <span className="ml-auto text-xs text-muted-foreground">
              {filtered.length} von {targets.length} Orten
            </span>
          </div>
          {geoTags.length > 0 && (
            <div className="flex flex-wrap items-center gap-1.5">
              <MapPin className="size-3.5 text-muted-foreground" />
              <button
                type="button"
                onClick={() => setGeoFilter("")}
                className={cnFilterChip(geoFilter === "")}
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
      )}

      {/* Gruppen je Hub */}
      {targets.length === 0 ? (
        <p className="rounded-2xl border bg-card p-5 text-sm text-muted-foreground shadow-sm">
          Noch keine Ziel-Orte. Lege oben die Krankenhäuser &amp; Co. an oder
          importiere deine Liste.
        </p>
      ) : filtered.length === 0 ? (
        <p className="rounded-2xl border bg-card p-5 text-sm text-muted-foreground shadow-sm">
          Kein Ziel-Ort passt zu Suche/Filter.
        </p>
      ) : (
        groupKeys.map((key) => {
          const list = [...(groups.get(key) ?? [])].sort(
            (a, b) =>
              statusRank(a) - statusRank(b) ||
              (relevanzOf(a) ?? 9) - (relevanzOf(b) ?? 9) ||
              a.name.localeCompare(b.name, "de"),
          );
          const due = list.filter((t) => crmStatus(t, todayIso()) !== "geplant")
            .length;
          return (
            <section key={key} className="flex flex-col gap-2.5">
              <div className="flex items-center gap-2">
                <h3 className="font-semibold">
                  {key === HUB_NONE
                    ? "Noch keinem Hub zugeteilt"
                    : hubName(key)}
                </h3>
                <span className="text-sm text-muted-foreground">
                  ({list.length} Ziel-Orte
                  {due > 0 ? `, ${due} anstehend` : ""})
                </span>
              </div>
              <ul className="flex flex-col gap-2">
                {list.map((t) => {
                  const editing = editId === t.id;
                  return (
                    <li
                      key={t.id}
                      className="flex flex-col gap-2.5 rounded-xl border bg-card px-4 py-3 shadow-sm"
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
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {[
                              t.kategorie ? placeKindLabel(t.kategorie) : null,
                              t.adresse,
                              t.ort,
                            ]
                              .filter(Boolean)
                              .join(" · ") || "—"}
                            {` · Follow-up alle ${t.intervall_wochen} Wochen`}
                          </p>
                          {(personsByTarget.get(t.id) ?? []).map((p) => (
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
                                  className="flex items-center gap-1 text-primary hover:underline"
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
                          {t.letzter_besuch && (
                            <p className="mt-0.5 text-xs text-muted-foreground">
                              <CalendarClock className="mr-1 inline size-3" />
                              {kontaktArtLabel(t.letzte_kontakt_art) ||
                                "Kontakt"}{" "}
                              am {formatIsoDate(t.letzter_besuch)}
                              {t.ansprechpartner
                                ? ` · Ansprechpartner: ${t.ansprechpartner}`
                                : ""}
                              {t.besuchs_notiz ? ` — „${t.besuchs_notiz}“` : ""}
                            </p>
                          )}
                          {t.note && (
                            <p className="mt-0.5 text-xs text-muted-foreground">
                              Notiz: {t.note}
                            </p>
                          )}
                        </div>
                        <div className="flex shrink-0 items-center gap-1.5">
                          <Badge
                            variant="outline"
                            className={
                              (t.recare_partner ??
                                (t.note?.includes("Recare-Partner")
                                  ? true
                                  : null)) === true
                                ? "border-chart-4/40 bg-chart-4/10 text-chart-4"
                                : (t.recare_partner ?? null) === false
                                  ? "border-destructive/40 bg-destructive/10 text-destructive"
                                  : "text-muted-foreground"
                            }
                          >
                            {(t.recare_partner ??
                              (t.note?.includes("Recare-Partner")
                                ? true
                                : null)) === true
                              ? "Recare-Partner"
                              : (t.recare_partner ?? null) === false
                                ? "kein Recare"
                                : "Recare?"}
                          </Badge>
                          {isPdlAdded(t) && (
                            <Badge
                              variant="outline"
                              className="border-chart-4/40 bg-chart-4/10 text-chart-4"
                            >
                              von PDL
                            </Badge>
                          )}
                          {relevanzOf(t) != null && (
                            <Badge
                              variant="outline"
                              className={
                                relevanzOf(t) === 1
                                  ? "border-primary/60 bg-primary text-primary-foreground"
                                  : relevanzOf(t) === 2
                                    ? "border-primary/40 bg-primary/10 text-primary"
                                    : "text-muted-foreground"
                              }
                            >
                              Prio {relevanzOf(t)}
                            </Badge>
                          )}
                          {t.plan && (
                            <Badge
                              variant="outline"
                              className="border-primary/40 bg-primary/10 text-primary"
                            >
                              To-do: {planLabel(t.plan)}
                            </Badge>
                          )}
                          <StatusBadge t={t} />
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="size-7 text-muted-foreground"
                            disabled={pending}
                            onClick={() => {
                              setEditId(editing ? null : t.id);
                              setEdit(editing ? null : { ...t });
                              setConfirmDeleteId(null);
                            }}
                            aria-label="Bearbeiten"
                          >
                            <Pencil className="size-3.5" />
                          </Button>
                          {confirmDeleteId === t.id ? (
                            <Button
                              type="button"
                              variant="destructive"
                              size="sm"
                              disabled={pending}
                              onClick={() => remove(t.id)}
                            >
                              Wirklich?
                            </Button>
                          ) : (
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="size-7 text-muted-foreground hover:text-destructive"
                              disabled={pending}
                              onClick={() => setConfirmDeleteId(t.id)}
                              aria-label="Löschen"
                            >
                              <Trash2 className="size-3.5" />
                            </Button>
                          )}
                        </div>
                      </div>

                      {editing && edit && (
                        <div className="flex flex-col gap-2 rounded-lg border bg-background p-3">
                          <div className="flex flex-col gap-2 sm:flex-row">
                            <Input
                              value={edit.name}
                              onChange={(e) =>
                                setEdit({ ...edit, name: e.target.value })
                              }
                              placeholder="Name"
                              className="sm:flex-1"
                              maxLength={200}
                            />
                            <Select
                              items={katItems}
                              value={edit.kategorie ?? KAT_NONE}
                              onValueChange={(v) =>
                                setEdit({
                                  ...edit,
                                  kategorie: v === KAT_NONE ? null : v,
                                })
                              }
                            >
                              <SelectTrigger className="sm:w-56">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {Object.entries(katItems).map(
                                  ([value, label]) => (
                                    <SelectItem key={value} value={value}>
                                      {label}
                                    </SelectItem>
                                  ),
                                )}
                              </SelectContent>
                            </Select>
                            <Select
                              items={relItems}
                              value={String(edit.relevanz ?? REL_NONE)}
                              onValueChange={(v) =>
                                setEdit({
                                  ...edit,
                                  relevanz:
                                    !v || v === REL_NONE ? null : Number(v),
                                })
                              }
                            >
                              <SelectTrigger className="sm:w-40">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {Object.entries(relItems).map(
                                  ([value, label]) => (
                                    <SelectItem key={value} value={value}>
                                      {label}
                                    </SelectItem>
                                  ),
                                )}
                              </SelectContent>
                            </Select>
                            <Select
                              items={planItems}
                              value={edit.plan ?? PLAN_NONE}
                              onValueChange={(v) =>
                                setEdit({
                                  ...edit,
                                  plan: v === PLAN_NONE ? null : v,
                                })
                              }
                            >
                              <SelectTrigger className="sm:w-56">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {Object.entries(planItems).map(
                                  ([value, label]) => (
                                    <SelectItem key={value} value={value}>
                                      {label}
                                    </SelectItem>
                                  ),
                                )}
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="flex flex-col gap-2 sm:flex-row">
                            <Input
                              value={edit.adresse ?? ""}
                              onChange={(e) =>
                                setEdit({ ...edit, adresse: e.target.value })
                              }
                              placeholder="Adresse"
                              className="sm:flex-1"
                              maxLength={200}
                            />
                            <Input
                              value={edit.ort ?? ""}
                              onChange={(e) =>
                                setEdit({ ...edit, ort: e.target.value })
                              }
                              placeholder="Ort/Stadt"
                              className="sm:w-56"
                              maxLength={120}
                            />
                            <Input
                              value={edit.geo_tag ?? ""}
                              onChange={(e) =>
                                setEdit({ ...edit, geo_tag: e.target.value })
                              }
                              placeholder="Geo-Tag (leer = aus Ort)"
                              className="sm:w-48"
                              maxLength={60}
                            />
                          </div>
                          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                            <Select
                              items={hubItems}
                              value={edit.hub_id ?? HUB_NONE}
                              onValueChange={(v) =>
                                setEdit({
                                  ...edit,
                                  hub_id: v === HUB_NONE ? null : (v ?? null),
                                })
                              }
                            >
                              <SelectTrigger className="sm:w-72">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {Object.entries(hubItems).map(
                                  ([value, label]) => (
                                    <SelectItem key={value} value={value}>
                                      {label}
                                    </SelectItem>
                                  ),
                                )}
                              </SelectContent>
                            </Select>
                            <div className="flex items-center gap-2">
                              <Label className="text-xs whitespace-nowrap">
                                Follow-up alle
                              </Label>
                              <Input
                                type="number"
                                min={1}
                                max={52}
                                inputMode="numeric"
                                value={edit.intervall_wochen}
                                onChange={(e) =>
                                  setEdit({
                                    ...edit,
                                    intervall_wochen:
                                      Math.trunc(Number(e.target.value)) || 3,
                                  })
                                }
                                className="w-20"
                              />
                              <span className="text-sm text-muted-foreground">
                                Wochen
                              </span>
                            </div>
                            <Input
                              value={edit.note ?? ""}
                              onChange={(e) =>
                                setEdit({ ...edit, note: e.target.value })
                              }
                              placeholder="Interne Notiz"
                              className="sm:flex-1"
                              maxLength={1000}
                            />
                          </div>
                          {/* Ansprechpartner pflegen */}
                          <div className="flex flex-col gap-2 rounded-lg border bg-muted/30 p-2.5">
                            <p className="flex items-center gap-1.5 text-xs font-semibold">
                              <UserRound className="size-3.5 text-primary" />
                              Ansprechpartner
                            </p>
                            {(personsByTarget.get(t.id) ?? []).length === 0 && (
                              <p className="text-xs text-muted-foreground">
                                Noch keine Ansprechpartner hinterlegt.
                              </p>
                            )}
                            {(personsByTarget.get(t.id) ?? []).map((p) => (
                              <div
                                key={p.id}
                                className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-sm"
                              >
                                <span className="font-medium">{p.name}</span>
                                {p.funktion && (
                                  <span className="text-xs text-muted-foreground">
                                    {p.funktion}
                                  </span>
                                )}
                                {p.telefon && (
                                  <span className="text-xs text-muted-foreground">
                                    {p.telefon}
                                  </span>
                                )}
                                {p.email && (
                                  <span className="text-xs text-muted-foreground">
                                    {p.email}
                                  </span>
                                )}
                                <button
                                  type="button"
                                  disabled={pending}
                                  onClick={() => removePerson(p.id)}
                                  className="text-muted-foreground hover:text-destructive"
                                  aria-label="Ansprechpartner löschen"
                                >
                                  <Trash2 className="size-3.5" />
                                </button>
                              </div>
                            ))}
                            <div className="flex flex-col gap-2 sm:flex-row">
                              <Input
                                value={pName}
                                onChange={(e) => setPName(e.target.value)}
                                placeholder="Name"
                                className="sm:flex-1"
                                maxLength={200}
                              />
                              <Input
                                value={pFunktion}
                                onChange={(e) => setPFunktion(e.target.value)}
                                placeholder="Funktion, z. B. Case Management"
                                className="sm:w-56"
                                maxLength={120}
                              />
                              <Input
                                value={pTelefon}
                                onChange={(e) => setPTelefon(e.target.value)}
                                placeholder="Telefon"
                                className="sm:w-44"
                                maxLength={60}
                              />
                              <Input
                                value={pEmail}
                                onChange={(e) => setPEmail(e.target.value)}
                                placeholder="E-Mail"
                                className="sm:w-56"
                                maxLength={200}
                              />
                              <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                disabled={pending || !pName.trim()}
                                onClick={() => addPerson(t.id)}
                              >
                                <Plus className="size-4" />
                                Hinzufügen
                              </Button>
                            </div>
                          </div>

                          <div className="flex items-center gap-2">
                            <Button
                              type="button"
                              size="sm"
                              disabled={pending || !edit.name.trim()}
                              onClick={saveEdit}
                            >
                              {pending ? "Speichere…" : "Speichern"}
                            </Button>
                            <Button
                              type="button"
                              size="sm"
                              variant="ghost"
                              disabled={pending}
                              onClick={() => {
                                setEditId(null);
                                setEdit(null);
                              }}
                            >
                              Abbrechen
                            </Button>
                          </div>
                        </div>
                      )}
                    </li>
                  );
                })}
              </ul>
            </section>
          );
        })
      )}
    </div>
  );
}
