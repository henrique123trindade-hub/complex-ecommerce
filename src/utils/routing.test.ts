import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {
  normalizePathname,
  parseNavigationTarget,
  resolveStorefrontRoute,
} from './routing';

test('normalizePathname strips trailing slashes and duplicate slashes cleanly', () => {
  assert.equal(normalizePathname(''), '/');
  assert.equal(normalizePathname('/'), '/');
  assert.equal(normalizePathname('/index.html'), '/');
  assert.equal(normalizePathname('/account/'), '/account');
  assert.equal(normalizePathname('//account//'), '/account');
  assert.equal(normalizePathname('account'), '/account');
  assert.equal(normalizePathname('/product/washed-essential-hoodie/'), '/product/washed-essential-hoodie');
});

test('parseNavigationTarget preserves query strings and hashes with normalized pathname', () => {
  assert.deepEqual(parseNavigationTarget('/shop/?category=hoodies#editorial'), {
    fullUrl: '/shop?category=hoodies#editorial',
    locationUrl: '/shop?category=hoodies',
    pathname: '/shop',
    queryString: 'category=hoodies',
    hash: 'editorial',
  });

  assert.deepEqual(parseNavigationTarget('/account/'), {
    fullUrl: '/account',
    locationUrl: '/account',
    pathname: '/account',
    queryString: '',
    hash: '',
  });
});

test('resolveStorefrontRoute handles all storefront paths including trailing slashes', () => {
  assert.deepEqual(resolveStorefrontRoute('/account'), { page: 'account', pathname: '/account' });
  assert.deepEqual(resolveStorefrontRoute('/account/'), { page: 'account', pathname: '/account' });
  assert.deepEqual(resolveStorefrontRoute('/shop/'), { page: 'shop', pathname: '/shop' });
  assert.deepEqual(resolveStorefrontRoute('/collections'), { page: 'collections', pathname: '/collections' });
  assert.deepEqual(resolveStorefrontRoute('/about'), { page: 'about', pathname: '/about' });
  assert.deepEqual(resolveStorefrontRoute('/bag'), { page: 'bag', pathname: '/bag' });
  assert.deepEqual(resolveStorefrontRoute('/checkout'), { page: 'checkout', pathname: '/checkout' });
  assert.deepEqual(resolveStorefrontRoute('/admin'), { page: 'admin', pathname: '/admin' });
  assert.deepEqual(resolveStorefrontRoute('/product/washed-essential-hoodie/'), {
    page: 'product',
    pathname: '/product/washed-essential-hoodie',
    slug: 'washed-essential-hoodie',
  });
  assert.deepEqual(resolveStorefrontRoute('/product/'), { page: 'shop', pathname: '/shop' });
  assert.deepEqual(resolveStorefrontRoute('/rota-inexistente'), { page: 'home', pathname: '/rota-inexistente' });
});

test('vercel.json provides SPA rewrite to /index.html while sparing API and static assets', () => {
  const vercelPath = path.resolve(process.cwd(), 'vercel.json');
  assert.ok(fs.existsSync(vercelPath), 'vercel.json must exist at project root');

  const config = JSON.parse(fs.readFileSync(vercelPath, 'utf8')) as {
    rewrites?: Array<{ source: string; destination: string }>;
  };

  assert.ok(Array.isArray(config.rewrites) && config.rewrites.length > 0, 'vercel.json rewrites missing');
  const spaRule = config.rewrites[0];
  assert.equal(spaRule.destination, '/index.html');

  // Compile Vercel regex pattern (^ + pattern + $) to verify route matching
  const matcher = new RegExp(`^${spaRule.source}$`);

  // Client-side routes must rewrite to /index.html
  for (const spaPath of [
    '/',
    '/account',
    '/account/',
    '/shop',
    '/collections',
    '/about',
    '/product/washed-essential-hoodie',
    '/bag',
    '/checkout',
    '/admin',
  ]) {
    assert.ok(matcher.test(spaPath), `Expected SPA path ${spaPath} to match Vercel rewrite`);
  }

  // Static asset prefixes and API routes must NOT be swallowed by SPA rewrite
  for (const excludedPath of [
    '/api/health',
    '/api/orders',
    '/assets/index-abc123.js',
    '/src/assets/images/optimized/complex_campaign_1_5292459e-1200w.avif',
    '/favicon.ico',
    '/favicon.svg',
    '/apple-touch-icon.png',
  ]) {
    assert.ok(!matcher.test(excludedPath), `Expected asset/API path ${excludedPath} to bypass SPA rewrite`);
  }
});
