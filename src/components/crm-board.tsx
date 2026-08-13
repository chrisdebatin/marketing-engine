"use client";

import { useState } from "react";
import { Inbox, PhoneCall } from "lucide-react";
import { cn } from "@/lib/utils";

export interface CrmBoardTeam {
  id: string;
  label: string;
  leadsBadge?: number;
  outboundBadge?: number;
  leads: React.ReactNode;
  outbound: React.ReactNode;
}

/**
 * /crm-Board: kleiner Team-Switch (Belinda & Adelina / Davina) ÜBER dem
 * großen Toggle "Anstehende Leads" vs. "Outbound-Anrufe" — jedes Team hat
 * seine eigene Lead-Inbox und seine eigene Anrufliste.
 */
export function CrmBoard({ teams }: { teams: CrmBoardTeam[] }) {
  const [teamId, setTeamId] = useState(teams[0]?.id);
  const [tab, setTab] = useState<"leads" | "outbound">("leads");
  const team = teams.find((t) => t.id === teamId) ?? teams[0];

  return (
    <div className="flex flex-col gap-3">
      {/* kleiner Team-Switch */}
      <div className="flex justify-end">
        <div className="flex gap-0.5 rounded-full border bg-card p-0.5 shadow-sm">
          {teams.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTeamId(t.id)}
              className={cn(
                "flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium whitespace-nowrap transition-all",
                teamId === t.id
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {t.label}
              {(t.leadsBadge ?? 0) > 0 && (
                <span
                  className={cn(
                    "rounded-full px-1 py-0.5 text-[0.6rem] leading-none font-semibold tabular-nums",
                    teamId === t.id ? "bg-white/20" : "bg-primary/15 text-primary",
                  )}
                >
                  {t.leadsBadge}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* großer Toggle: Leads vs. Outbound (fürs gewählte Team) */}
      <div className="flex gap-1 rounded-xl border bg-card p-1 shadow-sm">
        {(
          [
            { key: "leads", label: "Anstehende Leads", Icon: Inbox, badge: team?.leadsBadge },
            { key: "outbound", label: "Outbound-Anrufe", Icon: PhoneCall, badge: team?.outboundBadge },
          ] as const
        ).map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => setTab(t.key)}
            className={cn(
              "flex flex-1 items-center justify-center gap-2 rounded-lg px-3 py-2 text-sm font-medium",
              tab === t.key
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            <t.Icon className="size-4" />
            {t.label}
            {(t.badge ?? 0) > 0 && (
              <span
                className={cn(
                  "rounded-full px-1.5 text-xs font-semibold tabular-nums",
                  tab === t.key ? "bg-white/20" : "bg-primary/10 text-primary",
                )}
              >
                {t.badge}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Inhalte: alle gerendert, nur die aktive Kombination sichtbar (State bleibt erhalten) */}
      {teams.map((t) => (
        <div key={t.id} className={cn(t.id !== teamId && "hidden")}>
          <div className={cn(tab !== "leads" && "hidden")}>{t.leads}</div>
          <div className={cn(tab !== "outbound" && "hidden")}>{t.outbound}</div>
        </div>
      ))}
    </div>
  );
}
