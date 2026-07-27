"use client";

import { useState } from "react";
import { toast } from "sonner";
import {
  CalendarClock,
  Check,
  ListTodo,
  MapPin,
  Megaphone,
  Sparkles,
  Pencil,
  Phone,
  Package,
  Plus,
  Trash2,
  Trophy,
  Users,
} from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { PLACE_KINDS } from "@/lib/places";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { placeKindLabel } from "@/lib/places";
import {
  crmStatus,
  formatIsoDate,
  KONTAKT_ARTEN,
  kontaktArtLabel,
  planLabel,
  todayIso,
} from "@/lib/crm";

export interface VisitTarget {
  id: string;
  name: string;
  kategorie: string | null;
  adresse: string | null;
  ort: string | null;
  intervall_wochen: number;
  letzter_besuch: string | null;
  naechster_besuch: string | null;
  besuchs_notiz: string | null;
  ansprechpartner?: string | null;
  letzte_kontakt_art?: string | null;
  recare_partner?: boolean | null;
  plan?: string | null;
  note?: string | null;
}

/** Ein Eintrag im vereinten Aktivitäts-Log (Kontakte + Auslagen). */
export interface CrmLogEntry {
  id: string;
  date: string;
  art: string;
  ort: string;
  notiz: string | null;
  ansprechpartner: string | null;
}

const ART_ICON = {
  box: Package,
  flyer: Megaphone,
  besuch: Users,
  anruf: Phone,
} as const;

/** Recare-Status: Spalte, mit Fallback auf die Notiz-Markierung. */
function recareOf(t: VisitTarget): boolean | null {
  if (t.recare_partner != null) return t.recare_partner;
  if (t.note?.includes("Recare-Partner")) return true;
  return null;
}

function RecareChip({ t }: { t: VisitTarget }) {
  const status = recareOf(t);
  return (
    <span
      className={cn(
        "rounded-full px-2 py-0.5 text-[0.65rem] font-semibold whitespace-nowrap",
        status === true && "bg-chart-4/15 text-chart-4",
        status === false && "bg-destructive/10 text-destructive",
        status === null && "bg-muted text-muted-foreground",
      )}
    >
      {status === true
        ? "Recare-Partner"
        : status === false
          ? "kein Recare"
          : "Recare? erfragen"}
    </span>
  );
}

/**
 * Klinik-/CRM-Liste für die PDL: anonymes Aktivitäts-Ranking, fällige Kontakte zuerst,
 * Kontakt loggen (Box/Besuch/Anruf + Ansprechpartner + Gesprächsnotiz);
 * das nächste Gespräch wird automatisch in `intervall_wochen` terminiert.
 */
