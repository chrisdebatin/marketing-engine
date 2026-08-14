"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LogOut, Megaphone } from "lucide-react";
import { cn } from "@/lib/utils";
import { isNavActive, navGroups } from "@/lib/nav";
import { OnlineIndicator } from "@/components/online-indicator";
import { SyncBadge } from "@/components/sync-badge";

/**
 * Desktop-Navigation als linke weiße Sidebar (Referenz-Look): Icon + Label,
 * aktive Seite als kräftig blaues abgerundetes Rechteck mit weißem Text,
 * Badge-Zähler (offene Leads) als kleine rote Pille.
 * Auf Mobilgeräten übernimmt weiterhin die Top-Bar (AppHeader).
 */
export function AppSidebar({
  isAdmin,
  email,
  crmBadge = 0,
}: {
  isAdmin: boolean;
  email: string | null;
  /** Anzahl offener (unbeantworteter) Leads — rote Pille am CRM-Eintrag. */
  crmBadge?: number;
}) {
  const pathname = usePathname();

  return (
    <aside className="fixed inset-y-0 left-0 z-40 hidden w-64 flex-col border-r bg-sidebar lg:flex">
      {/* Logo */}
      <Link
        href="/"
        className="flex h-16 shrink-0 items-center gap-2.5 border-b px-5 font-semibold"
      >
        <span className="flex size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
          <Megaphone className="size-4" />
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
          <div key={group.title} className="mb-6">
            <p className="mb-1.5 px-2.5 text-[0.6875rem] font-semibold tracking-wider text-muted-foreground/70 uppercase">
              {group.title}
            </p>
            <ul className="flex flex-col gap-0.5">
              {group.items.map(({ href, label, Icon }) => {
                const active = isNavActive(href, pathname);
                const badge = href === "/crm" ? crmBadge : 0;
                return (
                  <li key={href}>
                    <Link
                      href={href}
                      aria-current={active ? "page" : undefined}
                      className={cn(
                        "flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm transition-colors",
                        active
                          ? "bg-primary font-medium text-primary-foreground shadow-sm"
                          : "font-normal text-muted-foreground hover:bg-accent/60 hover:text-foreground",
                      )}
                    >
                      <Icon
                        className={cn(
                          "size-4 shrink-0",
                          active
                            ? "text-primary-foreground"
                            : "text-muted-foreground/70",
                        )}
                      />
                      <span className="min-w-0 flex-1 truncate">{label}</span>
                      {badge > 0 && (
                        <span
                          title={`${badge} offene Leads warten auf Rückruf`}
                          className={cn(
                            "flex h-4.5 min-w-4.5 items-center justify-center rounded-full px-1 text-[10px] leading-none font-bold tabular-nums",
                            active
                              ? "bg-white/25 text-primary-foreground"
                              : "bg-red-500 text-white",
                          )}
                        >
                          {badge}
                        </span>
                      )}
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
