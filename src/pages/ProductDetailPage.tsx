import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ArrowUpRight, Check, Minus, Plus, Ruler } from 'lucide-react';
import { useCart, useCatalog, useStoreUI } from '../context/StoreContext';
import { ProductCard } from '../components/ProductCard';
import { Breadcrumbs } from '../components/Breadcrumbs';
import { SizeGuideModal } from '../components/SizeGuideModal';
import { OptimizedImage } from '../components/OptimizedImage';
import { Reveal } from '../components/Reveal';
import {
  calculateShippingQuotes,
  formatBrl,
  formatCep,
  getVariantStock,
  validateCep,
} from '../utils/commerce';
import { buildProductBreadcrumbs, buildProductJsonLd } from '../utils/seo';
import type { ShippingQuote } from '../types/store';

interface ProductDetailPageProps {
  slug: string;
  onNavigate: (path: string) => void;
}

const useIsDesktop = () => {
  const [isDesktop, setIsDesktop] = useState<boolean>(() =>
    typeof window !== 'undefined' ? window.matchMedia('(min-width: 1024px)').matches : true
  );

  useEffect(() => {
    const mq = window.matchMedia('(min-width: 1024px)');
    const update = () => setIsDesktop(mq.matches);
    update();
    mq.addEventListener('change', update);
    return () => mq.removeEventListener('change', update);
  }, []);

  return isDesktop;
};

