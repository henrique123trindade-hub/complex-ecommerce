import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { IMAGE_VARIANTS } from '../data/imageVariants';
import {
  buildSrcSet,
  getImageVariant,
  getOptimizedFallbackUrl,
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
    normalizeImageKey('http://localhost:3000/assets/aistudio/Imagem_do_ChatGPT_17_de_nov._de_2026__20_02_47-1_5292459e.png'),
    '/assets/aistudio/Imagem_do_ChatGPT_17_de_nov._de_2026__20_02_47-1_5292459e.png'
  );
  assert.equal(normalizeImageKey(undefined), '');
});

test('getImageVariant resolves local assets to responsive AVIF/WebP manifest entries with LQIP blurDataUrl', () => {
  const hero = getImageVariant('/assets/aistudio/Imagem_do_ChatGPT_17_de_nov._de_2026__20_02_47-1_5292459e.png');
  assert.ok(hero);
  assert.equal(hero.width, 1672);
  assert.equal(hero.height, 941);
  assert.ok(hero.webpSrc.endsWith('.webp'));
  assert.ok(hero.fallbackSrc.endsWith('.webp'));
  assert.ok(hero.blurDataUrl.startsWith('data:image/webp;base64,'));
  assert.ok(hero.variants.some((v) => v.width === 400));
  assert.ok(hero.variants.some((v) => v.width === 800));
  assert.ok(hero.variants.some((v) => v.width === 1200));
  assert.ok(hero.avifVariants && hero.avifVariants.some((v) => v.width === 1672));

  const product = getImageVariant('/src/assets/images/product_hoodie_taupe_1794952251370.jpg');
  assert.ok(product);
  assert.ok(product.fallbackSrc.endsWith('-800w.webp'));
  assert.ok(product.variants.some((v) => v.width === 400));
  assert.ok(product.variants.some((v) => v.width === 800));

  assert.equal(getImageVariant('https://example.com/custom.jpg'), null);
  assert.equal(
    getOptimizedFallbackUrl('/assets/aistudio/Imagem_do_ChatGPT_17_de_nov._de_2026__20_02_47-1_5292459e.png'),
    hero.fallbackSrc
  );
  const directWebp = getImageVariant('/src/assets/images/optimized/complex_campaign_1_5292459e-1672w.webp');
  assert.ok(directWebp);
  assert.equal(directWebp.webpSrc, hero.webpSrc);
});

test('buildSrcSet orders variants ascending by width', () => {
  const srcSet = buildSrcSet([
    { width: 1200, url: '/img-1200w.webp' },
    { width: 400, url: '/img-400w.webp' },
    { width: 800, url: '/img-800w.webp' },
  ]);
  assert.equal(srcSet, '/img-400w.webp 400w, /img-800w.webp 800w, /img-1200w.webp 1200w');
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

test('all assets in src/assets are converted to paired AVIF and WebP variants on disk', () => {
  const assetsDir = path.resolve('src/assets');
  const walk = (dir: string): string[] =>
    fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
      const full = path.join(dir, entry.name);
      return entry.isDirectory() ? walk(full) : [full];
    });

  const files = walk(assetsDir);
  assert.ok(files.length > 0);
  const nonOptimized = files.filter((f) => !f.endsWith('.avif') && !f.endsWith('.webp'));
  assert.deepEqual(nonOptimized, []);

  const avifs = new Set(files.filter((f) => f.endsWith('.avif')).map((f) => f.slice(0, -5)));
  const webps = new Set(files.filter((f) => f.endsWith('.webp')).map((f) => f.slice(0, -5)));
  assert.equal(avifs.size, webps.size);
  for (const base of avifs) {
    assert.ok(webps.has(base), `Missing WebP pair for ${base}`);
  }

  for (const [key, entry] of Object.entries(IMAGE_VARIANTS)) {
    assert.ok(entry.variants.length >= 2, `Expected responsive WebP variants for ${key}`);
    assert.ok(entry.avifVariants && entry.avifVariants.length === entry.variants.length, `Expected matching AVIF variants for ${key}`);
    assert.ok(entry.blurDataUrl.startsWith('data:image/webp;base64,'), `Expected WebP LQIP for ${key}`);
    assert.ok(entry.width > 0 && entry.height > 0, `Expected explicit dimensions for ${key}`);
  }
});
