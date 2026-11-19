import type {
  AdminCustomerSummary,
  AuthProviderId,
  CustomerAccountStatus,
  OrderRecord,
  UserProfile,
} from '../types/store';
import { extractAuthProviders, formatAuthProvidersLabel } from './authValidation';

export type CustomerStatusFilter = 'ALL' | CustomerAccountStatus;
export type CustomerSortOption =
  | 'recent'
  | 'last-login'
  | 'spent-desc'
  | 'orders-desc'
  | 'name-asc';

export interface CustomerQueryOptions {
  query: string;
  status: CustomerStatusFilter;
  sort: CustomerSortOption;
  page: number;
  pageSize: number;
}

export interface CustomerPageResult {
  items: AdminCustomerSummary[];
  totalFiltered: number;
  totalPages: number;
  safePage: number;
}

export interface MissingCustomerCandidate {
  uid: string;
  displayName: string;
  email: string;
  cpf: string;
  phone: string;
  status: CustomerAccountStatus;
  sourceOrderCount: number;
  earliestOrderAt?: string;
}

const VALID_UID_REGEX = /^[a-zA-Z0-9_-]{1,128}$/;

function toIsoStringOptional(value: unknown): string | undefined {
  if (value && typeof (value as { toDate?: () => Date }).toDate === 'function') {
    try {
      return (value as { toDate: () => Date }).toDate().toISOString();
    } catch {
      return undefined;
    }
  }
  if (
    value &&
    typeof value === 'object' &&
    'seconds' in value &&
    typeof (value as { seconds?: unknown }).seconds === 'number'
  ) {
    const seconds = (value as { seconds: number }).seconds;
    const ms = seconds * 1000;
    if (Number.isFinite(ms)) {
      return new Date(ms).toISOString();
    }
  }
  if (typeof value === 'string' && value.trim()) {
    const parsed = Date.parse(value);
    if (!Number.isNaN(parsed)) {
      return new Date(parsed).toISOString();
    }
  }
  return undefined;
}

export function sanitizeCustomerString(value: unknown, maxLength: number): string {
  if (typeof value !== 'string') return '';
  return value.trim().slice(0, maxLength);
}

/**
 * Normalizes a raw Firestore /users/{uid} record into a clean, safe UserProfile.
 * Explicitly picks only allowed non-sensitive fields and normalizes timestamps.
 */
export function normalizeUserProfileRecord(
  raw: Record<string, unknown>,
  fallbackUid?: string
): UserProfile {
  const uid = sanitizeCustomerString(raw.uid ?? fallbackUid, 128);
  const email = sanitizeCustomerString(raw.email, 160).toLowerCase();
  const displayName = sanitizeCustomerString(raw.displayName, 120) || 'Cliente COMPLEX';
  const cpf = sanitizeCustomerString(raw.cpf, 20);
  const phone = sanitizeCustomerString(raw.phone, 30);
  const status: CustomerAccountStatus = raw.status === 'inactive' ? 'inactive' : 'active';
  const rawProviders = Array.isArray(raw.authProviders)
    ? extractAuthProviders(
        raw.authProviders.map((entry) =>
          typeof entry === 'string' ? { providerId: entry } : { providerId: '' }
        )
      )
    : [];
  const emailVerified = typeof raw.emailVerified === 'boolean' ? raw.emailVerified : undefined;
  const createdAt = toIsoStringOptional(raw.createdAt);
  const updatedAt = toIsoStringOptional(raw.updatedAt);
  const lastLoginAt = toIsoStringOptional(raw.lastLoginAt);

  return {
    uid,
    displayName,
    email,
    cpf,
    phone,
    status,
    ...(rawProviders.length > 0 ? { authProviders: rawProviders } : {}),
    ...(emailVerified !== undefined ? { emailVerified } : {}),
    ...(createdAt ? { createdAt } : {}),
    ...(updatedAt ? { updatedAt } : {}),
    ...(lastLoginAt ? { lastLoginAt } : {}),
  };
}

/**
 * Builds a deterministic, schema-compliant payload for creating a new /users/{uid} document.
 * Never includes credentials, tokens, or shadow privilege fields.
 */
