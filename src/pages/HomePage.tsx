import React from 'react';
import { ArrowRight, ArrowUpRight } from 'lucide-react';
import { useStore } from '../context/StoreContext';
import { ProductCard } from '../components/ProductCard';
import { STORE_ASSETS } from '../data/assets';
import { OptimizedImage } from '../components/OptimizedImage';
import { getCategoryLabel } from '../utils/commerce';

interface HomePageProps {
  onNavigate: (path: string) => void;
}

export const HomePage: React.FC<HomePageProps> = ({ onNavigate }) => {
  const { products, categories, editorial } = useStore();

  const activeProducts = products.filter((p) => p.active);
  const newArrivals = activeProducts.filter((p) => p.isNew).slice(0, 4);
  const moreToExplore = activeProducts
    .filter((p) => !newArrivals.some((n) => n.id === p.id))
    .slice(0, 4);

  const primaryCategories = categories
    .filter((c) => ['tees', 'hoodies', 'bottoms', 'outerwear'].includes(c.slug.toLowerCase()))
    .slice(0, 4);

  return (
    <main className="bg-[#F1EEE8] text-[#171717]">
      {/* B. HERO EDITORIAL */}
      <section className="relative w-full h-[78vh] min-h-[540px] max-h-[820px] bg-[#171717] overflow-hidden">
        {/* Art-directed LCP Hero picture: downloads ONLY desktop OR mobile source */}
        <OptimizedImage
          src={editorial.heroDesktopImage || STORE_ASSETS.heroDesktop.url}
          mobileSrc={editorial.heroMobileImage || STORE_ASSETS.heroMobile.url}
          alt={STORE_ASSETS.heroDesktop.alt}
          sizes="hero"
          priority
          className="absolute inset-0 w-full h-full"
          imgClassName="w-full h-full object-cover object-top md:object-[50%_8%]"
        />

        {/* Measured contrast scrim */}
        <div
          className="absolute inset-0 bg-gradient-to-t from-[#171717]/85 via-[#171717]/25 to-transparent"
          aria-hidden="true"
        />

        <div className="relative z-10 h-full max-w-[1440px] mx-auto px-4 md:px-8 pb-8 md:pb-12 flex flex-col justify-end">
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
            <div className="max-w-2xl">
              <p className="font-mono-tabular text-[11px] uppercase tracking-[0.16em] text-[#F1EEE8]/85 mb-2">
                {editorial.heroSubtitle}
              </p>
              <h1 className="font-display text-4xl sm:text-6xl lg:text-[76px] font-extrabold tracking-[-0.03em] leading-[0.95] text-[#F1EEE8] text-balance">
                {editorial.heroTitle}
              </h1>
            </div>

            <div className="shrink-0">
              <button
                type="button"
                onClick={() => onNavigate('/shop')}
                className="group inline-flex items-center gap-3 pb-1.5 border-b border-[#F1EEE8] text-[#F1EEE8] font-mono-tabular text-xs uppercase tracking-[0.14em] hover:opacity-80 transition-opacity cursor-pointer"
              >
                <span>{editorial.heroCta}</span>
                <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* BRAND EDITORIAL STATEMENT */}
      <section className="max-w-[1440px] mx-auto px-4 md:px-8 py-14 md:py-18 border-b border-[#171717]/12">
        <p className="font-mono-tabular text-[11px] uppercase tracking-[0.14em] text-[#99968F] mb-4">
          {editorial.brandKicker}
        </p>
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          <h2 className="lg:col-span-7 font-display text-2xl sm:text-3xl lg:text-4xl font-extrabold tracking-[-0.025em] leading-[1.05] text-balance">
            {editorial.brandTitle}
          </h2>
          <div className="lg:col-span-5 lg:pl-8 space-y-5">
            <p className="text-[15px] leading-relaxed text-[#171717]/80">
              {editorial.brandCopy}
            </p>
            <button
              type="button"
              onClick={() => onNavigate('/about')}
              className="inline-flex items-center gap-1.5 font-mono-tabular text-[11px] uppercase tracking-[0.14em] text-[#171717] hover:underline underline-offset-4 cursor-pointer"
            >
              <span>Descubra a COMPLEX</span>
              <ArrowUpRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </section>

      {/* C. NEW ARRIVALS */}
      <section className="max-w-[1440px] mx-auto px-4 md:px-8 py-14 md:py-20">
        <div className="flex items-end justify-between gap-4 mb-8">
          <div>
            <p className="font-mono-tabular text-[11px] uppercase tracking-[0.14em] text-[#99968F] mb-1">
              SELEÇÃO CURADA / 001
            </p>
            <h2 className="font-display text-2xl md:text-3xl font-bold tracking-[-0.02em]">
              Lançamentos
            </h2>
          </div>

          <button
            type="button"
            onClick={() => onNavigate('/shop?sort=newest')}
            className="inline-flex items-center gap-1 font-mono-tabular text-[11px] uppercase tracking-[0.14em] text-[#171717] hover:underline underline-offset-4 shrink-0 cursor-pointer"
          >
            <span>Ver tudo</span>
            <ArrowUpRight className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-x-4 gap-y-10 md:gap-x-6">
          {newArrivals.map((product) => (
            <ProductCard
              key={product.id}
              product={product}
              onSelect={(slug) => onNavigate(`/product/${slug}`)}
            />
          ))}
        </div>
      </section>

      {/* D. FEATURED CAMPAIGN */}
      <section className="max-w-[1440px] mx-auto px-4 md:px-8 pb-16 md:pb-22">
        <div className="grid grid-cols-1 lg:grid-cols-12 items-stretch bg-[#171717] text-[#F1EEE8]">
          <div className="lg:col-span-6 relative aspect-[4/5] lg:aspect-auto lg:h-[640px] overflow-hidden bg-[#222222]">
            <OptimizedImage
              src={editorial.campaignImage || STORE_ASSETS.editorialUrban.url}
              alt={STORE_ASSETS.editorialUrban.alt}
              sizes="split"
              className="w-full h-full bg-[#222222]"
              imgClassName="w-full h-full object-cover object-[50%_12%]"
            />
          </div>

          <div className="lg:col-span-6 p-8 sm:p-12 lg:p-16 flex flex-col justify-between">
            <p className="font-mono-tabular text-[11px] uppercase tracking-[0.16em] text-[#99968F]">
              CAMPANHA EM DESTAQUE / 001
            </p>

            <div className="py-10 lg:py-0 space-y-5 max-w-md">
              <h2 className="font-display text-3xl sm:text-4xl lg:text-5xl font-extrabold tracking-[-0.03em] leading-[0.98] text-balance">
                {editorial.campaignTitle}
              </h2>
              <p className="text-[15px] leading-relaxed text-[#F1EEE8]/80">
                {editorial.campaignCopy}
              </p>
              <button
                type="button"
                onClick={() => onNavigate('/about')}
                className="inline-flex items-center gap-2 font-mono-tabular text-xs uppercase tracking-[0.14em] text-[#F1EEE8] border-b border-[#F1EEE8]/60 pb-1 hover:border-[#F1EEE8] transition-colors cursor-pointer"
              >
                <span>{editorial.campaignCta}</span>
                <ArrowUpRight className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="pt-6 border-t border-[#F1EEE8]/15 flex items-center justify-between font-mono-tabular text-[10px] uppercase tracking-[0.14em] text-[#99968F]">
              <span>Proporção & Forma</span>
              <span>Coleção 01</span>
            </div>
          </div>
        </div>
      </section>

      {/* E. SHOP BY CATEGORY */}
      <section className="max-w-[1440px] mx-auto px-4 md:px-8 py-14 md:py-20 border-t border-[#171717]/12">
        <div className="flex items-end justify-between gap-4 mb-8">
          <div>
            <p className="font-mono-tabular text-[11px] uppercase tracking-[0.14em] text-[#99968F] mb-1">
              ARQUIVO POR CATEGORIA
            </p>
            <h2 className="font-display text-2xl md:text-3xl font-bold tracking-[-0.02em]">
              Explorar por Categoria
            </h2>
          </div>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
          {primaryCategories.map((cat) => (
            <button
              key={cat.id}
              type="button"
              onClick={() => onNavigate(`/shop?category=${encodeURIComponent(cat.slug)}`)}
              className="group relative aspect-[3/4] overflow-hidden bg-[#EAE6DF] text-left cursor-pointer focus-visible:outline-2 focus-visible:outline-[#171717]"
            >
              <OptimizedImage
                src={cat.image}
                alt={`${cat.name} — ${cat.description}`}
                sizes="card"
                className="w-full h-full"
                imgClassName="w-full h-full object-cover object-top group-hover:scale-[1.03] transition-transform duration-300"
              />
              <div
                className="absolute inset-0 bg-gradient-to-t from-[#171717]/75 via-[#171717]/10 to-transparent"
                aria-hidden="true"
              />
              <div className="absolute inset-x-0 bottom-0 p-4 md:p-5 flex items-end justify-between text-[#F1EEE8]">
                <div>
                  <span className="block font-display text-lg md:text-xl font-bold tracking-tight">
                    {getCategoryLabel(cat.slug)}
                  </span>
                  <span className="hidden sm:block text-xs text-[#F1EEE8]/75 mt-0.5">
                    {cat.description}
                  </span>
                </div>
                <ArrowUpRight className="w-4 h-4 shrink-0 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
              </div>
            </button>
          ))}
        </div>
      </section>

      {/* F. COLLECTION STORY (Dark Editorial Magazine Section) */}
      <section className="bg-[#171717] text-[#F1EEE8] py-16 md:py-24">
        <div className="max-w-[1440px] mx-auto px-4 md:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-start">
            <div className="lg:col-span-5 space-y-6">
              <p className="font-mono-tabular text-[11px] uppercase tracking-[0.16em] text-[#B6A18C]">
                {editorial.storyKicker}
              </p>
              <h2 className="font-display text-3xl md:text-4xl font-extrabold tracking-[-0.025em] leading-[1.02] text-balance">
                {editorial.storyTitle}
              </h2>
              <p className="text-[15px] leading-relaxed text-[#F1EEE8]/80">
                {editorial.storyCopy}
              </p>

              <div className="pt-4">
                <div className="aspect-[4/3] w-full overflow-hidden bg-[#242424]">
                  <OptimizedImage
                    src={editorial.storyDetailImage || STORE_ASSETS.detailCotton.url}
                    alt={STORE_ASSETS.detailCotton.alt}
                    sizes="(min-width: 1024px) 42vw, 100vw"
                    className="w-full h-full bg-[#242424]"
                    imgClassName="w-full h-full object-cover"
                  />
                </div>
                <p className="mt-2 font-mono-tabular text-[10px] uppercase tracking-[0.14em] text-[#99968F]">
                  Tecido encorpado & costura reforçada — Estudo de construção
                </p>
              </div>

              <button
                type="button"
                onClick={() => onNavigate('/collections')}
                className="inline-flex items-center gap-2 font-mono-tabular text-xs uppercase tracking-[0.14em] text-[#F1EEE8] border-b border-[#F1EEE8]/50 pb-1 hover:border-[#F1EEE8] transition-colors cursor-pointer"
              >
                <span>Explorar Editorial 01</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="lg:col-span-7">
              <div className="aspect-[4/5] w-full overflow-hidden bg-[#242424]">
                <OptimizedImage
                  src={editorial.storyImage || STORE_ASSETS.editorialStudioHoodie.url}
                  alt={STORE_ASSETS.editorialStudioHoodie.alt}
                  sizes="split"
                  className="w-full h-full bg-[#242424]"
                  imgClassName="w-full h-full object-cover object-top"
                />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* G. MORE TO EXPLORE */}
      <section className="max-w-[1440px] mx-auto px-4 md:px-8 py-14 md:py-20">
        <div className="flex items-end justify-between gap-4 mb-8">
          <div>
            <p className="font-mono-tabular text-[11px] uppercase tracking-[0.14em] text-[#99968F] mb-1">
              OUTRAS PEÇAS DA COLEÇÃO
            </p>
            <h2 className="font-display text-2xl md:text-3xl font-bold tracking-[-0.02em]">
              Mais para Explorar
            </h2>
          </div>

          <button
            type="button"
            onClick={() => onNavigate('/shop')}
            className="inline-flex items-center gap-1 font-mono-tabular text-[11px] uppercase tracking-[0.14em] text-[#171717] hover:underline underline-offset-4 shrink-0 cursor-pointer"
          >
            <span>Catálogo completo</span>
            <ArrowUpRight className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-x-4 gap-y-10 md:gap-x-6">
          {moreToExplore.map((product) => (
            <ProductCard
              key={product.id}
              product={product}
              onSelect={(slug) => onNavigate(`/product/${slug}`)}
            />
          ))}
        </div>
      </section>
    </main>
  );
};
