import { DEFAULT_EDITORIAL } from '../data/seedCatalog';
import type { CategoryItem, EditorialConfig, OrderItem, OrderRecord, Product } from '../types/store';

export const LEGACY_IMAGE_MAP: Record<string, string> = {
  '/assets/aistudio/image_e60999db.png': DEFAULT_EDITORIAL.heroDesktopImage,
  '/src/assets/images/hero_mobile_campaign_1794952246363.jpg':
    DEFAULT_EDITORIAL.heroMobileImage,
  '/src/assets/images/editorial_urban_tee_1794952249745.jpg':
    DEFAULT_EDITORIAL.campaignImage,
  '/assets/aistudio/image_340e3e49.png': DEFAULT_EDITORIAL.storyImage,
  '/src/assets/images/campaign_night_lifestyle_1794952250620.jpg':
    '/src/assets/images/optimized/complex_campaign_dusk_4_87617fd1-1672w.webp',
  '/assets/aistudio/Imagem_do_ChatGPT_17_de_nov._de_2026__20_02_47-1_5292459e.png':
    '/src/assets/images/optimized/complex_campaign_1_5292459e-1672w.webp',
  '/assets/aistudio/Imagem_do_ChatGPT_17_de_nov._de_2026__20_02_48-2_ca8505d2.png':
    '/src/assets/images/optimized/complex_model_tee_2_ca8505d2-1122w.webp',
  '/assets/aistudio/Imagem_do_ChatGPT_17_de_nov._de_2026__20_02_48-3_41227f9c.png':
    '/src/assets/images/optimized/complex_model_hoodie_3_41227f9c-1122w.webp',
  '/assets/aistudio/Imagem_do_ChatGPT_17_de_nov._de_2026__20_02_49-4_87617fd1.png':
    '/src/assets/images/optimized/complex_campaign_dusk_4_87617fd1-1672w.webp',
  '/assets/aistudio/image_2e7943ba.png': '/src/assets/images/optimized/image_2e7943ba-786w.webp',
  '/assets/images/product_detail_cotton_1794952250261.jpg':
    '/src/assets/images/optimized/product_detail_cotton_1794952250261-1200w.webp',
  '/assets/images/product_boxy_tee_front_1794952251135.jpg':
    '/src/assets/images/optimized/product_boxy_tee_front_1794952251135-896w.webp',
  '/assets/images/product_boxy_tee_back_1794952252777.jpg':
    '/src/assets/images/optimized/product_boxy_tee_back_1794952252777-896w.webp',
  '/assets/images/product_tee_bone_1794952275758.jpg':
    '/src/assets/images/optimized/product_tee_bone_1794952275758-896w.webp',
  '/assets/images/product_hoodie_taupe_1794952251370.jpg':
    '/src/assets/images/optimized/product_hoodie_taupe_1794952251370-896w.webp',
  '/assets/images/product_hoodie_charcoal_1794952276198.jpg':
    '/src/assets/images/optimized/product_hoodie_charcoal_1794952276198-896w.webp',
  '/assets/images/product_crewneck_olive_1794952278742.jpg':
    '/src/assets/images/optimized/product_crewneck_olive_1794952278742-896w.webp',
  '/assets/images/product_cargo_olive_1794952252317.jpg':
    '/src/assets/images/optimized/product_cargo_olive_1794952252317-896w.webp',
  '/assets/images/product_denim_wide_1794952276236.jpg':
    '/src/assets/images/optimized/product_denim_wide_1794952276236-896w.webp',
  '/assets/images/product_jacket_shell_1794952276902.jpg':
    '/src/assets/images/optimized/product_jacket_shell_1794952276902-896w.webp',
  '/assets/images/product_accessories_cap_1794952253579.jpg':
    '/src/assets/images/optimized/product_accessories_cap_1794952253579-896w.webp',
};

export function mapLegacyUrl(url: string): string {
  return LEGACY_IMAGE_MAP[url] || url;
}

export function normalizeProductRecord(data: Product): Product {
  return {
    ...data,
    images: Array.isArray(data.images) ? data.images.map(mapLegacyUrl) : [],
    colors: Array.isArray(data.colors)
      ? data.colors.map((c) => ({
          ...c,
          images: Array.isArray(c.images) ? c.images.map(mapLegacyUrl) : [],
        }))
      : [],
  };
}

export function normalizeCategoryRecord(data: CategoryItem): CategoryItem {
  return {
    ...data,
    image: data.image ? mapLegacyUrl(data.image) : data.image,
  };
}