export function CrmVisitList({
  token,
  initial,
  initialScore,
  otherScores,
  initialLog = [],
}: {
  token: string;
  initial: VisitTarget[];
  /** Aktivitäten dieses Standorts in den letzten 4 Wochen. */
  initialScore: number;
  /** Aktivitäts-Werte der anderen Standorte — anonym, nur Zahlen. */
  otherScores: number[];
  /** Vereintes Log (Kontakte + Auslagen), neueste zuerst. */
  initialLog?: CrmLogEntry[];
}) {
  const [targets, setTargets] = useState<VisitTarget[]>(initial);
  const [score, setScore] = useState(initialScore);
  const [log, setLog] = useState<CrmLogEntry[]>(initialLog);
  // Schnell-Log: EIN Formular für alles (Ort + Aktion, Rest optional)
  const [qOrt, setQOrt] = useState("");
  const [qArt, setQArt] = useState("");
  const [qAnsprech, setQAnsprech] = useState("");
  const [qNotiz, setQNotiz] = useState("");
  const [qRecare, setQRecare] = useState("");
  const [quickBusy, setQuickBusy] = useState(false);

  async function quickLog() {
    if (quickBusy || !qOrt.trim() || !qArt) return;
    setQuickBusy(true);
    try {
      const res = await fetch("/api/public/crm-log", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          token,
          ort_name: qOrt,
          aktion: qArt,
          ansprechpartner: qAnsprech,
          notiz: qNotiz,
          recare: qRecare,
        }),
      });
      const body = (await res.json().catch(() => ({}))) as {
        error?: string;
        result?: { ort: string; aktion: string; art: string; neu: boolean };
        targets?: VisitTarget[];
      };
      if (!res.ok || !body.result) {
        toast.error(body.error ?? "Loggen fehlgeschlagen.");
        return;
      }
      if (body.targets) setTargets(body.targets);
      const today = todayIso();
      setLog((prev) => [
        {
          id: `quick-${today}-${prev.length}-${body.result!.ort}`,
          date: today,
          art: body.result!.art,
          ort: body.result!.ort,
          notiz: qNotiz.trim() || null,
          ansprechpartner: qAnsprech.trim() || null,
        },
        ...prev,
      ]);
      // Box/Flyer erzeugen zusätzlich einen Auslage-Ort → 2 Ranking-Punkte.
      setScore(
        (c) =>
          c + 1 + (body.result!.art === "box" || body.result!.art === "flyer" ? 1 : 0),
      );
      setQOrt("");
      setQArt("");
      setQAnsprech("");
      setQNotiz("");
      setQRecare("");
      toast.success(
        `Geloggt: ${body.result.aktion} — ${body.result.ort}${body.result.neu ? " (neu zur Liste hinzugefügt)" : ""}`,
      );
    } catch {
      toast.error("Netzwerkfehler. Bitte erneut versuchen.");
    } finally {
      setQuickBusy(false);
    }
  }
  const [logFor, setLogFor] = useState<string | null>(null);
  const [art, setArt] = useState<string>("");
  const [ansprechpartner, setAnsprechpartner] = useState("");
  const [note, setNote] = useState("");
  const [recare, setRecare] = useState<string>("");
  const [saving, setSaving] = useState(false);
  // Eigenen Ort hinzufügen
  const [addOpen, setAddOpen] = useState(false);
  const [aName, setAName] = useState("");
  const [aKategorie, setAKategorie] = useState("");
  const [aAdresse, setAAdresse] = useState("");
  const [aOrt, setAOrt] = useState("");
  const [aInfo, setAInfo] = useState("");

  async function addPlace() {
    if (saving || !aName.trim()) return;
    setSaving(true);
    try {
      const res = await fetch("/api/public/crm-target", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          token,
          name: aName,
          kategorie: aKategorie,
          adresse: aAdresse,
          ort: aOrt,
          info: aInfo,
        }),
      });
      const body = (await res.json().catch(() => ({}))) as {
        error?: string;
        target?: VisitTarget;
      };
      if (!res.ok || !body.target) {
        toast.error(body.error ?? "Speichern fehlgeschlagen.");
        return;
      }
      setTargets((prev) => [...prev, body.target!]);
      setAddOpen(false);
      setAName("");
      setAAdresse("");
      setAOrt("");
      setAInfo("");
      toast.success("Ort zur Liste hinzugefügt");
    } catch {
      toast.error("Netzwerkfehler. Bitte erneut versuchen.");
    } finally {
      setSaving(false);
    }
  }

  // Inline-Bearbeitung eines Klinik-Eintrags
  const [editFor, setEditFor] = useState<string | null>(null);
  const [eName, setEName] = useState("");
  const [eAdresse, setEAdresse] = useState("");
  const [eOrt, setEOrt] = useState("");
  const [eAnsprech, setEAnsprech] = useState("");
  const [eRecare, setERecare] = useState("");
  const [eInfo, setEInfo] = useState("");

  function startEdit(t: VisitTarget) {
    setEditFor(t.id);
    setLogFor(null);
    setEName(t.name);
    setEAdresse(t.adresse ?? "");
    setEOrt(t.ort ?? "");
    setEAnsprech(t.ansprechpartner ?? "");
    setERecare(
      t.recare_partner === true ? "ja" : t.recare_partner === false ? "nein" : "",
    );
    setEInfo(t.note ?? "");
  }

  async function saveEdit(t: VisitTarget) {
    if (saving || !eName.trim()) return;
    setSaving(true);
    try {
      const res = await fetch("/api/public/crm-visit", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          token,
          id: t.id,
          name: eName,
          adresse: eAdresse,
          ort: eOrt,
          ansprechpartner: eAnsprech,
          recare: eRecare,
          info: eInfo,
        }),
      });
      const body = (await res.json().catch(() => ({}))) as {
        error?: string;
        target?: VisitTarget;
      };
      if (!res.ok || !body.target) {
        toast.error(body.error ?? "Speichern fehlgeschlagen.");
        return;
      }
      setTargets((prev) => prev.map((x) => (x.id === t.id ? body.target! : x)));
      setEditFor(null);
      toast.success("Eintrag aktualisiert");
    } catch {
      toast.error("Netzwerkfehler. Bitte erneut versuchen.");
    } finally {
      setSaving(false);
    }
  }

  async function deleteContact(t: VisitTarget) {
    if (saving) return;
    if (
      !window.confirm(
        `Letzten Kontakt für „${t.name}“ wirklich löschen? Der Eintrag springt auf den Stand davor zurück.`,
      )
    ) {
      return;
    }
    setSaving(true);
    try {
      const res = await fetch("/api/public/crm-visit", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, id: t.id }),
      });
      const body = (await res.json().catch(() => ({}))) as {
        error?: string;
        target?: VisitTarget;
        deletedDate?: string;
      };
      if (!res.ok || !body.target) {
        toast.error(body.error ?? "Löschen fehlgeschlagen.");
        return;
      }
      setTargets((prev) => prev.map((x) => (x.id === t.id ? body.target! : x)));
      // Ranking-Punkte korrigieren, wenn der Kontakt aus dem 4-Wochen-Fenster war.
      const cutoff = new Date();
      cutoff.setDate(cutoff.getDate() - 28);
      if (
        body.deletedDate &&
        body.deletedDate >= cutoff.toISOString().slice(0, 10)
      ) {
        setScore((c) => Math.max(0, c - 1));
      }
      toast.success("Kontakt gelöscht");
    } catch {
      toast.error("Netzwerkfehler. Bitte erneut versuchen.");
    } finally {
      setSaving(false);
    }
  }

  const today = todayIso();
  const rank = (t: VisitTarget) => {
    const s = crmStatus(t, today);
    return s === "faellig" ? 0 : s === "erstbesuch" ? 1 : 2;
  };
  const sorted = [...targets].sort(
    (a, b) => rank(a) - rank(b) || a.name.localeCompare(b.name, "de"),
  );
  const pendingList = sorted.filter((t) => rank(t) < 2);
  const doneList = sorted.filter((t) => rank(t) === 2);
  const openCount = pendingList.length;

  // Anonymes Aktivitäts-Ranking: Platz = 1 + Standorte mit mehr Punkten.
  const totalHubs = otherScores.length + 1;
  const place = 1 + otherScores.filter((s) => s > score).length;
  const nextBetter =
    place > 1 ? Math.min(...otherScores.filter((s) => s > score)) : null;

  type Row = VisitTarget | { header: string; count: number };
  const rows: Row[] = [
    { header: "Noch ausstehend", count: pendingList.length },
    ...pendingList,
    ...(doneList.length > 0
      ? [
          {
            header: "Erledigt — nächster Termin steht",
            count: doneList.length,
          } as Row,
        ]
      : []),
    ...doneList,
  ];

  async function logContact(t: VisitTarget) {
    if (saving || !art) return;
    setSaving(true);
    try {
      const res = await fetch("/api/public/crm-visit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          token,
          id: t.id,
          kontakt_art: art,
          ansprechpartner,
          note,
          recare,
        }),
      });
      const body = (await res.json().catch(() => ({}))) as {
        error?: string;
        target?: VisitTarget;
        placementCreated?: boolean;
      };
      if (!res.ok || !body.target) {
        toast.error(body.error ?? "Speichern fehlgeschlagen.");
        return;
      }
      setTargets((prev) => prev.map((x) => (x.id === t.id ? body.target! : x)));
      // Box-Kontakt erzeugt zusätzlich einen Liefer-Ort → 2 Ranking-Punkte.
      setScore((c) => c + 1 + (body.placementCreated ? 1 : 0));
      setLogFor(null);
      setArt("");
      setAnsprechpartner("");
      setNote("");
      setRecare("");
      toast.success(
        body.placementCreated
          ? `Kontakt gespeichert — Box-Lieferung automatisch als Ort eingetragen. Nächstes Gespräch ab ${formatIsoDate(body.target.naechster_besuch)}`
          : `Kontakt gespeichert — nächstes Gespräch ab ${formatIsoDate(body.target.naechster_besuch)}`,
      );
    } catch {
      toast.error("Netzwerkfehler. Bitte erneut versuchen.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex flex-col gap-3">
      {/* Anonymes Aktivitäts-Ranking der Standorte */}
      <div className="flex flex-wrap items-center gap-3 rounded-xl border bg-card p-4 shadow-sm">
        <span
          className={cn(
            "flex size-11 shrink-0 items-center justify-center rounded-full",
            place === 1 ? "bg-chart-4/15" : "bg-primary/10",
          )}
        >
          <Trophy
            className={cn(
              "size-5",
              place === 1 ? "text-chart-4" : "text-primary",
            )}
          />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold">
            Ihr Standort ist{" "}
            <span className={cn(place === 1 && "text-chart-4")}>
              Platz {place} von {totalHubs}
            </span>{" "}
            auf der Wachstums-Aktivitäts-Skala
          </p>
          <p className="text-xs text-muted-foreground">
            {place === 1
              ? "Spitzenreiter — weiter so! 🏆"
              : nextBetter != null
                ? `Noch ${nextBetter - score + 1} geloggte Aktion${nextBetter - score + 1 === 1 ? "" : "en"} bis zum nächsten Platz. Jede zählt: Box, Besuch, Anruf oder Auslage.`
                : "Jede geloggte Aktion zählt: Box, Besuch, Anruf oder Auslage."}{" "}
            Gewertet werden die letzten 4 Wochen, alle Standorte anonym im
            Vergleich.
          </p>
        </div>
        <span className="shrink-0 text-right">
          <span className="block text-2xl font-semibold tabular-nums">
            {score}
          </span>
          <span className="block text-xs text-muted-foreground">
            Aktion{score === 1 ? "" : "en"} / 4 Wochen
          </span>
        </span>
      </div>

      {/* Schnell-Log: ein Formular für alles */}
      <div className="flex flex-col gap-2.5 rounded-xl border border-primary/25 bg-primary/[0.04] p-4">
        <p className="flex items-center gap-1.5 text-sm font-semibold">
          <Sparkles className="size-4 text-primary" />
          Schnell-Log — was haben Sie gemacht?
        </p>
        <div className="flex flex-col gap-1.5">
          <Label className="text-xs">Wo? (bekannte Orte werden vorgeschlagen)</Label>
          <Input
            value={qOrt}
            onChange={(e) => setQOrt(e.target.value)}
            placeholder="z. B. Klinikum Musterstadt oder Apotheke am Markt"
            list="crm-ort-suggestions"
            autoComplete="off"
            maxLength={200}
            className="bg-background"
            disabled={quickBusy}
          />
          <datalist id="crm-ort-suggestions">
            {targets.map((t) => (
              <option key={t.id} value={t.name} />
            ))}
          </datalist>
        </div>
        <div className="flex flex-col gap-1.5">
          <Label className="text-xs">Was? (Pflicht)</Label>
          <div className="grid grid-cols-2 gap-1 rounded-lg bg-muted p-1 sm:grid-cols-4">
            {KONTAKT_ARTEN.map((k) => {
              const Icon = ART_ICON[k.key];
              return (
                <button
                  key={k.key}
                  type="button"
                  onClick={() => setQArt(k.key)}
                  className={cn(
                    "flex items-center justify-center gap-1.5 rounded-md px-2 py-2 text-xs font-medium transition-colors sm:text-sm",
                    qArt === k.key
                      ? "bg-background text-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  <Icon className="size-3.5" />
                  {k.label}
                </button>
              );
            })}
          </div>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row">
          <Input
            value={qAnsprech}
            onChange={(e) => setQAnsprech(e.target.value)}
            placeholder="Ansprechpartner (optional), z. B. Frau Weber, Sozialdienst"
            autoComplete="off"
            maxLength={200}
            className="bg-background sm:flex-1"
            disabled={quickBusy}
          />
          <Input
            value={qNotiz}
            onChange={(e) => setQNotiz(e.target.value)}
            placeholder="Notiz (optional)"
            autoComplete="off"
            maxLength={1000}
            className="bg-background sm:flex-1"
            disabled={quickBusy}
          />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            size="sm"
            disabled={quickBusy || !qOrt.trim() || !qArt}
            onClick={() => void quickLog()}
          >
            <Check className="size-4" />
            {quickBusy ? "Speichere…" : "Loggen"}
          </Button>
          <div className="flex items-center gap-1 rounded-lg bg-muted p-0.5">
            {(
              [
                ["ja", "Recare: ja"],
                ["nein", "Recare: nein"],
                ["", "Recare: ?"],
              ] as const
            ).map(([value, label]) => (
              <button
                key={label}
                type="button"
                onClick={() => setQRecare(value)}
                className={cn(
                  "rounded-md px-2 py-1 text-xs transition-colors",
                  qRecare === value
                    ? "bg-background font-medium shadow-sm"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                {label}
              </button>
            ))}
          </div>
          <span className="text-xs text-muted-foreground">
            Neue Orte werden automatisch zur Liste hinzugefügt.
          </span>
        </div>
      </div>

      {/* Eigenen Ort zur Liste hinzufügen */}
      <div className="flex flex-wrap items-center gap-2">
        <p className="text-sm text-muted-foreground">
          {targets.length === 0
            ? "Ihre Liste ist noch leer — fügen Sie Orte hinzu, die Sie anfahren möchten."
            : openCount > 0
              ? `${openCount} ${openCount === 1 ? "Ort ist" : "Orte sind"} dran — Kontakt aufnehmen und loggen.`
              : "Alles erledigt — die nächsten Termine stehen unten."}
        </p>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="ml-auto"
          onClick={() => setAddOpen((v) => !v)}
        >
          <Plus className="size-4" />
          Ort hinzufügen
        </Button>
      </div>

      {addOpen && (
        <div className="flex flex-col gap-2 rounded-xl border bg-card p-3.5 shadow-sm">
          <p className="text-sm font-medium">
            Eigenen Ort zur Liste hinzufügen
          </p>
          <div className="flex flex-col gap-2 sm:flex-row">
            <Input
              value={aName}
              onChange={(e) => setAName(e.target.value)}
              placeholder="Name, z. B. Hausarztpraxis Dr. Weber"
              maxLength={200}
              className="sm:flex-1"
            />
            <Select
              items={{
                "": "Kategorie (optional)",
                ...Object.fromEntries(PLACE_KINDS.map((p) => [p.key, p.label])),
              }}
              value={aKategorie}
              onValueChange={(v) => setAKategorie(v ?? "")}
            >
              <SelectTrigger className="sm:w-56">
                <SelectValue placeholder="Kategorie (optional)" />
              </SelectTrigger>
              <SelectContent>
                {PLACE_KINDS.map((p) => (
                  <SelectItem key={p.key} value={p.key}>
                    {p.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row">
            <Input
              value={aAdresse}
              onChange={(e) => setAAdresse(e.target.value)}
              placeholder="Adresse (Straße + Nr.)"
              maxLength={200}
              className="sm:flex-1"
            />
            <Input
              value={aOrt}
              onChange={(e) => setAOrt(e.target.value)}
              placeholder="Ort/Stadt"
              maxLength={120}
              className="sm:w-44"
            />
          </div>
          <Input
            value={aInfo}
            onChange={(e) => setAInfo(e.target.value)}
            placeholder="Info (optional), z. B. warum dieser Ort"
            maxLength={500}
          />
          <div className="flex items-center gap-2">
            <Button
              type="button"
              size="sm"
              disabled={saving || !aName.trim()}
              onClick={() => void addPlace()}
            >
              {saving ? "Speichere…" : "Zur Liste hinzufügen"}
            </Button>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              disabled={saving}
              onClick={() => setAddOpen(false)}
            >
              Abbrechen
            </Button>
          </div>
        </div>
      )}

      {targets.length === 0 ? null : (
        <>
          <ul className="flex flex-col gap-2">
            {rows.map((row, idx) => {
              if ("header" in row) {
                return (
                  <li
                    key={`h-${idx}`}
                    className={cn(
                      "flex items-center gap-1.5 text-sm font-semibold",
                      idx > 0 && "mt-3",
                    )}
                  >
                    <ListTodo className="size-4 text-primary" />
                    {row.header} ({row.count})
                  </li>
                );
              }
              const t = row;
              const status = crmStatus(t, today);
              const done = status === "geplant";
              const logOpen = logFor === t.id;
              return (
                <li
                  key={t.id}
                  className={cn(
                    "flex flex-col gap-2 rounded-xl border bg-background px-3.5 py-3",
                    status === "faellig" &&
                      "border-amber-500/50 bg-amber-500/[0.05]",
                    status === "erstbesuch" &&
                      "border-primary/40 bg-primary/[0.03]",
                    done && "opacity-70",
                  )}
                >
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="flex flex-wrap items-center gap-1.5 font-medium">
                        {t.name}
                        <RecareChip t={t} />
                      </p>
                      <p className="flex items-center gap-1 text-xs text-muted-foreground">
                        <MapPin className="size-3 shrink-0" />
                        {[
                          t.kategorie ? placeKindLabel(t.kategorie) : null,
                          t.adresse,
                          t.ort,
                        ]
                          .filter(Boolean)
                          .join(" · ") || "—"}
                        {t.ansprechpartner
                          ? ` · Ansprechpartner: ${t.ansprechpartner}`
                          : ""}
                      </p>
                      {t.note && (
                        <p className="mt-0.5 text-xs text-muted-foreground/80">
                          {t.note}
                        </p>
                      )}
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        {!done &&
                          (() => {
                            const p =
                              planLabel(t.plan) ||
                              (t.kategorie === "krankenhaus"
                                ? "Box vorbeibringen"
                                : "");
                            return p ? (
                              <span className="mr-2 inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-[0.7rem] font-semibold text-primary">
                                <ListTodo className="size-3" />
                                To-do: {p}
                              </span>
                            ) : null;
                          })()}
                        {status === "erstbesuch" && (
                          <span className="font-medium text-primary">
                            Erstkontakt ausstehend
                          </span>
                        )}
                        {status === "faellig" && (
                          <span className="font-medium text-amber-700 dark:text-amber-400">
                            Nächstes Gespräch fällig (zuletzt{" "}
                            {formatIsoDate(t.letzter_besuch)}
                            {t.letzte_kontakt_art
                              ? `, ${kontaktArtLabel(t.letzte_kontakt_art)}`
                              : ""}
                            )
                          </span>
                        )}
                        {done && (
                          <>
                            <CalendarClock className="mr-1 inline size-3" />
                            {kontaktArtLabel(t.letzte_kontakt_art) || "Kontakt"}{" "}
                            am {formatIsoDate(t.letzter_besuch)}
                            {t.besuchs_notiz ? ` — „${t.besuchs_notiz}“` : ""} ·
                            nächstes Gespräch ab{" "}
                            {formatIsoDate(t.naechster_besuch)}
                          </>
                        )}
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-1">
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="size-8 text-muted-foreground"
                        disabled={saving}
                        onClick={() =>
                          editFor === t.id ? setEditFor(null) : startEdit(t)
                        }
                        aria-label="Eintrag bearbeiten"
                        title="Eintrag bearbeiten"
                      >
                        <Pencil className="size-3.5" />
                      </Button>
                      {t.letzter_besuch && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="size-8 text-muted-foreground hover:text-destructive"
                          disabled={saving}
                          onClick={() => void deleteContact(t)}
                          aria-label="Letzten Kontakt löschen"
                          title="Letzten Kontakt löschen"
                        >
                          <Trash2 className="size-3.5" />
                        </Button>
                      )}
                      <Button
                        type="button"
                        size="sm"
                        variant={done ? "outline" : "default"}
                        disabled={saving}
                        onClick={() => {
                          setLogFor(logOpen ? null : t.id);
                          setEditFor(null);
                          setArt("");
                          setAnsprechpartner(t.ansprechpartner ?? "");
                          setNote("");
                        }}
                      >
                        <Check className="size-4" />
                        Kontakt loggen
                      </Button>
                    </div>
                  </div>

                  {editFor === t.id && (
                    <div className="flex flex-col gap-2 border-t pt-2.5">
                      <div className="flex flex-col gap-2 sm:flex-row">
                        <Input
                          value={eName}
                          onChange={(e) => setEName(e.target.value)}
                          placeholder="Name der Klinik"
                          maxLength={200}
                          className="sm:flex-1"
                        />
                        <Input
                          value={eOrt}
                          onChange={(e) => setEOrt(e.target.value)}
                          placeholder="Ort/Stadt"
                          maxLength={120}
                          className="sm:w-44"
                        />
                      </div>
                      <div className="flex flex-col gap-2 sm:flex-row">
                        <Input
                          value={eAdresse}
                          onChange={(e) => setEAdresse(e.target.value)}
                          placeholder="Adresse (Straße + Nr.)"
                          maxLength={200}
                          className="sm:flex-1"
                        />
                        <Input
                          value={eAnsprech}
                          onChange={(e) => setEAnsprech(e.target.value)}
                          placeholder="Ansprechpartner Sozialdienst/CM"
                          maxLength={200}
                          className="sm:flex-1"
                        />
                      </div>
                      <Input
                        value={eInfo}
                        onChange={(e) => setEInfo(e.target.value)}
                        placeholder="Info zur Klinik (optional)"
                        maxLength={1000}
                      />
                      <div className="flex flex-col gap-1.5">
                        <Label className="text-xs">
                          Arbeitet die Klinik mit Recare?
                        </Label>
                        <div className="grid grid-cols-3 gap-1 rounded-lg bg-muted p-1">
                          {(
                            [
                              ["ja", "Ja"],
                              ["nein", "Nein"],
                              ["", "Unbekannt"],
                            ] as const
                          ).map(([value, label]) => (
                            <button
                              key={label}
                              type="button"
                              onClick={() => setERecare(value)}
                              className={cn(
                                "rounded-md px-2 py-1.5 text-xs font-medium transition-colors",
                                eRecare === value
                                  ? "bg-background text-foreground shadow-sm"
                                  : "text-muted-foreground hover:text-foreground",
                              )}
                            >
                              {label}
                            </button>
                          ))}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button
                          type="button"
                          size="sm"
                          disabled={saving || !eName.trim()}
                          onClick={() => void saveEdit(t)}
                        >
                          {saving ? "Speichere…" : "Speichern"}
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          disabled={saving}
                          onClick={() => setEditFor(null)}
                        >
                          Abbrechen
                        </Button>
                      </div>
                    </div>
                  )}

                  {logOpen && (
                    <div className="flex flex-col gap-2.5 border-t pt-2.5">
                      <div className="flex flex-col gap-1.5">
                        <Label className="text-xs">
                          Was war es? (Pflicht)
                        </Label>
                        <div className="grid grid-cols-2 gap-1 rounded-lg bg-muted p-1 sm:grid-cols-4">
                          {KONTAKT_ARTEN.map((k) => {
                            const Icon = ART_ICON[k.key];
                            return (
                              <button
                                key={k.key}
                                type="button"
                                onClick={() => setArt(k.key)}
                                className={cn(
                                  "flex items-center justify-center gap-1.5 rounded-md px-2 py-2 text-xs font-medium transition-colors sm:text-sm",
                                  art === k.key
                                    ? "bg-background text-foreground shadow-sm"
                                    : "text-muted-foreground hover:text-foreground",
                                )}
                              >
                                <Icon className="size-3.5" />
                                {k.label}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                      <div className="flex flex-col gap-1.5">
                        <Label className="text-xs">
                          Ansprechpartner Sozialdienst / Case Management
                        </Label>
                        <Input
                          value={ansprechpartner}
                          onChange={(e) => setAnsprechpartner(e.target.value)}
                          placeholder="z. B. Frau Weber, Sozialdienst, Tel. -123"
                          autoComplete="off"
                          maxLength={200}
                        />
                      </div>
                      <div className="flex flex-col gap-1.5">
                        <Label className="text-xs">
                          Arbeitet die Klinik mit Recare?
                        </Label>
                        <div className="grid grid-cols-3 gap-1 rounded-lg bg-muted p-1">
                          {(
                            [
                              ["ja", "Ja"],
                              ["nein", "Nein"],
                              ["", "Weiß nicht"],
                            ] as const
                          ).map(([value, label]) => (
                            <button
                              key={label}
                              type="button"
                              onClick={() => setRecare(value)}
                              className={cn(
                                "rounded-md px-2 py-1.5 text-xs font-medium transition-colors sm:text-sm",
                                recare === value
                                  ? "bg-background text-foreground shadow-sm"
                                  : "text-muted-foreground hover:text-foreground",
                              )}
                            >
                              {label}
                            </button>
                          ))}
                        </div>
                      </div>
                      <Textarea
                        value={note}
                        onChange={(e) => setNote(e.target.value)}
                        placeholder="Notizen zum Gespräch — was wurde besprochen, wie war die Resonanz?"
                        rows={2}
                        maxLength={1000}
                      />
                      <div className="flex items-center gap-2">
                        <Button
                          type="button"
                          size="sm"
                          disabled={saving || !art}
                          onClick={() => void logContact(t)}
                        >
                          {saving ? "Speichere…" : "Kontakt speichern"}
                        </Button>
                        <span className="text-xs text-muted-foreground">
                          Nächstes Gespräch automatisch in{" "}
                          {t.intervall_wochen} Wochen.
                        </span>
                      </div>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        </>
      )}

      {/* Vereintes Aktivitäts-Log: Kontakte + Auslagen, neueste zuerst */}
      {log.length > 0 && (
        <div className="flex flex-col gap-2 border-t pt-4">
          <p className="flex items-center gap-1.5 text-sm font-semibold">
            <CalendarClock className="size-4 text-primary" />
            Log — Ihre letzten Aktionen ({log.length})
          </p>
          <ul className="flex flex-col gap-1">
            {log.slice(0, 15).map((e) => {
              const Icon =
                ART_ICON[e.art as keyof typeof ART_ICON] ?? Check;
              return (
                <li
                  key={e.id}
                  className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5 rounded-lg bg-muted/50 px-3 py-1.5 text-sm"
                >
                  <span className="shrink-0 text-xs text-muted-foreground tabular-nums">
                    {formatIsoDate(e.date)}
                  </span>
                  <span className="flex items-center gap-1 font-medium">
                    <Icon className="size-3.5 text-primary" />
                    {kontaktArtLabel(e.art) || e.art}
                  </span>
                  <span className="min-w-0">— {e.ort}</span>
                  {e.ansprechpartner && (
                    <span className="text-xs text-muted-foreground">
                      ({e.ansprechpartner})
                    </span>
                  )}
                  {e.notiz && (
                    <span className="w-full pl-5 text-xs text-muted-foreground">
                      „{e.notiz}“
                    </span>
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}
