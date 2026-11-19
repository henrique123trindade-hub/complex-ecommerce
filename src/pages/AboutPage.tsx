import React from 'react';
import { ArrowRight } from 'lucide-react';
import { STORE_ASSETS } from '../data/assets';
import { useCatalog } from '../context/StoreContext';
import { OptimizedImage } from '../components/OptimizedImage';
import { Reveal } from '../components/Reveal';

interface AboutPageProps {
  onNavigate: (path: string) => void;
}

export const AboutPage: React.FC<AboutPageProps> = ({ onNavigate }) => {
  const { editorial } = useCatalog();

  return (
    <main className="bg-[#F1EEE8] text-[#171717]">
      <section className="max-w-[1440px] mx-auto px-4 md:px-8 py-14 md:py-20 border-b border-[#171717]/12">
        <p className="font-mono-tabular text-[11px] uppercase tracking-[0.16em] text-[#99968F] mb-3">
          MANIFESTO / COMPLEX
        </p>
        <h1 className="font-display text-4xl md:text-6xl font-extrabold tracking-[-0.03em] leading-[0.98] max-w-3xl text-balance">
          Essenciais contemporâneos desenhados pela proporção.
        </h1>
      </section>

      <Reveal as="section" className="max-w-[1440px] mx-auto px-4 md:px-8 py-14 md:py-20 grid grid-cols-1 lg:grid-cols-12 gap-10 items-start">
        <div className="group lg:col-span-6 aspect-[4/5] bg-[#EAE6DF] overflow-hidden">
          <OptimizedImage
            src={STORE_ASSETS.editorialOuterwear.url}
            alt={STORE_ASSETS.editorialOuterwear.alt}
            sizes="split"
            priority
            className="w-full h-full"
            imgClassName="product-hover-zoom w-full h-full object-cover object-top group-hover:scale-[1.025]"
          />
        </div>

        <div className="lg:col-span-6 space-y-8 lg:pl-8">
          <div className="space-y-4">
            <h2 className="font-display text-2xl font-bold tracking-tight">
              Linguagem Visual e Construção
            </h2>
            <p className="text-[15px] leading-relaxed text-[#171717]/80">
              A COMPLEX nasce como um exercício de contenção e forma aplicada ao vestuário urbano. Em vez de gráficos excessivos, priorizamos o desenho de ombro, o volume do caimento e a consistência tátil de bases neutras em Bone, Carbon Black, Muted Olive e Washed Taupe.
            </p>
            <p className="text-[15px] leading-relaxed text-[#171717]/80">
              Cada coleção parte de um número reduzido de peças essenciais que dialogam entre si e podem ser combinadas sem esforço.
            </p>
          </div>

          <div className="group aspect-[4/3] bg-[#EAE6DF] overflow-hidden">
            <OptimizedImage
              src={STORE_ASSETS.detailCotton.url}
              alt={STORE_ASSETS.detailCotton.alt}
              sizes="split"
              className="w-full h-full"
              imgClassName="product-hover-zoom w-full h-full object-cover group-hover:scale-[1.03]"
            />
          </div>

          <div id="privacidade" className="pt-6 border-t border-[#171717]/12 space-y-2">
            <h3 className="font-mono-tabular text-[11px] uppercase tracking-[0.14em] text-[#99968F]">
              Políticas & Informações Configuráveis
            </h3>
            <p className="text-xs leading-relaxed text-[#171717]/75">
              <strong>Atendimento:</strong> {editorial.contactEmail}
            </p>
            <p className="text-xs leading-relaxed text-[#171717]/75">
              <strong>Entregas:</strong> {editorial.shippingNote}
            </p>
            <p id="termos" className="text-xs leading-relaxed text-[#171717]/75">
              <strong>Trocas e Devoluções:</strong> {editorial.returnsNote}
            </p>
          </div>

          <button
            type="button"
            onClick={() => onNavigate('/shop')}
            className="group inline-flex items-center gap-2 px-6 py-3 bg-[#171717] text-[#F1EEE8] font-mono-tabular text-xs uppercase tracking-[0.14em] hover:bg-[#171717]/88 active:scale-[0.99] transition-[background-color,transform] duration-200 cursor-pointer"
          >
            <span>Explorar Coleção 01</span>
            <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform duration-200" />
          </button>
        </div>
      </Reveal>
    </main>
  );
};
