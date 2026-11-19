import test from 'node:test';
import assert from 'node:assert/strict';
import {
  aggregateCustomersWithOrders,
  buildCustomerCreatePayload,
  filterSortPaginateCustomers,
  findMissingProfilesFromOrders,
  formatCustomerDateTime,
  getCustomerStatusLabel,
  normalizeUserProfileRecord,
} from './customers';
import type { OrderRecord, UserProfile } from '../types/store';

function makeOrder(overrides: Partial<OrderRecord>): OrderRecord {
  return {
    id: 'ord-1',
    orderNumber: 'CMP-10001',
    userId: 'uid-cliente-a',
    customerName: 'Cliente A',
    customerEmail: 'cliente.a@exemplo.com',
    shippingAddress: {
      recipientName: 'Cliente A',
      cep: '01310-100',
      street: 'Av. Paulista',
      number: '1000',
      neighborhood: 'Bela Vista',
      city: 'São Paulo',
      state: 'SP',
    },
    shippingMethod: 'SEDEX',
    shippingCostBrl: 25,
    paymentMethod: 'pix',
    discountBrl: 0,
    subtotalBrl: 300,
    totalBrl: 325,
    status: 'confirmed',
    isDemo: true,
    items: [],
    createdAt: '2026-05-01T14:00:00.000Z',
    updatedAt: '2026-05-01T14:00:00.000Z',
    ...overrides,
  };
}

test('normalizeUserProfileRecord converts Firestore timestamps, defaults status, and strips sensitive keys', () => {
  const raw = {
    uid: 'uid-123',
    displayName: '  Lucas Mendes  ',
    email: '  LUCAS@EXEMPLO.COM ',
    phone: '(11) 98888-7777',
    cpf: '123.456.789-00',
    password: 'SHOULD_NEVER_APPEAR',
    sessionToken: 'SECRET_TOKEN',
    createdAt: { toDate: () => new Date('2026-04-10T10:00:00.000Z') },
    updatedAt: { seconds: 1775818800 },
    lastLoginAt: '2026-04-12T15:30:00.000Z',
  };

  const normalized = normalizeUserProfileRecord(raw);
  assert.equal(normalized.uid, 'uid-123');
  assert.equal(normalized.displayName, 'Lucas Mendes');
  assert.equal(normalized.email, 'lucas@exemplo.com');
  assert.equal(normalized.status, 'active');
  assert.equal(normalized.createdAt, '2026-04-10T10:00:00.000Z');
  assert.equal(normalized.lastLoginAt, '2026-04-12T15:30:00.000Z');
  assert.ok(normalized.updatedAt);
  assert.equal('password' in normalized, false);
  assert.equal('sessionToken' in normalized, false);
});

test('buildCustomerCreatePayload creates clean persistent payload with no sensitive fields', () => {
  const payload = buildCustomerCreatePayload(
    {
      uid: 'uid-abc',
      displayName: 'Mariana Costa',
      email: 'MARIANA@COMPLEX.BR',
    },
    'SERVER_TS'
  );

  assert.deepEqual(Object.keys(payload).sort(), [
    'cpf',
    'createdAt',
    'displayName',
    'email',
    'lastLoginAt',
    'phone',
    'status',
    'uid',
    'updatedAt',
  ]);
  assert.equal(payload.email, 'mariana@complex.br');
  assert.equal(payload.status, 'active');
  assert.equal(payload.createdAt, 'SERVER_TS');
  assert.equal(payload.lastLoginAt, 'SERVER_TS');
});

test('aggregateCustomersWithOrders lists all registered accounts independent of current session and computes real totals', () => {
  const customers: UserProfile[] = [
    {
      uid: 'uid-admin',
      displayName: 'Henrique Admin',
      email: 'henrique123trindade@gmail.com',
      status: 'active',
      createdAt: '2026-01-01T10:00:00.000Z',
      lastLoginAt: '2026-05-10T09:00:00.000Z',
    },
    {
      uid: 'uid-cliente-a',
      displayName: 'Cliente A',
      email: 'cliente.a@exemplo.com',
      status: 'active',
      createdAt: '2026-05-01T12:00:00.000Z',
      lastLoginAt: '2026-05-02T12:00:00.000Z',
    },
    {
      uid: 'uid-cliente-b',
      displayName: 'Cliente B Sem Pedidos',
      email: 'cliente.b@exemplo.com',
      status: 'inactive',
      createdAt: '2026-05-05T12:00:00.000Z',
    },
  ];

  const orders: OrderRecord[] = [
    makeOrder({ id: 'ord-1', userId: 'uid-cliente-a', totalBrl: 325, status: 'confirmed' }),
    makeOrder({ id: 'ord-2', userId: 'uid-cliente-a', totalBrl: 200, status: 'delivered' }),
    makeOrder({ id: 'ord-3', userId: 'uid-cliente-a', totalBrl: 999, status: 'cancelled' }),
  ];

  // Admin is currently signed in; Customer A and Customer B are offline
  const summaries = aggregateCustomersWithOrders(customers, orders, 'uid-admin');
  assert.equal(summaries.length, 3);

  const adminRow = summaries.find((r) => r.profile.uid === 'uid-admin');
  const clienteA = summaries.find((r) => r.profile.uid === 'uid-cliente-a');
  const clienteB = summaries.find((r) => r.profile.uid === 'uid-cliente-b');

  assert.equal(adminRow?.isCurrentSessionUser, true);
  assert.equal(adminRow?.orderCount, 0);
  assert.equal(adminRow?.totalSpentBrl, 0);

  assert.equal(clienteA?.isCurrentSessionUser, false);
  assert.equal(clienteA?.orderCount, 3);
  assert.equal(clienteA?.validOrderCount, 2);
  assert.equal(clienteA?.totalSpentBrl, 525); // Cancelled order excluded from total spent

  assert.equal(clienteB?.isCurrentSessionUser, false);
  assert.equal(clienteB?.orderCount, 0);
  assert.equal(clienteB?.totalSpentBrl, 0);
  assert.equal(clienteB?.profile.status, 'inactive');
});

