import { requireSession } from "@/lib/auth";
import { AppHeader } from "@/components/app-header";
import { AppSidebar } from "@/components/app-sidebar";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await requireSession();

  return (
    <div className="flex min-h-full flex-1">
      {/* Desktop: linke Sidebar */}
      <AppSidebar isAdmin={session.isAdmin} email={session.email} />

      <div className="relative flex min-h-full flex-1 flex-col lg:pl-64">
        {/* Dezenter Farbverlauf hinter dem Inhalt */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-80 bg-gradient-to-b from-primary/[0.07] via-primary/[0.03] to-transparent"
        />
        {/* Mobil: Top-Bar */}
        <div className="lg:hidden">
          <AppHeader isAdmin={session.isAdmin} email={session.email} />
        </div>
        <main className="w-full flex-1 px-4 py-8 sm:px-6 lg:px-8">
          {children}
        </main>
      </div>
    </div>
  );
}
