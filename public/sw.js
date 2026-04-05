self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open("household-spend-tracker-v1").then((cache) => {
      return cache.addAll([
        "/manifest.webmanifest",
        "/icons/icon-192.svg",
        "/icons/icon-512.svg",
      ]);
    }),
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") {
    return;
  }

  const url = new URL(event.request.url);

  if (event.request.mode === "navigate") {
    return;
  }

  if (url.origin !== self.location.origin) {
    return;
  }

  const isStaticAsset =
    url.pathname.startsWith("/icons/") ||
    url.pathname.startsWith("/_next/static/") ||
    url.pathname === "/manifest.webmanifest";

  if (!isStaticAsset) {
    return;
  }

  event.respondWith(
    caches.match(event.request).then((cached) => {
      if (cached) {
        return cached;
      }

      return fetch(event.request)
        .then((response) => {
          if (!response.ok || response.type === "opaqueredirect" || response.redirected) {
            return response;
          }

          const cloned = response.clone();
          caches.open("household-spend-tracker-v1").then((cache) => cache.put(event.request, cloned));
          return response;
        });
    }),
  );
});