export function buildCustomerCreatePayload<TTimestamp>(
  input: {
    uid: string;
    displayName?: string | null;
    email?: string | null;
    cpf?: string | null;
    phone?: string | null;
    status?: CustomerAccountStatus;
    authProviders?: AuthProviderId[];
    emailVerified?: boolean;
  },
  timestampValue: TTimestamp
) {
  const uid = sanitizeCustomerString(input.uid, 128);
  const email = sanitizeCustomerString(input.email, 160).toLowerCase();
  const displayName = sanitizeCustomerString(input.displayName, 120) || 'Cliente COMPLEX';
  const cpf = sanitizeCustomerString(input.cpf, 20);
  const phone = sanitizeCustomerString(input.phone, 30);
  const status: CustomerAccountStatus = input.status === 'inactive' ? 'inactive' : 'active';
  const cleanProviders = Array.isArray(input.authProviders)
    ? extractAuthProviders(input.authProviders.map((providerId) => ({ providerId })))
    : [];

  return {
    uid,
    displayName,
    email,
    cpf,
    phone,
    status,
    ...(cleanProviders.length > 0 ? { authProviders: cleanProviders } : {}),
    ...(typeof input.emailVerified === 'boolean' ? { emailVerified: input.emailVerified } : {}),
    lastLoginAt: timestampValue,
    createdAt: timestampValue,
    updatedAt: timestampValue,
  };
}

/**
 * Joins registered customer profiles with real orders (independent of current session).
 * Cancelled orders are excluded from totalSpentBrl but counted in total order history.
 */
export function aggregateCustomersWithOrders(
  customers: UserProfile[],
  orders: OrderRecord[],
  currentUserUid?: string | null
): AdminCustomerSummary[] {
  const ordersByUid = new Map<string, OrderRecord[]>();

  for (const order of orders) {
    if (!order.userId) continue;
    const list = ordersByUid.get(order.userId) ?? [];
    list.push(order);
    ordersByUid.set(order.userId, list);
  }

  // Deduplicate profiles defensively by uid in case caller passes merged sources
  const seenUids = new Set<string>();
  const summaries: AdminCustomerSummary[] = [];

  for (const profile of customers) {
    if (!profile.uid || seenUids.has(profile.uid)) continue;
    seenUids.add(profile.uid);

    const customerOrders = (ordersByUid.get(profile.uid) ?? []).slice().sort((a, b) => {
      const aTime = Date.parse(a.createdAt || '') || 0;
      const bTime = Date.parse(b.createdAt || '') || 0;
      return bTime - aTime;
    });

    const validOrders = customerOrders.filter((ord) => ord.status !== 'cancelled');
    const totalSpentBrl = Number(
      validOrders.reduce((sum, ord) => sum + (Number(ord.totalBrl) || 0), 0).toFixed(2)
    );
    const lastOrderAt = customerOrders[0]?.createdAt;

    summaries.push({
      profile: {
        ...profile,
        status: profile.status === 'inactive' ? 'inactive' : 'active',
      },
      orderCount: customerOrders.length,
      validOrderCount: validOrders.length,
      totalSpentBrl,
      ...(lastOrderAt ? { lastOrderAt } : {}),
      orders: customerOrders,
      isCurrentSessionUser: Boolean(currentUserUid && profile.uid === currentUserUid),
    });
  }

  return summaries;
}

/**
 * Identifies authenticated userIds present in real orders that do not yet have
 * a corresponding /users/{uid} document, enabling safe, idempotent backfill recovery.
 */
