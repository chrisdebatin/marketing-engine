"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import { formatIsoDate } from "@/lib/crm";

/**
 * Recruiting-Leads (Meta-Anzeigen + Website-Bewerbungen): Tages-Chart über
 * die letzten 30 Tage (gestapelte Balken je Quelle, validierte Palette:
 * Meta = Blau, Website = Orange) und die Liste der Bewerber — neueste zuerst.
 */

export interface RecruitingRow {
  id: string;
  datum: string; // ISO
  name: string;
  telefon: string | null;
  email: string | null;
  quelle: "meta" | "website";
  /** Kampagne (Meta) bzw. Anliegen-Auszug (Website). */
  detail: string | null;
  rolle: string | null;
  weitergeleitet: boolean;
  /** Roh-ID + Typ für die Weiterleitung an einen Standort. */
  quelleId: string;
  quelleTyp: "meta" | "website";
  /** Standort-Vorschlag aus dem Kampagnennamen. */
  vorschlagHubId: string | null;
  /** Bereits an diesen Standort weitergeleitet (Name), sonst null. */
  pdlHub: string | null;
}

export interface RecruitingHub {
  id: string;
  name: string;
  pdl: string | null;
}

const QUELLE_META = { label: "Meta-Anzeigen", farbe: "#2a78d6" };
const QUELLE_WEBSITE = { label: "Website", farbe: "#eb6834" };

