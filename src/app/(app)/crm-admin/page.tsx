import Link from "next/link";
import { redirect } from "next/navigation";
import { Megaphone, Package, PhoneCall, Trophy, UserCheck, Users } from "lucide-react";
import { StatTile } from "@/components/ui/stat-tile";
import { requireSession } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { isRecruitingLead } from "@/lib/lead-forward";
import { AgenturRueckweisungen } from "@/components/agentur-rueckweisungen";
import {
  CallcenterAnalyse,
  type AnalyseCall,
  type AnalyseLead,
} from "@/components/callcenter-analyse";
import { PdlRanking } from "@/components/pdl-ranking";
import { CrmStatsDashboard, type StatLead } from "@/components/crm-stats-dashboard";
import { PageHeader } from "@/components/page-header";
import { ZieleSection } from "@/app/(app)/crm/ziele-section";

export const dynamic = "force-dynamic";

/**
 * CRM-Admin (nur Admins): reines Stats-Dashboard — Leads pro Tag je Kanal,
 * Prozess-Funnel mit Conversion-Rates, Bearbeiter- und PDL-Auswertung.
 * Verwaltung (CSV-Import etc.) bleibt eingeklappt erreichbar.
 */
export default async function CrmAdminPage() {
  const session = await requireSession();
  if (!session.isAdmin) redirect("/crm");

  const admin = createAdminClient();
  // select("*") statt fester Spaltenliste: fehlt eine Spalte aus einer noch
  // nicht eingespielten Migration, liefert die Abfrage trotzdem Daten (die
  // betroffene Kennzahl bleibt dann einfach leer).
  const [callsRes, metaRes, hubsRes, anrufeRes, targetsRes] = await Promise.all([
    admin.from("lead_calls").select("*").limit(4000),
    admin.from("meta_leads").select("*").neq("status", "geloescht").limit(4000),
    admin.from("hubs").select("id, name, pdl_name"),
    // Outbound-Anruf-Log (Kontakt-Historie) für die Anruf-Übersicht
    admin
      .from("crm_contacts")
      .select("contact_date, bearbeiter, ansprechpartner, note, target_id")
      .eq("kontakt_art", "anruf")
      .order("contact_date", { ascending: false })
      .limit(2000),
    admin.from("crm_targets").select("id, name, kategorie"),
  ]);
  // ── "Kontakte heute": alle Berührungen des Tages ──
  const heute = new Date().toISOString().slice(0, 10);
  const [kontakteHeuteRes, activitiesHeuteRes, versucheHeuteRes] = await Promise.all([
    admin
      .from("crm_contacts")
      .select("kontakt_art, hub_id, target_id")
      .eq("contact_date", heute),
    admin
      .from("activities")
      .select("type, hub_id")
      .eq("occurred_on", heute),
    admin.from("pdl_versuche").select("erreicht").gte("created_at", `${heute}T00:00:00Z`),
  ]);
  // ── Callcenter-Analyse: Telefonanlagen-Export (Annahmequote/Uhrzeiten) ──
  // Fehlt die Tabelle (Migration noch nicht eingespielt), bleibt die Sektion
  // leer und erklärt sich selbst — kein harter Fehler.
  const phoneRes = await admin
    .from("phone_calls")
    .select("call_time, hub_name, direction, answered, talking_seconds")
    .eq("direction", "inbound")
    .limit(20000);
  const phoneRows = phoneRes.error ? [] : (phoneRes.data ?? []);
  const analyseCalls: AnalyseCall[] = phoneRows.map((c) => ({
    zeit: c.call_time,
    hub: c.hub_name,
    angenommen: c.answered,
    sekunden: c.talking_seconds ?? 0,
  }));
  const analyseTageSet = [
    ...new Set(phoneRows.map((c) => c.call_time.slice(0, 10))),
  ].sort();
  const analyseTage = analyseTageSet.length;
  const analyseZeitraum = analyseTage
    ? { von: analyseTageSet[0], bis: analyseTageSet[analyseTage - 1] }
    : null;

  // Kategorie der verpassten 0800-Anrufe: steht im Ergebnis-Text der
  // KI-Vorsortierung ("kein Neuinteressent (KI-vorsortiert: …)"), alles
  // andere ist ein Neuinteressent.
  const analyseLeads: AnalyseLead[] = (callsRes.data ?? [])
    .filter((l) => l.quelle === "telefon0800")
    .map((l) => {
      const e = l.ergebnis ?? "";
      // Erst die Vorsortierung selbst erkennen ("kein Neuinteressent …") —
      // bei Altbestand fehlt die Kategorie in Klammern, der Anruf ist aber
      // trotzdem keine Neuanfrage und darf die Quote nicht schönen.
      const keinInteressent = /kein\s+neuinteressent/i.test(e);
      const kategorie: AnalyseLead["kategorie"] = !keinInteressent
        ? "neuinteressent"
        : /kein anliegen|anonym/i.test(e)
          ? "kein_anliegen"
          : /bestandskunde/i.test(e)
            ? "bestandskunde"
            : /mitarbeiter|intern/i.test(e)
              ? "mitarbeiter_intern"
              : "sonstiges";
      return {
        zeit: l.created_at ?? `${l.call_date}T12:00:00Z`,
        kategorie,
        bereich: l.bereich,
      };
    });

  const targetName = new Map((targetsRes.data ?? []).map((t) => [t.id, t.name]));
  const anrufe = (anrufeRes.data ?? []).map((a) => ({
    datum: a.contact_date,
    bearbeiter: a.bearbeiter ?? "unbekannt",
    ziel: targetName.get(a.target_id ?? "") ?? "(Institution)",
    ansprechpartner: a.ansprechpartner ?? null,
    note: a.note ?? null,
  }));

  const hubName = new Map((hubsRes.data ?? []).map((h) => [h.id, h.name]));
  const hubPdl: Record<string, string> = {};
  for (const h of hubsRes.data ?? []) {
    if (h.pdl_name) hubPdl[h.name] = h.pdl_name;
  }

  const leads: StatLead[] = [
    ...(callsRes.data ?? []).map((l) => ({
      kind: "call" as const,
      quelle: l.quelle,
      bereich: l.bereich,
      status: l.status,
      bearbeiter: l.bearbeiter,
      created: l.created_at ?? l.call_date,
      erst: l.erstbearbeitet_at ?? null,
      hub: hubName.get(l.zugewiesen_hub_id ?? "") ?? null,
      zugewiesenAt: l.zugewiesen_at ?? null,
      bestaetigtAt: l.pdl_bestaetigt_at ?? null,
      pdlErgebnis: l.pdl_ergebnis ?? null,
    })),
    // Meta: nur Kunden-Leads (Recruiting läuft separat übers Recruiting-Postfach).
    ...(metaRes.data ?? [])
      .filter((l) => !isRecruitingLead(l.campaign_name))
      .map((l) => ({
        kind: "meta" as const,
        quelle: "meta",
        bereich: null,
        status: l.status,
        bearbeiter: l.bearbeiter,
        created: l.created_time ?? l.created_at ?? "",
        erst: l.erstbearbeitet_at ?? null,
        hub: hubName.get(l.zugewiesen_hub_id ?? "") ?? null,
        zugewiesenAt: l.zugewiesen_at ?? null,
        bestaetigtAt: l.pdl_bestaetigt_at ?? null,
        pdlErgebnis: l.pdl_ergebnis ?? null,
      })),
  ].filter((l) => l.created);

  // Zurückgewiesene Leads "nicht im Einzugsbereich": Agentur-Leads sind
  // abrechnungsrelevant (wöchentliche Reklamations-Mail an die Agentur).
  const ausserhalb = (callsRes.data ?? []).filter(
    (l) =>
      l.status === "verloren" &&
      /einzugsbereich/i.test(l.ergebnis ?? ""),
  );
  const rueckweisungen = ausserhalb
    .filter((l) => l.quelle === "agentur")
    .map((l) => ({
      id: l.id,
      name: l.lead_name ?? "(ohne Name)",
      eingang: l.created_at ?? l.call_date,
      ort: ("adresse" in l ? (l as { adresse?: string | null }).adresse : null) ?? null,
      telefon: l.telefon,
      ergebnis: l.ergebnis,
    }))
    .sort((a, b) => (b.eingang ?? "").localeCompare(a.eingang ?? ""));
  const recareAusserhalb = ausserhalb.filter((l) => l.quelle === "recare").length;

  // ── Kennzahlen "Kontakte heute" ──
  const targetKategorie = new Map(
    (targetsRes.data ?? []).map((t) => [t.id, t.kategorie ?? "sonstiges"]),
  );
  const heuteKontakte = kontakteHeuteRes.data ?? [];
  const heuteAktivitaeten = activitiesHeuteRes.data ?? [];
  const klientenKontaktiert = [
    ...(callsRes.data ?? []),
    ...(metaRes.data ?? []),
  ].filter((l) => (l.erstbearbeitet_at ?? "").slice(0, 10) === heute).length;
  const anrufeHeute = heuteKontakte.filter((k) => k.kontakt_art === "anruf");
  const krankenhausAnrufe = anrufeHeute.filter(
    (k) => targetKategorie.get(k.target_id ?? "") === "krankenhaus",
  ).length;
  const flyerHeute =
    heuteKontakte.filter((k) => k.kontakt_art === "flyer").length +
    heuteAktivitaeten.filter((a) => a.type === "flyer").length;
  const boxenHeute =
    heuteKontakte.filter((k) => k.kontakt_art === "box").length +
    heuteAktivitaeten.filter((a) => a.type === "box").length;
  const besucheHeute = heuteKontakte.filter((k) => k.kontakt_art === "besuch").length;
  const neuaufnahmenHeute = [
    ...(callsRes.data ?? []),
    ...(metaRes.data ?? []),
  ].filter(
    (l) =>
      (l.pdl_bestaetigt_at ?? "").slice(0, 10) === heute &&
      !/nicht|kein/i.test(l.pdl_ergebnis ?? ""),
  ).length;
  const versucheHeute = versucheHeuteRes.error ? [] : (versucheHeuteRes.data ?? []);
  const pdlErreichtHeute = versucheHeute.filter((v) => v.erreicht).length;
  const pdlNichtHeute = versucheHeute.length - pdlErreichtHeute;
  // Aktivster Standort heute (Kontakte + Feld-Aktivitäten)
  const aktionenJeHub = new Map<string, number>();
  for (const k of [...heuteKontakte, ...heuteAktivitaeten]) {
    if (!k.hub_id) continue;
    aktionenJeHub.set(k.hub_id, (aktionenJeHub.get(k.hub_id) ?? 0) + 1);
  }
  const aktivsterHub = [...aktionenJeHub.entries()].sort((a, b) => b[1] - a[1])[0];
  const aktivsterHubName = aktivsterHub
    ? (hubsRes.data ?? []).find((h) => h.id === aktivsterHub[0])?.name
    : null;

  const sektion = (nr: string, titel: string, sub: string) => (
    <div className="mt-3 flex items-center gap-3 border-b pb-2">
      <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary text-sm font-bold text-primary-foreground">
        {nr}
      </span>
      <div>
        <h2 className="text-lg leading-tight font-bold tracking-tight">{titel}</h2>
        <p className="text-xs text-muted-foreground">{sub}</p>
      </div>
    </div>
  );

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="CRM-Admin"
        description={`Tagesreport für ${new Date().toLocaleDateString("de-DE", { weekday: "long", day: "2-digit", month: "2-digit", year: "numeric" })} — von oben nach unten lesen: Leads, Callcenter & Erreichbarkeit, Kontakte des Tages, PDL-Ranking.`}
      />

      {sektion("1", "Leads", "Eingänge, Kanäle, Funnel und Bearbeitung — Zeitraum oben rechts wählbar")}
      <CrmStatsDashboard
        leads={leads}
        hubPdl={hubPdl}
        anrufe={anrufe}
        now={new Date().toISOString()}
      />

      {sektion(
        "2",
        "Callcenter & Erreichbarkeit",
        "eingehende Anrufe, Annahmequote, Uhrzeiten — und was uns fehlende Besetzung kostet",
      )}
      <CallcenterAnalyse
        calls={analyseCalls}
        leads={analyseLeads}
        tage={analyseTage}
        zeitraum={analyseZeitraum}
      />
      <p className="-mt-2 text-xs text-muted-foreground">
        Eigener Bereich mit CSV-Upload:{" "}
        <Link href="/callcenter" className="text-primary underline">
          Callcenter-Analyse
        </Link>
      </p>

      {sektion("3", "Kontakte heute", "alle Berührungen des Tages — Klienten, Anrufe, Flyer & Boxen, Aufnahmen")}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6">
        <StatTile
          icon={Users}
          tone="blue"
          label="Klienten kontaktiert"
          value={String(klientenKontaktiert)}
          sub="heute erstmals bearbeitet"
        />
        <StatTile
          icon={PhoneCall}
          tone="purple"
          label="Outbound-Anrufe"
          value={String(anrufeHeute.length)}
          sub={`davon ${krankenhausAnrufe} Krankenhäuser`}
        />
        <StatTile
          icon={Megaphone}
          tone="orange"
          label="Flyer ausgelegt"
          value={String(flyerHeute)}
          sub={besucheHeute > 0 ? `+ ${besucheHeute} persönliche Besuche` : "Aktionen vor Ort"}
        />
        <StatTile
          icon={Package}
          tone="amber"
          label="Boxen geliefert"
          value={String(boxenHeute)}
          sub="CM-Boxen heute"
        />
        <StatTile
          icon={UserCheck}
          tone="green"
          coloredValue
          label="Neuaufnahmen"
          value={String(neuaufnahmenHeute)}
          sub="heute von PDLs bestätigt"
        />
        <StatTile
          icon={Trophy}
          tone="gray"
          label="Aktivster Standort"
          value={aktivsterHubName ?? "—"}
          sub={
            aktivsterHub
              ? `${aktivsterHub[1]} Aktionen heute`
              : "noch keine Aktionen heute"
          }
        />
      </div>
      {versucheHeute.length > 0 && (
        <p className="-mt-2 text-xs text-muted-foreground">
          PDL-Erreichbarkeit heute: {pdlErreichtHeute}× erreicht ·{" "}
          {pdlNichtHeute}× nicht erreicht.
        </p>
      )}

      {sektion("4", "PDL-Ranking", "Erreichbarkeit & Marketing-Aktivität je Standort — Handlungsbedarf zuerst")}
      <PdlRanking />

      {sektion("5", "Agentur-Rückweisungen", "nicht im Einzugsbereich — Grundlage der wöchentlichen Reklamations-Mail")}
      <AgenturRueckweisungen rows={rueckweisungen} recareCount={recareAusserhalb} />

      {/* Kontakte werden in den Team-Ansichten (/crm → Kontakte) gepflegt —
          hier nur noch Stats. Import & Einstellungen bleiben eingeklappt
          erreichbar. */}
      <details className="group rounded-xl border bg-card shadow-sm">
        <summary className="cursor-pointer list-none p-4 text-sm font-semibold select-none">
          Verwaltung (CSV-Import, Follow-up-Einstellungen, Institutionen)
          <span className="ml-2 text-xs font-normal text-muted-foreground group-open:hidden">
            aufklappen
          </span>
        </summary>
        <div className="border-t p-4">
          <ZieleSection mode="full" />
        </div>
      </details>
    </div>
  );
}
