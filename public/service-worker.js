const CACHE_VERSION = "2026-06-16.16";
const CACHE_PREFIX = "pocket-ledger";
const RUNTIME_CACHE = `${CACHE_PREFIX}-runtime-${CACHE_VERSION}`;
const STATIC_CACHE = `${CACHE_PREFIX}-static-${CACHE_VERSION}`;
const STATIC_ASSETS = ["./", "./index.html", "./manifest.webmanifest", "./icon.svg"];
const IS_DEVELOPMENT_HOST = ["localhost", "127.0.0.1", "::1"].includes(self.location.hostname);

self.addEventListener("install", (event) => {
  if (IS_DEVELOPMENT_HOST) {
    self.skipWaiting();
    return;
  }

  event.waitUntil(
    caches.open(STATIC_CACHE).then((cache) => {
      return cache.addAll(STATIC_ASSETS.map((url) => new Request(url, { cache: "reload" })));
    }),
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  if (IS_DEVELOPMENT_HOST) {
    event.waitUntil(clearPocketLedgerCaches().then(() => self.registration.unregister()).then(() => self.clients.claim()));
    return;
  }

  event.waitUntil(
    clearPocketLedgerCaches([STATIC_CACHE, RUNTIME_CACHE]).then(() => self.clients.claim()),
  );
});

self.addEventListener("message", (event) => {
  if (event.data?.type === "SKIP_WAITING") self.skipWaiting();
});

self.addEventListener("fetch", (event) => {
  if (IS_DEVELOPMENT_HOST) return;

  const { request } = event;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  if (isFreshRequest(request, url)) {
    event.respondWith(networkFirst(request));
    return;
  }

  event.respondWith(cacheFirstWithRefresh(request));
});

function isFreshRequest(request, url) {
  return (
    request.mode === "navigate" ||
    request.destination === "document" ||
    request.destination === "script" ||
    request.destination === "style" ||
    url.pathname.endsWith("/index.html") ||
    url.pathname.endsWith("/app.js") ||
    url.pathname.endsWith("/styles.css")
  );
}

async function clearPocketLedgerCaches(keep = []) {
  const keys = await caches.keys();
  return Promise.all(
    keys
      .filter((key) => key.startsWith(CACHE_PREFIX) && !keep.includes(key))
      .map((key) => caches.delete(key)),
  );
}

async function networkFirst(request) {
  const cache = await caches.open(RUNTIME_CACHE);
  try {
    const fresh = await fetch(new Request(request, { cache: "no-store" }));
    if (fresh.ok) await cache.put(request, fresh.clone());
    return fresh;
  } catch {
    const cached = await cache.match(request);
    if (cached) return cached;
    if (request.mode === "navigate") {
      const fallback = await cache.match("./index.html") || await cache.match("./");
      if (fallback) return fallback;
    }
    throw new Error("Pocket Ledger is offline and this asset is not cached yet.");
  }
}

async function cacheFirstWithRefresh(request) {
  const cached = await caches.match(request);
  const refresh = fetch(request)
    .then(async (response) => {
      if (response.ok) {
        const cache = await caches.open(RUNTIME_CACHE);
        await cache.put(request, response.clone());
      }
      return response;
    })
    .catch(() => null);

  return cached || refresh || Response.error();
}
