import { notFound } from "next/navigation";
import { Building2, CalendarDays, ListChecks } from "lucide-react";
import { createAdminClient } from "@/lib/supabase/admin";
import { getFollowupWeeks } from "@/lib/settings";
import { capacityWeekStart, type CapacityReport } from "@/lib/capacity";
import { CapacityForm } from "@/components/capacity-form";
import {
  CrmVisitList,
  type CrmLogEntry,
  type VisitTarget,
} from "@/components/crm-visit-list";
import { PdlTabs } from "@/components/pdl-tabs";
import { PdlTodoList, type PdlTodo } from "@/components/pdl-todo-list";
import {
  PdlPatientList,
  type PdlPatientRow,
} from "@/components/pdl-patient-list";
import { leadEmail, leadFullName, leadPhone } from "@/lib/meta-lead-fields";
import {
  OrderShop,
  type OrderWithItems,
  type ShopOrderItemLine,
} from "@/components/order-shop";
import {
  crmStatus,
  formatIsoDate,
  kontaktArtLabel,
  todayIso,
} from "@/lib/crm";
import { normName } from "@/lib/crm-log";

export const dynamic = "force-dynamic";

export default async function HubShareLinkPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const admin = createAdminClient();
  const followup = await getFollowupWeeks();

  const { data: hub } = await admin
    .from("hubs")
    .select("id, name")
    .eq("share_token", token)
    .single();

  if (!hub) notFound();

  // material_catalog/order_items may not exist yet on the live DB
  // (migrations pending) — every query below falls back to [] instead of
  // crashing.
  const [
    { data: deliveries },
    { data: placements },
    { data: orders },
    { data: catalogData },
    { data: crmTargets },
    { data: allTargets },
    { data: allHubs },
  ] = await Promise.all([
    admin
      .from("deliveries")
      .select("flyer_count, box_count, aufsteller_count")
      .eq("hub_id", hub.id),
    // select("*"): tolerant gegenüber noch fehlenden Spalten (0018/0020/0022).
    admin
      .from("delivery_placements")
      .select("*")
      .eq("hub_id", hub.id)
      .order("created_at", { ascending: false }),
    admin
      .from("orders")
      .select("id, material, quantity, status, note, created_at")
      .eq("hub_id", hub.id)
      .in("source", ["pdl", "admin"])
      .order("created_at", { ascending: false }),
    admin
      .from("material_catalog")
      .select("key, name, description")
      .eq("active", true)
      .order("sort_order", { ascending: true }),
    // Fallback ?? [] — fehlt Migration 0026, darf die Seite nicht crashen.
    admin.from("crm_targets").select("*").eq("hub_id", hub.id).order("name"),
    // Für den Blick auf die anderen Standorte (nur Kliniken-Status, DSGVO ok).
    admin.from("crm_targets").select("*").not("hub_id", "is", null).order("name"),
    admin.from("hubs").select("id, name, pdl_name"),
  ]);

  const catalog = catalogData ?? [];
  const orderList = orders ?? [];

  // Aktivitäts-Ranking (anonym): geloggte Kontakte + ausgelegte Flyer/Boxen
  // der letzten 4 Wochen, je Hub gezählt. Fällt auf letzter_besuch zurück,
  // solange das Kontakt-Log (0027) fehlt.
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - 28);
  const cutoff = cutoffDate.toISOString().slice(0, 10);
  const scoreByHub = new Map<string, number>();
  const bump = (hubId: string | null) => {
    if (!hubId) return;
    scoreByHub.set(hubId, (scoreByHub.get(hubId) ?? 0) + 1);
  };
  const { data: contactRows, error: contactErr } = await admin
    .from("crm_contacts")
    .select("hub_id")
    .gte("contact_date", cutoff);
  if (!contactErr && contactRows) {
    for (const c of contactRows) bump(c.hub_id);
  } else {
    for (const t of ((allTargets ?? []) as (VisitTarget & {
      hub_id: string | null;
    })[])) {
      if (t.letzter_besuch && t.letzter_besuch >= cutoff) bump(t.hub_id);
    }
  }
  const { data: placementRows } = await admin
    .from("delivery_placements")
    .select("hub_id, created_at")
    .gte("created_at", cutoff);
  for (const p of placementRows ?? []) bump(p.hub_id);
  const ownScore = scoreByHub.get(hub.id) ?? 0;
  const otherScores = (allHubs ?? [])
    .filter((h) => h.id !== hub.id)
    .map((h) => scoreByHub.get(h.id) ?? 0);
  // Leaderboard mit Standort-Namen — gamified, alle sehen alle.
  const leaderboard = (allHubs ?? []).map((h) => ({
    name: h.name,
    score: scoreByHub.get(h.id) ?? 0,
    isOwn: h.id === hub.id,
  }));

  // Kliniken-Listen der anderen Standorte (nur lesend).
  const hubNameOf = (id: string | null) =>
    (allHubs ?? []).find((h) => h.id === id)?.name ?? "Unbekannt";
  const otherByHub = new Map<string, VisitTarget[]>();
  for (const t of ((allTargets ?? []) as (VisitTarget & { hub_id: string | null })[])) {
    if (!t.hub_id || t.hub_id === hub.id) continue;
    const arr = otherByHub.get(t.hub_id) ?? [];
    arr.push(t);
    otherByHub.set(t.hub_id, arr);
  }
  const otherGroups = [...otherByHub.entries()]
    .map(([hubId, list]) => ({ hubName: hubNameOf(hubId), list }))
    .sort((a, b) => a.hubName.localeCompare(b.hubName, "de"));

  // Kapazitäts-Meldung: laufende Woche + letzte frühere als Vorbelegung.
  const capWeek = capacityWeekStart();
  const { data: capRows } = await admin
    .from("capacity_reports")
    .select("*")
    .eq("hub_id", hub.id)
    .order("week_start", { ascending: false })
    .limit(5);
  const capReports = (capRows ?? []) as CapacityReport[];
  const capCurrent = capReports.find((r) => r.week_start === capWeek) ?? null;
  const capPrevious = capReports.find((r) => r.week_start !== capWeek) ?? null;

  // Call-Center-Aufträge (KI-erkannt aus Gesprächsnotizen). Fehlt Tabelle
  // 0042, fällt die Abfrage auf [] zurück und der Tab zeigt den Leerzustand.
  const { data: todoRows } = await admin
    .from("crm_todos")
    .select("id, target_id, art, aufgabe, besprochen, created_at")
    .eq("hub_id", hub.id)
    .eq("status", "offen")
    .order("created_at", { ascending: false })
    .limit(100);

  // Doppelte Orte über Hub-Grenzen erkennen (gleicher normalisierter Name +
  // gleicher Ort): am eigenen Eintrag erscheint dann ein Hinweis, welcher
  // andere Standort denselben Ort auf der Liste hat und wann er dort war.
  const dupKey = (t: { name: string; ort: string | null }) =>
    `${normName(t.name)}|${(t.ort ?? "").trim().toLowerCase()}`;
  const sharedByKey = new Map<
    string,
    { hubId: string; hub: string; letzter_besuch: string | null; art: string | null }[]
  >();
  for (const t of (allTargets ?? []) as (VisitTarget & { hub_id: string | null })[]) {
    if (!t.hub_id) continue;
    const key = dupKey(t);
    const arr = sharedByKey.get(key) ?? [];
    const owner = (allHubs ?? []).find((h) => h.id === t.hub_id);
    arr.push({
      hubId: t.hub_id,
      hub: owner?.pdl_name
        ? `${owner.pdl_name} (${owner.name})`
        : hubNameOf(t.hub_id),
      letzter_besuch: t.letzter_besuch,
      art: t.letzte_kontakt_art ?? null,
    });
    sharedByKey.set(key, arr);
  }

  // Zugewiesene Patienten (offen = noch nicht bestätigt). Fallback ?? [] —
  // fehlt Migration 0054, bleibt der Tab einfach leer.
  const [{ data: patCalls }, { data: patMeta }] = await Promise.all([
    admin
      .from("lead_calls")
      .select("id, lead_name, telefon, email, quelle, quelle_detail, notiz, zugewiesen_at")
      .eq("zugewiesen_hub_id", hub.id)
      .is("pdl_bestaetigt_at", null),
    admin
      .from("meta_leads")
      .select("id, field_data, campaign_name, zugewiesen_at")
      .eq("zugewiesen_hub_id", hub.id)
      .is("pdl_bestaetigt_at", null),
  ]);
  const patients: PdlPatientRow[] = [
    ...(patCalls ?? []).map((c) => ({
      kind: "call" as const,
      id: c.id,
      name: c.lead_name ?? "(ohne Name)",
      telefon: c.telefon,
      email: c.email,
      kontext: [c.quelle === "recare" ? "Recare" : c.quelle, c.quelle_detail, c.notiz]
        .filter(Boolean)
        .join(" · "),
      zugewiesen_at: c.zugewiesen_at,
    })),
    ...(patMeta ?? []).map((m) => ({
      kind: "meta" as const,
      id: m.id,
      name: leadFullName(m.field_data) ?? "(ohne Name)",
      telefon: leadPhone(m.field_data),
      email: leadEmail(m.field_data),
      kontext: m.campaign_name,
      zugewiesen_at: m.zugewiesen_at,
    })),
  ].sort((a, b) => (a.zugewiesen_at ?? "").localeCompare(b.zugewiesen_at ?? ""));

  const ownTargets = ((crmTargets ?? []) as VisitTarget[]).map((t) => {
    const others = (sharedByKey.get(dupKey(t)) ?? []).filter(
      (s) => s.hubId !== hub.id,
    );
    return others.length > 0
      ? { ...t, geteilt_mit: others.map(({ hub, letzter_besuch, art }) => ({ hub, letzter_besuch, art })) }
      : t;
  });
  const dueCount = ownTargets.filter(
    (t) => crmStatus(t, todayIso()) !== "geplant",
  ).length;

  const todoTarget = (id: string) => ownTargets.find((t) => t.id === id);
  const pdlTodos: PdlTodo[] = (todoRows ?? []).map((t) => ({
    id: t.id,
    art: t.art,
    aufgabe: t.aufgabe,
    besprochen: t.besprochen,
    created_at: t.created_at,
    target_name: todoTarget(t.target_id)?.name ?? "Unbekannter Ort",
    target_ort: todoTarget(t.target_id)?.ort ?? null,
  }));

  // Vereintes Aktivitäts-Log: Kontakt-Log + manuell erfasste Auslagen.
  // Auto-Auslagen (aus Box-/Flyer-Kontakten) werden per Name+Datum
  // dedupliziert, damit nichts doppelt erscheint.
  const targetNameOf = (id: string | null) =>
    ownTargets.find((t) => t.id === id)?.name ?? "Unbekannter Ort";
  const { data: logRows } = await admin
    .from("crm_contacts")
    .select("id, target_id, kontakt_art, ansprechpartner, note, contact_date")
    .eq("hub_id", hub.id)
    .order("contact_date", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(25);
  const logEntries: CrmLogEntry[] = (logRows ?? []).map((c) => ({
    id: c.id,
    date: c.contact_date,
    art: c.kontakt_art,
    ort: targetNameOf(c.target_id),
    notiz: c.note ?? null,
    ansprechpartner: c.ansprechpartner ?? null,
  }));
  const contactKeys = new Set(
    logEntries.map((e) => `${e.ort.toLowerCase()}|${e.date}`),
  );
  for (const p of (placements ?? []) as {
    id: string;
    standort_name: string;
    kind?: string | null;
    created_at: string | null;
  }[]) {
    const date = (p.created_at ?? "").slice(0, 10);
    if (!date) continue;
    if (contactKeys.has(`${p.standort_name.toLowerCase()}|${date}`)) continue;
    logEntries.push({
      id: `pl-${p.id}`,
      date,
      art: p.kind === "flyer" ? "flyer" : "box",
      ort: p.standort_name,
      notiz: null,
      ansprechpartner: null,
    });
  }
  logEntries.sort((a, b) => b.date.localeCompare(a.date));
  logEntries.splice(20);

  // Second simple query for the cart positions (no embedded-relation selects),
  // then join in JS.
  const itemsByOrder = new Map<string, ShopOrderItemLine[]>();
  if (orderList.length > 0) {
    const { data: itemRows } = await admin
      .from("order_items")
      .select("order_id, material_key, quantity")
      .in(
        "order_id",
        orderList.map((o) => o.id),
      );
    for (const row of itemRows ?? []) {
      const arr = itemsByOrder.get(row.order_id) ?? [];
      arr.push({ material_key: row.material_key, quantity: row.quantity });
      itemsByOrder.set(row.order_id, arr);
    }
  }

  const shopOrders: OrderWithItems[] = orderList.map((o) => ({
    ...o,
    items: itemsByOrder.get(o.id),
  }));

  const flyers = (deliveries ?? []).reduce((s, d) => s + (d.flyer_count ?? 0), 0);
  const boxes = (deliveries ?? []).reduce((s, d) => s + (d.box_count ?? 0), 0);
  const aufsteller = (deliveries ?? []).reduce(
    (s, d) => s + (d.aufsteller_count ?? 0),
    0,
  );

  return (
    <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-5 px-4 py-8">
      {/* Kopf mit Standort und Liefer-Kennzahlen */}
      <div className="flex items-start gap-3">
        <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
          <Building2 className="size-5" />
        </span>
        <div className="min-w-0">
          <p className="text-xs font-semibold tracking-wide text-primary uppercase">
            Marketing Dashboard
          </p>
          <h1 className="text-2xl font-semibold tracking-tight">{hub.name}</h1>
          <p className="mt-0.5 text-sm text-muted-foreground">
            Ihre persönliche Standort-Seite — kein Login nötig, Link einfach
            speichern.
          </p>
          {(flyers > 0 || aufsteller > 0 || boxes > 0) && (
            <div className="mt-2.5 flex flex-wrap gap-1.5">
              {(
                [
                  [flyers, "Flyer"],
                  [aufsteller, "Aufsteller"],
                  [boxes, "Boxen"],
                ] as const
              )
                .filter(([v]) => v > 0)
                .map(([value, label]) => (
                  <span
                    key={label}
                    className="rounded-full border bg-card px-2.5 py-1 text-xs font-medium text-muted-foreground shadow-sm"
                  >
                    <span className="font-semibold text-foreground tabular-nums">
                      {value.toLocaleString("de-DE")}
                    </span>{" "}
                    {label} geliefert
                  </span>
                ))}
            </div>
          )}
        </div>
      </div>

      {/* Kurz-Überblick: eingeklappt, damit die Seite ruhig bleibt */}
      <details className="group rounded-xl border border-primary/20 bg-primary/[0.04]">
        <summary className="flex cursor-pointer list-none items-center gap-2 px-4 py-3 text-sm font-semibold select-none">
          <ListChecks className="size-4 text-primary" />
          So nutzen Sie diese Seite
          <span className="ml-auto text-xs font-normal text-muted-foreground group-open:hidden">
            aufklappen
          </span>
        </summary>
        <ol className="mx-4 mb-3 ml-9 flex list-decimal flex-col gap-1 text-sm text-muted-foreground">
          <li>
            <strong className="text-foreground">Meine Orte:</strong> Ihre
            To-do-Liste — Kliniken, Praxen, Apotheken &amp; Co. Nach jeder
            Aktion (Box, Flyer, Besuch, Anruf) kurz ins Schnell-Log eintragen:
            Ort tippen, Aktion wählen, fertig. Neue Orte werden automatisch
            zur Liste hinzugefügt.
          </li>
          <li>
            <strong className="text-foreground">Kapazität:</strong> Einmal pro
            Woche melden, wie viele Patienten Sie aufnehmen können — Grundlage
            für schnelle Antworten auf Klinik-Anfragen.
          </li>
          <li>
            <strong className="text-foreground">Material:</strong> Nachschub
            an Flyern, Boxen &amp; Co. bestellen — bitte nur bei Bedarf.
          </li>
        </ol>
      </details>

      {/* Monatliches Abstimmungs-Meeting mit dem Marketing-Team */}
      <div className="flex flex-wrap items-center gap-2.5 rounded-xl border bg-card px-4 py-2.5 shadow-sm">
        <CalendarDays className="size-4 shrink-0 text-primary" />
        <p className="min-w-0 flex-1 text-sm">
          <span className="font-medium">Meeting mit dem Marketing-Team</span>{" "}
          <span className="text-muted-foreground">
            — 30 Minuten, empfohlen einmal im Monat.
          </span>
        </p>
        <a
          href="https://calendly.com/christopher-debatin-tern-group/30min"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground shadow-sm transition-colors hover:bg-primary/90"
        >
          Termin buchen
        </a>
      </div>

      <PdlTabs
        tabs={[
          {
            id: "kliniken",
            label: "Meine Orte",
            badge: dueCount,
            content: (
              <div className="flex flex-col gap-5">
                <div>
                  <h2 className="text-xl font-semibold">
                    Ihre Orte-Liste (To-do)
                  </h2>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Alles an einem Ort: vorgegebene Kliniken, eigene Orte,
                    spontane Flyer- und Box-Stopps. Jede Aktion kurz loggen —
                    der nächste Termin wird automatisch gesetzt, Boxen und
                    Flyer zählen automatisch für Karte und Statistik.
                  </p>
                </div>
                <CrmVisitList
                  token={token}
                  initial={ownTargets}
                  initialScore={ownScore}
                  otherScores={otherScores}
                  leaderboard={leaderboard}
                  initialLog={logEntries}
                  followup={followup}
                />

                {otherGroups.length > 0 && (
                  <div className="flex flex-col gap-2 border-t pt-5">
                    <h3 className="font-semibold">
                      Listen der anderen Standorte (nur ansehen)
                    </h3>
                    {otherGroups.map((g) => (
                      <details
                        key={g.hubName}
                        className="group rounded-xl border bg-card"
                      >
                        <summary className="flex cursor-pointer list-none items-center gap-2 px-4 py-3 text-sm font-medium select-none">
                          {g.hubName}
                          <span className="text-xs font-normal text-muted-foreground">
                            ({g.list.length} Kliniken)
                          </span>
                          <span className="ml-auto text-xs text-muted-foreground group-open:hidden">
                            aufklappen
                          </span>
                        </summary>
                        <ul className="flex flex-col gap-1 border-t px-4 py-3">
                          {g.list.map((t) => {
                            const s = crmStatus(t, todayIso());
                            return (
                              <li
                                key={t.id}
                                className="flex items-baseline justify-between gap-3 border-t pt-1 text-sm first:border-t-0 first:pt-0"
                              >
                                <span className="min-w-0 truncate">
                                  {t.name}
                                  {t.ort ? (
                                    <span className="text-muted-foreground">
                                      {" "}
                                      · {t.ort}
                                    </span>
                                  ) : null}
                                </span>
                                <span className="shrink-0 text-xs text-muted-foreground">
                                  {s === "erstbesuch"
                                    ? "noch kein Kontakt"
                                    : s === "faellig"
                                      ? "fällig"
                                      : `${kontaktArtLabel(t.letzte_kontakt_art) || "Kontakt"} am ${formatIsoDate(t.letzter_besuch)}`}
                                </span>
                              </li>
                            );
                          })}
                        </ul>
                      </details>
                    ))}
                  </div>
                )}
              </div>
            ),
          },
          {
            id: "patienten",
            label: "Patienten",
            badge: patients.length > 0 ? patients.length : undefined,
            content: <PdlPatientList token={token} initial={patients} />,
          },
          {
            id: "auftraege",
            label: "Aufträge",
            badge: pdlTodos.length > 0 ? pdlTodos.length : undefined,
            content: <PdlTodoList token={token} initial={pdlTodos} />,
          },
          {
            id: "kapazitaet",
            label: "Kapazität",
            badge: capCurrent ? undefined : 1,
            content: (
              <CapacityForm
                token={token}
                weekStart={capWeek}
                current={capCurrent}
                previous={capPrevious}
              />
            ),
          },
          {
            id: "material",
            label: "Material",
            content: (
              <section className="flex flex-col gap-3">
        <div>
          <h2 className="text-xl font-semibold">Material bestellen</h2>
        </div>
        <StepBox
          title="So geht's:"
          steps={[
            <>
              Beim gewünschten Material die{" "}
              <strong className="text-foreground">Menge</strong> eintragen und{" "}
              <strong className="text-foreground">
                „In den Warenkorb&rdquo;
              </strong>{" "}
              klicken — gern mehrere Materialien sammeln.
            </>,
            <>
              Unten im Warenkorb auf{" "}
              <strong className="text-foreground">
                „Bestellung absenden&rdquo;
              </strong>{" "}
              klicken. Das Marketing-Team kümmert sich um den Versand.
            </>,
            <>
              Etwas nicht dabei? Über{" "}
              <strong className="text-foreground">
                „Etwas anderes benötigt?&rdquo;
              </strong>{" "}
              frei beschreiben und direkt bestellen. Den Status sehen Sie unter
              „Deine Bestellungen&rdquo;.
            </>,
          ]}
          footer={
            <>
              <strong className="text-foreground">
                Bitte nur bei tatsächlichem Bedarf bestellen.
              </strong>{" "}
              Bei Rückfragen gern anrufen:{" "}
              <a href="tel:+491772988173" className="text-primary underline">
                0177&nbsp;2988&nbsp;173
              </a>{" "}
              — oder per E-Mail an{" "}
              <a
                href="mailto:marketing@igs-holding.de"
                className="text-primary underline"
              >
                marketing@igs-holding.de
              </a>
              .
            </>
          }
        />
        {catalog.length === 0 ? (
          <p className="rounded-xl border bg-card p-5 text-sm text-muted-foreground shadow-sm">
            Der Material-Katalog ist derzeit nicht verfügbar. Bitte später
            erneut versuchen oder das Marketing-Team direkt kontaktieren.
          </p>
        ) : (
          <OrderShop token={token} catalog={catalog} initial={shopOrders} />
        )}
              </section>
            ),
          },
        ]}
      />
    </main>
  );
}

/** Einheitliche, einfache Schritt-für-Schritt-Erklärung je Bereich. */
function StepBox({
  title,
  steps,
  footer,
}: {
  title: string;
  steps: React.ReactNode[];
  footer?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-2 rounded-xl border border-primary/20 bg-primary/[0.04] p-4 text-sm">
      <p className="flex items-center gap-2 font-semibold">
        <ListChecks className="size-4 text-primary" />
        {title}
      </p>
      <ol className="ml-5 flex list-decimal flex-col gap-1 text-muted-foreground">
        {steps.map((s, i) => (
          <li key={i}>{s}</li>
        ))}
      </ol>
      {footer && <p className="text-xs text-muted-foreground">{footer}</p>}
    </div>
  );
}