export function normalizeEditorialRecord(rawEd: Partial<EditorialConfig>): EditorialConfig {
  const normalizedEd: Partial<EditorialConfig> = {
    ...rawEd,
    heroTitle: rawEd.heroTitle === 'NEW PERSPECTIVE.' ? 'NOVA PERSPECTIVA.' : rawEd.heroTitle,
    campaignTitle:
      rawEd.campaignTitle === 'BUILT FOR EVERYDAY.'
        ? 'FEITO PARA O DIA A DIA.'
        : rawEd.campaignTitle,
    heroDesktopImage: rawEd.heroDesktopImage
      ? mapLegacyUrl(rawEd.heroDesktopImage)
      : DEFAULT_EDITORIAL.heroDesktopImage,
    heroMobileImage: rawEd.heroMobileImage
      ? mapLegacyUrl(rawEd.heroMobileImage)
      : DEFAULT_EDITORIAL.heroMobileImage,
    campaignImage: rawEd.campaignImage
      ? mapLegacyUrl(rawEd.campaignImage)
      : DEFAULT_EDITORIAL.campaignImage,
    storyImage: rawEd.storyImage
      ? mapLegacyUrl(rawEd.storyImage)
      : DEFAULT_EDITORIAL.storyImage,
    shippingNote:
      typeof rawEd.shippingNote === 'string' &&
      rawEd.shippingNote.trim() &&
      !/painel administrativo/i.test(rawEd.shippingNote)
        ? rawEd.shippingNote
        : DEFAULT_EDITORIAL.shippingNote,
    returnsNote:
      typeof rawEd.returnsNote === 'string' &&
      rawEd.returnsNote.trim() &&
      !/painel administrativo/i.test(rawEd.returnsNote)
        ? rawEd.returnsNote
        : DEFAULT_EDITORIAL.returnsNote,
  };
  return { ...DEFAULT_EDITORIAL, ...normalizedEd };
}

export function normalizeFirestoreTimestamp(value: unknown, fallbackIso?: string): string {
  if (value && typeof (value as { toDate?: () => Date }).toDate === 'function') {
    return (value as { toDate: () => Date }).toDate().toISOString();
  }
  if (typeof value === 'string' && value.trim()) {
    return value;
  }
  return fallbackIso || new Date().toISOString();
}

export function normalizeOrderRecord(raw: Record<string, unknown>): OrderRecord {
  const fallbackNow = new Date().toISOString();
  return {
    ...(raw as unknown as OrderRecord),
    createdAt: normalizeFirestoreTimestamp(raw.createdAt, fallbackNow),
    updatedAt: normalizeFirestoreTimestamp(raw.updatedAt, fallbackNow),
  };
}

export interface SanitizedOrderResult {
  ok: true;
  order: OrderRecord & { paymentGatewayStatus: 'DEMO_MODE_NO_CHARGE' };
}

export interface SanitizedOrderError {
  ok: false;
  error: string;
}

const SAFE_ID_REGEX = /^[a-zA-Z0-9_-]{1,128}$/;
const SIMPLE_EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

/**
 * Validates and constructs a clean server-side demo order payload, preventing
 * client-side field injection or malformed financial totals.
 */
