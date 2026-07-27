import { Megaphone, Package, Phone, ShoppingCart, Trophy, Users } from "lucide-react";
import { requireSession } from "@/lib/auth";
import { collectGroupWeekly } from "@/lib/weekly-mails";
import { formatIsoDate } from "@/lib/crm";
import { mailConfigured } from "@/lib/mailer";
import { KommunikationSend } from "@/components/kommunikation-send";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

function Stat({
  icon: Icon,
  value,
  label,
}: {
  icon: React.ComponentType<{ className?: string }>;
  value: number;
  label: string;
}) {
  return (
    <div className="flex items-center gap-2.5 rounded-lg border bg-card px-3 py-2.5">
      <span className="flex size-8 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
        <Icon className="size-4" />
      </span>
      <div className="min-w-0">
        <div className="text-lg leading-none font-semibold tabular-nums">
          {value}
        </div>
        <div className="mt-1 truncate text-xs text-muted-foreground">
          {label}
        </div>
      </div>
    </div>
  );
}

/**
 * Kommunikation: der Wochen-Report der Gruppe (letzte 7 Tage) als Vorschau —
 * exakt das, was montags automatisch an MDs, PDLs und Geschäftsführung geht.
 */
export default async function KommunikationPage() {
  await requireSession();
  const g = await collectGroupWeekly();
  const active = g.hubs.filter((h) => h.score > 0);
  const inactive = g.hubs.length - active.length;
  const medals = ["🥇", "🥈", "🥉"];

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h1 className="text-2xl font-semibold">Kommunikation</h1>
        <p className="text-sm text-muted-foreground">
          Wochen-Report der Gruppe ({formatIsoDate(g.from)} –{" "}
          {formatIsoDate(g.to)}) — geht automatisch jeden Montag an MDs
          (eigene Standorte), PDLs (Wochen-Plan) und Geschäftsführung
          (dieser Gesamt-Report). Demnächst zusätzlich: neue Patienten je
          Standort.
        </p>
      </div>

      {mailConfigured() ? (
        <KommunikationSend gfConfigured={Boolean(process.env.GF_EMAIL)} />
      ) : (
        <p className="rounded-xl border bg-card p-5 text-sm text-muted-foreground shadow-sm">
          Mail-Versand noch nicht eingerichtet — SMTP-Zugangsdaten setzen
          (siehe Admin → E-Mail-Anbindung). Die Vorschau unten funktioniert
          trotzdem.
        </p>
      )}

      {/* Kennzahlen der Woche */}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
        <Stat icon={Users} value={g.totals.kontakte} label="Klinik-Kontakte" />
        <Stat icon={Package} value={g.totals.box} label="Boxen vorbeigebracht" />
        <Stat icon={Users} value={g.totals.besuch} label="Persönliche Besuche" />
        <Stat icon={Phone} value={g.totals.anruf} label="Anrufe" />
        <Stat icon={Megaphone} value={g.totals.auslagen} label="Auslagen (Flyer/Box)" />
        <Stat icon={ShoppingCart} value={g.totals.bestellungen} label="Bestellungen" />
      </div>

      {/* Aktivste Standorte */}
      <section className="flex flex-col gap-2 rounded-xl border bg-card p-5 shadow-sm">
        <p className="flex items-center gap-1.5 font-semibold">
          <Trophy className="size-4 text-primary" />
          Aktivste Standorte der Woche
        </p>
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
      </section>

      {/* Wo ausgelegt/beliefert wurde */}
      <section className="flex flex-col gap-2 rounded-xl border bg-card p-5 shadow-sm">
        <p className="flex items-center gap-1.5 font-semibold">
          <Megaphone className="size-4 text-primary" />
          Wo diese Woche ausgelegt/beliefert wurde ({g.placements.length})
        </p>
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
      </section>
    </div>
  );
}
