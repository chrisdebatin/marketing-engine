import { redirect } from "next/navigation";
import Link from "next/link";
import { PhoneIncoming } from "lucide-react";
import { requireSession } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { PageHeader } from "@/components/page-header";
import {
  CallcenterAnalyse,
  type AnalyseLead,
} from "@/components/callcenter-analyse";
import { kategorieAusErgebnis, stundeAusNotiz } from "@/lib/callcenter";

export const dynamic = "force-dynamic";

/**
 * Callcenter-Analyse: Wann kommen verpasste Anrufe rein, worum ging es und
 * wie viele Interessenten liegen außerhalb der Besetzungszeit.
 * EINZIGE Datenquelle: die Benachrichtigungs-Mails der Telefonanlage über
 * verpasste Anrufe (lead_calls, quelle "telefon0800"). Angenommene Anrufe
 * erzeugen keine Mail und sind dem System nicht bekannt.
 */
export default async function CallcenterPage() {
  const session = await requireSession();
  if (!session.isAdmin) redirect("/crm");

  const admin = createAdminClient();
  // select("*") — fehlt eine Spalte aus einer noch nicht eingespielten
  // Migration, liefert die Abfrage trotzdem Daten.
  const { data: callRows } = await admin
    .from("lead_calls")
    .select("*")
    .eq("quelle", "telefon0800")
    .limit(4000);

  const leads: AnalyseLead[] = (callRows ?? []).flatMap((l) => {
    const zeit = l.created_at ?? `${l.call_date}T12:00:00Z`;
    const stunde = stundeAusNotiz(l.notiz, zeit);
    // Ohne belegbare Uhrzeit fließt der Anruf nicht in die Zeit-Auswertung ein.
    if (stunde === null) return [];
    return [
      {
        zeit,
        stunde,
        kategorie: kategorieAusErgebnis(l.ergebnis),
        bereich: l.bereich,
      },
    ];
  });

  const tageSet = [
    ...new Set(
      (callRows ?? []).map((l) => (l.created_at ?? `${l.call_date}T00:00:00Z`).slice(0, 10)),
    ),
  ].sort();
  const zeitraum = tageSet.length
    ? { von: tageSet[0], bis: tageSet[tageSet.length - 1] }
    : null;

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        icon={PhoneIncoming}
        title="Callcenter-Analyse"
        description="Verpasste Anrufe aus den Mails der Telefonanlage: wann sie reinkommen, worum es ging — und wie viele Interessenten außerhalb der Besetzungszeit liegen bleiben."
      />


      <CallcenterAnalyse
        leads={leads}
        tage={tageSet.length}
        zeitraum={zeitraum}
      />

      <p className="text-xs text-muted-foreground">
        Der Tagesreport mit Leads, Kontakten und PDL-Ranking steht unter{" "}
        <Link href="/crm-admin" className="text-primary underline">
          CRM-Admin
        </Link>
        .
      </p>
    </div>
  );
}
