"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";

export interface LeadTeam {
  id: string;
  label: string;
  badge?: number;
  content: React.ReactNode;
}

/**
 * Kleiner Team-Umschalter (oben rechts) innerhalb des Leads-Tabs auf /crm:
 * wechselt zwischen den Team-Ansichten (Belinda & Adelina / Davina), ohne
 * die große Tab-Leiste zu belegen — die gehört Leads vs. Outbound.
 */
export function LeadTeamSwitch({ teams }: { teams: LeadTeam[] }) {
  const [active, setActive] = useState(teams[0]?.id);

  return (
    <div className="flex flex-col gap-3">
      <div className="flex justify-end">
        <div className="flex gap-0.5 rounded-full border bg-card p-0.5 shadow-sm">
          {teams.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setActive(t.id)}
              className={cn(
                "flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium whitespace-nowrap transition-all",
                active === t.id
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {t.label}
              {t.badge != null && t.badge > 0 && (
                <span
                  className={cn(
                    "rounded-full px-1 py-0.5 text-[0.6rem] leading-none font-semibold tabular-nums",
                    active === t.id ? "bg-white/20" : "bg-primary/15 text-primary",
                  )}
                >
                  {t.badge}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>
      {teams.map((t) => (
        <div key={t.id} className={cn(active !== t.id && "hidden")}>
          {t.content}
        </div>
      ))}
    </div>
  );
}
