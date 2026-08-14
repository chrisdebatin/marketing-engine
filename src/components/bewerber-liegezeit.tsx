import { AlertTriangle, Clock, UserCheck, Users } from "lucide-react";
import { StatTile } from "@/components/ui/stat-tile";
import { formatLiegezeit } from "@/lib/bewerber";
import { cn } from "@/lib/utils";

export interface BewerberStat {
  hub: string | null;
  status: string;
  zugewiesenAt: string;
  erstkontaktAt: string | null;
}

/**
 * Wie lange liegen Bewerbungen bei den PDLs, bevor sich jemand meldet?
 * Gemessen von der Weiterleitung bis zum ersten Statuswechsel. Offene
 * Bewerbungen zählen mit ihrer bisherigen Wartezeit — sonst sähe ein
 * Standort, der gar nicht reagiert, am besten aus.
 */
export function BewerberLiegezeit({
  rows,
  now,
}: {
  rows: BewerberStat[];
  now: string;
}) {
  const jetzt = new Date(now).getTime();
  const stunden = (r: BewerberStat) =>
    Math.max(
      0,
      ((r.erstkontaktAt ? new Date(r.erstkontaktAt).getTime() : jetzt) -
        new Date(r.zugewiesenAt).getTime()) /
        3_600_000,
    );

  const offen = rows.filter(
    (r) => !["eingestellt", "abgesagt"].includes(r.status),
  );
  const unbeantwortet = offen.filter((r) => !r.erstkontaktAt);
  const ueberfaellig = unbeantwortet.filter((r) => stunden(r) > 48);
  const beantwortet = rows.filter((r) => r.erstkontaktAt);
  const schnitt = beantwortet.length
    ? beantwortet.reduce((s, r) => s + stunden(r), 0) / beantwortet.length
    : null;
  const eingestellt = rows.filter((r) => r.status === "eingestellt").length;

  // Je Standort: offene, Ø Reaktionszeit, längste Wartezeit
  const hubs = new Map<
    string,
    { offen: number; zeiten: number[]; wartet: number }
  >();
  for (const r of rows) {
    const key = r.hub ?? "ohne Standort";
    const e = hubs.get(key) ?? { offen: 0, zeiten: [], wartet: 0 };
    if (!["eingestellt", "abgesagt"].includes(r.status)) e.offen++;
    if (r.erstkontaktAt) e.zeiten.push(stunden(r));
    else if (!["eingestellt", "abgesagt"].includes(r.status))
      e.wartet = Math.max(e.wartet, stunden(r));
    hubs.set(key, e);
  }
  const hubRows = [...hubs.entries()]
    .map(([name, v]) => ({
      name,
      offen: v.offen,
      schnitt: v.zeiten.length
        ? v.zeiten.reduce((a, b) => a + b, 0) / v.zeiten.length
        : null,
      wartet: v.wartet,
    }))
    // Handlungsbedarf zuerst: wer lässt am längsten warten?
    .sort((a, b) => b.wartet - a.wartet || (b.schnitt ?? 0) - (a.schnitt ?? 0));

  if (rows.length === 0) {
    return (
      <p className="rounded-xl border bg-card p-5 text-sm text-muted-foreground shadow-sm">
        Noch keine Bewerbungen an Standorte weitergeleitet. Unter{" "}
        <span className="font-medium text-foreground">Recruiting-Leads</span>{" "}
        lassen sich Bewerbungen per &bdquo;zur PDL weiterleiten&ldquo; zuweisen.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile
          icon={Users}
          tone="blue"
          coloredValue
          label="Bewerbungen bei PDLs"
          value={rows.length}
          sub={`${offen.length} noch offen`}
        />
        <StatTile
          icon={Clock}
          tone="purple"
          coloredValue
          label="Ø bis zur Rückmeldung"
          value={schnitt === null ? "—" : formatLiegezeit(schnitt)}
          sub={`aus ${beantwortet.length} Rückmeldungen`}
        />
        <StatTile
          icon={AlertTriangle}
          tone="red"
          coloredValue={ueberfaellig.length > 0}
          label="Über 48 Std unbeantwortet"
          value={ueberfaellig.length}
          sub="Bewerber springen ab"
        />
        <StatTile
          icon={UserCheck}
          tone="green"
          coloredValue
          label="Eingestellt"
          value={eingestellt}
          sub={`${rows.length > 0 ? Math.round((eingestellt / rows.length) * 100) : 0} % der Bewerbungen`}
        />
      </div>

      <div className="overflow-x-auto rounded-xl border bg-card shadow-sm">
        <table className="w-full min-w-[520px] text-sm">
          <thead>
            <tr className="border-b text-left text-xs text-muted-foreground">
              <th className="px-4 py-2 font-medium">Standort</th>
              <th className="px-2 py-2 font-medium">Offen</th>
              <th className="px-2 py-2 font-medium">Ø Rückmeldung</th>
              <th className="px-4 py-2 font-medium">Längste offene Wartezeit</th>
            </tr>
          </thead>
          <tbody>
            {hubRows.map((h) => (
              <tr key={h.name} className="border-b last:border-b-0">
                <td className="px-4 py-2 font-medium">{h.name}</td>
                <td className="px-2 py-2 tabular-nums">{h.offen}</td>
                <td className="px-2 py-2 tabular-nums">
                  {h.schnitt === null ? (
                    <span className="text-muted-foreground">
                      noch keine Rückmeldung
                    </span>
                  ) : (
                    formatLiegezeit(h.schnitt)
                  )}
                </td>
                <td
                  className={cn(
                    "px-4 py-2 tabular-nums",
                    h.wartet > 48 && "font-semibold text-red-700",
                  )}
                >
                  {h.wartet > 0 ? formatLiegezeit(h.wartet) : "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-muted-foreground">
        Gemessen von der Weiterleitung bis zur ersten Rückmeldung der PDL.
        Offene Bewerbungen zählen mit ihrer bisherigen Wartezeit — sonst stünde
        ein Standort, der gar nicht reagiert, am besten da.
      </p>
    </div>
  );
}
