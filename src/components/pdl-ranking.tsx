import { Phone, Trophy } from "lucide-react";
import { createAdminClient } from "@/lib/supabase/admin";
import { cn } from "@/lib/utils";

/**
 * PDL-Ranking (CRM-Admin): Die PDLs sind der Engpass, durch den jeder Lead
 * muss — dieses Ranking zeigt je Standort, wie viele Leads übergeben wurden,
 * wie aktiv die PDL im Marketing ist (Flyer & Boxen, letzte 4 Wochen) und
 * wie erreichbar sie ist (✓/✗-Vermerke des Teams + "PDL nicht erreicht" an
 * Leads). Sortiert nach Handlungsbedarf: schlechteste Erreichbarkeit zuerst
 * → dort mit Schulung/Sensibilisierung ansetzen (neue Leads haben zeitlich
 * Vorrang vor Routine-Aufgaben).
 */
export async function PdlRanking() {
  const admin = createAdminClient();
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - 28);
  const cutoff = cutoffDate.toISOString().slice(0, 10);

  const [
    { data: hubs },
    { data: leadHubs },
    { data: metaHubs },
    { data: aktionRows },
    { data: placementRows },
    versucheRes,
    { data: nichtErreichtCalls },
    { data: nichtErreichtMeta },
  ] = await Promise.all([
    admin.from("hubs").select("id, name, pdl_name"),
    admin.from("lead_calls").select("zugewiesen_hub_id, zugewiesen_at").not("zugewiesen_hub_id", "is", null),
    admin.from("meta_leads").select("zugewiesen_hub_id, zugewiesen_at").not("zugewiesen_hub_id", "is", null),
    admin
      .from("crm_contacts")
      .select("hub_id, kontakt_art")
      .in("kontakt_art", ["box", "flyer"])
      .gte("contact_date", cutoff),
    admin.from("delivery_placements").select("hub_id").gte("created_at", cutoff),
    // Tolerant, solange Migration 0060 fehlt.
    admin.from("pdl_versuche").select("hub_id, erreicht"),
    admin.from("lead_calls").select("zugewiesen_hub_id").ilike("pdl_ergebnis", "%nicht erreicht%"),
    admin.from("meta_leads").select("zugewiesen_hub_id").ilike("pdl_ergebnis", "%nicht erreicht%"),
  ]);

  const versuche = versucheRes.error ? [] : (versucheRes.data ?? []);
  const versucheFehlen = Boolean(versucheRes.error);

  interface Zeile {
    hub: string;
    pdl: string | null;
    leads: number;
    leads28: number;
    aktionen: number;
    erreicht: number;
    nicht: number;
  }
  const rows = new Map<string, Zeile>();
  for (const h of hubs ?? []) {
    rows.set(h.id, {
      hub: h.name,
      pdl: h.pdl_name,
      leads: 0,
      leads28: 0,
      aktionen: 0,
      erreicht: 0,
      nicht: 0,
    });
  }
  const at = (id: string | null) => (id ? rows.get(id) : undefined);
  for (const l of [...(leadHubs ?? []), ...(metaHubs ?? [])]) {
    const z = at(l.zugewiesen_hub_id);
    if (!z) continue;
    z.leads++;
    if ((l.zugewiesen_at ?? "").slice(0, 10) >= cutoff) z.leads28++;
  }
  for (const a of aktionRows ?? []) {
    const z = at(a.hub_id);
    if (z) z.aktionen++;
  }
  for (const p of placementRows ?? []) {
    const z = at(p.hub_id);
    if (z) z.aktionen++;
  }
  for (const v of versuche) {
    const z = at(v.hub_id);
    if (!z) continue;
    if (v.erreicht) z.erreicht++;
    else z.nicht++;
  }
  // Historische "PDL nicht erreicht"-Vermerke an Leads zählen als Fehlversuch.
  for (const l of [...(nichtErreichtCalls ?? []), ...(nichtErreichtMeta ?? [])]) {
    const z = at(l.zugewiesen_hub_id);
    if (z) z.nicht++;
  }

  // Nur Standorte mit irgendeiner Relevanz (Leads oder Versuche oder Aktionen).
  const liste = [...rows.values()].filter(
    (z) => z.leads > 0 || z.erreicht + z.nicht > 0 || z.aktionen > 0,
  );
  const quote = (z: Zeile) => {
    const total = z.erreicht + z.nicht;
    return total === 0 ? null : z.erreicht / total;
  };
  // Handlungsbedarf zuerst: schlechteste Erreichbarkeit, dann wenigste Aktionen.
  liste.sort((a, b) => {
    const qa = quote(a);
    const qb = quote(b);
    if (qa !== qb) return (qa ?? 2) - (qb ?? 2);
    return a.aktionen - b.aktionen;
  });
  const maxAktionen = Math.max(1, ...liste.map((z) => z.aktionen));

  const quoteChip = (z: Zeile) => {
    const q = quote(z);
    if (q == null)
      return (
        <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
          keine Daten
        </span>
      );
    const p = Math.round(q * 100);
    const tone =
      q >= 0.75
        ? "bg-emerald-100 text-emerald-800"
        : q >= 0.4
          ? "bg-amber-100 text-amber-800"
          : "bg-red-100 text-red-800";
    const label = q >= 0.75 ? "gut erreichbar" : q >= 0.4 ? "durchwachsen" : "schwer erreichbar";
    return (
      <span className={cn("rounded-full px-2 py-0.5 text-[11px] font-semibold", tone)}>
        {p} % · {label}
      </span>
    );
  };

  return (
    <section className="rounded-xl border bg-card p-4 shadow-sm">
      <h2 className="flex items-center gap-1.5 text-sm font-semibold">
        <Trophy className="size-4 text-primary" />
        PDL-Ranking — Erreichbarkeit &amp; Marketing-Aktivität
      </h2>
      <p className="mt-0.5 text-xs text-muted-foreground">
        Die PDLs sind der Engpass für jeden Lead. Handlungsbedarf oben:
        schwer erreichbar oder wenig aktiv → dort mit Schulung ansetzen und
        sensibilisieren, dass neue Leads zeitlich Vorrang vor Routine-Aufgaben
        haben. Erreichbarkeit aus den ✓/✗-Vermerken an den Lead-Karten
        (&bdquo;PDL angerufen?&ldquo;) plus &bdquo;PDL nicht erreicht&ldquo;-Ergebnissen;
        Aktionen = Flyer &amp; Boxen der letzten 4 Wochen.
        {versucheFehlen &&
          " Hinweis: Das Versuchs-Log (Migration 0060) ist noch nicht eingespielt — aktuell zählen nur die Lead-Ergebnisse."}
      </p>
      {liste.length === 0 ? (
        <p className="mt-3 text-sm text-muted-foreground">
          Noch keine Übergaben, Versuche oder Aktionen erfasst.
        </p>
      ) : (
        <div className="mt-3 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-xs text-muted-foreground">
                <th className="py-1.5 pr-3 font-medium">Standort (PDL)</th>
                <th className="py-1.5 pr-3 font-medium">Leads erhalten</th>
                <th className="py-1.5 pr-3 font-medium">Aktionen (4 Wo)</th>
                <th className="py-1.5 pr-3 font-medium">Anruf-Versuche</th>
                <th className="py-1.5 font-medium">Erreichbarkeit</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {liste.map((z) => {
                const total = z.erreicht + z.nicht;
                return (
                  <tr key={z.hub}>
                    <td className="py-1.5 pr-3">
                      <span className="font-medium">{z.hub}</span>
                      {z.pdl && (
                        <span className="ml-1.5 text-xs text-muted-foreground">{z.pdl}</span>
                      )}
                    </td>
                    <td className="py-1.5 pr-3 tabular-nums">
                      {z.leads}
                      <span className="ml-1 text-xs text-muted-foreground">
                        ({z.leads28} in 4 Wo)
                      </span>
                    </td>
                    <td className="py-1.5 pr-3">
                      <div className="flex items-center gap-2">
                        <div className="h-4 w-20 shrink-0">
                          <div
                            className="h-full rounded-r-[4px]"
                            style={{
                              width: `${(z.aktionen / maxAktionen) * 100}%`,
                              background: "var(--f3, #2a78d6)",
                              minWidth: z.aktionen > 0 ? 4 : 0,
                            }}
                          />
                        </div>
                        <span className="tabular-nums">{z.aktionen}</span>
                      </div>
                    </td>
                    <td className="py-1.5 pr-3">
                      {total === 0 ? (
                        <span className="text-xs text-muted-foreground">—</span>
                      ) : (
                        <div className="flex items-center gap-2">
                          {/* Farbskala: grün = erreicht, rot = nicht erreicht */}
                          <div className="flex h-4 w-24 shrink-0 overflow-hidden rounded-[4px]">
                            {z.erreicht > 0 && (
                              <div
                                className="h-full bg-emerald-500"
                                style={{ width: `${(z.erreicht / total) * 100}%` }}
                                title={`${z.erreicht}× erreicht`}
                              />
                            )}
                            {z.nicht > 0 && (
                              <div
                                className="h-full bg-red-400"
                                style={{ width: `${(z.nicht / total) * 100}%` }}
                                title={`${z.nicht}× nicht erreicht`}
                              />
                            )}
                          </div>
                          <span className="flex items-center gap-1 text-xs tabular-nums">
                            <Phone className="size-3 text-muted-foreground" />
                            {z.erreicht}✓ / {z.nicht}✗
                          </span>
                        </div>
                      )}
                    </td>
                    <td className="py-1.5">{quoteChip(z)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
