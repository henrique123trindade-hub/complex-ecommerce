import type { CartItem, CatalogFilters, Product, ShippingQuote } from '../types/store';

export function formatBrl(value: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

export function normalizeDigits(raw: string): string {
  return raw.replace(/\D/g, '');
}

export function formatCep(raw: string): string {
  const digits = normalizeDigits(raw).slice(0, 8);
  if (digits.length <= 5) return digits;
  return `${digits.slice(0, 5)}-${digits.slice(5)}`;
}

export function validateCep(cep: string): boolean {
  return normalizeDigits(cep).length === 8;
}

export function formatCpf(raw: string): string {
  const digits = normalizeDigits(raw).slice(0, 11);
  if (digits.length <= 3) return digits;
  if (digits.length <= 6) return `${digits.slice(0, 3)}.${digits.slice(3)}`;
  if (digits.length <= 9) return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6)}`;
  return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6, 9)}-${digits.slice(9)}`;
}

export function validateCpf(cpf: string): boolean {
  const digits = normalizeDigits(cpf);
  if (digits.length !== 11) return false;
  if (/^(\d)\1{10}$/.test(digits)) return false;

  let sum = 0;
  for (let i = 0; i < 9; i++) {
    sum += Number(digits[i]) * (10 - i);
  }
  let remainder = (sum * 10) % 11;
  if (remainder === 10 || remainder === 11) remainder = 0;
  if (remainder !== Number(digits[9])) return false;

  sum = 0;
  for (let i = 0; i < 10; i++) {
    sum += Number(digits[i]) * (11 - i);
  }
  remainder = (sum * 10) % 11;
  if (remainder === 10 || remainder === 11) remainder = 0;
  return remainder === Number(digits[10]);
}

export function calculateShippingQuotes(cep: string, subtotalBrl: number): ShippingQuote[] {
  const digits = normalizeDigits(cep);
  if (digits.length !== 8) {
    return [];
  }

  const firstDigit = Number(digits[0]);
  const isSoutheast = firstDigit >= 0 && firstDigit <= 3;
  const isSouthOrMidwest = firstDigit === 7 || firstDigit === 8 || firstDigit === 9;

  const basePac = isSoutheast ? 24 : isSouthOrMidwest ? 34 : 46;
  const baseSedex = isSoutheast ? 42 : isSouthOrMidwest ? 62 : 84;
  const pacDays = isSoutheast ? '4 a 6 dias úteis' : isSouthOrMidwest ? '6 a 9 dias úteis' : '8 a 12 dias úteis';
  const sedexDays = isSoutheast ? '1 a 3 dias úteis' : isSouthOrMidwest ? '2 a 4 dias úteis' : '3 a 6 dias úteis';

  const freeStandardEligible = subtotalBrl >= 550;

  return [
    {
      id: 'pac',
      label: freeStandardEligible ? 'Envio Padrão (Cortesia — Estimativa Demo)' : 'Envio Padrão PAC (Estimativa Demo)',
      carrier: 'Correios PAC',
      estimatedDays: pacDays,
      priceBrl: freeStandardEligible ? 0 : basePac,
    },
    {
      id: 'sedex',
      label: 'Envio Expresso Sedex (Estimativa Demo)',
      carrier: 'Correios Sedex',
      estimatedDays: sedexDays,
      priceBrl: baseSedex,
    },
  ];
}

export function calculateCartTotals(
  items: CartItem[],
  shippingCostBrl: number,
  discountPercent = 0,
  minOrderBrl = 0
): {
  subtotalBrl: number;
  discountBrl: number;
  shippingCostBrl: number;
  totalBrl: number;
  itemCount: number;
} {
  const subtotalBrl = items.reduce((acc, item) => acc + item.priceBrl * item.quantity, 0);
  const itemCount = items.reduce((acc, item) => acc + item.quantity, 0);
  const couponValid = discountPercent > 0 && subtotalBrl >= minOrderBrl;
  const discountBrl = couponValid ? Number(((subtotalBrl * discountPercent) / 100).toFixed(2)) : 0;
  const normalizedShipping = Math.max(0, shippingCostBrl);
  const totalBrl = Math.max(0, Number((subtotalBrl - discountBrl + normalizedShipping).toFixed(2)));

  return {
    subtotalBrl: Number(subtotalBrl.toFixed(2)),
    discountBrl,
    shippingCostBrl: normalizedShipping,
    totalBrl,
    itemCount,
  };
}

export function getVariantStock(product: Product, size: string): number {
  const found = product.sizes.find((entry) => entry.size === size);
  return found ? Math.max(0, found.stock) : 0;
}

export function isSizeAvailable(product: Product, size: string): boolean {
  return getVariantStock(product, size) > 0;
}

export function clampQuantityForStock(desired: number, stock: number): number {
  if (stock <= 0) return 0;
  return Math.max(1, Math.min(desired, stock));
}

export function filterAndSortProducts(products: Product[], filters: CatalogFilters): Product[] {
  const query = filters.query.trim().toLowerCase();

  const filtered = products.filter((product) => {
    if (!product.active) return false;
    if (filters.category !== 'ALL' && product.category !== filters.category) return false;

    if (filters.size !== 'ALL') {
      const sizeEntry = product.sizes.find((s) => s.size === filters.size);
      if (!sizeEntry || sizeEntry.stock <= 0) return false;
    }

    if (filters.color !== 'ALL') {
      const hasColor = product.colors.some(
        (c) => c.name.toLowerCase() === filters.color.toLowerCase()
      );
      if (!hasColor) return false;
    }

    if (filters.maxPrice !== null && product.priceBrl > filters.maxPrice) {
      return false;
    }

    if (query) {
      const searchable = `${product.name} ${product.category} ${product.collection} ${product.description} ${product.colors.map((c) => c.name).join(' ')}`.toLowerCase();
      if (!searchable.includes(query)) return false;
    }

    return true;
  });

  const sorted = [...filtered];
  if (filters.sort === 'price-asc') {
    sorted.sort((a, b) => a.priceBrl - b.priceBrl);
  } else if (filters.sort === 'price-desc') {
    sorted.sort((a, b) => b.priceBrl - a.priceBrl);
  } else {
    sorted.sort((a, b) => Number(b.isNew) - Number(a.isNew));
  }

  return sorted;
}
