import { TriangleAlert } from "lucide-react";

/**
 * Wird angezeigt, wenn der Zugriff auf employee_app fehlschlaegt — in aller
 * Regel, weil die einmalige Dashboard-Freigabe fehlt. Ohne diesen Hinweis
 * waere der Fehler ("PGRST106") fuer den Betreiber nicht deutbar.
 */
export function SchemaHint() {
  return (
    <div className="flex gap-3 rounded-xl border border-amber-300 bg-amber-50 p-4">
      <TriangleAlert
        className="mt-0.5 size-5 shrink-0 text-amber-600"
        aria-hidden
      />
      <div className="text-sm text-amber-900">
        <p className="font-semibold">
          Das Schema „employee_app“ ist noch nicht freigegeben.
        </p>
        <ol className="mt-2 list-decimal space-y-1 pl-5">
          <li>
            Migrationen <code>0063_employee_app.sql</code> und{" "}
            <code>0064_employee_app_rls.sql</code> im Supabase-SQL-Editor
            ausfuehren.
          </li>
          <li>
            Danach: <strong>Settings → API → Exposed schemas</strong> um{" "}
            <code>employee_app</code> ergaenzen und speichern.
          </li>
        </ol>
        <p className="mt-2">
          Ohne Schritt 2 antwortet Supabase mit <code>PGRST106</code> — auch
          fuer den Server-Zugriff.
        </p>
      </div>
    </div>
  );
}
