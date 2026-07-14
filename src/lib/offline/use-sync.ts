"use client";

import { useCallback, useEffect, useState } from "react";
import { pendingCount, syncQueue } from "./queue";

/**
 * Tracks the pending-queue size and flushes it on mount, when coming online,
 * and whenever the queue changes. Returns the count + a manual sync trigger.
 */
export function useSync() {
  const [pending, setPending] = useState(0);

  const refresh = useCallback(async () => {
    try {
      setPending(await pendingCount());
    } catch {
      /* ignore (e.g. SSR / no IndexedDB) */
    }
  }, []);

  const sync = useCallback(async () => {
    await syncQueue();
    await refresh();
  }, [refresh]);

  useEffect(() => {
    void refresh();
    void sync();

    const onOnline = () => void sync();
    const onChange = () => void refresh();
    window.addEventListener("online", onOnline);
    window.addEventListener("queue-changed", onChange);

    // periodic retry while items remain
    const interval = window.setInterval(() => void sync(), 30_000);

    return () => {
      window.removeEventListener("online", onOnline);
      window.removeEventListener("queue-changed", onChange);
      window.clearInterval(interval);
    };
  }, [refresh, sync]);

  return { pending, sync };
}
