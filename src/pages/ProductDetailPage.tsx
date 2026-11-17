import React, { useEffect, useMemo, useState } from 'react';
import { ArrowUpRight, Minus, Plus, Ruler } from 'lucide-react';
import { useStore } from '../context/StoreContext';
import { ProductCard } from '../components/ProductCard';
import { SizeGuideModal } from '../components/SizeGuideModal';
import { OptimizedImage } from '../components/OptimizedImage';
import {
  calculateShippingQuotes,
  formatBrl,
  formatCep,
  getCategoryLabel,
  getVariantStock,
  validateCep,
} from '../utils/commerce';
import type { ShippingQuote } from '../types/store';

interface ProductDetailPageProps {
  slug: string;
  onNavigate: (path: string) => void;
}

export const ProductDetailPage: React.FC<ProductDetailPageProps> = ({ slug, onNavigate }) => {
  const { products, editorial, addToCart, openAdvisor } = useStore();

  const product = useMemo(
    () => products.find((p) => p.slug === slug) || products[0],
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
  }, [product]);

  if (!product) {
    return (
      <main className="max-w-[1440px] mx-auto px-4 md:px-8 py-24 text-center">
        <h1 className="font-display text-2xl font-bold">Produto não encontrado.</h1>
        <button
          type="button"
          onClick={() => onNavigate('/shop')}
          className="mt-6 px-6 py-3 bg-[#171717] text-[#F1EEE8] text-xs uppercase tracking-[0.12em] cursor-pointer"
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
    <main className="bg-[#F1EEE8] text-[#171717]">
      {/* Breadcrumb Bar */}
      <div className="max-w-[1440px] mx-auto px-4 md:px-8 py-4 border-b border-[#171717]/10 flex items-center justify-between gap-4 font-mono-tabular text-[11px] uppercase tracking-[0.12em] text-[#99968F]">
        <nav aria-label="Breadcrumb" className="flex items-center gap-2 truncate">
          <button type="button" onClick={() => onNavigate('/shop')} className="hover:text-[#171717] cursor-pointer">
            Loja
          </button>
          <span aria-hidden="true">/</span>
          <button
            type="button"
            onClick={() => onNavigate(`/shop?category=${encodeURIComponent(product.category)}`)}
            className="hover:text-[#171717] cursor-pointer"
          >
            {getCategoryLabel(product.category)}
          </button>
          <span aria-hidden="true">/</span>
          <span className="text-[#171717] truncate">{product.name}</span>
        </nav>

        <span className="hidden sm:inline shrink-0">
          {product.isDemo ? 'PEÇA DEMO' : product.collection}
        </span>
      </div>

      {/* Main Split Section */}
      <section className="max-w-[1440px] mx-auto px-4 md:px-8 py-8 md:py-12">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-start">
          {/* Left: Gallery */}
          <div className="lg:col-span-7">
            {/* Mobile single viewer + thumbnails */}
            <div className="lg:hidden space-y-3">
              <div className="aspect-[3/4] w-full bg-[#EAE6DF] overflow-hidden">
                <OptimizedImage
                  src={galleryImages[activeImageIdx] || galleryImages[0]}
                  alt={`${product.name} — imagem ${activeImageIdx + 1}`}
                  sizes="gallery"
                  priority
                  className="w-full h-full"
                  imgClassName="w-full h-full object-cover"
                />
              </div>
              <div className="grid grid-cols-4 gap-2">
                {galleryImages.map((img, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => setActiveImageIdx(idx)}
                    className={`aspect-[3/4] bg-[#EAE6DF] overflow-hidden border cursor-pointer ${
                      activeImageIdx === idx ? 'border-[#171717]' : 'border-transparent opacity-70'
                    }`}
                  >
                    <OptimizedImage
                      src={img}
                      alt={`${product.name} miniatura ${idx + 1}`}
                      sizes="thumb"
                      className="w-full h-full"
                      imgClassName="w-full h-full object-cover"
                    />
                  </button>
                ))}
              </div>
            </div>

            {/* Desktop dual-column editorial gallery matching reference */}
            <div className="hidden lg:grid grid-cols-2 gap-4">
              {galleryImages.map((img, idx) => {
                const isOddFinal =
                  galleryImages.length % 2 === 1 && idx === galleryImages.length - 1;
                return (
                  <div
                    key={idx}
                    className={`${
                      isOddFinal ? 'col-span-2 aspect-[16/10]' : 'aspect-[3/4]'
                    } w-full bg-[#EAE6DF] overflow-hidden`}
                  >
                    <OptimizedImage
                      src={img}
                      alt={`${product.name} — ${selectedColor} foto ${idx + 1}`}
                      sizes={isOddFinal ? 'split' : 'gallery'}
                      priority={idx < 2}
                      className="w-full h-full"
                      imgClassName="w-full h-full object-cover"
                    />
                  </div>
                );
              })}
            </div>
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
                    className={`w-7 h-7 rounded-full border transition-transform cursor-pointer ${
                      selectedColor === color.name
                        ? 'border-[#171717] ring-2 ring-[#171717] ring-offset-2 ring-offset-[#F1EEE8]'
                        : 'border-[#171717]/25 hover:scale-105'
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
                  className="inline-flex items-center gap-1 font-mono-tabular text-[11px] uppercase tracking-[0.1em] text-[#171717]/75 hover:text-[#171717] underline underline-offset-4 cursor-pointer"
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
                      className={`h-11 font-mono-tabular text-xs border transition-colors ${
                        soldOut
                          ? 'border-[#171717]/10 text-[#99968F] line-through cursor-not-allowed bg-[#EAE6DF]/40'
                          : active
                          ? 'bg-[#171717] text-[#F1EEE8] border-[#171717] cursor-pointer'
                          : 'border-[#171717]/25 text-[#171717] hover:border-[#171717] cursor-pointer'
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
                  className="text-[#171717] underline underline-offset-4 cursor-pointer"
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
                  className="w-10 h-12 inline-flex items-center justify-center disabled:opacity-30 cursor-pointer"
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
                  className="w-10 h-12 inline-flex items-center justify-center disabled:opacity-30 cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                </button>
              </div>

              <button
                type="button"
                disabled={variantStock <= 0}
                onClick={handleAddToBag}
                className="flex-1 h-12 px-6 bg-[#171717] text-[#F1EEE8] font-mono-tabular text-xs uppercase tracking-[0.14em] inline-flex items-center justify-between hover:bg-[#171717]/90 disabled:bg-[#99968F] disabled:cursor-not-allowed transition-colors cursor-pointer"
              >
                <span>
                  {variantStock > 0 ? 'Adicionar à Sacola' : 'Tamanho Esgotado'}
                </span>
                <ArrowUpRight className="w-4 h-4" />
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
                  className="flex-1 h-10 px-3 bg-transparent border border-[#171717]/20 font-mono-tabular text-xs focus:outline-none focus:border-[#171717]"
                />
                <button
                  type="submit"
                  className="h-10 px-4 border border-[#171717] font-mono-tabular text-[11px] uppercase tracking-[0.12em] hover:bg-[#171717]/5 cursor-pointer"
                >
                  Calcular
                </button>
              </form>
              {cepError && <p className="mt-1.5 text-xs text-[#8A2C2C]">{cepError}</p>}
              {cepQuotes.length > 0 && (
                <div className="mt-3 p-3 bg-[#EAE6DF]/70 space-y-1.5 text-xs">
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
              <div>
                <button
                  type="button"
                  onClick={() => toggleAccordion('details')}
                  aria-expanded={openAccordion === 'details'}
                  className="w-full py-4 flex items-center justify-between font-mono-tabular text-[11px] uppercase tracking-[0.12em] cursor-pointer"
                >
                  <span>Detalhes e Composição</span>
                  <span>{openAccordion === 'details' ? '−' : '+'}</span>
                </button>
                {openAccordion === 'details' && (
                  <div className="pb-4 text-xs leading-relaxed text-[#171717]/80 space-y-2">
                    <p>{product.composition}</p>
                    <p>{product.careInstructions}</p>
                  </div>
                )}
              </div>

              <div>
                <button
                  type="button"
                  onClick={() => toggleAccordion('fit')}
                  aria-expanded={openAccordion === 'fit'}
                  className="w-full py-4 flex items-center justify-between font-mono-tabular text-[11px] uppercase tracking-[0.12em] cursor-pointer"
                >
                  <span>Modelagem & Caimento</span>
                  <span>{openAccordion === 'fit' ? '−' : '+'}</span>
                </button>
                {openAccordion === 'fit' && (
                  <div className="pb-4 text-xs leading-relaxed text-[#171717]/80">
                    <p>{product.fitNotes}</p>
                  </div>
                )}
              </div>

              <div>
                <button
                  type="button"
                  onClick={() => toggleAccordion('shipping')}
                  aria-expanded={openAccordion === 'shipping'}
                  className="w-full py-4 flex items-center justify-between font-mono-tabular text-[11px] uppercase tracking-[0.12em] cursor-pointer"
                >
                  <span>Entregas & Devoluções</span>
                  <span>{openAccordion === 'shipping' ? '−' : '+'}</span>
                </button>
                {openAccordion === 'shipping' && (
                  <div className="pb-4 text-xs leading-relaxed text-[#171717]/80 space-y-1.5">
                    <p>{editorial.shippingNote}</p>
                    <p>{editorial.returnsNote}</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Complete the Look / Related */}
      <section className="border-t border-[#171717]/12 bg-[#EAE6DF]/45">
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
                onSelect={(relSlug) => onNavigate(`/product/${relSlug}`)}
              />
            ))}
          </div>
        </div>
      </section>

      <SizeGuideModal
        open={sizeGuideOpen}
        onClose={() => setSizeGuideOpen(false)}
        product={product}
      />
    </main>
  );
};
