"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LogOut, Megaphone } from "lucide-react";
import { cn } from "@/lib/utils";
import { OnlineIndicator } from "@/components/online-indicator";
import { SyncBadge } from "@/components/sync-badge";

const NAV = [
  { href: "/", label: "Start" },
  { href: "/hubs", label: "Hubs" },
  { href: "/karte", label: "Karte" },
  { href: "/lieferungen", label: "Lieferungen" },
  { href: "/patienten", label: "Patienten" },
  { href: "/eintraege", label: "Einträge" },
  { href: "/assistant", label: "Assistant" },
];

export function AppHeader({ isAdmin, email }: { isAdmin: boolean; email: string | null }) {
  const pathname = usePathname();
  const links = isAdmin ? [...NAV, { href: "/admin", label: "Admin" }] : NAV;

  return (
    <header className="sticky top-0 z-40 border-b bg-background/80 backdrop-blur-lg supports-[backdrop-filter]:bg-background/60">
      <div className="mx-auto flex h-14 max-w-4xl items-center gap-3 px-4">
        <Link href="/" className="flex shrink-0 items-center gap-2 font-semibold">
          <span className="flex size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground shadow-sm">
            <Megaphone className="size-4" />
          </span>
          <span className="hidden sm:inline">Marketing-Engine</span>
        </Link>
        <nav className="ml-1 flex flex-1 items-center gap-1 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {links.map((l) => {
            const active =
              l.href === "/" ? pathname === "/" : pathname.startsWith(l.href);
            return (
              <Link
                key={l.href}
                href={l.href}
                className={cn(
                  "rounded-full px-3 py-1.5 text-sm font-medium whitespace-nowrap transition-colors",
                  active
                    ? "bg-primary/10 text-primary"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground",
                )}
              >
                {l.label}
              </Link>
            );
          })}
        </nav>
        <SyncBadge />
        <OnlineIndicator />
        {email && (
          <div className="flex shrink-0 items-center gap-1.5">
            <span
              className="hidden max-w-36 truncate text-xs text-muted-foreground md:inline"
              title={email}
            >
              {email}
            </span>
            <form action="/auth/signout" method="post">
              <button
                type="submit"
                title="Abmelden"
                className="flex size-8 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              >
                <LogOut className="size-4" />
                <span className="sr-only">Abmelden</span>
              </button>
            </form>
          </div>
        )}
      </div>
    </header>
  );
}