export const ProductDetailPage: React.FC<ProductDetailPageProps> = React.memo(({ slug, onNavigate }) => {
  const { products, editorial, catalogLoading } = useCatalog();
  const { addToCart } = useCart();
  const { openAdvisor } = useStoreUI();
  const isDesktop = useIsDesktop();

  const handleSelectRelated = useCallback(
    (relSlug: string) => onNavigate(`/product/${relSlug}`),
    [onNavigate]
  );

  const product = useMemo(
    () => products.find((p) => p.slug === slug) ?? null,
    [products, slug]
  );

  const [selectedColor, setSelectedColor] = useState<string>('');
  const [selectedSize, setSelectedSize] = useState<string>('');
  const [quantity, setQuantity] = useState<number>(1);
  const [activeImageIdx, setActiveImageIdx] = useState<number>(0);
  const [sizeGuideOpen, setSizeGuideOpen] = useState<boolean>(false);
  const [openAccordion, setOpenAccordion] = useState<string | null>('details');
  const [cepInput, setCepInput] = useState<string>('');
  const [cepQuotes, setCepQuotes] = useState<ShippingQuote[]>([]);
  const [cepLocation, setCepLocation] = useState<string>('');
  const [cepError, setCepError] = useState<string>('');
  const [justAdded, setJustAdded] = useState<boolean>(false);
  const addedTimerRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (addedTimerRef.current !== null) {
        window.clearTimeout(addedTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (!product) return;
    setSelectedColor(product.colors[0]?.name || '');
    const firstAvailable = product.sizes.find((s) => s.stock > 0);
    setSelectedSize(firstAvailable?.size || product.sizes[0]?.size || '');
    setQuantity(1);
    setActiveImageIdx(0);
    setCepQuotes([]);
    setCepLocation('');
    setCepError('');
    setJustAdded(false);
  }, [product]);

  useEffect(() => {
    if (!product) {
      document.title = 'Produto não encontrado — COMPLEX';
      return () => {
        document.title = 'COMPLEX — Streetwear';
      };
    }
    document.title = `${product.name} — COMPLEX`;
    return () => {
      document.title = 'COMPLEX — Streetwear';
    };
  }, [product]);

  const breadcrumbItems = useMemo(
    () => (product ? buildProductBreadcrumbs(product) : []),
    [product]
  );

  const productJsonLd = useMemo(() => {
    if (!product) return null;
    const origin =
      typeof window !== 'undefined' && window.location?.origin
        ? window.location.origin
        : 'https://complex-ecommerce.vercel.app';
    return buildProductJsonLd(product, origin);
  }, [product]);

  if (!product && catalogLoading) {
    return (
      <main className="max-w-[1440px] mx-auto px-4 md:px-8 py-12">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          <div className="lg:col-span-7 aspect-[3/4] bg-[#EAE6DF] animate-pulse" />
          <div className="lg:col-span-5 space-y-4">
            <div className="h-4 w-28 bg-[#EAE6DF] animate-pulse" />
            <div className="h-10 w-3/4 bg-[#EAE6DF] animate-pulse" />
            <div className="h-6 w-32 bg-[#EAE6DF] animate-pulse" />
          </div>
        </div>
      </main>
    );
  }

  if (!product) {
    return (
      <main className="max-w-[1440px] mx-auto px-4 md:px-8 py-24 text-center space-y-4">
        <p className="font-mono-tabular text-[11px] uppercase tracking-[0.16em] text-[#99968F]">
          COMPLEX / 404
        </p>
        <h1 className="font-display text-2xl md:text-3xl font-bold tracking-tight">
          Produto não encontrado.
        </h1>
        <p className="text-sm text-[#171717]/70 max-w-md mx-auto">
          A peça solicitada não está disponível no arquivo atual da Coleção 01.
        </p>
        <button
          type="button"
          onClick={() => onNavigate('/shop')}
          className="mt-2 px-6 py-3 bg-[#171717] text-[#F1EEE8] font-mono-tabular text-xs uppercase tracking-[0.12em] hover:bg-[#171717]/88 transition-colors cursor-pointer"
        >
          Voltar ao catálogo
        </button>
      </main>
    );
  }

  const activeColorObj =
    product.colors.find((c) => c.name === selectedColor) || product.colors[0];
  const galleryImages =
    activeColorObj?.images?.length > 0 ? activeColorObj.images : product.images;

  const variantStock = getVariantStock(product, selectedSize);
  const relatedProducts = products
    .filter((p) => p.id !== product.id && p.active)
    .slice(0, 3);

  const handleAddToBag = () => {
    if (!selectedSize || variantStock <= 0) return;
    addToCart(product, selectedColor, selectedSize, quantity);
    setJustAdded(true);
    if (addedTimerRef.current !== null) {
      window.clearTimeout(addedTimerRef.current);
    }
    addedTimerRef.current = window.setTimeout(() => {
      setJustAdded(false);
      addedTimerRef.current = null;
    }, 1400);
  };

  const handleCepLookup = async (e: React.FormEvent) => {
    e.preventDefault();
    setCepError('');
    if (!validateCep(cepInput)) {
      setCepError('Informe um CEP válido com 8 dígitos.');
      setCepQuotes([]);
      return;
    }

    const quotes = calculateShippingQuotes(cepInput, product.priceBrl);
    setCepQuotes(quotes);

    try {
      const res = await fetch(`/api/cep/${cepInput.replace(/\D/g, '')}`);
      if (res.ok) {
        const data = (await res.json()) as { city?: string; state?: string };
        if (data.city && data.state) {
          setCepLocation(`${data.city} — ${data.state}`);
        }
      }
    } catch {
      setCepLocation('');
    }
  };

  const toggleAccordion = (key: string) => {
    setOpenAccordion((current) => (current === key ? null : key));
  };

  return (
    <main className="bg-[#F1EEE8] text-[#171717] pb-20 lg:pb-0">
      <Breadcrumbs
        items={breadcrumbItems}
        onNavigate={onNavigate}
        rightMeta={product.isDemo ? 'PEÇA DEMO' : product.collection}
      />

      {productJsonLd && (
        <script
          type="application/ld+json"
          data-complex-jsonld="product"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(productJsonLd) }}
        />
      )}

      {/* Main Split Section */}
      <section className="max-w-[1440px] mx-auto px-4 md:px-8 py-8 md:py-12">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-start">
          {/* Left: Gallery — mounts ONLY desktop OR mobile viewer to avoid hidden eager image decodes */}
          <div className="lg:col-span-7">
            {!isDesktop ? (
              <div className="space-y-3">
                <div className="aspect-[3/4] w-full bg-[#EAE6DF] overflow-hidden">
                  <OptimizedImage
                    key={`${selectedColor}-${activeImageIdx}`}
                    src={galleryImages[activeImageIdx] || galleryImages[0]}
                    alt={`${product.name} — imagem ${activeImageIdx + 1}`}
                    sizes="gallery"
                    priority
                    className="w-full h-full page-transition-enter"
                    imgClassName="w-full h-full object-cover"
                  />
                </div>
                <div className="grid grid-cols-4 gap-2">
                  {galleryImages.map((img, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => setActiveImageIdx(idx)}
                      className={`aspect-[3/4] bg-[#EAE6DF] overflow-hidden border transition-[border-color,opacity] duration-200 cursor-pointer ${
                        activeImageIdx === idx
                          ? 'border-[#171717] opacity-100'
                          : 'border-transparent opacity-65 hover:opacity-90'
                      }`}
                    >
                      <OptimizedImage
                        src={img}
                        alt={`${product.name} miniatura ${idx + 1}`}
                        sizes="thumb"
                        eager={idx < 4}
                        className="w-full h-full"
                        imgClassName="w-full h-full object-cover"
                      />
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-4">
                {galleryImages.map((img, idx) => {
                  const isOddFinal =
                    galleryImages.length % 2 === 1 && idx === galleryImages.length - 1;
                  return (
                    <div
                      key={`${selectedColor}-${idx}`}
                      className={`${
                        isOddFinal ? 'col-span-2 aspect-[16/10]' : 'aspect-[3/4]'
                      } group w-full bg-[#EAE6DF] overflow-hidden`}
                    >
                      <OptimizedImage
                        src={img}
                        alt={`${product.name} — ${selectedColor} foto ${idx + 1}`}
                        sizes={isOddFinal ? 'split' : 'gallery'}
                        priority={idx === 0}
                        eager={idx === 1}
                        className="w-full h-full"
                        imgClassName="product-hover-zoom w-full h-full object-cover group-hover:scale-[1.03]"
                      />
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Right: Sticky Purchase Module */}
          <div className="lg:col-span-5 lg:sticky lg:top-24 space-y-6">
            <div>
              <p className="font-mono-tabular text-[11px] uppercase tracking-[0.14em] text-[#99968F] mb-2">
                {product.collection}
              </p>
              <h1 className="font-display text-3xl md:text-4xl font-extrabold tracking-[-0.025em] uppercase leading-[1.02]">
                {product.name}
              </h1>
              <p className="mt-3 font-mono-tabular text-xl text-[#171717]">
                {formatBrl(product.priceBrl)}
              </p>
            </div>

            <p className="text-[15px] leading-relaxed text-[#171717]/80">
              {product.description}
            </p>

            {/* Color Selection */}
            <div className="space-y-2.5">
              <p className="font-mono-tabular text-[11px] uppercase tracking-[0.12em]">
                COR — <span className="text-[#99968F]">{selectedColor}</span>
              </p>
              <div className="flex items-center gap-3">
                {product.colors.map((color) => (
                  <button
                    key={color.name}
                    type="button"
                    onClick={() => {
                      setSelectedColor(color.name);
                      setActiveImageIdx(0);
                    }}
                    aria-label={`Selecionar cor ${color.name}`}
                    title={color.name}
                    className={`w-7 h-7 rounded-full border transition-transform duration-200 cursor-pointer ${
                      selectedColor === color.name
                        ? 'border-[#171717] ring-2 ring-[#171717] ring-offset-2 ring-offset-[#F1EEE8] scale-105'
                        : 'border-[#171717]/25 hover:scale-110'
                    }`}
                    style={{ backgroundColor: color.hex }}
                  />
                ))}
              </div>
            </div>

            {/* Size Selection */}
            <div className="space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="font-mono-tabular text-[11px] uppercase tracking-[0.12em]">
                  SELECIONAR TAMANHO
                </span>
                <button
                  type="button"
                  onClick={() => setSizeGuideOpen(true)}
                  className="inline-flex items-center gap-1 font-mono-tabular text-[11px] uppercase tracking-[0.1em] text-[#171717]/75 hover:text-[#171717] underline underline-offset-4 transition-colors cursor-pointer"
                >
                  <Ruler className="w-3.5 h-3.5" />
                  <span>Guia de medidas</span>
                </button>
              </div>

              <div className="grid grid-cols-5 gap-2">
                {product.sizes.map((variant) => {
                  const soldOut = variant.stock <= 0;
                  const active = selectedSize === variant.size;
                  return (
                    <button
                      key={variant.size}
                      type="button"
                      disabled={soldOut}
                      onClick={() => {
                        setSelectedSize(variant.size);
                        setQuantity(1);
                      }}
                      className={`h-11 font-mono-tabular text-xs border transition-[background-color,color,border-color,transform] duration-200 ${
                        soldOut
                          ? 'border-[#171717]/10 text-[#99968F] line-through cursor-not-allowed bg-[#EAE6DF]/40'
                          : active
                          ? 'bg-[#171717] text-[#F1EEE8] border-[#171717] cursor-pointer'
                          : 'border-[#171717]/25 text-[#171717] hover:border-[#171717] active:scale-[0.97] cursor-pointer'
                      }`}
                    >
                      {variant.size}
                    </button>
                  );
                })}
              </div>

              <div className="flex items-center justify-between font-mono-tabular text-[11px] text-[#99968F]">
                <span>
                  {variantStock > 0
                    ? `Disponível em estoque: ${variantStock} un.`
                    : 'Tamanho selecionado indisponível'}
                </span>
                <button
                  type="button"
                  onClick={openAdvisor}
                  className="text-[#171717] underline underline-offset-4 hover:opacity-70 transition-opacity cursor-pointer"
                >
                  Dúvida no caimento?
                </button>
              </div>
            </div>

            {/* Quantity & Add to Bag CTA */}
            <div className="flex items-stretch gap-3 pt-1">
              <div className="inline-flex items-center border border-[#171717]/25 bg-[#F1EEE8]">
                <button
                  type="button"
                  onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                  disabled={variantStock <= 0 || quantity <= 1}
                  aria-label="Diminuir quantidade"
                  className="w-10 h-12 inline-flex items-center justify-center hover:bg-[#171717]/6 disabled:opacity-30 transition-colors cursor-pointer"
                >
                  <Minus className="w-3.5 h-3.5" />
                </button>
                <span className="w-10 text-center font-mono-tabular text-xs">
                  {variantStock > 0 ? quantity : 0}
                </span>
                <button
                  type="button"
                  onClick={() => setQuantity((q) => Math.min(variantStock, q + 1))}
                  disabled={variantStock <= 0 || quantity >= variantStock}
                  aria-label="Aumentar quantidade"
                  className="w-10 h-12 inline-flex items-center justify-center hover:bg-[#171717]/6 disabled:opacity-30 transition-colors cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                </button>
              </div>

              <button
                type="button"
                disabled={variantStock <= 0}
                onClick={handleAddToBag}
                className={`group flex-1 h-12 px-6 font-mono-tabular text-xs uppercase tracking-[0.14em] inline-flex items-center justify-between active:scale-[0.99] transition-[background-color,transform] duration-200 ${
                  variantStock <= 0
                    ? 'bg-[#99968F] text-[#F1EEE8] cursor-not-allowed'
                    : justAdded
                    ? 'bg-[#6A705C] text-[#F1EEE8] cursor-pointer'
                    : 'bg-[#171717] text-[#F1EEE8] hover:bg-[#171717]/88 cursor-pointer'
                }`}
              >
                <span>
                  {variantStock <= 0
                    ? 'Tamanho Esgotado'
                    : justAdded
                    ? 'Adicionado à Sacola'
                    : 'Adicionar à Sacola'}
                </span>
                {justAdded ? (
                  <Check className="w-4 h-4" />
                ) : (
                  <ArrowUpRight className="w-4 h-4 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform duration-200" />
                )}
              </button>
            </div>

            {/* CEP Shipping Estimator (Demo Estimate) */}
            <div className="pt-2 border-t border-[#171717]/12">
              <form onSubmit={handleCepLookup} className="flex items-center gap-2">
                <label htmlFor="pdp-cep-input" className="sr-only">
                  Calcular estimativa de frete por CEP
                </label>
                <input
                  id="pdp-cep-input"
                  type="text"
                  value={cepInput}
                  onChange={(e) => setCepInput(formatCep(e.target.value))}
                  placeholder="CEP para estimativa (00000-000)"
                  className="flex-1 h-10 px-3 bg-transparent border border-[#171717]/20 font-mono-tabular text-xs focus:outline-none focus:border-[#171717] transition-colors"
                />
                <button
                  type="submit"
                  className="h-10 px-4 border border-[#171717] font-mono-tabular text-[11px] uppercase tracking-[0.12em] hover:bg-[#171717]/6 transition-colors cursor-pointer"
                >
                  Calcular
                </button>
              </form>
              {cepError && <p className="mt-1.5 text-xs text-[#8A2C2C]">{cepError}</p>}
              {cepQuotes.length > 0 && (
                <div className="mt-3 p-3 bg-[#EAE6DF]/70 space-y-1.5 text-xs cart-item-enter">
                  {cepLocation && (
                    <p className="font-mono-tabular text-[10px] uppercase tracking-[0.1em] text-[#99968F]">
                      Destino: {cepLocation}
                    </p>
                  )}
                  {cepQuotes.map((q) => (
                    <div key={q.id} className="flex items-center justify-between">
                      <span>
                        {q.carrier} ({q.estimatedDays})
                      </span>
                      <span className="font-mono-tabular font-medium">
                        {q.priceBrl === 0 ? 'Cortesia' : formatBrl(q.priceBrl)}
                      </span>
                    </div>
                  ))}
                  <p className="text-[10px] text-[#99968F] pt-1">
                    Valores estimados em modo demonstrativo (sem integração ativa de transportadora).
                  </p>
                </div>
              )}
            </div>

            {/* Accordions */}
            <div className="divide-y divide-[#171717]/15 border-t border-b border-[#171717]/15">
              {[
                {
                  key: 'details',
                  label: 'Detalhes e Composição',
                  content: (
                    <div className="pb-4 text-xs leading-relaxed text-[#171717]/80 space-y-2">
                      <p>{product.composition}</p>
                      <p>{product.careInstructions}</p>
                    </div>
                  ),
                },
                {
                  key: 'fit',
                  label: 'Modelagem & Caimento',
                  content: (
                    <div className="pb-4 text-xs leading-relaxed text-[#171717]/80">
                      <p>{product.fitNotes}</p>
                    </div>
                  ),
                },
                {
                  key: 'shipping',
                  label: 'Entregas & Devoluções',
                  content: (
                    <div className="pb-4 text-xs leading-relaxed text-[#171717]/80 space-y-1.5">
                      <p>{editorial.shippingNote}</p>
                      <p>{editorial.returnsNote}</p>
                    </div>
                  ),
                },
              ].map((item) => {
                const isOpen = openAccordion === item.key;
                return (
                  <div key={item.key}>
                    <button
                      type="button"
                      onClick={() => toggleAccordion(item.key)}
                      aria-expanded={isOpen}
                      className="w-full py-4 flex items-center justify-between font-mono-tabular text-[11px] uppercase tracking-[0.12em] hover:opacity-75 transition-opacity cursor-pointer"
                    >
                      <span>{item.label}</span>
                      <span
                        className={`inline-block transition-transform duration-200 ${
                          isOpen ? 'rotate-45' : 'rotate-0'
                        }`}
                        aria-hidden="true"
                      >
                        +
                      </span>
                    </button>
                    <div className="accordion-panel" data-open={isOpen ? 'true' : 'false'}>
                      <div>{item.content}</div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </section>

      {/* Complete the Look / Related */}
      <Reveal as="section" className="border-t border-[#171717]/12 bg-[#EAE6DF]/45">
        <div className="max-w-[1440px] mx-auto px-4 md:px-8 py-14 md:py-18">
          <p className="font-mono-tabular text-[11px] uppercase tracking-[0.14em] text-[#99968F] mb-1">
            CURADORIA COM ESTA PEÇA
          </p>
          <h2 className="font-display text-2xl md:text-3xl font-bold tracking-[-0.02em] mb-8">
            Complete o look
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
            {relatedProducts.map((rel) => (
              <ProductCard
                key={rel.id}
                product={rel}
                onSelect={handleSelectRelated}
              />
            ))}
          </div>
        </div>
      </Reveal>

      {/* Compact Sticky Mobile Purchase Bar */}
      <div className="lg:hidden fixed inset-x-0 bottom-0 z-30 bg-[#F1EEE8]/95 backdrop-blur-md border-t border-[#171717]/15 px-4 py-3 flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-medium truncate">{product.name}</p>
          <p className="font-mono-tabular text-[11px] text-[#99968F]">
            {formatBrl(product.priceBrl)} · Tam {selectedSize || '—'}
          </p>
        </div>
        <button
          type="button"
          disabled={variantStock <= 0}
          onClick={handleAddToBag}
          className={`shrink-0 h-10 px-4 font-mono-tabular text-[11px] uppercase tracking-[0.12em] inline-flex items-center gap-1.5 transition-colors ${
            variantStock <= 0
              ? 'bg-[#99968F] text-[#F1EEE8] cursor-not-allowed'
              : justAdded
              ? 'bg-[#6A705C] text-[#F1EEE8]'
              : 'bg-[#171717] text-[#F1EEE8]'
          }`}
        >
          <span>{variantStock <= 0 ? 'Esgotado' : justAdded ? 'Adicionado' : 'Adicionar'}</span>
          {justAdded ? <Check className="w-3.5 h-3.5" /> : <ArrowUpRight className="w-3.5 h-3.5" />}
        </button>
      </div>

      <SizeGuideModal
        open={sizeGuideOpen}
        onClose={() => setSizeGuideOpen(false)}
        product={product}
      />
    </main>
  );
});

ProductDetailPage.displayName = 'ProductDetailPage';
