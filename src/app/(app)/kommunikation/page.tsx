import { Megaphone, Package, Phone, ShoppingCart, Trophy, Users } from "lucide-react";
import { requireSession } from "@/lib/auth";
import {
  buildMdDrafts,
  collectGroupWeekly,
  gfRecipients,
} from "@/lib/weekly-mails";
import { formatIsoDate } from "@/lib/crm";
import { mailConfigured } from "@/lib/mailer";
import { createAdminClient } from "@/lib/supabase/admin";
import { capacityWeekStart } from "@/lib/capacity";
import { splitPdlNames } from "@/lib/pdl";
import { PageHeader } from "@/components/page-header";
import { KommunikationSend } from "@/components/kommunikation-send";
import {
  CapacityRequestList,
  type CapacityRequestRow,
} from "@/components/capacity-request-list";
import { MdDraftList } from "@/components/md-draft-list";
import { FileText } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { SectionCard } from "@/components/ui/section-card";
import { StatTile } from "@/components/ui/stat-tile";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

/**
 * Kommunikation: der Wochen-Report der Gruppe (letzte 7 Tage) als Vorschau —
 * exakt das, was montags automatisch an MDs, PDLs und Geschäftsführung geht.
 */
export default async function KommunikationPage() {
  await requireSession();
  const admin = createAdminClient();
  const capWeek = capacityWeekStart();
  const [g, mdDrafts, { data: hubRows }, { data: capRows }] = await Promise.all([
    collectGroupWeekly(),
    buildMdDrafts(),
    admin.from("hubs").select("id, name, pdl_name, pdl_email").order("name"),
    admin
      .from("capacity_reports")
      .select("hub_id, freie_plaetze")
      .eq("week_start", capWeek),
  ]);
  const capByHub = new Map((capRows ?? []).map((r) => [r.hub_id, r]));
  const capacityRows: CapacityRequestRow[] = (hubRows ?? []).map((h) => ({
    hubId: h.id,
    name: h.name,
    pdl: splitPdlNames(h.pdl_name)[0] ?? null,
    hasEmail: (h.pdl_email ?? "").includes("@"),
    reported: capByHub.has(h.id),
    freiePlaetze: capByHub.get(h.id)?.freie_plaetze ?? null,
  }));
  const active = g.hubs.filter((h) => h.score > 0);
  const inactive = g.hubs.length - active.length;
  const medals = ["🥇", "🥈", "🥉"];

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="Kommunikation"
        description={
          <>
            Wochen-Report der Gruppe ({formatIsoDate(g.from)} –{" "}
            {formatIsoDate(g.to)}). Es wird nichts automatisch versendet — alle
            Mails (MD-Updates, PDL-Wochen-Plan, Gruppen-Report) prüfen Sie hier
            und geben sie per Klick frei. Demnächst zusätzlich: neue Patienten
            je Standort.
          </>
        }
      />

      {mailConfigured() ? (
        <KommunikationSend gfAddress={gfRecipients().join(", ")} />
      ) : (
        <p className="rounded-xl border bg-card p-5 text-sm text-muted-foreground shadow-sm">
          Mail-Versand noch nicht eingerichtet — SMTP-Zugangsdaten setzen
          (siehe Admin → E-Mail-Anbindung). Die Vorschau unten funktioniert
          trotzdem.
        </p>
      )}

      <CapacityRequestList
        rows={capacityRows}
        weekLabel={formatIsoDate(capWeek)}
        canSend={mailConfigured()}
      />

      {/* Kennzahlen der Woche */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <StatTile icon={Users} tone="blue" coloredValue value={g.totals.kontakte} label="Klinik-Kontakte" />
        <StatTile icon={Package} tone="green" value={g.totals.box} label="Boxen vorbeigebracht" />
        <StatTile icon={Users} tone="purple" value={g.totals.besuch} label="Persönliche Besuche" />
        <StatTile icon={Phone} tone="orange" value={g.totals.anruf} label="Anrufe" />
        <StatTile icon={Megaphone} tone="amber" value={g.totals.auslagen} label="Auslagen (Flyer/Box)" />
        <StatTile icon={ShoppingCart} tone="gray" value={g.totals.bestellungen} label="Bestellungen" />
      </div>

      {/* MD-Wochen-Updates als Entwürfe (Versand nach Freigabe) */}
      <section className="flex flex-col gap-2">
        <p className="flex items-center gap-1.5 font-semibold">
          <FileText className="size-4 text-primary" />
          Entwürfe: MD-Wochen-Updates ({mdDrafts.length})
        </p>
        <p className="-mt-1 text-sm text-muted-foreground">
          Pro MD eine individuelle Mail mit den Zahlen der jeweiligen
          Standorte — links durchklicken (oder ↑/↓), rechts prüfen und mit
          einem Klick freigeben; danach springt die Auswahl automatisch zum
          nächsten offenen Entwurf. „Alle offenen senden“ schickt den Rest
          auf einmal. Ohne Freigabe wird nichts versendet.
        </p>
        <MdDraftList
          drafts={mdDrafts.map((d) => ({
            md: d.md,
            email: d.email,
            subject: d.subject,
            html: d.html,
            hubNames: d.hubNames,
          }))}
          canSend={mailConfigured()}
        />
      </section>

      {/* Aktivste Standorte */}
      <SectionCard
        icon={Trophy}
        title="Aktivste Standorte der Woche"
        description="Zählt alle von den PDLs geloggten Aktionen der letzten 7 Tage — dieselben Zahlen stehen im Wochen-Report."
        contentClassName="flex flex-col gap-2"
      >
        {active.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Diese Woche wurden noch keine Aktivitäten geloggt.
          </p>
        ) : (
          <>
            <div className="flex flex-wrap gap-2">
              {active.slice(0, 3).map((h, i) => (
                <span
                  key={h.hubId}
                  className={cn(
                    "rounded-full px-3 py-1 text-sm font-medium",
                    i === 0
                      ? "bg-primary text-primary-foreground"
                      : "bg-primary/10 text-primary",
                  )}
                >
                  {medals[i]} {h.name} · {h.score} Aktionen
                </span>
              ))}
            </div>
            <div className="overflow-x-auto">
              <table className="mt-2 w-full min-w-[560px] text-sm">
                <thead>
                  <tr className="border-b text-left text-xs text-muted-foreground">
                    <th className="py-1.5 pr-2 font-medium">Standort</th>
                    <th className="px-2 py-1.5 font-medium">Boxen</th>
                    <th className="px-2 py-1.5 font-medium">Besuche</th>
                    <th className="px-2 py-1.5 font-medium">Anrufe</th>
                    <th className="px-2 py-1.5 font-medium">Auslagen</th>
                    <th className="px-2 py-1.5 font-medium">Bestell.</th>
                    <th className="px-2 py-1.5 font-medium">Gesamt</th>
                  </tr>
                </thead>
                <tbody>
                  {active.map((h) => (
                    <tr key={h.hubId} className="border-b last:border-b-0">
                      <td className="py-1.5 pr-2 font-medium">{h.name}</td>
                      <td className="px-2 py-1.5 tabular-nums">{h.box}</td>
                      <td className="px-2 py-1.5 tabular-nums">{h.besuch}</td>
                      <td className="px-2 py-1.5 tabular-nums">{h.anruf}</td>
                      <td className="px-2 py-1.5 tabular-nums">{h.auslagen}</td>
                      <td className="px-2 py-1.5 tabular-nums">
                        {h.bestellungen}
                      </td>
                      <td className="px-2 py-1.5 font-semibold tabular-nums">
                        {h.score}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {inactive > 0 && (
              <p className="text-xs text-muted-foreground">
                {inactive} Standort{inactive === 1 ? "" : "e"} ohne geloggte
                Aktivität diese Woche.
              </p>
            )}
          </>
        )}
      </SectionCard>

      {/* Wo ausgelegt/beliefert wurde */}
      <SectionCard
        icon={Megaphone}
        title={`Wo diese Woche ausgelegt/beliefert wurde (${g.placements.length})`}
        description="Alle Orte, die die PDLs in den letzten 7 Tagen über ihre Standort-Links eingetragen haben."
        contentClassName="flex flex-col gap-2"
      >
        {g.placements.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Keine Auslagen in den letzten 7 Tagen.
          </p>
        ) : (
          <ul className="flex flex-col gap-1">
            {g.placements.map((p, i) => (
              <li
                key={i}
                className="flex flex-wrap items-baseline gap-x-2 rounded-lg bg-muted/50 px-3 py-1.5 text-sm"
              >
                <Badge variant={p.kind === "Box" ? "secondary" : "outline"}>
                  {p.kind}
                </Badge>
                <span className="min-w-0 font-medium">{p.ort}</span>
                <span className="text-xs text-muted-foreground">
                  · {p.hub}
                </span>
              </li>
            ))}
          </ul>
        )}
      </SectionCard>
    </div>
  );
}
