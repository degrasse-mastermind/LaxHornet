const CACHE_NAME = "laxhornet-v288";
const RUNTIME_CONFIG_ASSET = "./runtime-config.js?v=288";
const PUBLIC_PATH_ALLOWLIST = new Set([
  "/",
  "/CNAME",
  "/LaxHornet-launch-kit.zip",
  "/access-and-trust.html",
  "/app.html",
  "/app.js",
  "/assets/LHbanner.png",
  "/assets/LHicon.png",
  "/assets/club-family-recap.png",
  "/assets/club-review-insight.png",
  "/assets/club-review-start.png",
  "/assets/honeycombblack.png",
  "/assets/supabase.min.js",
  "/coach-alignment.html",
  "/event-operation-service.js",
  "/index.html",
  "/landing.css",
  "/launch-kit/LaxHornet-admin-launch-checklist.pdf",
  "/launch-kit/LaxHornet-overview.pdf",
  "/launch-kit/LaxHornet-parent-handout.pdf",
  "/launch-kit/LaxHornet-promo-demo-thumbnail.png",
  "/launch-kit/LaxHornet-promo-demo.mp4",
  "/launch-kit/admin-launch-checklist.html",
  "/launch-kit/invite-message.txt",
  "/launch-kit/launch-kit-readme.md",
  "/launch-kit/laxhornet-overview.html",
  "/launch-kit/laxhornet-qr.png",
  "/launch-kit/parent-email.eml",
  "/launch-kit/parent-email.html",
  "/launch-kit/parent-handout.html",
  "/launch-kit/short-text-message.txt",
  "/launch-kit/social-captions.txt",
  "/launch-kit/team-chat-posts.txt",
  "/manifest.json",
  "/next-focus-recommendation.js",
  "/parent-experience.html",
  "/player-development.html",
  "/privacy.html",
  "/program-value.html",
  "/public-event-semantics.js",
  "/rollout-guide.html",
  "/runtime-config.js",
  "/service-worker.js",
  "/styles.css",
  "/terms.html",
  "/tracked-playing-time-service.js",
  "/tracking-framework.html",
  "/version.json",
]);
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
  "./launch-kit/laxhornet-overview.html",
  "./launch-kit/parent-handout.html",
  "./launch-kit/parent-email.html",
  "./launch-kit/admin-launch-checklist.html",
  "./launch-kit/laxhornet-qr.png",
  "./landing.css?v=288",
  "./styles.css?v=288",
  "./assets/supabase.min.js?v=253",
  RUNTIME_CONFIG_ASSET,
  "./event-operation-service.js?v=288",
  "./next-focus-recommendation.js?v=288",
  "./tracked-playing-time-service.js?v=288",
  "./public-event-semantics.js?v=288",
  "./app.js?v=288",
  "./manifest.json?v=288",
  "./assets/LHicon.png?v=1",
  "./assets/LHbanner.png?v=3",
  "./assets/honeycombblack.png?v=1",
  "./assets/club-review-start.png",
  "./assets/club-review-insight.png",
  "./assets/club-family-recap.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      const replacingSameReleaseWorker = await caches.has(CACHE_NAME);
      const cache = await caches.open(CACHE_NAME);
      await cache.addAll(APP_ASSETS.map((asset) => new Request(asset, { cache: "reload" })));
      if (replacingSameReleaseWorker) await self.skipWaiting();
    })(),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      await Promise.all([
        caches
          .keys()
          .then((keys) =>
            Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))),
          ),
        caches.open(CACHE_NAME).then(async (cache) => {
          const requests = await cache.keys();
          await Promise.all(
            requests
              .filter((request) => {
                const requestUrl = new URL(request.url);
                return requestUrl.origin === self.location.origin
                  && !PUBLIC_PATH_ALLOWLIST.has(requestUrl.pathname);
              })
              .map((request) => cache.delete(request)),
          );
        }),
      ]);
      await self.clients.claim();
    })(),
  );
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;

  const requestUrl = new URL(event.request.url);
  if (requestUrl.protocol !== "http:" && requestUrl.protocol !== "https:") return;
  const isAllowedPublicPath = requestUrl.origin === self.location.origin
    && PUBLIC_PATH_ALLOWLIST.has(requestUrl.pathname);

  if (requestUrl.origin === self.location.origin && !isAllowedPublicPath) {
    event.respondWith(fetch(event.request, { cache: "no-store" }));
    return;
  }

  if (requestUrl.pathname.endsWith("/runtime-config.js")) {
    event.respondWith(
      fetch(event.request, { cache: "no-store" })
        .then((response) => {
          if (!response.ok) throw new Error("Runtime configuration unavailable");
          const copy = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(RUNTIME_CONFIG_ASSET, copy));
          return response;
        })
        .catch(() =>
          caches.match(RUNTIME_CONFIG_ASSET).then(
            (cached) =>
              cached ||
              new Response(
                "window.LAXHORNET_RUNTIME_CONFIG=Object.freeze({...(window.LAXHORNET_RUNTIME_CONFIG||{}),publicLiveShareRpc:true,liveShareTokenRpc:true,exportAuditRpc:true,minimumSchemaCapability:1});",
                { headers: { "Content-Type": "application/javascript; charset=utf-8" } },
              ),
          ),
        ),
    );
    return;
  }

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
          if (response.ok && isAllowedPublicPath) {
            const copy = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
          }
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
