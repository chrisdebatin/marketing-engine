"use client";

import { useState } from "react";
import { toast } from "sonner";
import { CalendarClock, Check, MapPin, Pencil, Phone, Package, Users } from "lucide-react";
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
  todayIso,
  WEEKLY_GOAL,
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
  note?: string | null;
}

const ART_ICON = { box: Package, besuch: Users, anruf: Phone } as const;

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
 * Klinik-/CRM-Liste für die PDL: Wochenziel, fällige Kontakte zuerst,
 * Kontakt loggen (Box/Besuch/Anruf + Ansprechpartner + Gesprächsnotiz);
 * das nächste Gespräch wird automatisch in `intervall_wochen` terminiert.
 */
export function CrmVisitList({
  token,
  initial,
  initialWeekCount,
}: {
  token: string;
  initial: VisitTarget[];
  initialWeekCount: number;
}) {
  const [targets, setTargets] = useState<VisitTarget[]>(initial);
  const [weekCount, setWeekCount] = useState(initialWeekCount);
  const [logFor, setLogFor] = useState<string | null>(null);
  const [art, setArt] = useState<string>("");
  const [ansprechpartner, setAnsprechpartner] = useState("");
  const [note, setNote] = useState("");
  const [recare, setRecare] = useState<string>("");
  const [saving, setSaving] = useState(false);
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

  const today = todayIso();
  const rank = (t: VisitTarget) => {
    const s = crmStatus(t, today);
    return s === "faellig" ? 0 : s === "erstbesuch" ? 1 : 2;
  };
  const sorted = [...targets].sort(
    (a, b) => rank(a) - rank(b) || a.name.localeCompare(b.name, "de"),
  );
  const openCount = sorted.filter((t) => rank(t) < 2).length;
  const goalPct = Math.min(100, Math.round((weekCount / WEEKLY_GOAL) * 100));

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
      };
      if (!res.ok || !body.target) {
        toast.error(body.error ?? "Speichern fehlgeschlagen.");
        return;
      }
      setTargets((prev) => prev.map((x) => (x.id === t.id ? body.target! : x)));
      setWeekCount((c) => c + 1);
      setLogFor(null);
      setArt("");
      setAnsprechpartner("");
      setNote("");
      setRecare("");
      toast.success(
        `Kontakt gespeichert — nächstes Gespräch ab ${formatIsoDate(body.target.naechster_besuch)}`,
      );
    } catch {
      toast.error("Netzwerkfehler. Bitte erneut versuchen.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex flex-col gap-3">
      {/* Wochenziel */}
      <div className="flex flex-col gap-1.5 rounded-xl border bg-card p-4 shadow-sm">
        <div className="flex items-baseline justify-between text-sm">
          <span className="font-medium">
            Wochenziel: {WEEKLY_GOAL} Klinik-Kontakte
          </span>
          <span className="font-semibold tabular-nums">
            {weekCount}
            <span className="font-normal text-muted-foreground">
              {" "}
              / {WEEKLY_GOAL} diese Woche
            </span>
          </span>
        </div>
        <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
          <div
            className={cn(
              "h-full rounded-full transition-all",
              weekCount >= WEEKLY_GOAL ? "bg-chart-4" : "bg-primary",
            )}
            style={{ width: `${goalPct}%` }}
          />
        </div>
        <span className="text-xs text-muted-foreground">
          {weekCount >= WEEKLY_GOAL
            ? "Wochenziel erreicht — stark! 🎉"
            : `Noch ${WEEKLY_GOAL - weekCount} Kontakt${WEEKLY_GOAL - weekCount === 1 ? "" : "e"} bis zum Wochenziel. Jeder Kontakt zählt: Box, Besuch oder Anruf — bitte immer loggen.`}
        </span>
      </div>

      {targets.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Aktuell sind Ihnen keine Kliniken zugeteilt.
        </p>
      ) : (
        <>
          <p className="text-sm text-muted-foreground">
            {openCount > 0
              ? `${openCount} ${openCount === 1 ? "Klinik ist" : "Kliniken sind"} dran — Kontakt aufnehmen und unten loggen.`
              : "Alles erledigt — die nächsten Termine stehen unten."}
          </p>
          <ul className="flex flex-col gap-2">
            {sorted.map((t) => {
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
                        <div className="grid grid-cols-3 gap-1 rounded-lg bg-muted p-1">
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
    </div>
  );
}
