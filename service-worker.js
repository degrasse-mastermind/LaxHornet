const CACHE_NAME = "laxhornet-v276";
const APP_ASSETS = [
  "./",
  "./index.html",
  "./program-value.html",
  "./player-development.html",
  "./tracking-framework.html",
  "./parent-experience.html",
  "./coach-alignment.html",
  "./rollout-guide.html",
  "./access-and-trust.html",
  "./app.html",
  "./privacy.html",
  "./terms.html",
  "./logo-options.html",
  "./team-statkeeper-mockup.html",
  "./launch-kit/laxhornet-overview.html",
  "./launch-kit/parent-handout.html",
  "./launch-kit/parent-email.html",
  "./launch-kit/admin-launch-checklist.html",
  "./launch-kit/laxhornet-qr.png",
  "./landing.css?v=275",
  "./styles.css?v=275",
  "./assets/supabase.min.js?v=253",
  "./app.js?v=275",
  "./manifest.json?v=275",
  "./assets/icon.svg?v=11",
  "./assets/LHicon.png?v=1",
  "./assets/LHbanner.png?v=3",
  "./assets/honeycombblack.png?v=1",
  "./assets/laxhornet-logo.png",
  "./assets/club-review-start.png",
  "./assets/club-review-insight.png",
  "./assets/club-family-recap.png",
  "./assets/logo-concept-1-venom-wordmark.svg",
  "./assets/logo-concept-2-hornet-shield.svg",
  "./assets/logo-concept-3-stinger-slash.svg",
  "./assets/logo-concept-4-speed-stinger.svg",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) =>
      cache.addAll(APP_ASSETS.map((asset) => new Request(asset, { cache: "reload" }))),
    ),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))),
      ),
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;

  const requestUrl = new URL(event.request.url);
  if (requestUrl.pathname.endsWith("/version.json")) {
    event.respondWith(
      fetch(event.request, { cache: "no-store" }).catch(() => caches.match(event.request)),
    );
    return;
  }

  if (event.request.mode === "navigate") {
    event.respondWith(
      fetch(event.request, { cache: "reload" })
        .then((response) => {
          const copy = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
          return response;
        })
        .catch(() => {
          const fallback = requestUrl.pathname.endsWith("/app.html") || requestUrl.searchParams.has("share")
            ? "./app.html"
            : "./index.html";
          return caches.match(event.request).then((cached) => cached || caches.match(fallback));
        }),
    );
    return;
  }

  event.respondWith(
    caches.match(event.request).then((cached) => {
      if (cached) return cached;

      return fetch(event.request, { cache: "reload" })
        .then((response) => {
          const copy = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
          return response;
        })
        .catch(() => caches.match("./app.html"));
    }),
  );
});

self.addEventListener("message", (event) => {
  if (event.data?.type === "SKIP_WAITING") {
    self.skipWaiting();
  }
});
