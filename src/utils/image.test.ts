import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildSrcSet,
  getImageVariant,
  normalizeImageKey,
  resolveResponsiveSizes,
  shouldBypassProgressiveBlur,
} from './image';

test('normalizeImageKey strips query strings and normalizes relative/origin URLs', () => {
  assert.equal(
    normalizeImageKey('/src/assets/images/product_hoodie_taupe_1794952251370.jpg?v=1'),
    '/src/assets/images/product_hoodie_taupe_1794952251370.jpg'
  );
  assert.equal(
    normalizeImageKey('http://localhost:3000/assets/aistudio/image_e60999db.png'),
    '/assets/aistudio/image_e60999db.png'
  );
  assert.equal(normalizeImageKey(undefined), '');
});

test('getImageVariant resolves local assets to WebP manifest entries with LQIP blurDataUrl', () => {
  const hero = getImageVariant('/assets/aistudio/image_e60999db.png');
  assert.ok(hero);
  assert.equal(hero.width, 1672);
  assert.equal(hero.height, 941);
  assert.ok(hero.webpSrc.endsWith('.webp'));
  assert.ok(hero.blurDataUrl.startsWith('data:image/webp;base64,'));
  assert.ok(hero.variants.length >= 3);

  const product = getImageVariant('/src/assets/images/product_hoodie_taupe_1794952251370.jpg');
  assert.ok(product);
  assert.equal(product.fallbackSrc, '/src/assets/images/product_hoodie_taupe_1794952251370.jpg');
  assert.ok(product.variants.some((v) => v.width === 480));
  assert.ok(product.variants.some((v) => v.width === 768));

  assert.equal(getImageVariant('https://example.com/custom.jpg'), null);
});

test('buildSrcSet orders variants ascending by width', () => {
  const srcSet = buildSrcSet([
    { width: 896, url: '/img-896w.webp' },
    { width: 480, url: '/img-480w.webp' },
    { width: 768, url: '/img-768w.webp' },
  ]);
  assert.equal(srcSet, '/img-480w.webp 480w, /img-768w.webp 768w, /img-896w.webp 896w');
  assert.equal(buildSrcSet([]), '');
});

test('resolveResponsiveSizes maps semantic presets and preserves custom strings', () => {
  assert.equal(resolveResponsiveSizes('hero'), '100vw');
  assert.equal(resolveResponsiveSizes('card'), '(min-width: 1024px) 25vw, 50vw');
  assert.equal(resolveResponsiveSizes('split'), '(min-width: 1024px) 50vw, 100vw');
  assert.equal(resolveResponsiveSizes('thumb'), '96px');
  assert.equal(resolveResponsiveSizes('(min-width: 768px) 33vw, 100vw'), '(min-width: 768px) 33vw, 100vw');
});

test('shouldBypassProgressiveBlur skips data and blob URIs', () => {
  assert.equal(shouldBypassProgressiveBlur('data:image/png;base64,abc'), true);
  assert.equal(shouldBypassProgressiveBlur('blob:http://localhost:3000/123'), true);
  assert.equal(shouldBypassProgressiveBlur('/src/assets/images/product_hoodie_taupe_1794952251370.jpg'), false);
});
