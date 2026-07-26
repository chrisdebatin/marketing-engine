import { notFound } from "next/navigation";
import { CalendarDays, ListChecks } from "lucide-react";
import { createAdminClient } from "@/lib/supabase/admin";
import { PlacementBoard } from "@/components/placement-board";
import {
  CrmVisitList,
  type VisitTarget,
} from "@/components/crm-visit-list";
import { PdlTabs } from "@/components/pdl-tabs";
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
  weekStartIso,
} from "@/lib/crm";

export const dynamic = "force-dynamic";

export default async function HubShareLinkPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const admin = createAdminClient();

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
    { data: standorteData },
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
    admin
      .from("standorte")
      .select("name, adresse")
      .eq("hub_id", hub.id)
      .order("name"),
    // Fallback ?? [] — fehlt Migration 0026, darf die Seite nicht crashen.
    admin.from("crm_targets").select("*").eq("hub_id", hub.id).order("name"),
    // Für den Blick auf die anderen Standorte (nur Kliniken-Status, DSGVO ok).
    admin.from("crm_targets").select("*").not("hub_id", "is", null).order("name"),
    admin.from("hubs").select("id, name"),
  ]);

  const catalog = catalogData ?? [];
  const orderList = orders ?? [];

  // Wochenziel: geloggte Kontakte dieses Hubs seit Montag. Fällt auf die
  // letzter_besuch-Daten zurück, solange das Kontakt-Log (0027) fehlt.
  const weekStart = weekStartIso();
  let weekCount = 0;
  const { count: contactCount, error: contactErr } = await admin
    .from("crm_contacts")
    .select("id", { count: "exact", head: true })
    .eq("hub_id", hub.id)
    .gte("contact_date", weekStart);
  if (!contactErr && contactCount != null) {
    weekCount = contactCount;
  } else {
    weekCount = ((crmTargets ?? []) as VisitTarget[]).filter(
      (t) => t.letzter_besuch && t.letzter_besuch >= weekStart,
    ).length;
  }

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

  const ownTargets = (crmTargets ?? []) as VisitTarget[];
  const dueCount = ownTargets.filter(
    (t) => crmStatus(t, todayIso()) !== "geplant",
  ).length;

  // Eingabe-Vorschläge: bekannte Standorte des Hubs + frühere Einträge.
  const suggestionMap = new Map<
    string,
    { name: string; adresse: string | null; ort: string | null }
  >();
  for (const s of standorteData ?? []) {
    suggestionMap.set(s.name.toLowerCase(), {
      name: s.name,
      adresse: s.adresse ?? null,
      ort: null,
    });
  }
  for (const p of (placements ?? []) as {
    standort_name: string;
    adresse?: string | null;
    ort?: string | null;
  }[]) {
    const key = p.standort_name.toLowerCase();
    if (!suggestionMap.has(key)) {
      suggestionMap.set(key, {
        name: p.standort_name,
        adresse: p.adresse ?? null,
        ort: p.ort ?? null,
      });
    }
  }
  const suggestions = [...suggestionMap.values()].slice(0, 100);

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
    <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-6 px-4 py-8">
      {/* Hero mit Standort und Liefer-Kennzahlen */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-primary via-primary to-chart-5 p-6 text-primary-foreground shadow-lg">
        <div
          aria-hidden
          className="pointer-events-none absolute -top-16 -right-16 size-56 rounded-full bg-white/10 blur-2xl"
        />
        <p className="text-sm font-medium tracking-wide text-primary-foreground/80 uppercase">
          Marketing Dashboard
        </p>
        <h1 className="mt-1 text-3xl font-semibold tracking-tight">
          {hub.name}
        </h1>
        <p className="mt-2 text-sm text-primary-foreground/85">
          Ihre persönliche Standort-Seite — kein Login nötig, Link einfach
          speichern.
        </p>
        {(flyers > 0 || aufsteller > 0 || boxes > 0) && (
          <div className="mt-4 flex flex-wrap gap-2">
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
                  className="rounded-full bg-white/15 px-3 py-1 text-sm font-medium backdrop-blur-sm"
                >
                  <span className="font-semibold tabular-nums">
                    {value.toLocaleString("de-DE")}
                  </span>{" "}
                  {label} geliefert
                </span>
              ))}
          </div>
        )}
      </div>

      {/* Kurz-Überblick: was auf dieser Seite zu tun ist */}
      <StepBox
        title="So nutzen Sie diese Seite — 3 Reiter oben:"
        steps={[
          <>
            <strong className="text-foreground">Meine Orte:</strong> Ihre
            To-do-Liste abarbeiten — Box, Besuch oder Anruf, jeden Kontakt loggen
            (Ziel: 4 pro Woche). Eine geloggte Box zählt automatisch als
            Box-Lieferort.
          </>,
          <>
            <strong className="text-foreground">
              Flyer &amp; Boxen unterwegs:
            </strong>{" "}
            Nur für spontane Orte außerhalb der Liste — Apotheke, Praxis
            &amp; Co.
          </>,
          <>
            <strong className="text-foreground">Material:</strong> Nachschub
            an Flyern, Boxen &amp; Co. bestellen — bitte nur bei Bedarf.
          </>,
        ]}
      />

      {/* Monatliches Abstimmungs-Meeting mit dem Marketing-Team */}
      <div className="flex flex-wrap items-center gap-3 rounded-xl border bg-card p-4 shadow-sm">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary/10">
          <CalendarDays className="size-5 text-primary" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold">
            Meeting mit dem Marketing-Team
          </p>
          <p className="text-sm text-muted-foreground">
            Buchen Sie sich einen 30-Minuten-Termin — empfohlen: einmal im
            Monat.
          </p>
        </div>
        <a
          href="https://calendly.com/christopher-debatin-tern-group/30min"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow-sm transition-colors hover:bg-primary/90"
        >
          <CalendarDays className="size-4" />
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
                    Vorgegebene Kliniken plus eigene Orte, die Sie anfahren
                    möchten. Sie entscheiden, ob Box, persönlicher Besuch
                    oder Anruf — wichtig: jeden Kontakt loggen; der nächste
                    Termin wird automatisch gesetzt.
                  </p>
                </div>
                <CrmVisitList
                  token={token}
                  initial={ownTargets}
                  initialWeekCount={weekCount}
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
            id: "orte",
            label: "Flyer & Boxen unterwegs",
            content: (
              <section className="flex flex-col gap-3">
        <div>
          <h2 className="text-xl font-semibold">
            Flyer & Boxen unterwegs
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Für spontane Orte außerhalb Ihrer Kliniken-Liste — Apotheke,
            Praxis, Sanitätshaus &amp; Co.
          </p>
        </div>
        <StepBox
          title="So geht's:"
          steps={[
            <>
              Oben wählen:{" "}
              <strong className="text-foreground">„Flyer ausgelegt&rdquo;</strong>{" "}
              oder{" "}
              <strong className="text-foreground">„Box geliefert&rdquo;</strong>.
            </>,
            <>
              Einrichtung (z.&nbsp;B. „Apotheke am Markt&rdquo;),{" "}
              <strong className="text-foreground">Adresse</strong>, Ort und
              Anzahl angeben und auf{" "}
              <strong className="text-foreground">„Hinzufügen&rdquo;</strong>{" "}
              klicken — beim Tippen werden bekannte Standorte vorgeschlagen.
            </>,
            <>
              Vertippt? Über das{" "}
              <strong className="text-foreground">Stift-Symbol</strong> am
              Eintrag können Sie Ort und Anzahl korrigieren oder den Eintrag
              löschen.
            </>,
          ]}
          footer={
            <>
              <strong className="text-foreground">Wichtig:</strong> Kliniken
              aus Ihrer Liste bitte im Reiter „Meine Kliniken&rdquo; loggen —
              eine dort geloggte Box zählt hier automatisch als
              Box-Lieferort, kein doppeltes Eintragen nötig.
            </>
          }
        />
        <PlacementBoard
          token={token}
          initial={placements ?? []}
          endpoint="/api/public/hub-placement"
          allowBoxes
          suggestions={suggestions}
        />
              </section>
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
