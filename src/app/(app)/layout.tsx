import { requireSession } from "@/lib/auth";
import { AppHeader } from "@/components/app-header";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await requireSession();

  return (
    <div className="relative flex min-h-full flex-1 flex-col">
      {/* Dezenter Farbverlauf hinter dem Inhalt — moderner Dashboard-Look */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-80 bg-gradient-to-b from-primary/[0.07] via-primary/[0.03] to-transparent"
      />
      <AppHeader isAdmin={session.isAdmin} email={session.email} />
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8 sm:px-6">
        {children}
      </main>
    </div>
  );
}
