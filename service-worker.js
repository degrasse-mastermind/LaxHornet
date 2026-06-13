const CACHE_NAME = "laxhornet-v13";
const APP_ASSETS = [
  "./",
  "./index.html",
  "./logo-options.html",
  "./styles.css?v=13",
  "./app.js?v=13",
  "./manifest.json?v=13",
  "./assets/icon.svg?v=11",
  "./assets/laxhornet-logo.png",
  "./assets/logo-concept-1-venom-wordmark.svg",
  "./assets/logo-concept-2-hornet-shield.svg",
  "./assets/logo-concept-3-stinger-slash.svg",
  "./assets/logo-concept-4-speed-stinger.svg",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_ASSETS)),
  );
  self.skipWaiting();
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

  event.respondWith(
    caches.match(event.request).then((cached) => {
      if (cached) return cached;

      return fetch(event.request)
        .then((response) => {
          const copy = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
          return response;
        })
        .catch(() => caches.match("./index.html"));
    }),
  );
});
