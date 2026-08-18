import Link from "next/link";
import { BookOpen, HelpCircle, Phone, Users } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { CrmHilfe } from "@/components/crm-hilfe";

export const dynamic = "force-dynamic";

/**
 * Fragen-Seite zum CRM: Claude beantwortet Bedienungs-Fragen aus der
 * hinterlegten Anleitung. Dazu die beiden Handbücher zum Nachlesen.
 */
export default function CrmHilfePage() {
  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        icon={HelpCircle}
        title="CRM-Hilfe"
        description="Frag alles zur Bedienung des CRM — die Antwort kommt aus der hinterlegten Anleitung. Für Zahlen und Auswertungen gibt es den Assistenten."
      />

      {/* Handbücher */}
      <div className="grid gap-3 sm:grid-cols-2">
        <Link
          href="/crm-hilfe/kundenservice"
          className="flex items-start gap-3 rounded-xl border bg-card p-4 shadow-sm transition-shadow hover:shadow-md"
        >
          <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-blue-100 text-blue-600">
            <Users className="size-5" />
          </span>
          <span className="min-w-0">
            <span className="block font-semibold">
              Handbuch Belinda &amp; Adelina
            </span>
            <span className="block text-sm text-muted-foreground">
              Inbound-Leads: annehmen, Daten aufnehmen, an die PDL übergeben
            </span>
          </span>
        </Link>
        <Link
          href="/crm-hilfe/callcenter"
          className="flex items-start gap-3 rounded-xl border bg-card p-4 shadow-sm transition-shadow hover:shadow-md"
        >
          <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-purple-100 text-purple-600">
            <Phone className="size-5" />
          </span>
          <span className="min-w-0">
            <span className="block font-semibold">Handbuch Devina</span>
            <span className="block text-sm text-muted-foreground">
              Recare-Anfragen und Outbound-Anrufe bei Kliniken &amp; Praxen
            </span>
          </span>
        </Link>
      </div>

      {/* Nachschlagewerke, die sich aus echten Daten speisen */}
      <Link
        href="/pdl-verzeichnis"
        className="flex items-start gap-3 rounded-xl border bg-card p-4 shadow-sm transition-shadow hover:shadow-md"
      >
        <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-emerald-100 text-emerald-600">
          <Users className="size-5" />
        </span>
        <span className="min-w-0">
          <span className="block font-semibold">PDL-Verzeichnis</span>
          <span className="block text-sm text-muted-foreground">
            Alle Standorte mit Ansprechpartner, Telefon und E-Mail — immer
            aktuell, direkt aus dem System
          </span>
        </span>
      </Link>

      <CrmHilfe />

      <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <BookOpen className="size-3.5" />
        Ändert sich am Prozess etwas, muss die Anleitung in{" "}
        <code>src/lib/crm-wissen.ts</code> nachgezogen werden — sonst
        antwortet die Hilfe veraltet.
      </p>
    </div>
  );
}
