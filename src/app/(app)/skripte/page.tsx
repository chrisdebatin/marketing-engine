import { AlertTriangle, MessageSquareQuote } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { SkriptBibliothek } from "@/components/skript-bibliothek";
import { SKRIPTE } from "@/lib/skripte";

export const dynamic = "force-dynamic";

/**
 * Skript-Bibliothek: Gesprächsleitfäden je Zielgruppe zum Mitlesen während
 * des Telefonats. Bewusst eine eigene Seite (nicht nur die Outbound-
 * Seitenleiste), weil Devina die Patienten-Skripte auch bei Meta- und
 * Agentur-Leads braucht — also außerhalb der Outbound-Ansicht.
 */
export default function SkriptePage() {
  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        icon={MessageSquareQuote}
        title="Gesprächs-Skripte"
        description="Leitfäden für jede Lead-Quelle — zum Mitlesen während des Telefonats. Sätze lassen sich einzeln kopieren."
      />

      {/* Der Hinweis steht bewusst ganz oben: er betrifft jedes Skript und
          verhindert Zusagen, die der Standort nicht halten kann. */}
      <div className="flex items-start gap-3 rounded-xl border border-amber-300 bg-amber-50 p-4">
        <AlertTriangle className="mt-0.5 size-5 shrink-0 text-amber-600" />
        <div className="text-sm text-amber-900">
          <p className="font-semibold">
            Nur zusagen, was der Standort wirklich leisten kann
          </p>
          <p className="mt-1 leading-relaxed">
            Das System kennt drei Bereiche: <strong>Alltagshilfe</strong>,{" "}
            <strong>Ambulant</strong> und <strong>Intensiv</strong>. Ob
            Physiotherapie, Ergotherapie, Logopädie und Pflegehilfsmittel an
            einem Standort verfügbar sind, ist hier <strong>nicht</strong>{" "}
            hinterlegt — im Zweifel bei der PDL nachfragen und im Gespräch
            weglassen. Eine Zusage, die später nicht gehalten wird, kostet mehr
            als ein kurzer Rückruf.
          </p>
        </div>
      </div>

      <SkriptBibliothek skripte={SKRIPTE} />
    </div>
  );
}
