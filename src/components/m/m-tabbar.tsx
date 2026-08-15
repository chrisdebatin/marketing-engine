"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { House, Newspaper, UserPlus, User } from "lucide-react";
import { cn } from "@/lib/utils";

const TABS = [
  { href: "/mitarbeiter/start", label: "Start", icon: House },
  { href: "/mitarbeiter/news", label: "News", icon: Newspaper },
  { href: "/mitarbeiter/empfehlen", label: "Empfehlen", icon: UserPlus },
  { href: "/mitarbeiter/profil", label: "Profil", icon: User },
] as const;

/**
 * Untere Tab-Leiste — bewusst mit Beschriftung (nie nur Icons): die
 * Zielgruppe ist nicht technisch versiert, Symbole allein sind mehrdeutig.
 */
export function MTabBar({ unread = 0 }: { unread?: number }) {
  const pathname = usePathname();

  return (
    <nav
      className="m-tabbar fixed inset-x-0 bottom-0 z-40 flex border-t border-border bg-card"
      aria-label="Hauptnavigation"
    >
      {TABS.map((tab) => {
        const active = pathname.startsWith(tab.href);
        const Icon = tab.icon;
        return (
          <Link
            key={tab.href}
            href={tab.href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "relative flex flex-1 flex-col items-center justify-center gap-1 pt-1.5",
              active ? "text-primary" : "text-muted-foreground",
            )}
          >
            {active && (
              <span
                aria-hidden
                className="absolute top-0 h-[3px] w-5 rounded-full bg-primary"
              />
            )}
            <span className="relative">
              <Icon size={24} strokeWidth={active ? 2.4 : 2} aria-hidden />
              {tab.label === "News" && unread > 0 && (
                <>
                  <span
                    aria-hidden
                    className="absolute -right-1 -top-0.5 size-2 rounded-full bg-destructive"
                  />
                  <span className="sr-only">{unread} ungelesen</span>
                </>
              )}
            </span>
            <span className="text-[11px] font-semibold">{tab.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
