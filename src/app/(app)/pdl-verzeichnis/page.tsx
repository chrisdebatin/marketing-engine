import { Users } from "lucide-react";
import { requireSession } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { PageHeader } from "@/components/page-header";
import { PdlVerzeichnis, type PdlEintrag } from "@/components/pdl-verzeichnis";

export const dynamic = "force-dynamic";

/**
 * PDL-Verzeichnis: alle Standorte mit Ansprechpartner, Telefon und E-Mail —
 * für Devina und das Kundenservice-Team, wenn sie einen Standort erreichen
 * müssen. Bewusst als Seite und nicht als PDF: PDLs wechseln, und eine
 * verteilte Liste ist am Tag nach dem Verschicken veraltet.
 */
export default async function PdlVerzeichnisPage() {
  await requireSession();
  const admin = createAdminClient();

  const { data: hubs } = await admin
    .from("hubs")
    .select("id, name, region, pdl_name, pdl_phone, pdl_email, address")
    .order("name");

  const eintraege: PdlEintrag[] = (hubs ?? []).map((h) => ({
    id: h.id,
    name: h.name,
    region: h.region,
    pdl: h.pdl_name,
    telefon: h.pdl_phone,
    email: h.pdl_email,
    adresse: h.address,
  }));

  const ohneTelefon = eintraege.filter((e) => !e.telefon).length;

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        icon={Users}
        title="PDL-Verzeichnis"
        description="Alle Standorte mit Ansprechpartner — Telefonnummer antippen zum Anrufen. Die Liste kommt direkt aus dem System und ist damit immer aktuell."
      />
      <PdlVerzeichnis eintraege={eintraege} ohneTelefon={ohneTelefon} />
    </div>
  );
}
