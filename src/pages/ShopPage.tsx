import React, { useEffect, useMemo, useState } from 'react';
import { Search, SlidersHorizontal, X } from 'lucide-react';
import { useStore } from '../context/StoreContext';
import { ProductCard } from '../components/ProductCard';
import type { CatalogFilters, CategorySlug } from '../types/store';
import { filterAndSortProducts, formatBrl, getCategoryLabel } from '../utils/commerce';

interface ShopPageProps {
  queryString: string;
  onNavigate: (path: string) => void;
}

const CATEGORIES: Array<CategorySlug | 'ALL'> = [
  'ALL',
  'Tees',
  'Hoodies',
  'Bottoms',
  'Outerwear',
  'Accessories',
];

const SIZES = ['ALL', 'XS', 'S', 'M', 'L', 'XL', '38', '40', '42', '44', 'Único'];

export const ShopPage: React.FC<ShopPageProps> = ({ queryString, onNavigate }) => {
  const { products, catalogLoading } = useStore();

  const parseFilters = (qs: string): CatalogFilters => {
    const params = new URLSearchParams(qs);
    const rawCat = params.get('category');
    const matchedCat = rawCat
      ? CATEGORIES.find((c) => c.toLowerCase() === rawCat.toLowerCase()) || null
      : null;
    const sort = params.get('sort') as CatalogFilters['sort'] | null;
    const maxP = params.get('maxPrice');
    return {
      category: matchedCat || 'ALL',
      size: params.get('size') || 'ALL',
      color: params.get('color') || 'ALL',
      maxPrice: maxP ? Number(maxP) : null,
      sort: sort && ['newest', 'price-asc', 'price-desc'].includes(sort) ? sort : 'newest',
      query: params.get('q') || '',
    };
  };

  const [filters, setFilters] = useState<CatalogFilters>(() => parseFilters(queryString));
  const [filtersOpen, setFiltersOpen] = useState(false);

  useEffect(() => {
    setFilters(parseFilters(queryString));
  }, [queryString]);

  const updateFilters = (patch: Partial<CatalogFilters>) => {
    const next = { ...filters, ...patch };
    setFilters(next);

    const params = new URLSearchParams();
    if (next.category !== 'ALL') params.set('category', next.category);
    if (next.size !== 'ALL') params.set('size', next.size);
    if (next.color !== 'ALL') params.set('color', next.color);
    if (next.maxPrice !== null) params.set('maxPrice', String(next.maxPrice));
    if (next.sort !== 'newest') params.set('sort', next.sort);
    if (next.query.trim()) params.set('q', next.query.trim());

    const qs = params.toString();
    onNavigate(qs ? `/shop?${qs}` : '/shop');
  };

  const clearAllFilters = () => {
    const reset: CatalogFilters = {
      category: 'ALL',
      size: 'ALL',
      color: 'ALL',
      maxPrice: null,
      sort: 'newest',
      query: '',
    };
    setFilters(reset);
    onNavigate('/shop');
  };

  const availableColors = useMemo(() => {
    const names = new Set<string>();
    products.forEach((p) => p.colors.forEach((c) => names.add(c.name)));
    return ['ALL', ...Array.from(names)];
  }, [products]);

  const filteredProducts = useMemo(
    () => filterAndSortProducts(products, filters),
    [products, filters]
  );

  const hasActiveFilters =
    filters.category !== 'ALL' ||
    filters.size !== 'ALL' ||
    filters.color !== 'ALL' ||
    filters.maxPrice !== null ||
    filters.query.trim() !== '';

  return (
    <main className="bg-[#F1EEE8] text-[#171717] min-h-[75vh]">
      <div className="max-w-[1440px] mx-auto px-4 md:px-8 py-10 md:py-14">
        {/* Top Page Title & Count */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 pb-8 border-b border-[#171717]/12">
          <div>
            <p className="font-mono-tabular text-[11px] uppercase tracking-[0.14em] text-[#99968F] mb-1">
              COLEÇÃO 001 / CATÁLOGO
            </p>
            <h1 className="font-display text-3xl md:text-5xl font-extrabold tracking-[-0.03em]">
              {filters.category === 'ALL' ? 'Todas as Peças' : getCategoryLabel(filters.category)}
            </h1>
          </div>

          <p className="font-mono-tabular text-xs uppercase tracking-[0.12em] text-[#99968F]">
            {filteredProducts.length} {filteredProducts.length === 1 ? 'peça exibida' : 'peças exibidas'}
          </p>
        </div>

        {/* Category Tabs + Search & Sort Controls */}
        <div className="py-5 border-b border-[#171717]/12 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="flex items-center gap-2 overflow-x-auto pb-1 lg:pb-0">
            {CATEGORIES.map((cat) => (
              <button
                key={cat}
                type="button"
                onClick={() => updateFilters({ category: cat })}
                className={`px-3.5 py-2 font-mono-tabular text-[11px] uppercase tracking-[0.12em] whitespace-nowrap shrink-0 border transition-colors cursor-pointer ${
                  filters.category === cat
                    ? 'bg-[#171717] text-[#F1EEE8] border-[#171717]'
                    : 'bg-transparent text-[#171717]/80 border-[#171717]/15 hover:border-[#171717]'
                }`}
              >
                {getCategoryLabel(cat)}
              </button>
            ))}
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <div className="relative flex-1 sm:flex-none sm:w-56">
              <Search className="w-3.5 h-3.5 text-[#99968F] absolute left-3 top-1/2 -translate-y-1/2" />
              <label htmlFor="catalog-search" className="sr-only">
                Buscar no catálogo
              </label>
              <input
                id="catalog-search"
                type="search"
                value={filters.query}
                onChange={(e) => updateFilters({ query: e.target.value })}
                placeholder="Buscar peça..."
                className="w-full h-10 pl-9 pr-3 bg-transparent border border-[#171717]/20 text-xs focus:outline-none focus:border-[#171717]"
              />
            </div>

            <button
              type="button"
              onClick={() => setFiltersOpen((v) => !v)}
              aria-expanded={filtersOpen}
              className="h-10 px-4 border border-[#171717]/20 inline-flex items-center gap-2 font-mono-tabular text-[11px] uppercase tracking-[0.12em] hover:border-[#171717] cursor-pointer"
            >
              <SlidersHorizontal className="w-3.5 h-3.5" />
              <span>Filtros</span>
            </button>

            <label htmlFor="catalog-sort" className="sr-only">
              Ordenar produtos
            </label>
            <select
              id="catalog-sort"
              value={filters.sort}
              onChange={(e) => updateFilters({ sort: e.target.value as CatalogFilters['sort'] })}
              className="h-10 px-3 bg-[#F1EEE8] border border-[#171717]/20 font-mono-tabular text-[11px] uppercase tracking-[0.1em] focus:outline-none focus:border-[#171717] cursor-pointer"
            >
              <option value="newest">Ordenar: Novidades</option>
              <option value="price-asc">Menor preço</option>
              <option value="price-desc">Maior preço</option>
            </select>
          </div>
        </div>

        {/* Expandable Filter Panel */}
        {filtersOpen && (
          <div className="py-6 border-b border-[#171717]/12 grid grid-cols-1 md:grid-cols-3 gap-6 bg-[#EAE6DF]/40 px-4 mt-2">
            <div>
              <p className="font-mono-tabular text-[11px] uppercase tracking-[0.12em] text-[#99968F] mb-2.5">
                Tamanho disponível
              </p>
              <div className="flex flex-wrap gap-1.5">
                {SIZES.map((sz) => (
                  <button
                    key={sz}
                    type="button"
                    onClick={() => updateFilters({ size: sz })}
                    className={`px-2.5 py-1.5 font-mono-tabular text-[11px] border cursor-pointer ${
                      filters.size === sz
                        ? 'bg-[#171717] text-[#F1EEE8] border-[#171717]'
                        : 'border-[#171717]/20 text-[#171717]/80 hover:border-[#171717]'
                    }`}
                  >
                    {sz === 'ALL' ? 'Todos' : sz}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <p className="font-mono-tabular text-[11px] uppercase tracking-[0.12em] text-[#99968F] mb-2.5">
                Cor
              </p>
              <label htmlFor="filter-color" className="sr-only">
                Filtrar por cor
              </label>
              <select
                id="filter-color"
                value={filters.color}
                onChange={(e) => updateFilters({ color: e.target.value })}
                className="w-full h-10 px-3 bg-[#F1EEE8] border border-[#171717]/20 text-xs focus:outline-none"
              >
                {availableColors.map((colorName) => (
                  <option key={colorName} value={colorName}>
                    {colorName === 'ALL' ? 'Todas as cores' : colorName}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <p className="font-mono-tabular text-[11px] uppercase tracking-[0.12em] text-[#99968F] mb-2.5">
                Preço máximo: {filters.maxPrice ? formatBrl(filters.maxPrice) : 'Sem limite'}
              </p>
              <input
                type="range"
                min={150}
                max={900}
                step={50}
                value={filters.maxPrice ?? 900}
                onChange={(e) => {
                  const val = Number(e.target.value);
                  updateFilters({ maxPrice: val >= 900 ? null : val });
                }}
                aria-label="Preço máximo em reais"
                className="w-full accent-[#171717]"
              />
            </div>
          </div>
        )}

        {/* Active Filter Clear Bar */}
        {hasActiveFilters && (
          <div className="pt-4 flex flex-wrap items-center justify-between gap-2 text-xs">
            <span className="font-mono-tabular text-[11px] text-[#99968F]">
              Filtros ativos aplicados
            </span>
            <button
              type="button"
              onClick={clearAllFilters}
              className="inline-flex items-center gap-1 font-mono-tabular text-[11px] uppercase tracking-[0.12em] underline underline-offset-4 cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
              <span>Limpar filtros</span>
            </button>
          </div>
        )}

        {/* Product Grid */}
        {catalogLoading ? (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-6 pt-8">
            {Array.from({ length: 8 }).map((_, idx) => (
              <div key={idx} className="space-y-3">
                <div className="aspect-[3/4] bg-[#EAE6DF] animate-pulse" />
                <div className="h-4 w-2/3 bg-[#EAE6DF] animate-pulse" />
              </div>
            ))}
          </div>
        ) : filteredProducts.length === 0 ? (
          <div className="py-24 text-center max-w-md mx-auto space-y-4">
            <p className="font-mono-tabular text-[11px] uppercase tracking-[0.14em] text-[#99968F]">
              NENHUM RESULTADO
            </p>
            <h2 className="font-display text-2xl font-bold tracking-tight">
              Nenhuma peça encontrada com estes filtros.
            </h2>
            <p className="text-sm text-[#171717]/75">
              Ajuste o tamanho, cor ou faixa de preço para visualizar as demais peças da Coleção 01.
            </p>
            <button
              type="button"
              onClick={clearAllFilters}
              className="px-6 py-3 bg-[#171717] text-[#F1EEE8] font-mono-tabular text-xs uppercase tracking-[0.12em] hover:bg-[#171717]/90 cursor-pointer"
            >
              Limpar todos os filtros
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-x-4 gap-y-10 md:gap-x-6 pt-8">
            {filteredProducts.map((product, index) => (
              <ProductCard
                key={product.id}
                product={product}
                eager={index < 4}
                onSelect={(slug) => onNavigate(`/product/${slug}`)}
              />
            ))}
          </div>
        )}
      </div>
    </main>
  );
};
