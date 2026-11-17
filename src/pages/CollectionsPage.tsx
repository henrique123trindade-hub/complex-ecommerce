import React from 'react';
import { ArrowRight } from 'lucide-react';
import { STORE_ASSETS } from '../data/assets';
import { useStore } from '../context/StoreContext';
import { OptimizedImage } from '../components/OptimizedImage';

interface CollectionsPageProps {
  onNavigate: (path: string) => void;
}

export const CollectionsPage: React.FC<CollectionsPageProps> = ({ onNavigate }) => {
  const { products } = useStore();

  const looks = [
    {
      index: 'PRODUÇÃO 01',
      title: 'Concreto & Peso Bruto',
      description: 'Sobreposição de malha encorpada estonada e calça ampla com recorte arquitetônico.',
      image: STORE_ASSETS.heroDesktop.url,
      productSlug: products[0]?.slug || 'washed-essential-hoodie',
      productLabel: 'Ver Moletom Essencial Estonado',
    },
    {
      index: 'PRODUÇÃO 02',
      title: 'Silhueta Urbana Diurna',
      description: 'Camiseta boxy de ombro deslocado combinada ao volume amplo do jeans lavado.',
      image: STORE_ASSETS.editorialUrban.url,
      productSlug: 'heavyweight-box-tee',
      productLabel: 'Ver Camiseta Boxy Pesada',
    },
    {
      index: 'PRODUÇÃO 03',
      title: 'Estudo de Volume em Estúdio',
      description: 'Capuz estruturado sem cordão e tingimento mineral em cinza estonado.',
      image: STORE_ASSETS.editorialStudioHoodie.url,
      productSlug: 'wide-architectural-denim',
      productLabel: 'Ver Calça Jeans Wide Arquitetônica',
    },
    {
      index: 'PRODUÇÃO 04',
      title: 'Série Noturna Utilitária',
      description: 'Jaqueta fosca em poliamida técnica e calça cargo ripstop em oliva.',
      image: STORE_ASSETS.campaignNight.url,
      productSlug: 'cropped-storm-shell-jacket',
      productLabel: 'Ver Jaqueta Corta-Vento Cropped',
    },
  ];

  return (
    <main className="bg-[#F1EEE8] text-[#171717]">
      <section className="max-w-[1440px] mx-auto px-4 md:px-8 pt-12 pb-10 border-b border-[#171717]/12">
        <p className="font-mono-tabular text-[11px] uppercase tracking-[0.16em] text-[#99968F] mb-2">
          ARQUIVO EDITORIAL / 2026
        </p>
        <h1 className="font-display text-4xl md:text-6xl font-extrabold tracking-[-0.03em] leading-[0.95]">
          Coleção 01 — Editorial
        </h1>
        <p className="mt-4 text-[15px] text-[#171717]/75 max-w-xl">
          Um estudo sobre proporções cotidianas em algodão encorpado, sarja estruturada e paleta mineral neutra.
        </p>
      </section>

      <section className="max-w-[1440px] mx-auto px-4 md:px-8 py-12 md:py-16 space-y-16">
        {looks.map((look, idx) => (
          <article
            key={look.index}
            className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center pb-14 border-b border-[#171717]/10 last:border-b-0"
          >
            <div className={`lg:col-span-7 ${idx % 2 === 1 ? 'lg:order-2' : ''}`}>
              <div className="aspect-[4/5] md:aspect-[16/11] bg-[#EAE6DF] overflow-hidden">
                <OptimizedImage
                  src={look.image}
                  alt={look.title}
                  sizes="split"
                  priority={idx === 0}
                  className="w-full h-full"
                  imgClassName="w-full h-full object-cover object-top"
                />
              </div>
            </div>

            <div className={`lg:col-span-5 space-y-4 ${idx % 2 === 1 ? 'lg:order-1 lg:pr-8' : 'lg:pl-8'}`}>
              <p className="font-mono-tabular text-[11px] uppercase tracking-[0.14em] text-[#99968F]">
                {look.index}
              </p>
              <h2 className="font-display text-2xl md:text-3xl font-bold tracking-[-0.02em]">
                {look.title}
              </h2>
              <p className="text-[15px] leading-relaxed text-[#171717]/80">
                {look.description}
              </p>
              <button
                type="button"
                onClick={() => onNavigate(`/product/${look.productSlug}`)}
                className="inline-flex items-center gap-2 font-mono-tabular text-xs uppercase tracking-[0.12em] border-b border-[#171717] pb-1 hover:opacity-75 cursor-pointer"
              >
                <span>{look.productLabel}</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </article>
        ))}
      </section>
    </main>
  );
};
