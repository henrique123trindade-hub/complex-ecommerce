export type StorefrontRoute =
  | { page: 'home'; pathname: string }
  | { page: 'shop'; pathname: string }
  | { page: 'collections'; pathname: string }
  | { page: 'about'; pathname: string }
  | { page: 'product'; pathname: string; slug: string }
  | { page: 'bag'; pathname: string }
  | { page: 'checkout'; pathname: string }
  | { page: 'account'; pathname: string }
  | { page: 'admin'; pathname: string };

export interface ParsedNavigationTarget {
  fullUrl: string;
  locationUrl: string;
  pathname: string;
  queryString: string;
  hash: string;
}

/**
 * Normalizes a URL pathname so trailing slashes (`/account/`), duplicate slashes
 * (`//account`), or static entry aliases (`/index.html`) map cleanly to canonical routes.
 */
export function normalizePathname(rawPathname: string): string {
  const trimmed = (rawPathname || '').trim();
  if (!trimmed || trimmed === '/') return '/';

  const withLeadingSlash = trimmed.startsWith('/') ? trimmed : `/${trimmed}`;
  const collapsed = withLeadingSlash.replace(/\/{2,}/g, '/');
  const withoutTrailing = collapsed.length > 1 ? collapsed.replace(/\/+$/, '') : collapsed;

  if (withoutTrailing === '' || withoutTrailing === '/index.html') {
    return '/';
  }

  return withoutTrailing;
}

/**
 * Parses an in-app navigation path into normalized URL pieces without losing query strings or hashes.
 */
export function parseNavigationTarget(targetPath: string): ParsedNavigationTarget {
  const trimmed = (targetPath || '/').trim();
  const [beforeHash, hashPart = ''] = trimmed.split('#');
  const [rawPath = '/', queryString = ''] = beforeHash.split('?');

  const pathname = normalizePathname(rawPath);
  const locationUrl = queryString ? `${pathname}?${queryString}` : pathname;
  const fullUrl = hashPart ? `${locationUrl}#${hashPart}` : locationUrl;

  return {
    fullUrl,
    locationUrl,
    pathname,
    queryString,
    hash: hashPart,
  };
}

/**
 * Resolves a normalized pathname to a typed storefront page descriptor.
 */
export function resolveStorefrontRoute(rawPathname: string): StorefrontRoute {
  const pathname = normalizePathname(rawPathname);

  if (pathname === '/') return { page: 'home', pathname };
  if (pathname === '/shop') return { page: 'shop', pathname };
  if (pathname === '/collections') return { page: 'collections', pathname };
  if (pathname === '/about') return { page: 'about', pathname };
  if (pathname === '/bag') return { page: 'bag', pathname };
  if (pathname === '/checkout') return { page: 'checkout', pathname };
  if (pathname === '/account') return { page: 'account', pathname };
  if (pathname === '/admin') return { page: 'admin', pathname };
  if (pathname === '/product') return { page: 'shop', pathname: '/shop' };

  if (pathname.startsWith('/product/')) {
    const rawSlug = pathname.slice('/product/'.length).split('/')[0] || '';
    if (rawSlug) {
      let decodedSlug = rawSlug;
      try {
        decodedSlug = decodeURIComponent(rawSlug);
      } catch {
        decodedSlug = rawSlug;
      }
      return { page: 'product', pathname, slug: decodedSlug };
    }
    return { page: 'shop', pathname: '/shop' };
  }

  return { page: 'home', pathname };
}

/**
 * Determines whether a top-bar navigation target matches the current pathname + queryString,
 * distinguishing `/shop?sort=newest` (Lançamentos) from `/shop` (Loja).
 */
export function isNavLinkActive(
  currentPathname: string,
  currentQueryString: string,
  targetPath: string
): boolean {
  const normalizedCurrent = normalizePathname(currentPathname);
  const parsedTarget = parseNavigationTarget(targetPath);

  if (parsedTarget.pathname === '/shop') {
    if (normalizedCurrent !== '/shop') return false;
    const currentParams = new URLSearchParams(currentQueryString);
    const targetParams = new URLSearchParams(parsedTarget.queryString);
    if (targetParams.get('sort') === 'newest') {
      return currentParams.get('sort') === 'newest' && !currentParams.get('category');
    }
    return currentParams.get('sort') !== 'newest' || Boolean(currentParams.get('category'));
  }

  return (
    normalizedCurrent === parsedTarget.pathname ||
    normalizedCurrent.startsWith(`${parsedTarget.pathname}/`)
  );
}

