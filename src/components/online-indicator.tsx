"use client";

import { useOnline } from "@/lib/offline/use-online";
import { cn } from "@/lib/utils";

/** Small dot showing the current network status. */
export function OnlineIndicator() {
  const online = useOnline();
  return (
    <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
      <span
        className={cn(
          "size-2 rounded-full",
          online ? "bg-emerald-500" : "bg-amber-500",
        )}
        aria-hidden
      />
      <span className="hidden sm:inline">{online ? "Online" : "Offline"}</span>
    </span>
  );
}
