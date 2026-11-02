// Service worker Traveler Handal (F10) — ditulis tangan, tanpa Serwist.
// - /_next/static/** : cache-first (nama file ber-hash, aman disimpan lama).
// - Navigasi halaman : network-first; offline → halaman yang pernah dibuka, lalu /offline.html.
// - /api/**, Supabase, tile peta & semua request lintas origin: TIDAK disentuh (selalu jaringan).
const VERSION = "v1";
const STATIC_CACHE = `th-static-${VERSION}`;
const PAGE_CACHE = `th-pages-${VERSION}`;
const OFFLINE_URL = "/offline.html";
const MAX_STATIC = 300;
const MAX_PAGES = 15;

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(PAGE_CACHE)
      .then((c) => c.add(OFFLINE_URL))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys.filter((k) => k !== STATIC_CACHE && k !== PAGE_CACHE).map((k) => caches.delete(k)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

// Hapus entri tertua (urutan keys() = urutan penyisipan) bila melebihi batas.
async function trim(cacheName, max) {
  const cache = await caches.open(cacheName);
  const keys = await cache.keys();
  await Promise.all(keys.slice(0, Math.max(0, keys.length - max)).map((k) => cache.delete(k)));
}

function cacheable(res) {
  return res && res.ok && res.type === "basic" && !res.redirected;
}

async function cacheFirst(request) {
  const hit = await caches.match(request);
  if (hit) return hit;
  const res = await fetch(request);
  if (cacheable(res)) {
    const cache = await caches.open(STATIC_CACHE);
    await cache.put(request, res.clone());
    trim(STATIC_CACHE, MAX_STATIC);
  }
  return res;
}

async function networkFirstPage(request) {
  try {
    const res = await fetch(request);
    if (cacheable(res)) {
      const cache = await caches.open(PAGE_CACHE);
      await cache.put(request, res.clone());
      trim(PAGE_CACHE, MAX_PAGES);
    }
    return res;
  } catch {
    return (
      (await caches.match(request, { ignoreSearch: true })) ||
      (await caches.match(OFFLINE_URL)) ||
      Response.error()
    );
  }
}

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return; // Supabase, tile, Turnstile, dll.
  if (url.pathname.startsWith("/api/")) return;

  if (url.pathname.startsWith("/_next/static/")) {
    event.respondWith(cacheFirst(request));
  } else if (request.mode === "navigate") {
    event.respondWith(networkFirstPage(request));
  }
});

