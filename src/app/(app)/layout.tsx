import { requireSession } from "@/lib/auth";
import { AppHeader } from "@/components/app-header";
import { AppSidebar } from "@/components/app-sidebar";

/** Offene (noch unbeantwortete) Leads zählen — rote Pille am CRM-Nav-Eintrag. */
async function countOpenLeads(): Promise<number> {
  try {
    const { createAdminClient } = await import("@/lib/supabase/admin");
    const admin = createAdminClient();
    const [calls, meta] = await Promise.all([
      admin
        .from("lead_calls")
        .select("id", { count: "exact", head: true })
        .eq("status", "offen"),
      admin
        .from("meta_leads")
        .select("id", { count: "exact", head: true })
        .eq("status", "offen"),
    ]);
    return (calls.count ?? 0) + (meta.count ?? 0);
  } catch {
    return 0;
  }
}

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await requireSession();
  const crmBadge = await countOpenLeads();

  return (
    <div className="flex min-h-full flex-1">
      {/* Desktop: linke Sidebar */}
      <AppSidebar isAdmin={session.isAdmin} email={session.email} crmBadge={crmBadge} />

      <div className="relative flex min-h-full flex-1 flex-col lg:pl-64">
        {/* Mobil: Top-Bar */}
        <div className="lg:hidden">
          <AppHeader isAdmin={session.isAdmin} email={session.email} crmBadge={crmBadge} />
        </div>
        <main className="mx-auto w-full max-w-[1480px] flex-1 px-4 py-6 sm:px-6 sm:py-8 lg:px-10 lg:py-10">
          {children}
        </main>
      </div>
    </div>
  );
}
