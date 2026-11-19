import React, { useEffect, useRef, useState } from 'react';
import { Check } from 'lucide-react';
import { useCart } from '../context/StoreContext';
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
    const { addToCart } = useCart();
    const [hovered, setHovered] = useState(false);
    const [preloadSecondary, setPreloadSecondary] = useState(false);
    const [imgError, setImgError] = useState(false);
    const [justAddedSize, setJustAddedSize] = useState<string | null>(null);
    const addedTimerRef = useRef<number | null>(null);

    useEffect(() => {
      return () => {
        if (addedTimerRef.current !== null) {
          window.clearTimeout(addedTimerRef.current);
        }
      };
    }, []);

    const primaryImage = product.images[0];
    const secondaryImage = product.images[1] || product.images[0];
    const totalStock = product.sizes.reduce((sum, s) => sum + s.stock, 0);
    const isSoldOut = totalStock === 0;
    const defaultColorName = product.colors[0]?.name || 'Padrão';

    const activateHover = () => {
      setPreloadSecondary(true);
      setHovered(true);
    };

    const handleQuickAdd = (e: React.MouseEvent, size: string) => {
      e.stopPropagation();
      addToCart(product, defaultColorName, size, 1, { openDrawer: false });
      setJustAddedSize(size);
      if (addedTimerRef.current !== null) {
        window.clearTimeout(addedTimerRef.current);
      }
      addedTimerRef.current = window.setTimeout(() => {
        setJustAddedSize(null);
        addedTimerRef.current = null;
      }, 1300);
    };

    return (
      <article
        className="group flex flex-col"
        onMouseEnter={activateHover}
        onMouseLeave={() => setHovered(false)}
        onFocus={() => setPreloadSecondary(true)}
      >
        <div className="relative aspect-[3/4] w-full overflow-hidden bg-[#EAE6DF]">
          <button
            type="button"
            onClick={() => onSelect(product.slug)}
            className="relative block w-full h-full text-left cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#171717]"
            aria-label={`${product.name} — ${formatBrl(product.priceBrl)}${isSoldOut ? ' (Esgotado)' : ''}`}
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
                    isSoldOut ? 'grayscale-[25%] opacity-85' : ''
                  } ${
                    hovered && secondaryImage !== primaryImage
                      ? 'opacity-0 scale-[1.025] motion-reduce:scale-100'
                      : 'opacity-100 group-hover:scale-[1.03] motion-reduce:group-hover:scale-100'
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
                      isSoldOut ? 'grayscale-[25%] opacity-85' : ''
                    } ${
                      hovered
                        ? 'opacity-100 scale-100'
                        : 'opacity-0 scale-[1.02] motion-reduce:scale-100'
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

            {(product.isNew || isSoldOut) && (
              <span
                className={`absolute top-3 left-3 font-mono-tabular text-[10px] uppercase tracking-[0.14em] px-2 py-0.5 transition-transform duration-200 ease-out group-hover:translate-x-0.5 motion-reduce:transition-none motion-reduce:group-hover:translate-x-0 ${
                  isSoldOut
                    ? 'bg-[#171717] text-[#F1EEE8]'
                    : 'bg-[#F1EEE8]/92 text-[#171717]'
                }`}
              >
                {isSoldOut ? 'Esgotado' : 'Novo'}
              </span>
            )}
          </button>

          {/* Desktop Editorial Quick-Add Bar (appears smoothly on hover/focus) */}
          {!isSoldOut && (
            <div
              className="quick-add-shelf hidden md:block absolute inset-x-0 bottom-[2px] bg-[#F1EEE8]/94 backdrop-blur-sm border-t border-[#171717]/12 px-3 py-2.5"
              aria-label={`Adição rápida — ${product.name}`}
            >
              {justAddedSize ? (
                <div className="flex items-center justify-center gap-1.5 py-0.5 font-mono-tabular text-[10px] uppercase tracking-[0.14em] text-[#6A705C]">
                  <Check className="w-3.5 h-3.5" strokeWidth={2} />
                  <span>Tam {justAddedSize} adicionado</span>
                </div>
              ) : (
                <div className="space-y-1.5">
                  <p className="font-mono-tabular text-[9px] uppercase tracking-[0.16em] text-[#99968F] text-center">
                    Adição rápida
                  </p>
                  <div className="flex items-center justify-center flex-wrap gap-1">
                    {product.sizes.map((variant) => {
                      const unavailable = variant.stock <= 0;
                      return (
                        <button
                          key={variant.size}
                          type="button"
                          disabled={unavailable}
                          onClick={(e) => handleQuickAdd(e, variant.size)}
                          aria-label={`Adicionar ${product.name} tamanho ${variant.size} à sacola`}
                          className={`min-w-[28px] h-7 px-1.5 font-mono-tabular text-[10px] uppercase border transition-colors duration-150 ${
                            unavailable
                              ? 'border-[#171717]/10 text-[#99968F]/60 line-through cursor-not-allowed'
                              : 'border-[#171717]/20 text-[#171717] hover:bg-[#171717] hover:text-[#F1EEE8] hover:border-[#171717] cursor-pointer'
                          }`}
                        >
                          {variant.size}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}

          <span
            aria-hidden="true"
            className="product-hover-rule absolute inset-x-0 bottom-0 h-[2px] bg-[#171717] pointer-events-none"
          />
        </div>

        <div className="pt-3 flex items-baseline justify-between gap-3">
          <button
            type="button"
            onClick={() => onSelect(product.slug)}
            className="text-left text-[15px] font-medium tracking-[-0.01em] text-[#171717] transition-opacity duration-200 ease-out group-hover:underline underline-offset-4 truncate cursor-pointer motion-reduce:transition-none"
          >
            {product.name}
          </button>
          <span
            className={`font-mono-tabular text-[13px] transition-colors duration-200 ease-out whitespace-nowrap shrink-0 motion-reduce:transition-none ${
              isSoldOut
                ? 'text-[#99968F]'
                : 'text-[#171717]/90 group-hover:text-[#171717]'
            }`}
          >
            {formatBrl(product.priceBrl)}
          </span>
        </div>

        <div className="mt-1 flex items-center justify-between gap-2 text-[12px] text-[#99968F]">
          <span className="truncate transition-colors duration-200 ease-out group-hover:text-[#171717]/75 motion-reduce:transition-none">
            {isSoldOut
              ? 'Indisponível no momento'
              : `${product.colors[0]?.name || getCategoryLabel(product.category)} / Unissex`}
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
