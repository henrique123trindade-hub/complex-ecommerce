import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildBreadcrumbJsonLd,
  buildProductBreadcrumbs,
  buildProductJsonLd,
  buildShopBreadcrumbs,
} from './seo';
import { DEMO_PRODUCTS } from '../data/seedCatalog';

test('buildShopBreadcrumbs builds base catalog trail and category-filtered trail', () => {
  const baseTrail = buildShopBreadcrumbs('ALL');
  assert.deepEqual(baseTrail, [
    { label: 'Início', path: '/' },
    { label: 'Loja', path: '/shop' },
  ]);

  const hoodiesTrail = buildShopBreadcrumbs('Hoodies');
  assert.deepEqual(hoodiesTrail, [
    { label: 'Início', path: '/' },
    { label: 'Loja', path: '/shop' },
    { label: 'Moletons', path: '/shop?category=Hoodies' },
  ]);
});

test('buildProductBreadcrumbs includes Home, Shop, localized Category, and Product', () => {
  const product = DEMO_PRODUCTS[0];
  const trail = buildProductBreadcrumbs(product);
  assert.equal(trail.length, 4);
  assert.equal(trail[0].label, 'Início');
  assert.equal(trail[1].label, 'Loja');
  assert.equal(trail[2].label, 'Moletons');
  assert.equal(trail[2].path, '/shop?category=Hoodies');
  assert.equal(trail[3].label, product.name);
  assert.equal(trail[3].path, `/product/${product.slug}`);
});

test('buildBreadcrumbJsonLd formats valid Schema.org BreadcrumbList items', () => {
  const items = buildShopBreadcrumbs('Tees');
  const jsonLd = buildBreadcrumbJsonLd(items, 'https://complex-ecommerce.vercel.app');

  assert.equal(jsonLd['@context'], 'https://schema.org');
  assert.equal(jsonLd['@type'], 'BreadcrumbList');
  assert.equal(jsonLd.itemListElement.length, 3);
  assert.deepEqual(jsonLd.itemListElement[0], {
    '@type': 'ListItem',
    position: 1,
    name: 'Início',
    item: 'https://complex-ecommerce.vercel.app/',
  });
  assert.deepEqual(jsonLd.itemListElement[2], {
    '@type': 'ListItem',
    position: 3,
    name: 'Camisetas',
    item: 'https://complex-ecommerce.vercel.app/shop?category=Tees',
  });
});

test('buildProductJsonLd formats Schema.org Product with BRL Offer and optimized absolute image', () => {
  const product = DEMO_PRODUCTS[0];
  const jsonLd = buildProductJsonLd(product, 'https://complex-ecommerce.vercel.app');

  assert.equal(jsonLd['@type'], 'Product');
  assert.equal(jsonLd.name, product.name);
  assert.equal(jsonLd.brand.name, 'COMPLEX');
  assert.equal(jsonLd.offers.priceCurrency, 'BRL');
  assert.equal(jsonLd.offers.price, product.priceBrl.toFixed(2));
  assert.equal(jsonLd.offers.availability, 'https://schema.org/InStock');
  assert.ok(jsonLd.image.every((img) => img.startsWith('https://complex-ecommerce.vercel.app/')));
});
