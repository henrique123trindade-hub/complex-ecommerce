import React, { useState } from 'react';
import type { Product } from '../types/store';
import { formatBrl, getCategoryLabel } from '../utils/commerce';
import { OptimizedImage } from './OptimizedImage';

interface ProductCardProps {
  product: Product;
  onSelect: (slug: string) => void;
  priority?: boolean;
  eager?: boolean;
}

export const ProductCard: React.FC<ProductCardProps> = React.memo(
  ({ product, onSelect, priority = false, eager = false }) => {
    const [hovered, setHovered] = useState(false);
    const [preloadSecondary, setPreloadSecondary] = useState(false);
    const [imgError, setImgError] = useState(false);

    const primaryImage = product.images[0];
    const secondaryImage = product.images[1] || product.images[0];
    const totalStock = product.sizes.reduce((sum, s) => sum + s.stock, 0);

    const activateHover = () => {
      setPreloadSecondary(true);
      setHovered(true);
    };

    return (
      <article
        className="group flex flex-col"
        onMouseEnter={activateHover}
        onMouseLeave={() => setHovered(false)}
        onFocus={() => setPreloadSecondary(true)}
      >
        <button
          type="button"
          onClick={() => onSelect(product.slug)}
          className="relative aspect-[3/4] w-full overflow-hidden bg-[#EAE6DF] text-left cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#171717]"
          aria-label={`${product.name} — ${formatBrl(product.priceBrl)}`}
        >
          {!imgError && primaryImage ? (
            <>
              <OptimizedImage
                src={primaryImage}
                alt={product.name}
                sizes="card"
                priority={priority}
                eager={eager}
                onError={() => setImgError(true)}
                className={`absolute inset-0 w-full h-full product-hover-zoom ${
                  hovered && secondaryImage !== primaryImage
                    ? 'opacity-0 scale-[1.02] motion-reduce:scale-100'
                    : 'opacity-100 group-hover:scale-[1.02] motion-reduce:group-hover:scale-100'
                }`}
                imgClassName="w-full h-full object-cover object-[50%_18%]"
              />
              {secondaryImage !== primaryImage && preloadSecondary && (
                <OptimizedImage
                  src={secondaryImage}
                  alt={`${product.name} — ângulo alternativo`}
                  sizes="card"
                  eager
                  disablePlaceholder
                  className={`hidden md:block absolute inset-0 w-full h-full product-hover-zoom ${
                    hovered
                      ? 'opacity-100 scale-100'
                      : 'opacity-0 scale-[1.015] motion-reduce:scale-100'
                  }`}
                  imgClassName="w-full h-full object-cover object-[50%_18%]"
                />
              )}
            </>
          ) : (
            <div className="absolute inset-0 flex flex-col items-center justify-center p-4 text-center bg-[#EAE6DF]">
              <span className="font-mono-tabular text-[10px] uppercase tracking-[0.14em] text-[#99968F]">
                COMPLEX / {getCategoryLabel(product.category)}
              </span>
              <span className="mt-1 text-xs font-medium text-[#171717]/70">{product.name}</span>
            </div>
          )}

          {(product.isNew || totalStock === 0) && (
            <span className="absolute top-3 left-3 font-mono-tabular text-[10px] uppercase tracking-[0.14em] text-[#171717] bg-[#F1EEE8]/90 px-2 py-0.5 transition-transform duration-200 ease-out group-hover:translate-x-0.5 motion-reduce:transition-none motion-reduce:group-hover:translate-x-0">
              {totalStock === 0 ? 'Esgotado' : 'Novo'}
            </span>
          )}

          <span
            aria-hidden="true"
            className="product-hover-rule absolute inset-x-0 bottom-0 h-[2px] bg-[#171717] pointer-events-none"
          />
        </button>

        <div className="pt-3 flex items-baseline justify-between gap-3">
          <button
            type="button"
            onClick={() => onSelect(product.slug)}
            className="text-left text-[15px] font-medium tracking-[-0.01em] text-[#171717] transition-opacity duration-200 ease-out group-hover:underline underline-offset-4 truncate cursor-pointer motion-reduce:transition-none"
          >
            {product.name}
          </button>
          <span className="font-mono-tabular text-[13px] text-[#171717]/90 group-hover:text-[#171717] transition-colors duration-200 ease-out whitespace-nowrap shrink-0 motion-reduce:transition-none">
            {formatBrl(product.priceBrl)}
          </span>
        </div>

        <div className="mt-1 flex items-center justify-between gap-2 text-[12px] text-[#99968F]">
          <span className="truncate transition-colors duration-200 ease-out group-hover:text-[#171717]/75 motion-reduce:transition-none">
            {product.colors[0]?.name || getCategoryLabel(product.category)} / Unissex
          </span>
          <div className="flex items-center gap-1.5 shrink-0" aria-label="Cores disponíveis">
            {product.colors.slice(0, 4).map((color) => (
              <span
                key={color.name}
                title={color.name}
                className="w-2.5 h-2.5 border border-[#171717]/25 transition-transform duration-200 ease-out group-hover:border-[#171717]/55 group-hover:scale-110 motion-reduce:transition-none motion-reduce:group-hover:scale-100"
                style={{ backgroundColor: color.hex }}
              />
            ))}
          </div>
        </div>
      </article>
    );
  }
);
ProductCard.displayName = 'ProductCard';

