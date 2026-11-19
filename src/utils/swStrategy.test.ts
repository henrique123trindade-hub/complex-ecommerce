import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { classifyCacheRequest, SW_CACHE_VERSION } from './swStrategy';

const ORIGIN = 'https://complex-ecommerce.vercel.app';

test('classifyCacheRequest serves critical static scripts, styles, fonts, and icons Cache-First', () => {
  assert.equal(
    classifyCacheRequest({
      url: `${ORIGIN}/assets/vendor-react-CjC6NiCg.js`,
      appOrigin: ORIGIN,
    }),
    'cache-first-immutable'
  );

  assert.equal(
    classifyCacheRequest({
      url: `${ORIGIN}/assets/index-DUDc4H3y.css`,
      appOrigin: ORIGIN,
    }),
    'cache-first-immutable'
  );

  assert.equal(
    classifyCacheRequest({
      url: 'https://fonts.gstatic.com/s/archivo/v19/k3kCo8UDI-1M0wlSfdzyLmv3.woff2',
      appOrigin: ORIGIN,
    }),
    'cache-first-immutable'
  );

  assert.equal(
    classifyCacheRequest({
      url: `${ORIGIN}/favicon-32x32.png`,
      appOrigin: ORIGIN,
    }),
    'cache-first-immutable'
  );
});

test('classifyCacheRequest serves Google Fonts CSS stale-while-revalidate and optimized photos cache-first-media', () => {
  assert.equal(
    classifyCacheRequest({
      url: 'https://fonts.googleapis.com/css2?family=Archivo:wght@500;600;700;800&display=swap',
      appOrigin: ORIGIN,
    }),
    'stale-while-revalidate'
  );

  assert.equal(
    classifyCacheRequest({
      url: `${ORIGIN}/src/assets/images/optimized/complex_campaign_1_5292459e-1200w.avif`,
      appOrigin: ORIGIN,
    }),
    'cache-first-media'
  );
});

test('classifyCacheRequest handles SPA HTML navigations network-first and strictly bypasses API, Firebase, and SW script', () => {
  assert.equal(
    classifyCacheRequest({
      url: `${ORIGIN}/shop?category=hoodies`,
      mode: 'navigate',
      destination: 'document',
      appOrigin: ORIGIN,
    }),
    'network-first-shell'
  );

  for (const bypassReq of [
    { url: `${ORIGIN}/api/health` },
    { url: `${ORIGIN}/api/orders`, method: 'POST' },
    { url: `${ORIGIN}/sw.js` },
    { url: 'https://firestore.googleapis.com/google.firestore.v1.Firestore/Listen/channel' },
    { url: 'https://identitytoolkit.googleapis.com/v1/accounts:lookup' },
    { url: `${ORIGIN}/src/App.tsx` },
    { url: `${ORIGIN}/assets/index.js`, method: 'POST' },
    { url: 'chrome-extension://abcdef/script.js' },
  ]) {
    assert.equal(
      classifyCacheRequest({ ...bypassReq, appOrigin: ORIGIN }),
      'bypass',
      `Expected ${bypassReq.url} (${bypassReq.method || 'GET'}) to bypass SW`
    );
  }
});

test('public/sw.js exists and uses matching SW_CACHE_VERSION', () => {
  const swPath = path.resolve(process.cwd(), 'public/sw.js');
  assert.ok(fs.existsSync(swPath), 'public/sw.js must exist');
  const content = fs.readFileSync(swPath, 'utf8');
  assert.ok(content.includes(SW_CACHE_VERSION), 'public/sw.js version should match swStrategy');
});
