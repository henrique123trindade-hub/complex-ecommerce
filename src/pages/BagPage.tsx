import React, { useEffect, useRef, useState } from 'react';
import { ArrowRight, Minus, Plus, Trash2 } from 'lucide-react';
import { useCart } from '../context/StoreContext';
import { formatBrl, getFreeShippingProgress } from '../utils/commerce';
import { OptimizedImage } from '../components/OptimizedImage';
import { Breadcrumbs } from '../components/Breadcrumbs';

interface BagPageProps {
  onNavigate: (path: string) => void;
}

export const BagPage: React.FC<BagPageProps> = ({ onNavigate }) => {
  const { cart, cartCount, cartSubtotal, updateCartQuantity, removeFromCart } = useCart();
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

  const shippingProgress = getFreeShippingProgress(cartSubtotal);

  return (
    <main className="bg-[#F1EEE8] text-[#171717] min-h-[75vh]">
      <Breadcrumbs
        items={[
          { label: 'Início', path: '/' },
          { label: 'Sacola', path: '/bag' },
        ]}
        onNavigate={onNavigate}
        rightMeta="COMPLEX / SACOLA"
      />

      <div className="max-w-[1440px] mx-auto px-4 md:px-8 py-10 md:py-14">
        <div className="pb-8 border-b border-[#171717]/12 flex items-end justify-between gap-4">
          <div>
            <p className="font-mono-tabular text-[11px] uppercase tracking-[0.14em] text-[#99968F] mb-1">
              RESUMO DA COMPRA
            </p>
            <h1 className="font-display text-3xl md:text-4xl font-extrabold tracking-[-0.025em]">
              Sua Sacola ({cartCount})
            </h1>
          </div>
          <button
            type="button"
            onClick={() => onNavigate('/shop')}
            className="font-mono-tabular text-xs uppercase tracking-[0.12em] underline underline-offset-4 hover:opacity-70 transition-opacity cursor-pointer"
          >
            Continuar comprando
          </button>
        </div>

        {cart.length === 0 ? (
          <div className="py-24 text-center max-w-md mx-auto space-y-4">
            <h2 className="font-display text-2xl font-bold">Sua sacola está vazia.</h2>
            <p className="text-sm text-[#171717]/75">
              Explore as peças da Coleção 01 para adicionar itens à sua seleção.
            </p>
            <button
              type="button"
              onClick={() => onNavigate('/shop')}
              className="px-6 py-3 bg-[#171717] text-[#F1EEE8] font-mono-tabular text-xs uppercase tracking-[0.12em] hover:bg-[#171717]/88 transition-colors cursor-pointer"
            >
              Ir para o catálogo
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 pt-8">
            <div className="lg:col-span-8 space-y-6">
              {/* Free shipping bar */}
              <div className="p-4 border border-[#171717]/12 bg-[#EAE6DF]/50">
                <div className="flex items-center justify-between gap-2 font-mono-tabular text-[11px]">
                  {shippingProgress.eligible ? (
                    <span className="text-[#6A705C] uppercase tracking-[0.1em] font-medium">
                      Frete padrão grátis desbloqueado neste pedido
                    </span>
                  ) : (
                    <span className="text-[#171717]/80">
                      Adicione mais{' '}
                      <strong className="font-medium text-[#171717]">
                        {formatBrl(shippingProgress.remainingBrl)}
                      </strong>{' '}
                      para frete padrão grátis
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

              <div className="divide-y divide-[#171717]/12">
                {cart.map((item) => {
                  const isRemoving = Boolean(removingKeys[item.key]);
                  return (
                    <div
                      key={item.key}
                      className={`py-6 first:pt-0 flex gap-5 ${
                        isRemoving ? 'cart-item-removing pointer-events-none' : 'cart-item-enter'
                      }`}
                    >
                      <button
                        type="button"
                        onClick={() => onNavigate(`/product/${item.slug}`)}
                        className="group w-24 sm:w-28 aspect-[3/4] bg-[#EAE6DF] shrink-0 overflow-hidden cursor-pointer"
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
                        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-2">
                          <div>
                            <button
                              type="button"
                              onClick={() => onNavigate(`/product/${item.slug}`)}
                              className="font-display text-lg font-bold tracking-tight hover:underline underline-offset-4 text-left cursor-pointer"
                            >
                              {item.name}
                            </button>
                            <p className="mt-1 font-mono-tabular text-xs text-[#99968F] uppercase">
                              Cor: {item.colorName} · Tamanho: {item.size} · SKU: {item.sku}
                            </p>
                          </div>

                          <span className="font-mono-tabular text-sm font-medium">
                            {formatBrl(item.priceBrl * item.quantity)}
                          </span>
                        </div>

                        <div className="mt-4 flex items-center justify-between">
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
                              className="w-9 h-9 inline-flex items-center justify-center hover:bg-[#171717]/6 transition-colors cursor-pointer"
                            >
                              <Minus className="w-3.5 h-3.5" />
                            </button>
                            <span className="w-10 text-center font-mono-tabular text-xs">
                              {item.quantity}
                            </span>
                            <button
                              type="button"
                              onClick={() => updateCartQuantity(item.key, item.quantity + 1)}
                              disabled={item.quantity >= item.maxStock}
                              aria-label={`Aumentar quantidade de ${item.name}`}
                              className="w-9 h-9 inline-flex items-center justify-center hover:bg-[#171717]/6 disabled:opacity-30 transition-colors cursor-pointer"
                            >
                              <Plus className="w-3.5 h-3.5" />
                            </button>
                          </div>

                          <button
                            type="button"
                            onClick={() => handleAnimatedRemove(item.key)}
                            className="inline-flex items-center gap-1.5 text-xs text-[#99968F] hover:text-[#171717] transition-colors cursor-pointer"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                            <span>Remover</span>
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <aside className="lg:col-span-4">
              <div className="border border-[#171717]/15 bg-[#EAE6DF]/55 p-6 space-y-5 lg:sticky lg:top-24">
                <h2 className="font-mono-tabular text-xs uppercase tracking-[0.14em] text-[#99968F]">
                  Resumo do Pedido
                </h2>

                <div className="space-y-2.5 text-sm border-b border-[#171717]/12 pb-4">
                  <div className="flex justify-between">
                    <span className="text-[#171717]/75">Subtotal</span>
                    <span className="font-mono-tabular">{formatBrl(cartSubtotal)}</span>
                  </div>
                  <div className="flex justify-between text-xs text-[#99968F]">
                    <span>Frete</span>
                    <span>
                      {shippingProgress.eligible ? 'Grátis (Padrão)' : 'Calculado no checkout'}
                    </span>
                  </div>
                </div>

                <div className="flex justify-between items-baseline">
                  <span className="font-medium">Total estimado</span>
                  <span
                    className={`font-mono-tabular text-lg font-medium inline-block ${
                      subtotalPulse ? 'value-bump' : ''
                    }`}
                  >
                    {formatBrl(cartSubtotal)}
                  </span>
                </div>

                <button
                  type="button"
                  onClick={() => onNavigate('/checkout')}
                  className="group w-full h-12 px-5 bg-[#171717] text-[#F1EEE8] font-mono-tabular text-xs uppercase tracking-[0.14em] inline-flex items-center justify-between hover:bg-[#171717]/88 active:scale-[0.99] transition-[background-color,transform] duration-200 cursor-pointer"
                >
                  <span>Ir para o Checkout</span>
                  <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform duration-200" />
                </button>
              </div>
            </aside>
          </div>
        )}
      </div>
    </main>
  );
};
