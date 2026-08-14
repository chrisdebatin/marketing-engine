import { redirect } from "next/navigation";
import Link from "next/link";
import { PhoneIncoming } from "lucide-react";
import { requireSession } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { PageHeader } from "@/components/page-header";
import { CallUpload } from "@/components/call-upload";
import {
  CallcenterAnalyse,
  type AnalyseCall,
  type AnalyseLead,
} from "@/components/callcenter-analyse";

export const dynamic = "force-dynamic";

/**
 * Callcenter-Analyse: Erreichbarkeit und Anliegen der eingehenden Anrufe.
 * Datenbasis sind der CSV-Export der Telefonanlage (phone_calls) und die
 * KI-gelesenen Verpasst-Mails (lead_calls, quelle telefon0800).
 */
export default async function CallcenterPage() {
  const session = await requireSession();
  if (!session.isAdmin) redirect("/crm");

  const admin = createAdminClient();
  const [phoneRes, callsRes] = await Promise.all([
    admin
      .from("phone_calls")
      .select("call_time, hub_name, direction, answered, talking_seconds")
      .eq("direction", "inbound")
      .limit(20000),
    // select("*") — fehlt eine Spalte aus einer noch nicht eingespielten
    // Migration, liefert die Abfrage trotzdem Daten.
    admin.from("lead_calls").select("*").eq("quelle", "telefon0800").limit(4000),
  ]);

  const phoneRows = phoneRes.error ? [] : (phoneRes.data ?? []);
  const tabelleFehlt =
    phoneRes.error?.code === "PGRST205" || phoneRes.error?.code === "42P01";

  const calls: AnalyseCall[] = phoneRows.map((c) => ({
    zeit: c.call_time,
    hub: c.hub_name,
    angenommen: c.answered,
    sekunden: c.talking_seconds ?? 0,
  }));
  const tageSet = [...new Set(phoneRows.map((c) => c.call_time.slice(0, 10)))].sort();
  const zeitraum = tageSet.length
    ? { von: tageSet[0], bis: tageSet[tageSet.length - 1] }
    : null;

  // Kategorie steht im Ergebnis-Text der KI-Vorsortierung; erst die
  // Vorsortierung selbst erkennen, dann die Unterkategorie.
  const leads: AnalyseLead[] = (callsRes.data ?? []).map((l) => {
    const e = l.ergebnis ?? "";
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

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        icon={PhoneIncoming}
        title="Callcenter-Analyse"
        description="Wie viele Anrufe kommen rein, wie viele nehmen wir selbst an, wie viele landen bei der KI-Agentin Nora — und was uns fehlende Besetzung an Interessenten kostet."
      />

      {tabelleFehlt && (
        <p className="rounded-xl border bg-card p-5 text-sm text-muted-foreground shadow-sm">
          Die Tabelle <code>phone_calls</code> fehlt noch — bitte einmal{" "}
          <code>supabase/apply_all_pending.sql</code> im Supabase SQL-Editor
          ausführen, dann den CSV-Export hochladen.
        </p>
      )}

      <CallUpload />

      <CallcenterAnalyse
        calls={calls}
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
