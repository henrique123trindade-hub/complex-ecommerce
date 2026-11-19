import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Search, X } from 'lucide-react';
import { useCatalog, useStoreUI } from '../context/StoreContext';
import { formatBrl } from '../utils/commerce';
import { useAnimatedDisclosure } from '../utils/useAnimatedDisclosure';
import { OptimizedImage } from './OptimizedImage';

interface SearchOverlayProps {
  onNavigate: (path: string) => void;
}

export const SearchOverlay: React.FC<SearchOverlayProps> = ({ onNavigate }) => {
  const { products } = useCatalog();
  const { isSearchOpen, closeSearch } = useStoreUI();
  const { mounted, visible } = useAnimatedDisclosure(isSearchOpen, closeSearch, 240);
  const [query, setQuery] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isSearchOpen) {
      const timer = window.setTimeout(() => inputRef.current?.focus(), 60);
      return () => window.clearTimeout(timer);
    }
    setQuery('');
  }, [isSearchOpen]);

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    const active = products.filter((p) => p.active);
    if (!q) return active.slice(0, 4);
    return active
      .filter((p) =>
        `${p.name} ${p.category} ${p.collection} ${p.colors.map((c) => c.name).join(' ')}`
          .toLowerCase()
          .includes(q)
      )
      .slice(0, 8);
  }, [products, query]);

  if (!mounted) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    closeSearch();
    onNavigate(query.trim() ? `/shop?q=${encodeURIComponent(query.trim())}` : '/shop');
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center"
      role="dialog"
      aria-modal="true"
      aria-label="Buscar no catálogo COMPLEX"
    >
      <div
        className={`overlay-backdrop fixed inset-0 bg-[#171717]/40 backdrop-blur-[1px] ${
          visible ? 'opacity-100' : 'opacity-0'
        }`}
        onClick={closeSearch}
        aria-hidden="true"
      />
      <div
        className={`drawer-panel-top relative z-10 w-full bg-[#F1EEE8] text-[#171717] border-b border-[#171717]/15 shadow-xl px-4 md:px-8 py-6 max-h-[88vh] overflow-y-auto ${
          visible ? 'translate-y-0 opacity-100' : '-translate-y-4 opacity-0'
        }`}
      >
        <div className="max-w-[1440px] mx-auto">
          <form onSubmit={handleSubmit} className="flex items-center gap-3 pb-4 border-b border-[#171717]">
            <Search className="w-4 h-4 text-[#99968F] shrink-0" />
            <label htmlFor="complex-search-input" className="sr-only">
              Buscar peças, categorias ou cores
            </label>
            <input
              id="complex-search-input"
              ref={inputRef}
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Buscar moletons, camisetas boxy, cargo, jeans..."
              className="flex-1 bg-transparent text-base md:text-lg placeholder:text-[#99968F] focus:outline-none"
            />
            <button
              type="button"
              onClick={closeSearch}
              aria-label="Fechar busca"
              className="w-10 h-10 inline-flex items-center justify-center hover:opacity-65 transition-opacity cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </form>

          <div className="pt-5">
            <div className="flex items-center justify-between mb-4">
              <span className="font-mono-tabular text-[11px] uppercase tracking-[0.14em] text-[#99968F]">
                {query.trim() ? `Resultados (${results.length})` : 'Sugestões da Coleção 01'}
              </span>
              <button
                type="button"
                onClick={() => {
                  closeSearch();
                  onNavigate(query.trim() ? `/shop?q=${encodeURIComponent(query.trim())}` : '/shop');
                }}
                className="font-mono-tabular text-[11px] uppercase tracking-[0.12em] underline underline-offset-4 hover:opacity-65 transition-opacity cursor-pointer"
              >
                Ver todo o catálogo
              </button>
            </div>

            {results.length === 0 ? (
              <p className="text-sm text-[#99968F] py-6">
                Nenhuma peça encontrada para "{query}". Tente buscar por "Moletom", "Boxy", "Cargo" ou "Oliva".
              </p>
            ) : (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {results.map((product) => (
                  <button
                    key={product.id}
                    type="button"
                    onClick={() => {
                      closeSearch();
                      onNavigate(`/product/${product.slug}`);
                    }}
                    className="text-left group cursor-pointer"
                  >
                    <div className="aspect-[3/4] bg-[#EAE6DF] overflow-hidden mb-2">
                      <OptimizedImage
                        src={product.images[0]}
                        alt={product.name}
                        sizes="card"
                        className="w-full h-full"
                        imgClassName="product-hover-zoom w-full h-full object-cover group-hover:scale-[1.04]"
                      />
                    </div>
                    <p className="text-sm font-medium truncate group-hover:underline underline-offset-4">
                      {product.name}
                    </p>
                    <p className="font-mono-tabular text-xs text-[#99968F]">
                      {formatBrl(product.priceBrl)}
                    </p>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
