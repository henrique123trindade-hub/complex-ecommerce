import { IMAGE_VARIANTS, type ImageAssetVariant, type ImageWidthVariant } from '../data/imageVariants';

export type ResponsiveSizesPreset = 'hero' | 'card' | 'split' | 'gallery' | 'thumb';

const SIZES_MAP: Record<ResponsiveSizesPreset, string> = {
  hero: '100vw',
  card: '(min-width: 1024px) 25vw, 50vw',
  split: '(min-width: 1024px) 50vw, 100vw',
  gallery: '(min-width: 1024px) 30vw, 100vw',
  thumb: '96px',
};

const OPTIMIZED_URL_INDEX: Record<string, ImageAssetVariant> = (() => {
  const index: Record<string, ImageAssetVariant> = {};
  for (const [key, variant] of Object.entries(IMAGE_VARIANTS)) {
    index[key] = variant;
    index[variant.webpSrc] = variant;
    index[variant.fallbackSrc] = variant;
    for (const v of variant.variants) {
      index[v.url] = variant;
    }
    if (variant.avifVariants) {
      for (const v of variant.avifVariants) {
        index[v.url] = variant;
      }
    }
  }
  return index;
})();

export function normalizeImageKey(src: string | undefined): string {
  if (!src) return '';
  const withoutHash = src.split('#')[0];
  const withoutQuery = withoutHash.split('?')[0];
  if (withoutQuery.startsWith('http://') || withoutQuery.startsWith('https://')) {
    try {
      const parsed = new URL(withoutQuery);
      return parsed.pathname;
    } catch {
      return withoutQuery;
    }
  }
  return withoutQuery.startsWith('/') ? withoutQuery : `/${withoutQuery}`;
}

export function getImageVariant(src: string | undefined): ImageAssetVariant | null {
  if (!src || shouldBypassProgressiveBlur(src)) return null;
  const key = normalizeImageKey(src);
  return OPTIMIZED_URL_INDEX[key] || null;
}

export function buildSrcSet(variants: ImageWidthVariant[]): string {
  if (!Array.isArray(variants) || variants.length === 0) return '';
  return [...variants]
    .sort((a, b) => a.width - b.width)
    .map((v) => `${v.url} ${v.width}w`)
    .join(', ');
}

export function resolveResponsiveSizes(sizes?: ResponsiveSizesPreset | string): string {
  if (!sizes) return SIZES_MAP.card;
  if (sizes in SIZES_MAP) {
    return SIZES_MAP[sizes as ResponsiveSizesPreset];
  }
  return sizes;
}

export function getOptimizedFallbackUrl(src: string | undefined): string {
  if (!src) return '';
  const variant = getImageVariant(src);
  return variant ? variant.fallbackSrc : src;
}

export function shouldBypassProgressiveBlur(src: string | undefined): boolean {
  if (!src) return true;
  return src.startsWith('data:') || src.startsWith('blob:');
}
