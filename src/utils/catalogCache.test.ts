import test from 'node:test';
import assert from 'node:assert/strict';
import {
  areCatalogSnapshotsEqual,
  CATALOG_CACHE_KEY,
  CATALOG_CACHE_TTL_MS,
  isValidCatalogSnapshot,
  readCatalogSnapshot,
  writeCatalogSnapshot,
} from './catalogCache';
import {
  DEFAULT_EDITORIAL,
  DEMO_CATEGORIES,
  DEMO_PRODUCTS,
} from '../data/seedCatalog';

function createMemoryStorage(): Storage {
  const store = new Map<string, string>();
  return {
    get length() {
      return store.size;
    },
    clear() {
      store.clear();
    },
    getItem(key: string) {
      return store.get(key) ?? null;
    },
    key(index: number) {
      return Array.from(store.keys())[index] ?? null;
    },
    removeItem(key: string) {
      store.delete(key);
    },
    setItem(key: string, value: string) {
      store.set(key, value);
    },
  };
}

test('isValidCatalogSnapshot rejects empty, malformed, or incomplete payloads', () => {
  assert.equal(isValidCatalogSnapshot(null), false);
  assert.equal(isValidCatalogSnapshot({}), false);
  assert.equal(
    isValidCatalogSnapshot({
      products: [],
      categories: DEMO_CATEGORIES,
      editorial: DEFAULT_EDITORIAL,
      source: 'firestore',
      savedAt: 1000,
    }),
    false
  );
  assert.equal(
    isValidCatalogSnapshot({
      products: DEMO_PRODUCTS,
      categories: DEMO_CATEGORIES,
      editorial: DEFAULT_EDITORIAL,
      source: 'firestore',
      savedAt: 1000,
    }),
    true
  );
});

test('writeCatalogSnapshot & readCatalogSnapshot roundtrip and expire cleanly after TTL', () => {
  const originalWindow = (globalThis as { window?: unknown }).window;
  const storage = createMemoryStorage();
  (globalThis as { window?: unknown }).window = { localStorage: storage };

  try {
    const t0 = 1_700_000_000_000;
    writeCatalogSnapshot(
      {
        products: DEMO_PRODUCTS,
        categories: DEMO_CATEGORIES,
        editorial: DEFAULT_EDITORIAL,
        source: 'firestore',
      },
      t0
    );

    const fresh = readCatalogSnapshot(t0 + 5_000);
    assert.ok(fresh);
    assert.equal(fresh.source, 'firestore');
    assert.equal(fresh.products.length, DEMO_PRODUCTS.length);

    const expired = readCatalogSnapshot(t0 + CATALOG_CACHE_TTL_MS + 1);
    assert.equal(expired, null);

    storage.setItem(CATALOG_CACHE_KEY, '{corrupted-json');
    assert.equal(readCatalogSnapshot(t0), null);
  } finally {
    (globalThis as { window?: unknown }).window = originalWindow;
  }
});

test('areCatalogSnapshotsEqual skips redundant state updates when Firestore matches cached data', () => {
  const snapA = {
    products: DEMO_PRODUCTS,
    categories: DEMO_CATEGORIES,
    editorial: DEFAULT_EDITORIAL,
    source: 'firestore' as const,
  };
  const snapB = {
    products: structuredClone(DEMO_PRODUCTS),
    categories: structuredClone(DEMO_CATEGORIES),
    editorial: structuredClone(DEFAULT_EDITORIAL),
    source: 'firestore' as const,
  };

  assert.equal(areCatalogSnapshotsEqual(snapA, snapB), true);
  assert.equal(
    areCatalogSnapshotsEqual(snapA, { ...snapB, source: 'demo' as const }),
    false
  );
});