test('findMissingProfilesFromOrders identifies missing accounts idempotently without touching existing or guest orders', () => {
  const existing: UserProfile[] = [
    {
      uid: 'uid-existing',
      displayName: 'Já Existe',
      email: 'existe@exemplo.com',
      status: 'active',
    },
  ];

  const orders: OrderRecord[] = [
    makeOrder({ id: 'ord-1', userId: 'uid-existing', customerEmail: 'existe@exemplo.com' }),
    makeOrder({ id: 'ord-2', userId: 'guest', customerEmail: 'guest@exemplo.com' }),
    makeOrder({ id: 'ord-3', userId: 'guest-demo', customerEmail: 'guest2@exemplo.com' }),
    makeOrder({
      id: 'ord-4',
      userId: 'uid-legacy-1',
      customerName: 'Ana Antiga',
      customerEmail: 'ANA@EXEMPLO.COM',
      createdAt: '2026-03-10T10:00:00.000Z',
    }),
    makeOrder({
      id: 'ord-5',
      userId: 'uid-legacy-1',
      customerName: 'Ana Antiga',
      customerEmail: 'ana@exemplo.com',
      customerCpf: '111.222.333-44',
      createdAt: '2026-02-01T10:00:00.000Z',
    }),
  ];

  const missing = findMissingProfilesFromOrders(existing, orders);
  assert.equal(missing.length, 1);
  assert.equal(missing[0].uid, 'uid-legacy-1');
  assert.equal(missing[0].email, 'ana@exemplo.com');
  assert.equal(missing[0].cpf, '111.222.333-44');
  assert.equal(missing[0].sourceOrderCount, 2);
  assert.equal(missing[0].earliestOrderAt, '2026-02-01T10:00:00.000Z');
});

test('filterSortPaginateCustomers supports search, status filter, sorting, and pagination clamping', () => {
  const customers: UserProfile[] = [
    {
      uid: 'u1',
      displayName: 'Bruno Silva',
      email: 'bruno@loja.com',
      status: 'active',
      createdAt: '2026-04-01T10:00:00.000Z',
    },
    {
      uid: 'u2',
      displayName: 'Carla Souza',
      email: 'carla@loja.com',
      status: 'inactive',
      createdAt: '2026-04-15T10:00:00.000Z',
    },
    {
      uid: 'u3',
      displayName: 'Amanda Lima',
      email: 'amanda@loja.com',
      status: 'active',
      createdAt: '2026-04-20T10:00:00.000Z',
    },
  ];

  const orders: OrderRecord[] = [
    makeOrder({ id: 'o1', userId: 'u1', totalBrl: 800 }),
    makeOrder({ id: 'o2', userId: 'u3', totalBrl: 250 }),
  ];

  const summaries = aggregateCustomersWithOrders(customers, orders, null);

  // Default recent sort: u3 -> u2 -> u1
  const recent = filterSortPaginateCustomers(summaries, {
    query: '',
    status: 'ALL',
    sort: 'recent',
    page: 1,
    pageSize: 2,
  });
  assert.equal(recent.totalFiltered, 3);
  assert.equal(recent.totalPages, 2);
  assert.deepEqual(
    recent.items.map((i) => i.profile.uid),
    ['u3', 'u2']
  );

  // Page clamping beyond range
  const page2 = filterSortPaginateCustomers(summaries, {
    query: '',
    status: 'ALL',
    sort: 'recent',
    page: 99,
    pageSize: 2,
  });
  assert.equal(page2.safePage, 2);
  assert.deepEqual(
    page2.items.map((i) => i.profile.uid),
    ['u1']
  );

  // Search by email
  const search = filterSortPaginateCustomers(summaries, {
    query: 'carla@',
    status: 'ALL',
    sort: 'recent',
    page: 1,
    pageSize: 10,
  });
  assert.equal(search.totalFiltered, 1);
  assert.equal(search.items[0].profile.uid, 'u2');

  // Filter active + sort by spent descending
  const activeSpent = filterSortPaginateCustomers(summaries, {
    query: '',
    status: 'active',
    sort: 'spent-desc',
    page: 1,
    pageSize: 10,
  });
  assert.deepEqual(
    activeSpent.items.map((i) => i.profile.uid),
    ['u1', 'u3']
  );
});

test('formatCustomerDateTime and getCustomerStatusLabel handle missing values cleanly', () => {
  assert.equal(formatCustomerDateTime(undefined), '—');
  assert.equal(formatCustomerDateTime('invalid-date'), '—');
  assert.notEqual(formatCustomerDateTime('2026-05-01T14:30:00.000Z'), '—');
  assert.equal(getCustomerStatusLabel('active'), 'Ativo');
  assert.equal(getCustomerStatusLabel('inactive'), 'Inativo');
  assert.equal(getCustomerStatusLabel(undefined), 'Ativo');
});
