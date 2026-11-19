import test from 'node:test';
import assert from 'node:assert/strict';
import {
  mapLegacyUrl,
  normalizeEditorialRecord,
  normalizeFirestoreTimestamp,
  normalizeOrderRecord,
  sanitizeServerOrderPayload,
} from './catalogNormalization';

test('mapLegacyUrl migrates known legacy asset paths and leaves modern paths untouched', () => {
  assert.equal(
    mapLegacyUrl('/assets/images/product_boxy_tee_front_1794952251135.jpg'),
    '/src/assets/images/optimized/product_boxy_tee_front_1794952251135-896w.webp'
  );
  assert.equal(
    mapLegacyUrl('/src/assets/images/optimized/custom-photo.webp'),
    '/src/assets/images/optimized/custom-photo.webp'
  );
});

test('normalizeEditorialRecord localizes legacy English titles, strips admin placeholders, and fills defaults', () => {
  const result = normalizeEditorialRecord({
    heroTitle: 'NEW PERSPECTIVE.',
    campaignTitle: 'BUILT FOR EVERYDAY.',
    shippingNote: 'Prazo e condições de envio configuráveis no painel administrativo.',
    returnsNote: 'Troca garantida em 14 dias.',
  });
  assert.equal(result.heroTitle, 'NOVA PERSPECTIVA.');
  assert.equal(result.campaignTitle, 'FEITO PARA O DIA A DIA.');
  assert.ok(result.heroDesktopImage.includes('/src/assets/images/optimized/'));
  assert.equal(/painel administrativo/i.test(result.shippingNote), false);
  assert.equal(result.returnsNote, 'Troca garantida em 14 dias.');
});

test('normalizeFirestoreTimestamp and normalizeOrderRecord handle Timestamp-like objects and ISO strings', () => {
  const fakeTimestamp = { toDate: () => new Date('2026-06-01T12:00:00.000Z') };
  assert.equal(normalizeFirestoreTimestamp(fakeTimestamp), '2026-06-01T12:00:00.000Z');
  assert.equal(normalizeFirestoreTimestamp('2026-06-02T00:00:00.000Z'), '2026-06-02T00:00:00.000Z');

  const order = normalizeOrderRecord({
    id: 'ord-1',
    orderNumber: 'CMP-10001',
    createdAt: fakeTimestamp,
    updatedAt: '2026-06-02T00:00:00.000Z',
  });
  assert.equal(order.createdAt, '2026-06-01T12:00:00.000Z');
  assert.equal(order.updatedAt, '2026-06-02T00:00:00.000Z');
});

test('sanitizeServerOrderPayload recomputes totals server-side and strips injected fields', () => {
  const result = sanitizeServerOrderPayload(
    {
      id: 'ord-12345',
      orderNumber: 'CMP-54321',
      customerName: 'Ana Silva',
      customerEmail: 'ana@example.com',
      shippingCostBrl: 24,
      discountBrl: 32.9,
      subtotalBrl: 1, // spoofed client subtotal
      totalBrl: 0, // spoofed client total
      status: 'delivered', // attempted status override
      isDemo: false, // attempted demo override
      role: 'admin', // injected field
      paymentMethod: 'pix',
      shippingAddress: {
        cep: '01310-100',
        street: 'Av. Paulista',
        number: '1000',
        neighborhood: 'Bela Vista',
        city: 'São Paulo',
        state: 'sp',
      },
      items: [
        {
          productId: 'p1',
          slug: 'washed-essential-hoodie',
          name: 'Moletom Essencial Estonado',
          colorName: 'Cinza Estonado',
          size: 'M',
          sku: 'CMP-HD-M',
          quantity: 1,
          unitPriceBrl: 329,
          image: '/img.webp',
        },
      ],
    },
    '2026-06-01T10:00:00.000Z'
  );

  assert.equal(result.ok, true);
  if (result.ok) {
    assert.equal(result.order.subtotalBrl, 329);
    assert.equal(result.order.totalBrl, 320.1);
    assert.equal(result.order.status, 'demo_pending');
    assert.equal(result.order.isDemo, true);
    assert.equal(result.order.shippingAddress.state, 'SP');
    assert.equal('role' in result.order, false);
  }
});

test('sanitizeServerOrderPayload rejects invalid email, empty items, or negative prices', () => {
  const badEmail = sanitizeServerOrderPayload({
    customerName: 'Ana',
    customerEmail: 'invalido',
    items: [{ quantity: 1, unitPriceBrl: 100 }],
    shippingAddress: { cep: '01310-100', street: 'Rua A', city: 'SP', state: 'SP' },
  });
  assert.equal(badEmail.ok, false);

  const emptyItems = sanitizeServerOrderPayload({
    customerName: 'Ana Silva',
    customerEmail: 'ana@example.com',
    items: [],
    shippingAddress: { cep: '01310-100', street: 'Rua A', city: 'SP', state: 'SP' },
  });
  assert.equal(emptyItems.ok, false);

  const negativePrice = sanitizeServerOrderPayload({
    customerName: 'Ana Silva',
    customerEmail: 'ana@example.com',
    items: [{ quantity: 1, unitPriceBrl: -50 }],
    shippingAddress: { cep: '01310-100', street: 'Rua A', city: 'SP', state: 'SP' },
  });
  assert.equal(negativePrice.ok, false);
});
