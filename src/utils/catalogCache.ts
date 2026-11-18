import type { CategoryItem, EditorialConfig, Product } from '../types/store';

export const CATALOG_CACHE_KEY = 'complex_catalog_snapshot_v1';
export const CATALOG_CACHE_TTL_MS = 1000 * 60 * 60 * 24; // 24h

export interface CatalogSnapshot {
  products: Product[];
  categories: CategoryItem[];
  editorial: EditorialConfig;
  source: 'demo' | 'firestore';
  savedAt: number;
}

export function isValidCatalogSnapshot(value: unknown): value is CatalogSnapshot {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<CatalogSnapshot>;
  if (!Array.isArray(candidate.products) || candidate.products.length === 0) return false;
  if (!Array.isArray(candidate.categories) || candidate.categories.length === 0) return false;
  if (!candidate.editorial || typeof candidate.editorial !== 'object') return false;
  if (candidate.source !== 'demo' && candidate.source !== 'firestore') return false;
  if (typeof candidate.savedAt !== 'number' || !Number.isFinite(candidate.savedAt)) return false;
  return true;
}

export function readCatalogSnapshot(now = Date.now()): CatalogSnapshot | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(CATALOG_CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as unknown;
    if (!isValidCatalogSnapshot(parsed)) return null;
    if (now - parsed.savedAt > CATALOG_CACHE_TTL_MS) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function writeCatalogSnapshot(snapshot: Omit<CatalogSnapshot, 'savedAt'>, now = Date.now()): void {
  if (typeof window === 'undefined') return;
  if (snapshot.products.length === 0 || snapshot.categories.length === 0) return;
  try {
    const payload: CatalogSnapshot = {
      ...snapshot,
      savedAt: now,
    };
    window.localStorage.setItem(CATALOG_CACHE_KEY, JSON.stringify(payload));
  } catch {
    // Ignore storage quota or private browsing errors
  }
}

export function areCatalogSnapshotsEqual(
  a: Pick<CatalogSnapshot, 'products' | 'categories' | 'editorial' | 'source'>,
  b: Pick<CatalogSnapshot, 'products' | 'categories' | 'editorial' | 'source'>
): boolean {
  if (a.source !== b.source) return false;
  if (a.products.length !== b.products.length || a.categories.length !== b.categories.length) {
    return false;
  }
  try {
    return (
      JSON.stringify({ p: a.products, c: a.categories, e: a.editorial }) ===
      JSON.stringify({ p: b.products, c: b.categories, e: b.editorial })
    );
  } catch {
    return false;
  }
}
