import { validateNewsletterEmail } from '../utils/newsletter';

export const ID_PATTERN = /^[a-zA-Z0-9_-]+$/;
export const SLUG_PATTERN = /^[a-z0-9-]+$/;

export function isValidBlueprintId(id: string): boolean {
  return typeof id === 'string' && id.length >= 1 && id.length <= 128 && ID_PATTERN.test(id);
}

export function validateProductPayload(payload: Record<string, unknown>): { valid: boolean; reason?: string } {
  const allowed = new Set([
    'id', 'slug', 'name', 'category', 'collection', 'priceBrl',
    'description', 'composition', 'careInstructions', 'fitNotes',
    'isNew', 'isFeatured', 'isDemo', 'active',
    'images', 'colors', 'sizes', 'measurements', 'createdAt', 'updatedAt',
  ]);
  const required = [
    'id', 'slug', 'name', 'category', 'collection', 'priceBrl',
    'description', 'isNew', 'isFeatured', 'isDemo', 'active',
    'images', 'colors', 'sizes', 'createdAt', 'updatedAt',
  ];

  for (const key of Object.keys(payload)) {
    if (!allowed.has(key)) return { valid: false, reason: `Disallowed key: ${key}` };
  }
  for (const key of required) {
    if (!(key in payload)) return { valid: false, reason: `Missing required key: ${key}` };
  }
  if (!isValidBlueprintId(String(payload.id))) return { valid: false, reason: 'Invalid product id' };
  if (typeof payload.slug !== 'string' || !SLUG_PATTERN.test(payload.slug) || payload.slug.length > 128) {
    return { valid: false, reason: 'Invalid slug' };
  }
  if (typeof payload.name !== 'string' || payload.name.length < 2 || payload.name.length > 140) {
    return { valid: false, reason: 'Invalid name' };
  }
  if (!['Tees', 'Hoodies', 'Bottoms', 'Outerwear', 'Accessories'].includes(String(payload.category))) {
    return { valid: false, reason: 'Invalid category' };
  }
  if (typeof payload.priceBrl !== 'number' || payload.priceBrl <= 0 || payload.priceBrl > 100000) {
    return { valid: false, reason: 'Invalid priceBrl' };
  }
  if (!Array.isArray(payload.images) || payload.images.length < 1 || payload.images.length > 12) {
    return { valid: false, reason: 'Invalid images array' };
  }
  return { valid: true };
}

export function validateOrderPayload(
  payload: Record<string, unknown>,
  authUid: string | null,
  emailVerified: boolean
): { valid: boolean; reason?: string } {
  if (!authUid || !emailVerified) {
    return { valid: false, reason: 'Authenticated verified user required' };
  }
  const allowed = new Set([
    'id', 'orderNumber', 'userId', 'customerName', 'customerEmail', 'customerCpf',
    'shippingAddress', 'shippingMethod', 'shippingCostBrl',
    'paymentMethod', 'couponCode', 'discountBrl', 'subtotalBrl', 'totalBrl',
    'status', 'isDemo', 'items', 'createdAt', 'updatedAt',
  ]);
  const required = [
    'id', 'orderNumber', 'userId', 'customerName', 'customerEmail',
    'shippingAddress', 'shippingMethod', 'shippingCostBrl',
    'paymentMethod', 'discountBrl', 'subtotalBrl', 'totalBrl',
    'status', 'isDemo', 'items', 'createdAt', 'updatedAt',
  ];

  for (const key of Object.keys(payload)) {
    if (!allowed.has(key)) return { valid: false, reason: `Shadow field rejected: ${key}` };
  }
  for (const key of required) {
    if (!(key in payload)) return { valid: false, reason: `Missing required key: ${key}` };
  }
  if (!isValidBlueprintId(String(payload.id))) return { valid: false, reason: 'Invalid order id' };
  if (payload.userId !== authUid) return { valid: false, reason: 'Identity spoofing rejected' };
  if (payload.status !== 'demo_pending') return { valid: false, reason: 'Status shortcutting rejected' };
  if (!Array.isArray(payload.items) || payload.items.length < 1 || payload.items.length > 50) {
    return { valid: false, reason: 'Invalid items bounds' };
  }
  return { valid: true };
}

export function validateNewsletterPayload(payload: Record<string, unknown>): { valid: boolean; reason?: string } {
  const keys = Object.keys(payload);
  if (keys.length !== 4 || !['id', 'email', 'consent', 'createdAt'].every((k) => k in payload)) {
    return { valid: false, reason: 'Invalid newsletter keys' };
  }
  if (!isValidBlueprintId(String(payload.id))) return { valid: false, reason: 'Invalid subscriber id' };
  if (typeof payload.email !== 'string' || validateNewsletterEmail(payload.email, { enforceRequired: true }).status !== 'valid') {
    return { valid: false, reason: 'Invalid email' };
  }
  if (payload.consent !== true) return { valid: false, reason: 'Explicit consent required' };
  return { valid: true };
}

export function validateUserProfilePayload(
  payload: Record<string, unknown>,
  targetUserId: string,
  authUid: string | null,
  emailVerified: boolean,
  options?: { isAdmin?: boolean; mode?: 'create' | 'update' }
): { valid: boolean; reason?: string } {
  const isAdmin = Boolean(options?.isAdmin);
  const mode = options?.mode ?? 'create';

  if (!authUid || !emailVerified) {
    return { valid: false, reason: 'Authenticated verified user required' };
  }
  if (!isValidBlueprintId(targetUserId)) {
    return { valid: false, reason: 'Invalid target user id' };
  }
  if (authUid !== targetUserId && !isAdmin) {
    return { valid: false, reason: 'Cross-user profile access rejected' };
  }

  const allowed = new Set([
    'uid',
    'displayName',
    'email',
    'cpf',
    'phone',
    'status',
    'lastLoginAt',
    'createdAt',
    'updatedAt',
  ]);
  const required = ['uid', 'email', 'createdAt', 'updatedAt'];

  for (const key of Object.keys(payload)) {
    if (!allowed.has(key)) {
      return { valid: false, reason: `Shadow or sensitive field rejected: ${key}` };
    }
  }
  for (const key of required) {
    if (!(key in payload)) {
      return { valid: false, reason: `Missing required key: ${key}` };
    }
  }
  if (payload.uid !== targetUserId || !isValidBlueprintId(String(payload.uid))) {
    return { valid: false, reason: 'UID mismatch rejected' };
  }
  if (typeof payload.email !== 'string' || payload.email.length < 3 || payload.email.length > 160) {
    return { valid: false, reason: 'Invalid email' };
  }
  if ('displayName' in payload && (typeof payload.displayName !== 'string' || payload.displayName.length > 120)) {
    return { valid: false, reason: 'Invalid displayName' };
  }
  if ('cpf' in payload && (typeof payload.cpf !== 'string' || payload.cpf.length > 20)) {
    return { valid: false, reason: 'Invalid cpf' };
  }
  if ('phone' in payload && (typeof payload.phone !== 'string' || payload.phone.length > 30)) {
    return { valid: false, reason: 'Invalid phone' };
  }
  if ('status' in payload && payload.status !== 'active' && payload.status !== 'inactive') {
    return { valid: false, reason: 'Invalid account status' };
  }
  if (mode === 'create' && !isAdmin && 'status' in payload && payload.status !== 'active') {
    return { valid: false, reason: 'Self-registration must initialize as active' };
  }
  return { valid: true };
}

