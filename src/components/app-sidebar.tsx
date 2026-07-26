"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LogOut, Megaphone } from "lucide-react";
import { cn } from "@/lib/utils";
import { isNavActive, navGroups } from "@/lib/nav";
import { OnlineIndicator } from "@/components/online-indicator";
import { SyncBadge } from "@/components/sync-badge";

/**
 * Desktop-Navigation als linke Sidebar (moderner Software-Look);
 * auf Mobilgeräten übernimmt weiterhin die Top-Bar (AppHeader).
 */
export function AppSidebar({
  isAdmin,
  email,
}: {
  isAdmin: boolean;
  email: string | null;
}) {
  const pathname = usePathname();

  return (
    <aside className="fixed inset-y-0 left-0 z-40 hidden w-64 flex-col border-r bg-card/60 backdrop-blur-xl lg:flex">
      {/* Logo */}
      <Link
        href="/"
        className="flex h-16 shrink-0 items-center gap-2.5 border-b px-5 font-semibold"
      >
        <span className="flex size-9 items-center justify-center rounded-xl bg-gradient-to-br from-primary to-chart-5 text-primary-foreground shadow-sm">
          <Megaphone className="size-4.5" />
        </span>
        <span className="leading-tight">
          Marketing-Engine
          <span className="block text-[0.65rem] font-normal tracking-wide text-muted-foreground uppercase">
            Pflegeunion
          </span>
        </span>
      </Link>

      {/* Gruppierte Navigation */}
      <nav className="flex-1 overflow-y-auto px-3 py-4">
        {navGroups(isAdmin).map((group) => (
          <div key={group.title} className="mb-5">
            <p className="mb-1.5 px-2 text-[0.65rem] font-semibold tracking-wider text-muted-foreground uppercase">
              {group.title}
            </p>
            <ul className="flex flex-col gap-0.5">
              {group.items.map(({ href, label, Icon }) => {
                const active = isNavActive(href, pathname);
                return (
                  <li key={href}>
                    <Link
                      href={href}
                      className={cn(
                        "flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm font-medium transition-all",
                        active
                          ? "bg-primary text-primary-foreground shadow-sm"
                          : "text-muted-foreground hover:bg-muted hover:text-foreground",
                      )}
                    >
                      <Icon className="size-4 shrink-0" />
                      {label}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>

      {/* Fußbereich: Status + Konto */}
      <div className="flex flex-col gap-2 border-t px-4 py-3">
        <div className="flex items-center gap-2">
          <SyncBadge />
          <OnlineIndicator />
        </div>
        {email && (
          <div className="flex items-center justify-between gap-2">
            <span
              className="min-w-0 truncate text-xs text-muted-foreground"
              title={email}
            >
              {email}
            </span>
            <form action="/auth/signout" method="post">
              <button
                type="submit"
                title="Abmelden"
                className="flex size-7 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              >
                <LogOut className="size-3.5" />
                <span className="sr-only">Abmelden</span>
              </button>
            </form>
          </div>
        )}
      </div>
    </aside>
  );
}
