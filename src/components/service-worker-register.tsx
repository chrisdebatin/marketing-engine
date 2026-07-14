"use client";

import { useEffect } from "react";

/**
 * Registers the app-shell service worker once, client-side, in production.
 *
 * The dev-mode *teardown* deliberately lives in an inline script in the root
 * layout, not here: a stale SW serves cache-first Turbopack chunks that no
 * longer match the freshly-served HTML, which triggers a hydration mismatch
 * and blanks the page. When that happens the React tree never mounts, so a
 * `useEffect` cleanup would never run and the SW would keep blanking every
 * reload. The inline script runs synchronously, independent of React.
 */
export function ServiceWorkerRegister() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production") return;
    if (typeof window === "undefined" || !("serviceWorker" in navigator)) return;

    const onLoad = () => {
      navigator.serviceWorker.register("/sw.js").catch(() => {
        // registration failures are non-fatal (e.g. dev/no-https)
      });
    };
    window.addEventListener("load", onLoad);
    return () => window.removeEventListener("load", onLoad);
  }, []);

  return null;
}
