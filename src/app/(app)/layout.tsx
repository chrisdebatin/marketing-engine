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
        {/* Mobil: Top-Bar */}
        <div className="lg:hidden">
          <AppHeader isAdmin={session.isAdmin} email={session.email} />
        </div>
        <main className="mx-auto w-full max-w-[1480px] flex-1 px-4 py-6 sm:px-6 sm:py-8 lg:px-10 lg:py-10">
          {children}
        </main>
      </div>
    </div>
  );
}
