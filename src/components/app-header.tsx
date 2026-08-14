"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LogOut, Megaphone } from "lucide-react";
import { cn } from "@/lib/utils";
import { isNavActive, navItems } from "@/lib/nav";
import { OnlineIndicator } from "@/components/online-indicator";
import { SyncBadge } from "@/components/sync-badge";

export function AppHeader({
  isAdmin,
  email,
  crmBadge = 0,
}: {
  isAdmin: boolean;
  email: string | null;
  /** Anzahl offener Leads — rote Pille am CRM-Eintrag. */
  crmBadge?: number;
}) {
  const pathname = usePathname();
  const links = navItems(isAdmin);

  return (
    <header className="sticky top-0 z-40 border-b bg-background/80 backdrop-blur-lg supports-[backdrop-filter]:bg-background/60">
      <div className="mx-auto flex h-14 max-w-6xl items-center gap-3 px-4 sm:px-6">
        <Link href="/" className="flex shrink-0 items-center gap-2 font-semibold">
          <span className="flex size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <Megaphone className="size-4" />
          </span>
          <span className="hidden sm:inline">Marketing-Engine</span>
        </Link>
        <nav className="ml-1 flex flex-1 items-center gap-1 overflow-x-auto [mask-image:linear-gradient(to_right,black_calc(100%-1.5rem),transparent)] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {links.map((l) => {
            const active = isNavActive(l.href, pathname);
            return (
              <Link
                key={l.href}
                href={l.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm whitespace-nowrap transition-colors",
                  active
                    ? "bg-primary font-medium text-primary-foreground"
                    : "font-normal text-muted-foreground hover:bg-accent/60 hover:text-foreground",
                )}
              >
                {l.label}
                {l.href === "/crm" && crmBadge > 0 && (
                  <span
                    className={cn(
                      "flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[10px] leading-none font-bold tabular-nums",
                      active ? "bg-white/25 text-primary-foreground" : "bg-red-500 text-white",
                    )}
                  >
                    {crmBadge}
                  </span>
                )}
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
