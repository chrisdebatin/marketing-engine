import { Smartphone } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import {
  listAllAnnouncements,
  listCustomerReferrals,
  listMaReferrals,
  listStaff,
} from "@/lib/employee/admin";
import { requireSession } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { AnnouncementsPanel } from "./announcements-panel";
import { ReferralsPanel } from "./referrals-panel";
import { StaffPanel } from "./staff-panel";
import { SchemaHint } from "./schema-hint";

export const dynamic = "force-dynamic";

/**
 * Admin-Bereich der Mitarbeiter-App — bewusst INNERHALB der Marketing-Engine
 * (Route-Group (app)), damit es keine zweite interne Welt gibt.
 * Utilitaristisch gehalten: Tabellen, Formulare, keine Mobile-Optik.
 */
export default async function MitarbeiterAppAdminPage() {
  // Diese Seite rendert Mitarbeiterdaten und Empfehlungen (inkl. Kontaktdaten
  // Dritter). Sie ist deshalb NICHT im Open-Access-Modus sichtbar, sondern
  // verlangt eine echte Anmeldung — siehe requireEmployeeAppAdmin().
  const session = await requireSession();
  if (!session.loggedIn || !session.isAdmin) {
    return (
      <div className="flex flex-col gap-6">
        <PageHeader
          title="Mitarbeiter-App"
          description="Meldungen, Empfehlungen und Zugaenge der Mitarbeitenden."
          icon={Smartphone}
        />
        <div className="rounded-xl border border-border bg-card p-6">
          <p className="text-[15px] font-medium text-foreground">
            Bitte anmelden.
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            Dieser Bereich zeigt personenbezogene Daten und ist nur fuer
            angemeldete Admins zugaenglich.
          </p>
          <a
            href="/login"
            className="mt-4 inline-flex h-9 items-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground"
          >
            Zur Anmeldung
          </a>
        </div>
      </div>
    );
  }

  // Fehlt die Schema-Freigabe im Dashboard, liefert PostgREST PGRST106.
  // Statt einer kaputten Seite zeigen wir dann eine klare Anleitung.
  // Das Ergebnis wird als Wert durchgereicht (kein Reassign nach dem Render).
  const [staffResult, announcements, customer, ma, hubsRes] = await Promise.all([
    listStaff().then(
      (rows) => ({ ok: true as const, rows }),
      () => ({ ok: false as const, rows: [] as Awaited<ReturnType<typeof listStaff>> }),
    ),
    listAllAnnouncements().catch(() => []),
    listCustomerReferrals().catch(() => []),
    listMaReferrals().catch(() => []),
    createAdminClient().from("hubs").select("id, name").order("name"),
  ]);

  const staff = staffResult.rows;
  const failed = !staffResult.ok;
  const hubs = (hubsRes.data ?? []) as { id: string; name: string }[];

  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        title="Mitarbeiter-App"
        description="Meldungen, Empfehlungen und Zugaenge der Mitarbeitenden."
        icon={Smartphone}
      />

      {failed && <SchemaHint />}

      <AnnouncementsPanel announcements={announcements} />
      <ReferralsPanel customer={customer} ma={ma} />
      <StaffPanel staff={staff} hubs={hubs} />
    </div>
  );
}