export function RecruitingOverview({
  rows,
  hubs,
}: {
  rows: RecruitingRow[];
  hubs: RecruitingHub[];
}) {
  const [hover, setHover] = useState<number | null>(null);
  // Weiterleitungen, die in dieser Sitzung passiert sind (Hub-Name je Zeile).
  const [gesendet, setGesendet] = useState<Record<string, string>>({});

  // ── Tages-Buckets der letzten 30 Tage ──
  const heute = new Date();
  heute.setHours(0, 0, 0, 0);
  const tage = Array.from({ length: 30 }, (_, i) => {
    const d = new Date(heute.getTime() - (29 - i) * 86_400_000);
    return {
      iso: d.toISOString().slice(0, 10),
      label: `${d.getDate()}.${d.getMonth() + 1}.`,
      meta: 0,
      website: 0,
    };
  });
  const byIso = new Map(tage.map((t) => [t.iso, t]));
  for (const r of rows) {
    const b = byIso.get(r.datum.slice(0, 10));
    if (b) b[r.quelle]++;
  }
  const max = Math.max(1, ...tage.map((t) => t.meta + t.website));

  return (
    <div className="flex flex-col gap-4">
      {/* Tages-Chart */}
      <section className="rounded-xl border bg-card p-4 shadow-sm">
        <h2 className="text-sm font-semibold">Eingänge pro Tag — letzte 30 Tage</h2>
        <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1">
          {(
            [
              [QUELLE_META, rows.filter((r) => r.quelle === "meta").length],
              [QUELLE_WEBSITE, rows.filter((r) => r.quelle === "website").length],
            ] as const
          ).map(([q, n]) => (
            <span key={q.label} className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <span className="size-2.5 rounded-[3px]" style={{ background: q.farbe }} />
              {q.label} · <span className="font-semibold text-foreground tabular-nums">{n}</span>
            </span>
          ))}
        </div>
        <div className="relative mt-3">
          <div className="flex h-36 items-end gap-[3px]">
            {tage.map((t, i) => {
              const gesamt = t.meta + t.website;
              return (
                <div
                  key={t.iso}
                  className="group relative flex h-full flex-1 flex-col justify-end"
                  onMouseEnter={() => setHover(i)}
                  onMouseLeave={() => setHover(null)}
                  title={`${t.label}: ${gesamt} (Meta ${t.meta} · Website ${t.website})`}
                >
                  {t.website > 0 && (
                    <div
                      style={{
                        height: `${(t.website / max) * 100}%`,
                        background: QUELLE_WEBSITE.farbe,
                      }}
                      className={cn("w-full", t.meta === 0 && "rounded-t-[3px]")}
                    />
                  )}
                  {t.meta > 0 && (
                    <div
                      style={{
                        height: `${(t.meta / max) * 100}%`,
                        background: QUELLE_META.farbe,
                        marginBottom: t.website > 0 ? 2 : 0,
                      }}
                      className="order-first w-full rounded-t-[3px]"
                    />
                  )}
                  {gesamt === 0 && <div className="h-px w-full bg-border" />}
                </div>
              );
            })}
          </div>
          <div className="mt-1 flex justify-between text-[10px] text-muted-foreground">
            <span>{tage[0]?.label}</span>
            <span>{tage[14]?.label}</span>
            <span>heute</span>
          </div>
          {hover != null && (tage[hover].meta > 0 || tage[hover].website > 0) && (
            <div
              className="pointer-events-none absolute -top-1 z-10 w-40 -translate-x-1/2 rounded-lg border bg-card p-2 text-xs shadow-md"
              style={{ left: `${((hover + 0.5) / 30) * 100}%` }}
            >
              <p className="font-semibold">{tage[hover].label}</p>
              <p className="mt-0.5 flex items-center gap-1.5">
                <span className="size-2 rounded-[2px]" style={{ background: QUELLE_META.farbe }} />
                Meta <span className="ml-auto font-semibold tabular-nums">{tage[hover].meta}</span>
              </p>
              <p className="flex items-center gap-1.5">
                <span className="size-2 rounded-[2px]" style={{ background: QUELLE_WEBSITE.farbe }} />
                Website <span className="ml-auto font-semibold tabular-nums">{tage[hover].website}</span>
              </p>
            </div>
          )}
        </div>
      </section>

      {/* Liste */}
      <section className="rounded-xl border bg-card p-4 shadow-sm">
        <h2 className="text-sm font-semibold">Alle Recruiting-Leads ({rows.length})</h2>
        <p className="mt-0.5 text-xs text-muted-foreground">
          Neueste zuerst. Meta-Leads werden automatisch ans Recruiting-Postfach
          weitergeleitet, Website-Bewerbungen an recruiting@pflegeunion.de.
        </p>
        {rows.length === 0 ? (
          <p className="mt-3 text-sm text-muted-foreground">
            Noch keine Recruiting-Leads eingegangen.
          </p>
        ) : (
          <ul className="mt-3 divide-y">
            {rows.slice(0, 150).map((r) => (
              <li
                key={r.id}
                className="flex flex-wrap items-center gap-x-3 gap-y-1 py-2 text-sm"
              >
                <span className="w-24 shrink-0 text-xs text-muted-foreground tabular-nums">
                  {formatIsoDate(r.datum.slice(0, 10))}
                </span>
                <span className="font-medium">{r.name}</span>
                <span
                  className="rounded-full px-2 py-0.5 text-[11px] font-semibold text-white"
                  style={{
                    background:
                      r.quelle === "meta" ? QUELLE_META.farbe : QUELLE_WEBSITE.farbe,
                  }}
                >
                  {r.quelle === "meta" ? "Meta" : "Website"}
                </span>
                {r.rolle && (
                  <span className="rounded-full border px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
                    {r.rolle}
                  </span>
                )}
                {r.telefon && (
                  <a href={`tel:${r.telefon}`} className="text-xs text-primary hover:underline">
                    {r.telefon}
                  </a>
                )}
                {r.email && (
                  <a href={`mailto:${r.email}`} className="text-xs text-primary hover:underline">
                    {r.email}
                  </a>
                )}
                {r.detail && (
                  <span
                    className="max-w-64 truncate text-xs text-muted-foreground"
                    title={r.detail}
                  >
                    {r.detail}
                  </span>
                )}
                <PdlWeiterleiten
                  className="ml-auto"
                  row={r}
                  hubs={hubs}
                  bereits={gesendet[r.id] ?? r.pdlHub}
                  onDone={(hubName) =>
                    setGesendet((g) => ({ ...g, [r.id]: hubName }))
                  }
                />
                <span
                  className={cn(
                    "text-[11px] font-medium",
                    r.weitergeleitet ? "text-emerald-700" : "text-amber-700",
                  )}
                  title={
                    r.weitergeleitet
                      ? "ans Recruiting-Postfach weitergeleitet"
                      : "Weiterleitung steht noch aus"
                  }
                >
                  {r.weitergeleitet ? "✓ weitergeleitet" : "wartet"}
                </span>
              </li>
            ))}
            {rows.length > 150 && (
              <li className="py-2 text-center text-xs text-muted-foreground">
                +{rows.length - 150} ältere Leads
              </li>
            )}
          </ul>
        )}
      </section>
    </div>
  );
}

