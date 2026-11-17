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
  if (typeof payload.email !== 'string' || payload.email.length < 5 || payload.email.length > 160) {
    return { valid: false, reason: 'Invalid email' };
  }
  if (payload.consent !== true) return { valid: false, reason: 'Explicit consent required' };
  return { valid: true };
}
