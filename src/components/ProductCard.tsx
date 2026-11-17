import React, { useState } from 'react';
import type { Product } from '../types/store';
import { formatBrl } from '../utils/commerce';
import { OptimizedImage } from './OptimizedImage';

interface ProductCardProps {
  product: Product;
  onSelect: (slug: string) => void;
  priority?: boolean;
}

export const ProductCard: React.FC<ProductCardProps> = ({
  product,
  onSelect,
  priority = false,
}) => {
  const [hovered, setHovered] = useState(false);
  const [imgError, setImgError] = useState(false);

  const primaryImage = product.images[0];
  const secondaryImage = product.images[1] || product.images[0];
  const totalStock = product.sizes.reduce((sum, s) => sum + s.stock, 0);

  return (
    <article
      className="group flex flex-col"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
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
              onError={() => setImgError(true)}
              className={`absolute inset-0 w-full h-full transition-opacity duration-200 ${
                hovered && secondaryImage !== primaryImage ? 'opacity-0' : 'opacity-100'
              }`}
              imgClassName="w-full h-full object-cover object-center"
            />
            {secondaryImage !== primaryImage && (
              <OptimizedImage
                src={secondaryImage}
                alt={`${product.name} — ângulo alternativo`}
                sizes="card"
                disablePlaceholder
                className={`hidden md:block absolute inset-0 w-full h-full transition-opacity duration-200 ${
                  hovered ? 'opacity-100' : 'opacity-0'
                }`}
                imgClassName="w-full h-full object-cover object-center"
              />
            )}
          </>
        ) : (
          <div className="absolute inset-0 flex flex-col items-center justify-center p-4 text-center bg-[#EAE6DF]">
            <span className="font-mono-tabular text-[10px] uppercase tracking-[0.14em] text-[#99968F]">
              COMPLEX / {product.category}
            </span>
            <span className="mt-1 text-xs font-medium text-[#171717]/70">{product.name}</span>
          </div>
        )}

        {(product.isNew || totalStock === 0) && (
          <span className="absolute top-3 left-3 font-mono-tabular text-[10px] uppercase tracking-[0.14em] text-[#171717] bg-[#F1EEE8]/90 px-2 py-0.5">
            {totalStock === 0 ? 'Esgotado' : 'Novo'}
          </span>
        )}
      </button>

      <div className="pt-3 flex items-baseline justify-between gap-3">
        <button
          type="button"
          onClick={() => onSelect(product.slug)}
          className="text-left text-[15px] font-medium tracking-[-0.01em] text-[#171717] hover:underline underline-offset-4 truncate cursor-pointer"
        >
          {product.name}
        </button>
        <span className="font-mono-tabular text-[13px] text-[#171717] whitespace-nowrap shrink-0">
          {formatBrl(product.priceBrl)}
        </span>
      </div>

      <div className="mt-1 flex items-center justify-between gap-2 text-[12px] text-[#99968F]">
        <span className="truncate">
          {product.colors[0]?.name || product.category} / Unissex
        </span>
        <div className="flex items-center gap-1.5 shrink-0" aria-label="Cores disponíveis">
          {product.colors.slice(0, 4).map((color) => (
            <span
              key={color.name}
              title={color.name}
              className="w-2.5 h-2.5 border border-[#171717]/25"
              style={{ backgroundColor: color.hex }}
            />
          ))}
        </div>
      </div>
    </article>
  );
};
