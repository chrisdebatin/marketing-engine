// Marketing-Engine service worker – app-shell caching for offline load.
// Data writes are handled offline by the IndexedDB sync queue, not here.

const CACHE = "marketing-engine-v2";
const APP_SHELL = ["/", "/offline", "/manifest.webmanifest"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE).then((cache) => cache.addAll(APP_SHELL)).catch(() => {}),
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))),
      ),
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  // Never cache API/auth calls – always hit the network.
  if (url.pathname.startsWith("/api") || url.pathname.startsWith("/auth")) return;

  // Navigations: network-first, fall back to cache, then /offline.
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(request, copy)).catch(() => {});
          return res;
        })
        .catch(async () => {
          return (
            (await caches.match(request)) ||
            (await caches.match("/offline")) ||
            (await caches.match("/")) ||
            Response.error()
          );
        }),
    );
    return;
  }

  // Static assets: cache-first.
  if (
    url.origin === self.location.origin &&
    (url.pathname.startsWith("/_next/static") ||
      url.pathname.startsWith("/icons") ||
      request.destination === "style" ||
      request.destination === "script" ||
      request.destination === "font")
  ) {
    event.respondWith(
      caches.match(request).then(
        (cached) =>
          cached ||
          fetch(request).then((res) => {
            const copy = res.clone();
            caches.open(CACHE).then((c) => c.put(request, copy)).catch(() => {});
            return res;
          }),
      ),
    );
  }
});