export function sanitizeServerOrderPayload(
  body: Record<string, unknown> | null | undefined,
  nowIso = new Date().toISOString()
): SanitizedOrderResult | SanitizedOrderError {
  if (!body || typeof body !== 'object') {
    return { ok: false, error: 'Payload do pedido inválido.' };
  }

  const customerName = typeof body.customerName === 'string' ? body.customerName.trim() : '';
  const customerEmail = typeof body.customerEmail === 'string' ? body.customerEmail.trim() : '';
  if (customerName.length < 2 || customerName.length > 120 || !SIMPLE_EMAIL_REGEX.test(customerEmail)) {
    return { ok: false, error: 'Dados do cliente obrigatórios e válidos.' };
  }

  if (!Array.isArray(body.items) || body.items.length === 0 || body.items.length > 50) {
    return { ok: false, error: 'Carrinho vazio ou inválido.' };
  }

  const sanitizedItems: OrderItem[] = [];
  for (const rawItem of body.items) {
    if (!rawItem || typeof rawItem !== 'object') {
      return { ok: false, error: 'Item do pedido inválido.' };
    }
    const item = rawItem as Record<string, unknown>;
    const quantity = Number(item.quantity);
    const unitPriceBrl = Number(item.unitPriceBrl);
    if (!Number.isInteger(quantity) || quantity < 1 || quantity > 99) {
      return { ok: false, error: 'Quantidade inválida no pedido.' };
    }
    if (!Number.isFinite(unitPriceBrl) || unitPriceBrl <= 0 || unitPriceBrl > 100000) {
      return { ok: false, error: 'Preço unitário inválido no pedido.' };
    }
    sanitizedItems.push({
      productId: String(item.productId || '').slice(0, 128),
      slug: String(item.slug || '').slice(0, 128),
      name: String(item.name || '').slice(0, 140),
      colorName: String(item.colorName || 'Padrão').slice(0, 60),
      size: String(item.size || 'Único').slice(0, 20),
      sku: String(item.sku || '').slice(0, 64),
      quantity,
      unitPriceBrl: Number(unitPriceBrl.toFixed(2)),
      image: String(item.image || '').slice(0, 500),
    });
  }

  const rawAddress = (body.shippingAddress || {}) as Record<string, unknown>;
  const shippingAddress = {
    recipientName: String(rawAddress.recipientName || customerName).trim().slice(0, 120),
    cep: String(rawAddress.cep || '').trim().slice(0, 12),
    street: String(rawAddress.street || '').trim().slice(0, 160),
    number: String(rawAddress.number || '').trim().slice(0, 20),
    complement: String(rawAddress.complement || '').trim().slice(0, 80),
    neighborhood: String(rawAddress.neighborhood || '').trim().slice(0, 100),
    city: String(rawAddress.city || '').trim().slice(0, 100),
    state: String(rawAddress.state || '').trim().toUpperCase().slice(0, 2),
  };

  if (!shippingAddress.cep || !shippingAddress.street || !shippingAddress.city || shippingAddress.state.length !== 2) {
    return { ok: false, error: 'Endereço de entrega incompleto.' };
  }

  const subtotalBrl = Number(
    sanitizedItems.reduce((sum, item) => sum + item.unitPriceBrl * item.quantity, 0).toFixed(2)
  );
  const rawShipping = Number(body.shippingCostBrl ?? 0);
  const shippingCostBrl = Number.isFinite(rawShipping) && rawShipping >= 0 && rawShipping <= 5000
    ? Number(rawShipping.toFixed(2))
    : 0;
  const rawDiscount = Number(body.discountBrl ?? 0);
  const discountBrl = Number.isFinite(rawDiscount) && rawDiscount >= 0
    ? Number(Math.min(rawDiscount, subtotalBrl).toFixed(2))
    : 0;
  const totalBrl = Number(Math.max(0, subtotalBrl - discountBrl + shippingCostBrl).toFixed(2));

  const rawId = typeof body.id === 'string' && SAFE_ID_REGEX.test(body.id) ? body.id : `ord-${Date.now()}`;
  const rawOrderNumber =
    typeof body.orderNumber === 'string' && body.orderNumber.trim().length >= 3 && body.orderNumber.trim().length <= 32
      ? body.orderNumber.trim()
      : `CMP-${Math.floor(10000 + Math.random() * 90000)}`;
  const paymentMethod = body.paymentMethod === 'cartao' ? 'cartao' : 'pix';
  const couponCode =
    typeof body.couponCode === 'string' && body.couponCode.trim()
      ? body.couponCode.trim().toUpperCase().slice(0, 40)
      : undefined;
  const customerCpf =
    typeof body.customerCpf === 'string' && body.customerCpf.trim()
      ? body.customerCpf.trim().slice(0, 20)
      : undefined;

  return {
    ok: true,
    order: {
      id: rawId,
      orderNumber: rawOrderNumber,
      userId:
        typeof body.userId === 'string' && SAFE_ID_REGEX.test(body.userId)
          ? body.userId
          : 'guest-demo',
      customerName,
      customerEmail,
      ...(customerCpf ? { customerCpf } : {}),
      shippingAddress,
      shippingMethod: String(body.shippingMethod || 'Envio Padrão (Estimativa Demo)').slice(0, 80),
      shippingCostBrl,
      paymentMethod,
      ...(couponCode ? { couponCode } : {}),
      discountBrl,
      subtotalBrl,
      totalBrl,
      status: 'demo_pending',
      isDemo: true,
      paymentGatewayStatus: 'DEMO_MODE_NO_CHARGE',
      items: sanitizedItems,
      createdAt: nowIso,
      updatedAt: nowIso,
    },
  };
}
