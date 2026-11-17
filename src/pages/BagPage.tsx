import React from 'react';
import { ArrowRight, Minus, Plus, Trash2 } from 'lucide-react';
import { useStore } from '../context/StoreContext';
import { formatBrl } from '../utils/commerce';
import { OptimizedImage } from '../components/OptimizedImage';

interface BagPageProps {
  onNavigate: (path: string) => void;
}

export const BagPage: React.FC<BagPageProps> = ({ onNavigate }) => {
  const { cart, cartCount, cartSubtotal, updateCartQuantity, removeFromCart } = useStore();

  return (
    <main className="bg-[#F1EEE8] text-[#171717] min-h-[75vh]">
      <div className="max-w-[1440px] mx-auto px-4 md:px-8 py-12 md:py-16">
        <div className="pb-8 border-b border-[#171717]/12 flex items-end justify-between">
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
            className="font-mono-tabular text-xs uppercase tracking-[0.12em] underline underline-offset-4 cursor-pointer"
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
              className="px-6 py-3 bg-[#171717] text-[#F1EEE8] font-mono-tabular text-xs uppercase tracking-[0.12em] cursor-pointer"
            >
              Ir para o catálogo
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 pt-8">
            <div className="lg:col-span-8 divide-y divide-[#171717]/12">
              {cart.map((item) => (
                <div key={item.key} className="py-6 first:pt-0 flex gap-5">
                  <button
                    type="button"
                    onClick={() => onNavigate(`/product/${item.slug}`)}
                    className="w-24 sm:w-28 aspect-[3/4] bg-[#EAE6DF] shrink-0 overflow-hidden cursor-pointer"
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
                    <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-2">
                      <div>
                        <button
                          type="button"
                          onClick={() => onNavigate(`/product/${item.slug}`)}
                          className="font-display text-lg font-bold tracking-tight hover:underline text-left cursor-pointer"
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
                          onClick={() => updateCartQuantity(item.key, item.quantity - 1)}
                          aria-label={`Diminuir quantidade de ${item.name}`}
                          className="w-9 h-9 inline-flex items-center justify-center hover:bg-[#171717]/5 cursor-pointer"
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
                          className="w-9 h-9 inline-flex items-center justify-center hover:bg-[#171717]/5 disabled:opacity-30 cursor-pointer"
                        >
                          <Plus className="w-3.5 h-3.5" />
                        </button>
                      </div>

                      <button
                        type="button"
                        onClick={() => removeFromCart(item.key)}
                        className="inline-flex items-center gap-1.5 text-xs text-[#99968F] hover:text-[#171717] cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span>Remover</span>
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <aside className="lg:col-span-4">
              <div className="border border-[#171717]/15 bg-[#EAE6DF]/55 p-6 space-y-5">
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
                    <span>Calculado no checkout</span>
                  </div>
                </div>

                <div className="flex justify-between items-baseline">
                  <span className="font-medium">Total estimado</span>
                  <span className="font-mono-tabular text-lg font-medium">
                    {formatBrl(cartSubtotal)}
                  </span>
                </div>

                <button
                  type="button"
                  onClick={() => onNavigate('/checkout')}
                  className="w-full h-12 px-5 bg-[#171717] text-[#F1EEE8] font-mono-tabular text-xs uppercase tracking-[0.14em] inline-flex items-center justify-between hover:bg-[#171717]/90 cursor-pointer"
                >
                  <span>Ir para o Checkout</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </aside>
          </div>
        )}
      </div>
    </main>
  );
};
