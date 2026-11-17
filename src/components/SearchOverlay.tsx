import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Search, X } from 'lucide-react';
import { useStore } from '../context/StoreContext';
import { formatBrl } from '../utils/commerce';
import { OptimizedImage } from './OptimizedImage';

interface SearchOverlayProps {
  onNavigate: (path: string) => void;
}

export const SearchOverlay: React.FC<SearchOverlayProps> = ({ onNavigate }) => {
  const { isSearchOpen, closeSearch, products } = useStore();
  const [query, setQuery] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isSearchOpen) {
      window.setTimeout(() => inputRef.current?.focus(), 40);
    } else {
      setQuery('');
    }
  }, [isSearchOpen]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isSearchOpen) closeSearch();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isSearchOpen, closeSearch]);

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

  if (!isSearchOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    closeSearch();
    onNavigate(query.trim() ? `/shop?q=${encodeURIComponent(query.trim())}` : '/shop');
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-[#171717]/40 flex items-start justify-center"
      role="dialog"
      aria-modal="true"
      aria-label="Buscar no catálogo COMPLEX"
    >
      <div
        className="fixed inset-0"
        onClick={closeSearch}
        aria-hidden="true"
      />
      <div className="relative z-10 w-full bg-[#F1EEE8] text-[#171717] border-b border-[#171717]/15 px-4 md:px-8 py-6">
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
              placeholder="Buscar hoodies, tees boxy, cargo, denim..."
              className="flex-1 bg-transparent text-base md:text-lg placeholder:text-[#99968F] focus:outline-none"
            />
            <button
              type="button"
              onClick={closeSearch}
              aria-label="Fechar busca"
              className="w-10 h-10 inline-flex items-center justify-center hover:opacity-65 cursor-pointer"
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
                className="font-mono-tabular text-[11px] uppercase tracking-[0.12em] underline underline-offset-4 cursor-pointer"
              >
                Ver todo o catálogo
              </button>
            </div>

            {results.length === 0 ? (
              <p className="text-sm text-[#99968F] py-6">
                Nenhuma peça encontrada para "{query}". Tente buscar por "Hoodie", "Boxy", "Cargo" ou "Olive".
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
                        imgClassName="w-full h-full object-cover group-hover:scale-[1.02] transition-transform duration-200"
                      />
                    </div>
                    <p className="text-sm font-medium truncate">{product.name}</p>
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
