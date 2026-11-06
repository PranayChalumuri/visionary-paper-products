const CACHE="visionary-paper-v10-utf8-inr-order-fix";
const ASSETS=["./","./index.html","./css/styles.css","./js/app.js","./assets/visionary-logo.svg","./manifest.webmanifest"];

self.addEventListener("install", event => {
  event.waitUntil(
    caches.open(CACHE).then(cache => cache.addAll(ASSETS))
  );
  self.skipWaiting();
});

self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys
          .filter(key => key !== CACHE)
          .map(key => caches.delete(key))
      ))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", event => {
  if (event.request.method !== "GET") return;

  const url = new URL(event.request.url);

  // NEVER cache backend/API GET requests.
  // Order history and other customer data must always come from FastAPI/PostgreSQL.
  if (url.port === "8000" || url.pathname.startsWith("/orders/") ||
      url.pathname.startsWith("/products/") || url.pathname.startsWith("/customers/") ||
      url.pathname.startsWith("/admin/") || url.pathname.startsWith("/custom-orders/") || url.pathname.startsWith("/auth/")) {
    event.respondWith(fetch(event.request));
    return;
  }

  // Cache only the website's static GET assets.
  event.respondWith(
    caches.match(event.request).then(cached => {
      if (cached) return cached;

      return fetch(event.request).then(response => {
        if (!response || !response.ok) return response;
        const copy = response.clone();
        caches.open(CACHE).then(cache => cache.put(event.request, copy));
        return response;
      }).catch(() => cached);
    })
  );
});
