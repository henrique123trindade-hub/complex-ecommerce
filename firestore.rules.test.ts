import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  validateNewsletterPayload,
  validateOrderPayload,
  validateProductPayload,
} from './src/lib/validation';

const rulesSource = fs.readFileSync('./firestore.rules', 'utf-8');

test('firestore.rules enforces default-deny catch-all and email_verified checks', () => {
  assert.match(rulesSource, /match \/\{document=\*\*\} \{\s*allow read, write: if false;/);
  assert.match(rulesSource, /request\.auth\.token\.email_verified == true/);
  assert.match(rulesSource, /affectedKeys\(\)\.hasOnly/);
});

test('Dirty Dozen payloads are rejected by blueprint validation', () => {
  // 1. Shadow field in product
  const shadowProduct = validateProductPayload({
    id: 'p1',
    slug: 'hoodie-test',
    name: 'Test Hoodie',
    category: 'Hoodies',
    collection: '001',
    priceBrl: 329,
    description: 'Desc',
    isNew: true,
    isFeatured: false,
    isDemo: true,
    active: true,
    images: ['/a.jpg'],
    colors: [{}],
    sizes: [{}],
    createdAt: 'server',
    updatedAt: 'server',
    isVerifiedHack: true,
  });
  assert.equal(shadowProduct.valid, false);

  // 2. Unverified email order rejected
  const unverifiedOrder = validateOrderPayload(
    {
      id: 'ord-1',
      orderNumber: 'CMP-1001',
      userId: 'user-a',
      customerName: 'Ana',
      customerEmail: 'ana@exemplo.com',
      shippingAddress: {},
      shippingMethod: 'PAC',
      shippingCostBrl: 24,
      paymentMethod: 'pix',
      discountBrl: 0,
      subtotalBrl: 329,
      totalBrl: 353,
      status: 'demo_pending',
      isDemo: true,
      items: [{}],
      createdAt: 'now',
      updatedAt: 'now',
    },
    'user-a',
    false
  );
  assert.equal(unverifiedOrder.valid, false);

  // 3. Order impersonation rejected
  const spoofedOrder = validateOrderPayload(
    {
      id: 'ord-2',
      orderNumber: 'CMP-1002',
      userId: 'user-b',
      customerName: 'Ana',
      customerEmail: 'ana@exemplo.com',
      shippingAddress: {},
      shippingMethod: 'PAC',
      shippingCostBrl: 24,
      paymentMethod: 'pix',
      discountBrl: 0,
      subtotalBrl: 329,
      totalBrl: 353,
      status: 'demo_pending',
      isDemo: true,
      items: [{}],
      createdAt: 'now',
      updatedAt: 'now',
    },
    'user-a',
    true
  );
  assert.equal(spoofedOrder.valid, false);

  // 4. Order status shortcutting rejected
  const shortcutOrder = validateOrderPayload(
    {
      id: 'ord-3',
      orderNumber: 'CMP-1003',
      userId: 'user-a',
      customerName: 'Ana',
      customerEmail: 'ana@exemplo.com',
      shippingAddress: {},
      shippingMethod: 'PAC',
      shippingCostBrl: 24,
      paymentMethod: 'pix',
      discountBrl: 0,
      subtotalBrl: 329,
      totalBrl: 353,
      status: 'delivered',
      isDemo: true,
      items: [{}],
      createdAt: 'now',
      updatedAt: 'now',
    },
    'user-a',
    true
  );
  assert.equal(shortcutOrder.valid, false);

  // 5. ID poisoning rejected
  const poisonedId = validateOrderPayload(
    {
      id: 'bad$id/' + 'a'.repeat(200),
      orderNumber: 'CMP-1004',
      userId: 'user-a',
      customerName: 'Ana',
      customerEmail: 'ana@exemplo.com',
      shippingAddress: {},
      shippingMethod: 'PAC',
      shippingCostBrl: 24,
      paymentMethod: 'pix',
      discountBrl: 0,
      subtotalBrl: 329,
      totalBrl: 353,
      status: 'demo_pending',
      isDemo: true,
      items: [{}],
      createdAt: 'now',
      updatedAt: 'now',
    },
    'user-a',
    true
  );
  assert.equal(poisonedId.valid, false);

  // 6. Newsletter without consent rejected
  const noConsent = validateNewsletterPayload({
    id: 'sub-1',
    email: 'visitante@exemplo.com',
    consent: false,
    createdAt: 'now',
  });
  assert.equal(noConsent.valid, false);
});
