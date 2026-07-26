"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";

export interface PdlTab {
  id: string;
  label: string;
  badge?: number;
  content: React.ReactNode;
}

/** Reiter-Navigation für das PDL-Dashboard (Inhalte kommen vom Server). */
export function PdlTabs({ tabs }: { tabs: PdlTab[] }) {
  const [active, setActive] = useState(tabs[0]?.id);

  return (
    <div className="flex flex-col gap-5">
      <div className="sticky top-0 z-30 -mx-4 bg-background/90 px-4 py-2 backdrop-blur-lg">
        <div className="flex gap-1 overflow-x-auto rounded-xl bg-muted p-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {tabs.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setActive(t.id)}
              className={cn(
                "flex flex-1 items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium whitespace-nowrap transition-all",
                active === t.id
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {t.label}
              {t.badge != null && t.badge > 0 && (
                <span
                  className={cn(
                    "rounded-full px-1.5 py-0.5 text-[0.65rem] leading-none font-semibold tabular-nums",
                    active === t.id
                      ? "bg-primary text-primary-foreground"
                      : "bg-primary/15 text-primary",
                  )}
                >
                  {t.badge}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {tabs.map((t) => (
        <div key={t.id} className={cn(active !== t.id && "hidden")}>
          {t.content}
        </div>
      ))}
    </div>
  );
}
