"use client";

import { useRef, useState } from "react";
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
  relevanzOf,
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
  relevanz?: number | null;
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

/** Interne Import-Marker aus der Notiz filtern — die PDL sieht nur Nützliches. */
function displayNote(note: string | null | undefined): string {
  if (!note) return "";
  return note
    .split("·")
    .map((part) => part.trim())
    .filter(
      (part) =>
        part &&
        !/Auto-|bitte verifizieren|Quelle:|Recare-Status|Von der PDL selbst|Relevanz [1-3]|nächster Standort/.test(
          part,
        ),
    )
    .join(" · ");
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
  leaderboard = [],
  initialLog = [],
  followup = { box: 8, flyer: 8, besuch: 4, anruf: 4 },
}: {
  token: string;
  initial: VisitTarget[];
  /** Aktivitäten dieses Standorts in den letzten 4 Wochen. */
  initialScore: number;
  /** Aktivitäts-Werte der anderen Standorte — anonym, nur Zahlen. */
  otherScores: number[];
  /** Leaderboard mit Standort-Namen (Aktionen der letzten 4 Wochen). */
  leaderboard?: { name: string; score: number; isOwn: boolean }[];
  /** Vereintes Log (Kontakte + Auslagen), neueste zuerst. */
  initialLog?: CrmLogEntry[];
  /** Follow-up-Rhythmus in Wochen je Kontakt-Art (zentral eingestellt). */
  followup?: { box: number; flyer: number; besuch: number; anruf: number };
}) {
  const [targets, setTargets] = useState<VisitTarget[]>(initial);
  const [score, setScore] = useState(initialScore);
  const [log, setLog] = useState<CrmLogEntry[]>(initialLog);
  const [showAllVorschlaege, setShowAllVorschlaege] = useState(false);
  // Log-Eintrag bearbeiten
  const [logEditId, setLogEditId] = useState<string | null>(null);
  const [leArt, setLeArt] = useState("");
  const [leDate, setLeDate] = useState("");
  const [leAnsprech, setLeAnsprech] = useState("");
  const [leNotiz, setLeNotiz] = useState("");

  function startLogEdit(e: CrmLogEntry) {
    setLogEditId(e.id);
    setLeArt(e.art);
    setLeDate(e.date);
    setLeAnsprech(e.ansprechpartner ?? "");
    setLeNotiz(e.notiz ?? "");
  }

  async function saveLogEdit(e: CrmLogEntry) {
    if (saving || !leArt || !leDate) return;
    setSaving(true);
    try {
      const res = await fetch("/api/public/crm-contact", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          token,
          id: e.id,
          kontakt_art: leArt,
          contact_date: leDate,
          ansprechpartner: leAnsprech,
          note: leNotiz,
        }),
      });
      const body = (await res.json().catch(() => ({}))) as {
        error?: string;
        entry?: Omit<CrmLogEntry, "ort">;
        target?: VisitTarget;
      };
      if (!res.ok || !body.entry) {
        toast.error(body.error ?? "Speichern fehlgeschlagen.");
        return;
      }
      setLog((prev) =>
        prev.map((x) => (x.id === e.id ? { ...body.entry!, ort: x.ort } : x)),
      );
      if (body.target) {
        setTargets((prev) =>
          prev.map((x) => (x.id === body.target!.id ? body.target! : x)),
        );
      }
      setLogEditId(null);
      toast.success("Log-Eintrag aktualisiert");
    } catch {
      toast.error("Netzwerkfehler. Bitte erneut versuchen.");
    } finally {
      setSaving(false);
    }
  }

  async function deleteLogEntry(e: CrmLogEntry) {
    if (saving) return;
    if (
      !window.confirm(
        `Log-Eintrag „${kontaktArtLabel(e.art) || e.art} — ${e.ort}“ vom ${formatIsoDate(e.date)} löschen?`,
      )
    ) {
      return;
    }
    setSaving(true);
    try {
      const isPlacement = e.id.startsWith("pl-");
      const res = await fetch(
        isPlacement ? "/api/public/hub-placement" : "/api/public/crm-contact",
        {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            token,
            id: isPlacement ? e.id.slice(3) : e.id,
          }),
        },
      );
      const body = (await res.json().catch(() => ({}))) as {
        error?: string;
        target?: VisitTarget | null;
      };
      if (!res.ok) {
        toast.error(body.error ?? "Löschen fehlgeschlagen.");
        return;
      }
      setLog((prev) => prev.filter((x) => x.id !== e.id));
      if (body.target) {
        setTargets((prev) =>
          prev.map((x) => (x.id === body.target!.id ? body.target! : x)),
        );
      }
      const cutoff = new Date();
      cutoff.setDate(cutoff.getDate() - 28);
      if (e.date >= cutoff.toISOString().slice(0, 10)) {
        setScore((c) => Math.max(0, c - 1));
      }
      toast.success("Log-Eintrag gelöscht");
    } catch {
      toast.error("Netzwerkfehler. Bitte erneut versuchen.");
    } finally {
      setSaving(false);
    }
  }
  // Schnell-Log: EIN Formular für alles (Ort + Aktion, Rest optional)
  const [qOrt, setQOrt] = useState("");
  // Vom Karten-Vorschlag übernommene Details (Adresse/Ort/Kategorie)
  const [qMeta, setQMeta] = useState<{
    adresse: string | null;
    ort: string | null;
    kategorie: string | null;
  } | null>(null);
  const [mapSuggestions, setMapSuggestions] = useState<
    { name: string; adresse: string | null; ort: string | null; kategorie: string | null }[]
  >([]);
  const [suggestOpen, setSuggestOpen] = useState(false);
  const suggestTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  function onOrtInput(value: string) {
    setQOrt(value);
    setQMeta(null);
    setSuggestOpen(true);
    if (suggestTimer.current) clearTimeout(suggestTimer.current);
    if (value.trim().length < 3) {
      setMapSuggestions([]);
      return;
    }
    // Karten-Suche leicht verzögert, damit nicht jeder Tastendruck anfragt.
    suggestTimer.current = setTimeout(async () => {
      try {
        const res = await fetch(
          `/api/public/place-search?token=${encodeURIComponent(token)}&q=${encodeURIComponent(value.trim())}`,
        );
        const body = (await res.json().catch(() => ({}))) as {
          places?: typeof mapSuggestions;
        };
        setMapSuggestions(body.places ?? []);
      } catch {
        setMapSuggestions([]);
      }
    }, 350);
  }
  const [qArt, setQArt] = useState("");
  const [qAnsprech, setQAnsprech] = useState("");
  const [qNotiz, setQNotiz] = useState("");
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
          kategorie: qMeta?.kategorie ?? "",
          adresse: qMeta?.adresse ?? "",
          ort: qMeta?.ort ?? "",
          ansprechpartner: qAnsprech,
          notiz: qNotiz,
        }),
      });
      const body = (await res.json().catch(() => ({}))) as {
        error?: string;
        result?: {
          ort: string;
          aktion: string;
          art: string;
          neu: boolean;
          contactId?: string | null;
          warnung?: string | null;
        };
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
          id:
            body.result!.contactId ??
            `quick-${today}-${prev.length}-${body.result!.ort}`,
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
      setQMeta(null);
      setMapSuggestions([]);
      setQArt("");
      setQAnsprech("");
      setQNotiz("");
      toast.success(
        `Geloggt: ${body.result.aktion} — ${body.result.ort}${body.result.neu ? " (neu zur Liste hinzugefügt)" : ""}`,
      );
      if (body.result.warnung) {
        toast.warning(body.result.warnung, { duration: 8000 });
      }
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
        warnung?: string | null;
      };
      if (!res.ok || !body.target) {
        toast.error(body.error ?? "Speichern fehlgeschlagen.");
        return;
      }
      setTargets((prev) => [...prev, body.target!]);
      if (body.warnung) toast.warning(body.warnung, { duration: 8000 });
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
  const [eInfo, setEInfo] = useState("");

  function startEdit(t: VisitTarget) {
    setEditFor(t.id);
    setLogFor(null);
    setEName(t.name);
    setEAdresse(t.adresse ?? "");
    setEOrt(t.ort ?? "");
    setEAnsprech(t.ansprechpartner ?? "");
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
  // Innerhalb der Gruppen: wichtigste zuerst (Prio 1–3), dann alphabetisch.
  const sorted = [...targets].sort(
    (a, b) =>
      rank(a) - rank(b) ||
      (relevanzOf(a) ?? 9) - (relevanzOf(b) ?? 9) ||
      a.name.localeCompare(b.name, "de"),
  );
  // Ein Menü, drei Abschnitte: offene Follow-ups, vorgeschlagene (noch nie
  // besuchte) Orte zum Abhaken, erledigte mit stehendem Termin.
  const offenList = sorted.filter((t) => rank(t) === 0);
  const vorgeschlagenList = sorted.filter((t) => rank(t) === 1);
  const doneList = sorted.filter((t) => rank(t) === 2);
  const openCount = offenList.length + vorgeschlagenList.length;

  // Ranking: Platz = 1 + Standorte mit mehr Punkten.
  const place = 1 + otherScores.filter((s) => s > score).length;
  const nextBetter =
    place > 1 ? Math.min(...otherScores.filter((s) => s > score)) : null;

  // Vorschläge in Wochen-Häppchen: 5 für diese Woche, 5 für nächste,
  // der Rest wartet eingeklappt unter "Später".
  const dieseWoche = vorgeschlagenList.slice(0, 5);
  const naechsteWoche = vorgeschlagenList.slice(5, 10);
  const spaeter = vorgeschlagenList.slice(10);

  type Row =
    | VisitTarget
    | { header: string; hint?: string; count: number }
    | { more: number };
  const rows: Row[] = [
    ...(offenList.length > 0
      ? [
          {
            header: "Offene Orte — Follow-up fällig",
            count: offenList.length,
          } as Row,
          ...offenList,
        ]
      : []),
    ...(dieseWoche.length > 0
      ? [
          {
            header: "Vorgeschlagen für diese Woche",
            hint: "Die wichtigsten zuerst — Box vorbeibringen, Besuch oder Anruf, danach abhaken (loggen).",
            count: dieseWoche.length,
          } as Row,
          ...dieseWoche,
        ]
      : []),
    ...(naechsteWoche.length > 0
      ? [
          {
            header: "Nächste Woche",
            count: naechsteWoche.length,
          } as Row,
          ...naechsteWoche,
        ]
      : []),
    ...(spaeter.length > 0
      ? [
          { header: "Später", count: spaeter.length } as Row,
          ...(showAllVorschlaege
            ? spaeter
            : [{ more: spaeter.length } as Row]),
        ]
      : []),
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
        }),
      });
      const body = (await res.json().catch(() => ({}))) as {
        error?: string;
        target?: VisitTarget;
        placementCreated?: boolean;
        contactId?: string | null;
      };
      if (!res.ok || !body.target) {
        toast.error(body.error ?? "Speichern fehlgeschlagen.");
        return;
      }
      setTargets((prev) => prev.map((x) => (x.id === t.id ? body.target! : x)));
      const heute = todayIso();
      setLog((prev) => [
        {
          id: body.contactId ?? `quick-${heute}-${prev.length}-${t.name}`,
          date: heute,
          art,
          ort: t.name,
          notiz: note.trim() || null,
          ansprechpartner: ansprechpartner.trim() || null,
        },
        ...prev,
      ]);
      // Box-Kontakt erzeugt zusätzlich einen Liefer-Ort → 2 Ranking-Punkte.
      setScore((c) => c + 1 + (body.placementCreated ? 1 : 0));
      setLogFor(null);
      setArt("");
      setAnsprechpartner("");
      setNote("");
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
      {/* Leaderboard: wer hat die meisten Aktionen geloggt? */}
      {(() => {
        const rows = leaderboard
          .map((r) => (r.isOwn ? { ...r, score } : r))
          .sort((a, b) => b.score - a.score || a.name.localeCompare(b.name, "de"));
        const maxScore = Math.max(1, rows[0]?.score ?? 0);
        const ownIdx = rows.findIndex((r) => r.isOwn);
        const TOP = 8;
        const shown = rows.slice(0, TOP);
        const ownOutside = ownIdx >= TOP ? rows[ownIdx] : null;
        const medal = (i: number) =>
          i === 0 ? "👑" : i === 1 ? "🥈" : i === 2 ? "🥉" : `${i + 1}.`;
        const bar = (r: (typeof rows)[number], i: number) => (
          <li key={r.name} className="flex items-center gap-2">
            <span
              className={cn(
                "w-7 shrink-0 text-right text-sm tabular-nums",
                i === 0 && "text-base",
              )}
              aria-label={`Platz ${i + 1}`}
            >
              {medal(i)}
            </span>
            <span
              className={cn(
                "w-40 shrink-0 truncate text-sm sm:w-52",
                r.isOwn ? "font-semibold" : "text-muted-foreground",
              )}
            >
              {r.name}
              {r.isOwn ? " (Sie)" : ""}
            </span>
            <span className="h-4 min-w-0 flex-1">
              <span
                className={cn(
                  "block h-full rounded-r-[4px] transition-all",
                  r.isOwn
                    ? "bg-primary"
                    : i === 0
                      ? "bg-amber-400"
                      : "bg-primary/30",
                )}
                style={{
                  width: `${Math.max(r.score === 0 ? 0 : 4, (r.score / maxScore) * 100)}%`,
                }}
              />
            </span>
            <span
              className={cn(
                "w-8 shrink-0 text-right text-sm tabular-nums",
                r.isOwn && "font-semibold",
              )}
            >
              {r.score}
            </span>
          </li>
        );
        return (
          <div className="flex flex-col gap-2 rounded-xl border bg-card p-4 shadow-sm">
            <div className="flex flex-wrap items-baseline gap-x-2">
              <p className="flex items-center gap-1.5 text-sm font-semibold">
                <Trophy className="size-4 text-primary" />
                Aktions-Leaderboard
              </p>
              <span className="text-xs text-muted-foreground">
                geloggte Aktionen der letzten 4 Wochen — Sie sind Platz{" "}
                {ownIdx + 1} von {rows.length}
                {place === 1
                  ? " 👑"
                  : nextBetter != null
                    ? ` · noch ${nextBetter - score + 1} Aktion${nextBetter - score + 1 === 1 ? "" : "en"} bis zum nächsten Platz`
                    : ""}
              </span>
            </div>
            <ul className="flex flex-col gap-1.5">
              {shown.map((r, i) => bar(r, i))}
              {ownOutside && (
                <>
                  <li className="pl-9 text-xs text-muted-foreground">…</li>
                  {bar(ownOutside, ownIdx)}
                </>
              )}
            </ul>
          </div>
        );
      })()}

      {/* Schnell-Log: ein Formular für alles */}
      <div className="flex flex-col gap-2.5 rounded-xl border border-primary/25 bg-primary/[0.04] p-4">
        <p className="flex items-center gap-1.5 text-sm font-semibold">
          <Sparkles className="size-4 text-primary" />
          Schnell-Log — was haben Sie gemacht?
        </p>
        <div className="flex flex-col gap-1.5">
          <Label className="text-xs">
            Wo? (Ihre Liste und die Karte werden durchsucht)
          </Label>
          <div className="relative">
            <Input
              value={qOrt}
              onChange={(e) => onOrtInput(e.target.value)}
              onFocus={() => setSuggestOpen(true)}
              onBlur={() => setTimeout(() => setSuggestOpen(false), 150)}
              placeholder="z. B. Klinikum Musterstadt oder Apotheke am Markt"
              autoComplete="off"
              maxLength={200}
              className="bg-background"
              disabled={quickBusy}
            />
            {suggestOpen &&
              qOrt.trim().length >= 2 &&
              (() => {
                const q = qOrt.trim().toLowerCase();
                const own = targets
                  .filter((t) => t.name.toLowerCase().includes(q))
                  .slice(0, 4);
                const ownNames = new Set(own.map((t) => t.name.toLowerCase()));
                const map = mapSuggestions
                  .filter((m) => !ownNames.has(m.name.toLowerCase()))
                  .slice(0, 5);
                if (own.length === 0 && map.length === 0) return null;
                return (
                  <div className="absolute top-full right-0 left-0 z-20 mt-1 overflow-hidden rounded-lg border bg-popover shadow-md">
                    {own.length > 0 && (
                      <p className="px-3 pt-2 pb-1 text-[0.65rem] font-semibold tracking-wide text-muted-foreground uppercase">
                        Aus Ihrer Liste
                      </p>
                    )}
                    {own.map((t) => (
                      <button
                        key={t.id}
                        type="button"
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={() => {
                          setQOrt(t.name);
                          setQMeta(null);
                          setSuggestOpen(false);
                        }}
                        className="flex w-full flex-col px-3 py-1.5 text-left text-sm hover:bg-accent"
                      >
                        <span className="font-medium">{t.name}</span>
                        <span className="text-xs text-muted-foreground">
                          {[t.kategorie ? placeKindLabel(t.kategorie) : null, t.ort]
                            .filter(Boolean)
                            .join(" · ") || "bereits in Ihrer Liste"}
                        </span>
                      </button>
                    ))}
                    {map.length > 0 && (
                      <p className="border-t px-3 pt-2 pb-1 text-[0.65rem] font-semibold tracking-wide text-muted-foreground uppercase">
                        Aus der Karte
                      </p>
                    )}
                    {map.map((m, i) => (
                      <button
                        key={`${m.name}-${i}`}
                        type="button"
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={() => {
                          setQOrt(m.name);
                          setQMeta({
                            adresse: m.adresse,
                            ort: m.ort,
                            kategorie: m.kategorie,
                          });
                          setSuggestOpen(false);
                        }}
                        className="flex w-full flex-col px-3 py-1.5 text-left text-sm hover:bg-accent"
                      >
                        <span className="font-medium">{m.name}</span>
                        <span className="text-xs text-muted-foreground">
                          {[
                            m.kategorie ? placeKindLabel(m.kategorie) : null,
                            m.adresse,
                            m.ort,
                          ]
                            .filter(Boolean)
                            .join(" · ") || "Karten-Treffer"}
                        </span>
                      </button>
                    ))}
                  </div>
                );
              })()}
          </div>
          {qMeta && (
            <p className="text-xs text-muted-foreground">
              Übernommen aus der Karte:{" "}
              {[qMeta.adresse, qMeta.ort].filter(Boolean).join(", ") ||
                "Details"}{" "}
              — wird beim Anlegen gespeichert.
            </p>
          )}
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
              if ("more" in row) {
                return (
                  <li key={`more-${idx}`}>
                    <button
                      type="button"
                      className="w-full rounded-xl border border-dashed px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-muted/50 hover:text-foreground"
                      onClick={() => setShowAllVorschlaege(true)}
                    >
                      {row.more} weitere Orte anzeigen
                    </button>
                  </li>
                );
              }
              if ("header" in row) {
                return (
                  <li key={`h-${idx}`} className={cn(idx > 0 && "mt-3")}>
                    <p className="flex items-center gap-1.5 text-sm font-semibold">
                      <ListTodo className="size-4 text-primary" />
                      {row.header} ({row.count})
                    </p>
                    {row.hint && (
                      <p className="mt-0.5 ml-5.5 text-xs text-muted-foreground">
                        {row.hint}
                      </p>
                    )}
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
                        {relevanzOf(t) != null && (
                          <span
                            className={cn(
                              "rounded-full px-2 py-0.5 text-[0.65rem] font-semibold whitespace-nowrap",
                              relevanzOf(t) === 1
                                ? "bg-primary text-primary-foreground"
                                : relevanzOf(t) === 2
                                  ? "bg-primary/10 text-primary"
                                  : "bg-muted text-muted-foreground",
                            )}
                          >
                            Prio {relevanzOf(t)}
                          </span>
                        )}
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
                      {displayNote(t.note) && (
                        <p className="mt-0.5 text-xs text-muted-foreground/80">
                          {displayNote(t.note)}
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
                          {art
                            ? `Nächster Termin automatisch in ${followup[art as keyof typeof followup] ?? 4} Wochen.`
                            : "Nächster Termin wird automatisch geplant (Box/Flyer und Besuch/Anruf haben eigene Rhythmen)."}
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
              const isPlacement = e.id.startsWith("pl-");
              const editable = !isPlacement && !e.id.startsWith("quick-");
              return (
                <li
                  key={e.id}
                  className="flex flex-col gap-1 rounded-lg bg-muted/50 px-3 py-1.5 text-sm"
                >
                  <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
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
                    <span className="ml-auto flex shrink-0 items-center">
                      {editable && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="size-7 text-muted-foreground"
                          disabled={saving}
                          onClick={() =>
                            logEditId === e.id
                              ? setLogEditId(null)
                              : startLogEdit(e)
                          }
                          aria-label="Log-Eintrag bearbeiten"
                          title="Bearbeiten"
                        >
                          <Pencil className="size-3.5" />
                        </Button>
                      )}
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="size-7 text-muted-foreground hover:text-destructive"
                        disabled={saving || e.id.startsWith("quick-")}
                        onClick={() => void deleteLogEntry(e)}
                        aria-label="Log-Eintrag löschen"
                        title="Löschen"
                      >
                        <Trash2 className="size-3.5" />
                      </Button>
                    </span>
                  </div>
                  {e.notiz && logEditId !== e.id && (
                    <span className="pl-5 text-xs text-muted-foreground">
                      „{e.notiz}“
                    </span>
                  )}

                  {logEditId === e.id && (
                    <div className="flex flex-col gap-2 border-t pt-2">
                      <div className="grid grid-cols-2 gap-1 rounded-lg bg-muted p-1 sm:grid-cols-4">
                        {KONTAKT_ARTEN.map((k) => {
                          const KIcon = ART_ICON[k.key];
                          return (
                            <button
                              key={k.key}
                              type="button"
                              onClick={() => setLeArt(k.key)}
                              className={cn(
                                "flex items-center justify-center gap-1.5 rounded-md px-2 py-1.5 text-xs font-medium transition-colors",
                                leArt === k.key
                                  ? "bg-background text-foreground shadow-sm"
                                  : "text-muted-foreground hover:text-foreground",
                              )}
                            >
                              <KIcon className="size-3.5" />
                              {k.label}
                            </button>
                          );
                        })}
                      </div>
                      <div className="flex flex-col gap-2 sm:flex-row">
                        <Input
                          type="date"
                          value={leDate}
                          onChange={(ev) => setLeDate(ev.target.value)}
                          className="bg-background sm:w-40"
                        />
                        <Input
                          value={leAnsprech}
                          onChange={(ev) => setLeAnsprech(ev.target.value)}
                          placeholder="Ansprechpartner (optional)"
                          maxLength={200}
                          className="bg-background sm:flex-1"
                        />
                      </div>
                      <Input
                        value={leNotiz}
                        onChange={(ev) => setLeNotiz(ev.target.value)}
                        placeholder="Notiz (optional)"
                        maxLength={1000}
                        className="bg-background"
                      />
                      <div className="flex items-center gap-2">
                        <Button
                          type="button"
                          size="sm"
                          disabled={saving || !leArt || !leDate}
                          onClick={() => void saveLogEdit(e)}
                        >
                          {saving ? "Speichere…" : "Speichern"}
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          disabled={saving}
                          onClick={() => setLogEditId(null)}
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
        </div>
      )}
    </div>
  );
}
