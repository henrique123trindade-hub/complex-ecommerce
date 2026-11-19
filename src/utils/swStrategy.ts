export const SW_CACHE_VERSION = 'v1';

export const SW_CACHE_NAMES = {
  immutable: `complex-immutable-${SW_CACHE_VERSION}`,
  fontsCss: `complex-fonts-css-${SW_CACHE_VERSION}`,
  media: `complex-media-${SW_CACHE_VERSION}`,
  shell: `complex-shell-${SW_CACHE_VERSION}`,
} as const;

export const MAX_MEDIA_CACHE_ENTRIES = 80;

export type CacheStrategy =
  | 'bypass'
  | 'cache-first-immutable'
  | 'cache-first-media'
  | 'stale-while-revalidate'
  | 'network-first-shell';

export interface ClassifyRequestInput {
  url: string;
  method?: string;
  mode?: string;
  destination?: string;
  appOrigin: string;
}

const BYPASS_HOST_PATTERNS = [
  'firestore.googleapis.com',
  'identitytoolkit.googleapis.com',
  'securetoken.googleapis.com',
  'firebaseinstallations.googleapis.com',
  'firebasestorage.googleapis.com',
  'www.googleapis.com',
  'accounts.google.com',
];

const IMMUTABLE_ASSET_EXT_RE = /\.(?:js|mjs|css|woff2?|ttf|otf|avif|webp|png|ico|svg)$/i;
const MEDIA_OPTIMIZED_RE = /^\/src\/assets\/images\/optimized\/.+\.(?:avif|webp|png|jpe?g)$/i;
const BRAND_ICON_RE = /^\/(?:favicon(?:-32x32|-192x192)?\.(?:ico|png|svg)|apple-touch-icon\.png)$/i;

export function classifyCacheRequest({
  url,
  method = 'GET',
  mode = '',
  destination = '',
  appOrigin,
}: ClassifyRequestInput): CacheStrategy {
  if (method.toUpperCase() !== 'GET') {
    return 'bypass';
  }

  let parsed: URL;
  try {
    parsed = new URL(url, appOrigin);
  } catch {
    return 'bypass';
  }

  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    return 'bypass';
  }

  // Google Fonts font binaries (.woff2) — Cache-First immutable
  if (parsed.hostname === 'fonts.gstatic.com') {
    return 'cache-first-immutable';
  }

  // Google Fonts CSS stylesheets — Stale-While-Revalidate (instant paint + background refresh)
  if (parsed.hostname === 'fonts.googleapis.com') {
    return 'stale-while-revalidate';
  }

  // Never intercept third-party APIs, Firebase channels, Auth, or external hosts
  if (
    parsed.origin !== appOrigin ||
    BYPASS_HOST_PATTERNS.some((host) => parsed.hostname === host || parsed.hostname.endsWith(`.${host}`))
  ) {
    return 'bypass';
  }

  const { pathname, search } = parsed;

  // Never intercept service worker script itself, API calls, or Vite dev-mode modules
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

  // Hashed Vite production assets (/assets/*.js, *.css, preload *.avif/*.webp) — Cache-First
  if (pathname.startsWith('/assets/') && IMMUTABLE_ASSET_EXT_RE.test(pathname)) {
    return 'cache-first-immutable';
  }

  // Brand icons and favicons — Cache-First
  if (BRAND_ICON_RE.test(pathname)) {
    return 'cache-first-immutable';
  }

  // Optimized product/editorial photography — Cache-First with LRU cap
  if (MEDIA_OPTIMIZED_RE.test(pathname)) {
    return 'cache-first-media';
  }

  // App shell HTML navigations — Network-First with cached shell fallback
  if (mode === 'navigate' || destination === 'document') {
    return 'network-first-shell';
  }

  return 'bypass';
}
