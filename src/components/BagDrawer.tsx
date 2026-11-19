import React, { useEffect, useState } from 'react';
import { Minus, Plus, Trash2, X } from 'lucide-react';
import { useStore } from '../context/StoreContext';
import { formatBrl } from '../utils/commerce';
import { OptimizedImage } from './OptimizedImage';

interface BagDrawerProps {
  onNavigate: (path: string) => void;
}

export const BagDrawer: React.FC<BagDrawerProps> = ({ onNavigate }) => {
  const {
    cart,
    cartCount,
    cartSubtotal,
    isBagOpen,
    closeBag,
    updateCartQuantity,
    removeFromCart,
  } = useStore();

  const [mounted, setMounted] = useState(false);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const prefersReducedMotion =
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    if (isBagOpen) {
      setMounted(true);
      if (prefersReducedMotion) {
        setVisible(true);
        return;
      }
      let raf2 = 0;
      const raf1 = window.requestAnimationFrame(() => {
        raf2 = window.requestAnimationFrame(() => {
          setVisible(true);
        });
      });
      return () => {
        window.cancelAnimationFrame(raf1);
        if (raf2) window.cancelAnimationFrame(raf2);
      };
    }

    if (mounted) {
      if (prefersReducedMotion) {
        setVisible(false);
        setMounted(false);
        return;
      }
      setVisible(false);
      const timer = window.setTimeout(() => {
        setMounted(false);
      }, 320);
      return () => window.clearTimeout(timer);
    }
  }, [isBagOpen, mounted]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isBagOpen) closeBag();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isBagOpen, closeBag]);

  useEffect(() => {
    if (!mounted) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [mounted]);

  if (!mounted) return null;

  const go = (path: string) => {
    closeBag();
    onNavigate(path);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex justify-end overflow-hidden"
      role="dialog"
      aria-modal="true"
      aria-label="Sacola de compras"
      data-state={visible ? 'open' : 'closed'}
    >
      <div
        className={`bag-backdrop fixed inset-0 bg-[#171717]/40 backdrop-blur-[1px] ${
          visible ? 'opacity-100' : 'opacity-0 pointer-events-none'
        }`}
        onClick={closeBag}
        aria-hidden="true"
      />

      <aside
        className={`bag-drawer-panel relative z-10 w-full max-w-md h-full bg-[#F1EEE8] text-[#171717] border-l border-[#171717]/15 flex flex-col shadow-2xl ${
          visible ? 'translate-x-0 opacity-100' : 'translate-x-full opacity-95'
        }`}
      >
        {/* Header */}
        <div className="px-6 py-5 border-b border-[#171717]/12 flex items-center justify-between">
          <div>
            <p className="font-mono-tabular text-[10px] uppercase tracking-[0.14em] text-[#99968F]">
              COMPLEX / SACOLA
            </p>
            <h2 className="font-display text-lg font-bold tracking-tight">
              Sua Sacola ({cartCount})
            </h2>
          </div>
          <button
            type="button"
            onClick={closeBag}
            aria-label="Fechar sacola"
            className="w-10 h-10 inline-flex items-center justify-center hover:opacity-65 transition-opacity cursor-pointer"
          >
            <X className="w-5 h-5" strokeWidth={1.5} />
          </button>
        </div>

        {/* Items */}
        <div className="flex-1 overflow-y-auto px-6 py-5 divide-y divide-[#171717]/10">
          {cart.length === 0 ? (
            <div className="py-16 text-center space-y-4">
              <p className="text-sm text-[#171717]/70">Sua sacola está vazia.</p>
              <button
                type="button"
                onClick={() => go('/shop')}
                className="px-6 py-3 bg-[#171717] text-[#F1EEE8] text-xs uppercase tracking-[0.12em] font-medium hover:bg-[#171717]/90 transition-colors cursor-pointer"
              >
                Explorar catálogo
              </button>
            </div>
          ) : (
            cart.map((item) => (
              <div key={item.key} className="py-4 first:pt-0 flex gap-4">
                <button
                  type="button"
                  onClick={() => go(`/product/${item.slug}`)}
                  className="w-20 aspect-[3/4] bg-[#EAE6DF] shrink-0 overflow-hidden cursor-pointer"
                >
                  <OptimizedImage
                    src={item.image}
                    alt={item.name}
                    sizes="thumb"
                    className="w-full h-full"
                    imgClassName="w-full h-full object-cover"
                  />
                </button>

                <div className="flex-1 min-w-0 flex flex-col justify-between">
                  <div>
                    <div className="flex items-start justify-between gap-2">
                      <button
                        type="button"
                        onClick={() => go(`/product/${item.slug}`)}
                        className="text-left text-sm font-medium text-[#171717] hover:underline truncate cursor-pointer"
                      >
                        {item.name}
                      </button>
                      <span className="font-mono-tabular text-xs text-[#171717] shrink-0">
                        {formatBrl(item.priceBrl * item.quantity)}
                      </span>
                    </div>
                    <p className="mt-1 font-mono-tabular text-[11px] text-[#99968F] uppercase">
                      {item.colorName} · Tam {item.size}
                    </p>
                  </div>

                  <div className="mt-3 flex items-center justify-between">
                    <div className="inline-flex items-center border border-[#171717]/20">
                      <button
                        type="button"
                        onClick={() => updateCartQuantity(item.key, item.quantity - 1)}
                        aria-label={`Diminuir quantidade de ${item.name}`}
                        className="w-8 h-8 inline-flex items-center justify-center hover:bg-[#171717]/5 transition-colors cursor-pointer"
                      >
                        <Minus className="w-3.5 h-3.5" />
                      </button>
                      <span className="w-8 text-center font-mono-tabular text-xs">
                        {item.quantity}
                      </span>
                      <button
                        type="button"
                        onClick={() => updateCartQuantity(item.key, item.quantity + 1)}
                        disabled={item.quantity >= item.maxStock}
                        aria-label={`Aumentar quantidade de ${item.name}`}
                        className="w-8 h-8 inline-flex items-center justify-center hover:bg-[#171717]/5 transition-colors disabled:opacity-30 cursor-pointer"
                      >
                        <Plus className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    <button
                      type="button"
                      onClick={() => removeFromCart(item.key)}
                      aria-label={`Remover ${item.name}`}
                      className="text-xs text-[#99968F] hover:text-[#171717] transition-colors inline-flex items-center gap-1 cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>Remover</span>
                    </button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Footer */}
        {cart.length > 0 && (
          <div className="px-6 py-5 border-t border-[#171717]/12 bg-[#EAE6DF]/60 space-y-4">
            <div className="flex items-center justify-between text-sm">
              <span className="text-[#171717]/75">Subtotal estimado</span>
              <span className="font-mono-tabular font-medium text-base">
                {formatBrl(cartSubtotal)}
              </span>
            </div>
            <p className="text-[11px] text-[#99968F]">
              Frete e eventuais cupons são calculados no checkout. Pedido em modo de demonstração.
            </p>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => go('/bag')}
                className="py-3 px-4 border border-[#171717] text-[#171717] text-xs uppercase tracking-[0.12em] font-medium hover:bg-[#171717]/5 transition-colors cursor-pointer"
              >
                Ver sacola
              </button>
              <button
                type="button"
                onClick={() => go('/checkout')}
                className="py-3 px-4 bg-[#171717] text-[#F1EEE8] text-xs uppercase tracking-[0.12em] font-medium hover:bg-[#171717]/90 transition-colors cursor-pointer"
              >
                Finalizar
              </button>
            </div>
          </div>
        )}
      </aside>
    </div>
  );
};
