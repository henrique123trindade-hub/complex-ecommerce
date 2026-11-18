import type { CategorySlug, Product } from '../types/store';
import { getCategoryLabel } from './commerce';
import { getOptimizedFallbackUrl } from './image';

export interface BreadcrumbEntry {
  label: string;
  path: string;
}

export function buildShopBreadcrumbs(category: CategorySlug | 'ALL'): BreadcrumbEntry[] {
  const trail: BreadcrumbEntry[] = [
    { label: 'Início', path: '/' },
    { label: 'Loja', path: '/shop' },
  ];

  if (category !== 'ALL') {
    trail.push({
      label: getCategoryLabel(category),
      path: `/shop?category=${encodeURIComponent(category)}`,
    });
  }

  return trail;
}

export function buildProductBreadcrumbs(
  product: Pick<Product, 'name' | 'slug' | 'category'>
): BreadcrumbEntry[] {
  return [
    { label: 'Início', path: '/' },
    { label: 'Loja', path: '/shop' },
    {
      label: getCategoryLabel(product.category),
      path: `/shop?category=${encodeURIComponent(product.category)}`,
    },
    {
      label: product.name,
      path: `/product/${product.slug}`,
    },
  ];
}

export function toAbsoluteSiteUrl(path: string, origin: string): string {
  if (!path) return origin;
  if (path.startsWith('http://') || path.startsWith('https://')) return path;
  const cleanOrigin = origin.replace(/\/+$/, '');
  const cleanPath = path.startsWith('/') ? path : `/${path}`;
  return `${cleanOrigin}${cleanPath}`;
}

export function buildBreadcrumbJsonLd(items: BreadcrumbEntry[], origin: string) {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((entry, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: entry.label,
      item: toAbsoluteSiteUrl(entry.path, origin),
    })),
  };
}

export function buildProductJsonLd(product: Product, origin: string) {
  const hasStock = product.sizes.some((s) => s.stock > 0);
  const imageUrls = product.images
    .map((img) => getOptimizedFallbackUrl(img))
    .filter(Boolean)
    .map((img) => toAbsoluteSiteUrl(img, origin));

  return {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: product.name,
    description: product.description,
    sku: product.id,
    category: getCategoryLabel(product.category),
    brand: {
      '@type': 'Brand',
      name: 'COMPLEX',
    },
    image: imageUrls,
    offers: {
      '@type': 'Offer',
      url: toAbsoluteSiteUrl(`/product/${product.slug}`, origin),
      priceCurrency: 'BRL',
      price: product.priceBrl.toFixed(2),
      availability: hasStock
        ? 'https://schema.org/InStock'
        : 'https://schema.org/OutOfStock',
      itemCondition: 'https://schema.org/NewCondition',
    },
  };
}
