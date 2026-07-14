"use client";

import { useSync } from "@/lib/offline/use-sync";
import { Badge } from "@/components/ui/badge";

/** Shows how many activities are waiting to be synced; hidden when zero. */
export function SyncBadge() {
  const { pending } = useSync();
  if (pending <= 0) return null;
  return (
    <Badge variant="secondary" className="whitespace-nowrap">
      {pending} offen
    </Badge>
  );
}