/**
 * "Zur PDL weiterleiten": Standort-Auswahl (mit Vorschlag aus dem
 * Kampagnennamen) und Bestätigung. Danach sieht die PDL die Bewerbung unter
 * "Meine Bewerber" — inklusive KI-Einstufung.
 */
function PdlWeiterleiten({
  row,
  hubs,
  bereits,
  onDone,
  className,
}: {
  row: RecruitingRow;
  hubs: RecruitingHub[];
  bereits: string | null;
  onDone: (hubName: string) => void;
  className?: string;
}) {
  const [offen, setOffen] = useState(false);
  const [hubId, setHubId] = useState(row.vorschlagHubId ?? "");
  const [busy, setBusy] = useState(false);
  const [fehler, setFehler] = useState<string | null>(null);

  if (bereits) {
    return (
      <span
        className={cn(
          "rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-semibold text-emerald-800",
          className,
        )}
        title={`Diese Bewerbung liegt bei ${bereits}`}
      >
        → {bereits}
      </span>
    );
  }

  async function senden() {
    if (!hubId) return;
    setBusy(true);
    setFehler(null);
    try {
      const res = await fetch("/api/recruiting/forward", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          quelle: row.quelleTyp,
          quelle_id: row.quelleId,
          name: row.name,
          telefon: row.telefon,
          email: row.email,
          rolle: row.rolle,
          kampagne: row.detail,
          hub_id: hubId,
        }),
      });
      const j = (await res.json().catch(() => ({}))) as {
        error?: string;
        hub?: string;
      };
      if (!res.ok) throw new Error(j.error ?? "Fehler beim Weiterleiten.");
      onDone(j.hub ?? hubs.find((h) => h.id === hubId)?.name ?? "Standort");
      setOffen(false);
    } catch (e) {
      setFehler(e instanceof Error ? e.message : "Fehler");
    } finally {
      setBusy(false);
    }
  }

  if (!offen) {
    return (
      <button
        type="button"
        onClick={() => setOffen(true)}
        className={cn(
          "rounded-md border px-2 py-0.5 text-[11px] font-medium text-muted-foreground hover:text-foreground",
          className,
        )}
      >
        zur PDL weiterleiten
      </button>
    );
  }

  return (
    <span className={cn("flex flex-wrap items-center gap-1.5", className)}>
      <select
        value={hubId}
        onChange={(e) => setHubId(e.target.value)}
        className="h-7 rounded-md border bg-background px-1.5 text-xs"
      >
        <option value="">Standort wählen…</option>
        {hubs.map((h) => (
          <option key={h.id} value={h.id}>
            {h.name}
            {h.id === row.vorschlagHubId ? " (Vorschlag)" : ""}
            {h.pdl ? ` — ${h.pdl}` : ""}
          </option>
        ))}
      </select>
      <button
        type="button"
        disabled={busy || !hubId}
        onClick={senden}
        className="rounded-md bg-primary px-2 py-1 text-[11px] font-medium text-primary-foreground disabled:opacity-50"
      >
        {busy ? "Sende…" : "Weiterleiten"}
      </button>
      <button
        type="button"
        onClick={() => setOffen(false)}
        className="text-[11px] text-muted-foreground hover:text-foreground"
      >
        Abbrechen
      </button>
      {fehler && (
        <span className="basis-full text-[11px] text-destructive">{fehler}</span>
      )}
    </span>
  );
}
