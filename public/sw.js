/* eslint-disable no-restricted-globals */
// COMPLEX Lightweight Cache-First Service Worker for critical static assets
const CACHE_VERSION = 'v1';
const CACHE_PREFIX = 'complex-';

const CACHES = {
  immutable: `${CACHE_PREFIX}immutable-${CACHE_VERSION}`,
  fontsCss: `${CACHE_PREFIX}fonts-css-${CACHE_VERSION}`,
  media: `${CACHE_PREFIX}media-${CACHE_VERSION}`,
  shell: `${CACHE_PREFIX}shell-${CACHE_VERSION}`,
};

const MAX_MEDIA_ENTRIES = 80;

const PRECACHE_SHELL_URLS = [
  '/',
  '/favicon.svg',
  '/favicon-32x32.png',
];

const BYPASS_HOSTS = [
  'firestore.googleapis.com',
  'identitytoolkit.googleapis.com',
  'securetoken.googleapis.com',
  'firebaseinstallations.googleapis.com',
  'firebasestorage.googleapis.com',
  'www.googleapis.com',
  'accounts.google.com',
];

const IMMUTABLE_EXT_RE = /\.(?:js|mjs|css|woff2?|ttf|otf|avif|webp|png|ico|svg)$/i;
const MEDIA_OPTIMIZED_RE = /^\/src\/assets\/images\/optimized\/.+\.(?:avif|webp|png|jpe?g)$/i;
const BRAND_ICON_RE = /^\/(?:favicon(?:-32x32|-192x192)?\.(?:ico|png|svg)|apple-touch-icon\.png)$/i;

function classifyRequest(request) {
  if (request.method !== 'GET') return 'bypass';

  let parsed;
  try {
    parsed = new URL(request.url);
  } catch {
    return 'bypass';
  }

  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    return 'bypass';
  }

  if (parsed.hostname === 'fonts.gstatic.com') {
    return 'cache-first-immutable';
  }

  if (parsed.hostname === 'fonts.googleapis.com') {
    return 'stale-while-revalidate';
  }

  if (
    parsed.origin !== self.location.origin ||
    BYPASS_HOSTS.some((h) => parsed.hostname === h || parsed.hostname.endsWith(`.${h}`))
  ) {
    return 'bypass';
  }

  const { pathname, search } = parsed;

  if (
    pathname === '/sw.js' ||
    pathname.startsWith('/api/') ||
    pathname.startsWith('/@vite') ||
    pathname.startsWith('/@react-refresh') ||
    pathname.startsWith('/node_modules/') ||
    /\.(?:tsx|ts|jsx|map)$/i.test(pathname) ||
    (pathname.startsWith('/src/') && /\.(?:mjs|js)$/i.test(pathname)) ||
    /[?&](?:v|t)=/.test(search)
  ) {
    return 'bypass';
  }

  if (pathname.startsWith('/assets/') && IMMUTABLE_EXT_RE.test(pathname)) {
    return 'cache-first-immutable';
  }

  if (BRAND_ICON_RE.test(pathname)) {
    return 'cache-first-immutable';
  }

  if (MEDIA_OPTIMIZED_RE.test(pathname)) {
    return 'cache-first-media';
  }

  if (request.mode === 'navigate' || request.destination === 'document') {
    return 'network-first-shell';
  }

  return 'bypass';
}

function isCacheableResponse(response) {
  if (!response) return false;
  // Allow standard 200 OK or opaque cross-origin responses (e.g. fonts CDN)
  return response.ok || response.type === 'opaque';
}

async function trimCacheIfNeeded(cacheName, maxEntries) {
  const cache = await caches.open(cacheName);
  const keys = await cache.keys();
  if (keys.length <= maxEntries) return;
  const excess = keys.length - maxEntries;
  await Promise.all(keys.slice(0, excess).map((req) => cache.delete(req)));
}

async function cacheFirst(request, cacheName, maxEntries) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);
  if (cached) return cached;

  const networkResponse = await fetch(request);
  if (isCacheableResponse(networkResponse)) {
    const clone = networkResponse.clone();
    await cache.put(request, clone);
    if (typeof maxEntries === 'number') {
      void trimCacheIfNeeded(cacheName, maxEntries);
    }
  }
  return networkResponse;
}

async function staleWhileRevalidate(request, cacheName) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);

  const networkUpdate = fetch(request)
    .then(async (response) => {
      if (isCacheableResponse(response)) {
        await cache.put(request, response.clone());
      }
      return response;
    })
    .catch(() => cached);

  return cached || networkUpdate;
}

async function networkFirstShell(request) {
  const cache = await caches.open(CACHES.shell);
  try {
    const response = await fetch(request);
    if (response && response.ok) {
      await cache.put('/', response.clone());
    }
    return response;
  } catch {
    const fallback = (await cache.match('/')) || (await cache.match('/index.html'));
    if (fallback) return fallback;
    return Response.error();
  }
}

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHES.shell)
      .then((cache) => cache.addAll(PRECACHE_SHELL_URLS).catch(() => undefined))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  const validNames = new Set(Object.values(CACHES));
  event.waitUntil(
    caches
      .keys()
      .then((names) =>
        Promise.all(
          names
            .filter((name) => name.startsWith(CACHE_PREFIX) && !validNames.has(name))
            .map((name) => caches.delete(name))
        )
      )
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const strategy = classifyRequest(event.request);
  if (strategy === 'bypass') return;

  if (strategy === 'cache-first-immutable') {
    event.respondWith(cacheFirst(event.request, CACHES.immutable));
    return;
  }

  if (strategy === 'cache-first-media') {
    event.respondWith(cacheFirst(event.request, CACHES.media, MAX_MEDIA_ENTRIES));
    return;
  }

  if (strategy === 'stale-while-revalidate') {
    event.respondWith(staleWhileRevalidate(event.request, CACHES.fontsCss));
    return;
  }

  if (strategy === 'network-first-shell') {
    event.respondWith(networkFirstShell(event.request));
  }
});

self.addEventListener('message', (event) => {
  const data = event.data;
  if (!data || data.type !== 'WARM_CRITICAL_ASSETS' || !Array.isArray(data.urls)) {
    return;
  }

  const warm = async () => {
    const urls = data.urls.slice(0, 30);
    await Promise.all(
      urls.map(async (rawUrl) => {
        if (typeof rawUrl !== 'string') return;
        const strategy = classifyRequest(new Request(rawUrl, { method: 'GET' }));
        if (strategy !== 'cache-first-immutable' && strategy !== 'stale-while-revalidate') {
          return;
        }
        const targetCacheName =
          strategy === 'stale-while-revalidate' ? CACHES.fontsCss : CACHES.immutable;
        const cache = await caches.open(targetCacheName);
        const already = await cache.match(rawUrl);
        if (already) return;
        try {
          const res = await fetch(rawUrl);
          if (isCacheableResponse(res)) {
            await cache.put(rawUrl, res.clone());
          }
        } catch {
          // Ignore best-effort warm failures
        }
      })
    );
  };

  event.waitUntil(warm());
});
