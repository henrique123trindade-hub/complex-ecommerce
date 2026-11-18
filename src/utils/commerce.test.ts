import test from 'node:test';
import assert from 'node:assert/strict';
import {
  calculateCartTotals,
  calculateShippingQuotes,
  clampQuantityForStock,
  filterAndSortProducts,
  formatBrl,
  formatCep,
  formatCpf,
  getCategoryLabel,
  isSizeAvailable,
  validateCartAgainstCatalog,
  validateCep,
  validateCpf,
} from './commerce';
import type { CartItem, Product } from '../types/store';

const sampleProducts: Product[] = [
  {
    id: 'p1',
    slug: 'washed-essential-hoodie',
    name: 'Washed Essential Hoodie',
    category: 'Hoodies',
    collection: 'Coleção 001',
    priceBrl: 329,
    description: 'Hoodie oversized 500g/m²',
    composition: '100% Algodão',
    careInstructions: 'Lavar a frio',
    fitNotes: 'Boxy oversized',
    isNew: true,
    isFeatured: true,
    isDemo: true,
    active: true,
    images: ['/img1.jpg'],
    colors: [{ name: 'Washed Grey', hex: '#6E6D6A', images: ['/img1.jpg'] }],
    sizes: [
      { size: 'S', stock: 4, sku: 'CMP-HD-S' },
      { size: 'M', stock: 0, sku: 'CMP-HD-M' },
    ],
    measurements: {},
  },
  {
    id: 'p2',
    slug: 'heavyweight-box-tee',
    name: 'Heavyweight Box Tee',
    category: 'Tees',
    collection: 'Coleção 001',
    priceBrl: 189,
    description: 'Camiseta boxy 320g/m²',
    composition: '100% Algodão',
    careInstructions: 'Lavar a frio',
    fitNotes: 'Boxy',
    isNew: false,
    isFeatured: true,
    isDemo: true,
    active: true,
    images: ['/img2.jpg'],
    colors: [{ name: 'Vintage Black', hex: '#1E1E1E', images: ['/img2.jpg'] }],
    sizes: [{ size: 'M', stock: 7, sku: 'CMP-TE-M' }],
    measurements: {},
  },
];

test('formatBrl formats Brazilian Real accurately', () => {
  const formatted = formatBrl(329);
  assert.match(formatted, /R\$\s?329,00/);
});

test('CEP formatting and validation', () => {
  assert.equal(formatCep('01310100'), '01310-100');
  assert.equal(validateCep('01310-100'), true);
  assert.equal(validateCep('0131'), false);
});

test('CPF formatting and check-digit validation', () => {
  assert.equal(formatCpf('52998224725'), '529.982.247-25');
  assert.equal(validateCpf('529.982.247-25'), true);
  assert.equal(validateCpf('111.111.111-11'), false);
  assert.equal(validateCpf('123.456.789-00'), false);
});

test('calculateShippingQuotes handles regional rates and free shipping threshold', () => {
  const spStandard = calculateShippingQuotes('01310-100', 329);
  assert.equal(spStandard.length, 2);
  assert.equal(spStandard[0].priceBrl, 24);
  assert.equal(spStandard[1].priceBrl, 42);

  const spFree = calculateShippingQuotes('01310-100', 600);
  assert.equal(spFree[0].priceBrl, 0);
  assert.equal(spFree[1].priceBrl, 42);
});

test('calculateCartTotals computes subtotal, coupon discount, and total', () => {
  const cart: CartItem[] = [
    {
      key: 'p1-grey-S',
      productId: 'p1',
      slug: 'washed-essential-hoodie',
      name: 'Washed Essential Hoodie',
      priceBrl: 329,
      colorName: 'Washed Grey',
      colorHex: '#6E6D6A',
      size: 'S',
      sku: 'CMP-HD-S',
      quantity: 2,
      maxStock: 4,
      image: '/img1.jpg',
    },
  ];
  const totals = calculateCartTotals(cart, 24, 10, 200);
  assert.equal(totals.subtotalBrl, 658);
  assert.equal(totals.discountBrl, 65.8);
  assert.equal(totals.totalBrl, 616.2);
  assert.equal(totals.itemCount, 2);
});

test('stock availability and quantity clamping respect variant limits', () => {
  assert.equal(isSizeAvailable(sampleProducts[0], 'S'), true);
  assert.equal(isSizeAvailable(sampleProducts[0], 'M'), false);
  assert.equal(clampQuantityForStock(10, 4), 4);
  assert.equal(clampQuantityForStock(2, 0), 0);
});

test('filterAndSortProducts filters by category, available size, price, and sort', () => {
  const hoodies = filterAndSortProducts(sampleProducts, {
    category: 'Hoodies',
    size: 'ALL',
    color: 'ALL',
    maxPrice: null,
    sort: 'newest',
    query: '',
  });
  assert.equal(hoodies.length, 1);
  assert.equal(hoodies[0].slug, 'washed-essential-hoodie');

  const sizeM = filterAndSortProducts(sampleProducts, {
    category: 'ALL',
    size: 'M',
    color: 'ALL',
    maxPrice: null,
    sort: 'price-asc',
    query: '',
  });
  assert.equal(sizeM.length, 1);
  assert.equal(sizeM[0].slug, 'heavyweight-box-tee');
});

test('getCategoryLabel translates canonical category slugs into Brazilian Portuguese', () => {
  assert.equal(getCategoryLabel('ALL'), 'Todos');
  assert.equal(getCategoryLabel('Tees'), 'Camisetas');
  assert.equal(getCategoryLabel('Hoodies'), 'Moletons');
  assert.equal(getCategoryLabel('Bottoms'), 'Calças');
  assert.equal(getCategoryLabel('Outerwear'), 'Jaquetas');
  assert.equal(getCategoryLabel('Accessories'), 'Acessórios');
});

test('validateCartAgainstCatalog catches stale prices, stock drops, and removed products', () => {
  const staleCart: CartItem[] = [
    {
      key: 'p1-grey-S',
      productId: 'p1',
      slug: 'washed-essential-hoodie',
      name: 'Washed Essential Hoodie',
      priceBrl: 299, // stale price (live is 329)
      colorName: 'Washed Grey',
      colorHex: '#6E6D6A',
      size: 'S',
      sku: 'CMP-HD-S',
      quantity: 10, // exceeds live stock 4
      maxStock: 10,
      image: '/img1.jpg',
    },
  ];

  const result = validateCartAgainstCatalog(staleCart, sampleProducts);
  assert.equal(result.valid, false);
  assert.equal(result.changed, true);
  assert.equal(result.issues.length, 2);
  assert.equal(result.adjustedCart[0].priceBrl, 329);
  assert.equal(result.adjustedCart[0].quantity, 4);
  assert.equal(result.adjustedCart[0].maxStock, 4);
});
