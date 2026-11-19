import React, { useEffect, useRef, useState } from 'react';
import { Minus, Plus, Trash2, X } from 'lucide-react';
import { useCart, useStoreUI } from '../context/StoreContext';
import { formatBrl, getFreeShippingProgress } from '../utils/commerce';
import { useAnimatedDisclosure } from '../utils/useAnimatedDisclosure';
import { OptimizedImage } from './OptimizedImage';

interface BagDrawerProps {
  onNavigate: (path: string) => void;
}

export const BagDrawer: React.FC<BagDrawerProps> = ({ onNavigate }) => {
  const { cart, cartCount, cartSubtotal, updateCartQuantity, removeFromCart } = useCart();
  const { isBagOpen, closeBag } = useStoreUI();
  const { mounted, visible } = useAnimatedDisclosure(isBagOpen, closeBag, 320);

  const [removingKeys, setRemovingKeys] = useState<Record<string, boolean>>({});
  const [subtotalPulse, setSubtotalPulse] = useState(false);
  const prevSubtotalRef = useRef(cartSubtotal);
  const removeTimersRef = useRef<Record<string, number>>({});

  useEffect(() => {
    if (cartSubtotal !== prevSubtotalRef.current) {
      prevSubtotalRef.current = cartSubtotal;
      setSubtotalPulse(true);
      const timer = window.setTimeout(() => setSubtotalPulse(false), 260);
      return () => window.clearTimeout(timer);
    }
  }, [cartSubtotal]);

  useEffect(() => {
    return () => {
      Object.values(removeTimersRef.current).forEach((id) => window.clearTimeout(id));
    };
  }, []);

  if (!mounted) return null;

  const shippingProgress = getFreeShippingProgress(cartSubtotal);

  const go = (path: string) => {
    closeBag();
    onNavigate(path);
  };

  const handleAnimatedRemove = (key: string) => {
    if (removingKeys[key]) return;
    setRemovingKeys((prev) => ({ ...prev, [key]: true }));
    removeTimersRef.current[key] = window.setTimeout(() => {
      removeFromCart(key);
      setRemovingKeys((prev) => {
        const next = { ...prev };
        delete next[key];
        return next;
      });
      delete removeTimersRef.current[key];
    }, 180);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex justify-end"
      role="dialog"
      aria-modal="true"
      aria-label="Sacola de compras"
    >
      <div
        className={`overlay-backdrop fixed inset-0 bg-[#171717]/40 backdrop-blur-[1px] ${
          visible ? 'opacity-100' : 'opacity-0'
        }`}
        onClick={closeBag}
        aria-hidden="true"
      />

      <aside
        className={`drawer-panel-right relative z-10 w-full max-w-md h-full bg-[#F1EEE8] text-[#171717] border-l border-[#171717]/15 shadow-2xl flex flex-col ${
          visible ? 'translate-x-0' : 'translate-x-full'
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

        {/* Free shipping progress */}
        {cart.length > 0 && (
          <div className="px-6 py-3 border-b border-[#171717]/10 bg-[#EAE6DF]/55">
            <div className="flex items-center justify-between gap-2 text-[11px] font-mono-tabular">
              {shippingProgress.eligible ? (
                <span className="text-[#6A705C] uppercase tracking-[0.1em] font-medium">
                  Frete padrão grátis desbloqueado
                </span>
              ) : (
                <span className="text-[#171717]/80">
                  Faltam{' '}
                  <strong className="font-medium text-[#171717]">
                    {formatBrl(shippingProgress.remainingBrl)}
                  </strong>{' '}
                  para frete grátis
                </span>
              )}
              <span className="text-[#99968F]">{shippingProgress.percent}%</span>
            </div>
            <div className="mt-2 h-[2px] w-full bg-[#171717]/12 overflow-hidden">
              <div
                className={`h-full transition-[width] duration-300 ease-out ${
                  shippingProgress.eligible ? 'bg-[#6A705C]' : 'bg-[#171717]'
                }`}
                style={{ width: `${shippingProgress.percent}%` }}
              />
            </div>
          </div>
        )}

        {/* Items */}
        <div className="flex-1 overflow-y-auto px-6 py-5 divide-y divide-[#171717]/10">
          {cart.length === 0 ? (
            <div className="py-16 text-center space-y-4">
              <p className="text-sm text-[#171717]/70">Sua sacola está vazia.</p>
              <button
                type="button"
                onClick={() => go('/shop')}
                className="px-6 py-3 bg-[#171717] text-[#F1EEE8] text-xs uppercase tracking-[0.12em] font-medium hover:bg-[#171717]/88 active:scale-[0.99] transition-[background-color,transform] duration-200 cursor-pointer"
              >
                Explorar catálogo
              </button>
            </div>
          ) : (
            cart.map((item) => {
              const isRemoving = Boolean(removingKeys[item.key]);
              return (
                <div
                  key={item.key}
                  className={`py-4 first:pt-0 flex gap-4 ${
                    isRemoving ? 'cart-item-removing pointer-events-none' : 'cart-item-enter'
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => go(`/product/${item.slug}`)}
                    className="w-20 aspect-[3/4] bg-[#EAE6DF] shrink-0 overflow-hidden cursor-pointer group"
                  >
                    <OptimizedImage
                      src={item.image}
                      alt={item.name}
                      sizes="thumb"
                      className="w-full h-full"
                      imgClassName="w-full h-full object-cover group-hover:scale-[1.04] transition-transform duration-300"
                    />
                  </button>

                  <div className="flex-1 min-w-0 flex flex-col justify-between">
                    <div>
                      <div className="flex items-start justify-between gap-2">
                        <button
                          type="button"
                          onClick={() => go(`/product/${item.slug}`)}
                          className="text-left text-sm font-medium text-[#171717] hover:underline underline-offset-4 truncate cursor-pointer"
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
                          onClick={() => {
                            if (item.quantity <= 1) {
                              handleAnimatedRemove(item.key);
                            } else {
                              updateCartQuantity(item.key, item.quantity - 1);
                            }
                          }}
                          aria-label={`Diminuir quantidade de ${item.name}`}
                          className="w-8 h-8 inline-flex items-center justify-center hover:bg-[#171717]/6 active:bg-[#171717]/10 transition-colors cursor-pointer"
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
                          className="w-8 h-8 inline-flex items-center justify-center hover:bg-[#171717]/6 active:bg-[#171717]/10 disabled:opacity-30 transition-colors cursor-pointer"
                        >
                          <Plus className="w-3.5 h-3.5" />
                        </button>
                      </div>

                      <button
                        type="button"
                        onClick={() => handleAnimatedRemove(item.key)}
                        aria-label={`Remover ${item.name}`}
                        className="text-xs text-[#99968F] hover:text-[#171717] inline-flex items-center gap-1 transition-colors cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span>Remover</span>
                      </button>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer */}
        {cart.length > 0 && (
          <div className="px-6 py-5 border-t border-[#171717]/12 bg-[#EAE6DF]/60 space-y-4">
            <div className="flex items-center justify-between text-sm">
              <span className="text-[#171717]/75">Subtotal estimado</span>
              <span
                className={`font-mono-tabular font-medium text-base inline-block ${
                  subtotalPulse ? 'value-bump' : ''
                }`}
              >
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
                className="py-3 px-4 border border-[#171717] text-[#171717] text-xs uppercase tracking-[0.12em] font-medium hover:bg-[#171717]/6 active:scale-[0.99] transition-[background-color,transform] duration-200 cursor-pointer"
              >
                Ver sacola
              </button>
              <button
                type="button"
                onClick={() => go('/checkout')}
                className="py-3 px-4 bg-[#171717] text-[#F1EEE8] text-xs uppercase tracking-[0.12em] font-medium hover:bg-[#171717]/88 active:scale-[0.99] transition-[background-color,transform] duration-200 cursor-pointer"
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