export function findMissingProfilesFromOrders(
  existingCustomers: UserProfile[],
  orders: OrderRecord[]
): MissingCustomerCandidate[] {
  const existingUids = new Set(existingCustomers.map((c) => c.uid));
  const candidates = new Map<string, MissingCustomerCandidate>();

  for (const order of orders) {
    const uid = sanitizeCustomerString(order.userId, 128);
    if (!uid || uid === 'guest' || uid === 'guest-demo' || !VALID_UID_REGEX.test(uid)) {
      continue;
    }
    if (existingUids.has(uid)) {
      continue;
    }

    const email = sanitizeCustomerString(order.customerEmail, 160).toLowerCase();
    if (!email || !email.includes('@')) {
      continue;
    }

    const existingCandidate = candidates.get(uid);
    const orderCreatedAt = toIsoStringOptional(order.createdAt);

    if (!existingCandidate) {
      candidates.set(uid, {
        uid,
        displayName: sanitizeCustomerString(order.customerName, 120) || 'Cliente COMPLEX',
        email,
        cpf: sanitizeCustomerString(order.customerCpf, 20),
        phone: '',
        status: 'active',
        sourceOrderCount: 1,
        ...(orderCreatedAt ? { earliestOrderAt: orderCreatedAt } : {}),
      });
    } else {
      existingCandidate.sourceOrderCount += 1;
      if (!existingCandidate.cpf && order.customerCpf) {
        existingCandidate.cpf = sanitizeCustomerString(order.customerCpf, 20);
      }
      if (
        orderCreatedAt &&
        (!existingCandidate.earliestOrderAt ||
          Date.parse(orderCreatedAt) < Date.parse(existingCandidate.earliestOrderAt))
      ) {
        existingCandidate.earliestOrderAt = orderCreatedAt;
      }
    }
  }

  return Array.from(candidates.values());
}

function getTimeOrZero(iso?: string): number {
  if (!iso) return 0;
  const parsed = Date.parse(iso);
  return Number.isNaN(parsed) ? 0 : parsed;
}

export function filterSortPaginateCustomers(
  rows: AdminCustomerSummary[],
  options: CustomerQueryOptions
): CustomerPageResult {
  const normalizedQuery = options.query.trim().toLowerCase();

  const filtered = rows.filter((row) => {
    if (options.status !== 'ALL') {
      const effectiveStatus = row.profile.status === 'inactive' ? 'inactive' : 'active';
      if (effectiveStatus !== options.status) return false;
    }

    if (normalizedQuery) {
      const name = (row.profile.displayName || '').toLowerCase();
      const email = (row.profile.email || '').toLowerCase();
      const phone = (row.profile.phone || '').toLowerCase();
      const authMethod = formatAuthProvidersLabel(row.profile.authProviders).toLowerCase();
      if (
        !name.includes(normalizedQuery) &&
        !email.includes(normalizedQuery) &&
        !phone.includes(normalizedQuery) &&
        !authMethod.includes(normalizedQuery)
      ) {
        return false;
      }
    }

    return true;
  });

  const sorted = filtered.slice().sort((a, b) => {
    switch (options.sort) {
      case 'last-login': {
        const diff = getTimeOrZero(b.profile.lastLoginAt) - getTimeOrZero(a.profile.lastLoginAt);
        if (diff !== 0) return diff;
        return getTimeOrZero(b.profile.createdAt) - getTimeOrZero(a.profile.createdAt);
      }
      case 'spent-desc': {
        const diff = b.totalSpentBrl - a.totalSpentBrl;
        if (diff !== 0) return diff;
        return b.orderCount - a.orderCount;
      }
      case 'orders-desc': {
        const diff = b.orderCount - a.orderCount;
        if (diff !== 0) return diff;
        return b.totalSpentBrl - a.totalSpentBrl;
      }
      case 'name-asc':
        return (a.profile.displayName || '').localeCompare(b.profile.displayName || '', 'pt-BR');
      case 'recent':
      default: {
        const diff = getTimeOrZero(b.profile.createdAt) - getTimeOrZero(a.profile.createdAt);
        if (diff !== 0) return diff;
        return (a.profile.displayName || '').localeCompare(b.profile.displayName || '', 'pt-BR');
      }
    }
  });

  const pageSize = Math.max(1, Math.floor(options.pageSize));
  const totalFiltered = sorted.length;
  const totalPages = Math.max(1, Math.ceil(totalFiltered / pageSize));
  const safePage = Math.min(Math.max(1, Math.floor(options.page)), totalPages);
  const start = (safePage - 1) * pageSize;

  return {
    items: sorted.slice(start, start + pageSize),
    totalFiltered,
    totalPages,
    safePage,
  };
}

export function formatCustomerDateTime(iso?: string): string {
  if (!iso) return '—';
  const parsed = new Date(iso);
  if (Number.isNaN(parsed.getTime())) return '—';
  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(parsed);
}

export function getCustomerStatusLabel(status?: CustomerAccountStatus): string {
  return status === 'inactive' ? 'Inativo' : 'Ativo';
}
