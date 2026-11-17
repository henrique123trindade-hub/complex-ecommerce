import React from 'react';
import { ArrowUpRight } from 'lucide-react';
import { useStore } from '../context/StoreContext';
import { BrandMark } from './BrandMark';

interface FooterProps {
  onNavigate: (path: string) => void;
}

export const Footer: React.FC<FooterProps> = ({ onNavigate }) => {
  const { editorial, openAdvisor } = useStore();

  return (
    <footer className="bg-[#F1EEE8] text-[#171717] border-t border-[#171717]/15">
      <div className="max-w-[1440px] mx-auto px-4 md:px-8 pt-14 pb-10">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-10 pb-14 border-b border-[#171717]/12">
          {/* Institucional */}
          <div className="md:col-span-3 space-y-3">
            <h3 className="font-mono-tabular text-[11px] uppercase tracking-[0.14em] text-[#99968F]">
              Institucional
            </h3>
            <ul className="space-y-2 text-sm">
              <li>
                <button
                  type="button"
                  onClick={() => onNavigate('/about')}
                  className="hover:underline underline-offset-4 cursor-pointer"
                >
                  Sobre a COMPLEX
                </button>
              </li>
              <li>
                <button
                  type="button"
                  onClick={() => onNavigate('/collections')}
                  className="hover:underline underline-offset-4 cursor-pointer"
                >
                  Coleção 01 — Editorial
                </button>
              </li>
              <li>
                <button
                  type="button"
                  onClick={() => onNavigate('/shop')}
                  className="hover:underline underline-offset-4 cursor-pointer"
                >
                  Catálogo Completo
                </button>
              </li>
              <li>
                <button
                  type="button"
                  onClick={() => onNavigate('/admin')}
                  className="hover:underline underline-offset-4 text-[#6A705C] cursor-pointer"
                >
                  Painel Administrativo
                </button>
              </li>
            </ul>
          </div>

          {/* Atendimento */}
          <div className="md:col-span-3 space-y-3">
            <h3 className="font-mono-tabular text-[11px] uppercase tracking-[0.14em] text-[#99968F]">
              Atendimento
            </h3>
            <ul className="space-y-2 text-sm text-[#171717]/80">
              <li>{editorial.contactEmail}</li>
              <li>
                <button
                  type="button"
                  onClick={openAdvisor}
                  className="inline-flex items-center gap-1 text-[#171717] hover:underline underline-offset-4 cursor-pointer"
                >
                  Consultoria de Caimento <ArrowUpRight className="w-3.5 h-3.5" />
                </button>
              </li>
              <li>
                <button
                  type="button"
                  onClick={() => onNavigate('/account')}
                  className="hover:underline underline-offset-4 cursor-pointer"
                >
                  Minha Conta & Pedidos
                </button>
              </li>
            </ul>
          </div>

          {/* Entregas e Devoluções */}
          <div className="md:col-span-3 space-y-3">
            <h3 className="font-mono-tabular text-[11px] uppercase tracking-[0.14em] text-[#99968F]">
              Entregas & Devoluções
            </h3>
            <p className="text-xs leading-relaxed text-[#171717]/75">
              {editorial.shippingNote}
            </p>
            <p className="text-xs leading-relaxed text-[#171717]/75">
              {editorial.returnsNote}
            </p>
          </div>

          {/* Privacidade, Termos & Redes */}
          <div className="md:col-span-3 space-y-3">
            <h3 className="font-mono-tabular text-[11px] uppercase tracking-[0.14em] text-[#99968F]">
              Políticas & Redes
            </h3>
            <ul className="space-y-2 text-sm text-[#171717]/80">
              <li>
                <button
                  type="button"
                  onClick={() => onNavigate('/about#privacidade')}
                  className="hover:underline underline-offset-4 cursor-pointer"
                >
                  Política de Privacidade (Configurável)
                </button>
              </li>
              <li>
                <button
                  type="button"
                  onClick={() => onNavigate('/about#termos')}
                  className="hover:underline underline-offset-4 cursor-pointer"
                >
                  Termos de Uso (Configurável)
                </button>
              </li>
              <li className="font-mono-tabular text-xs pt-1 text-[#171717]">
                {editorial.instagramHandle}
              </li>
            </ul>
          </div>
        </div>

        {/* Bottom Wordmark Lockup */}
        <div className="pt-8 flex flex-col sm:flex-row sm:items-end justify-between gap-4">
          <div className="inline-flex items-center gap-3 text-[#171717]">
            <BrandMark className="w-11 h-5 md:w-14 md:h-7 shrink-0" />
            <span className="font-display text-3xl md:text-5xl font-extrabold tracking-[-0.04em] leading-none">
              COMPLEX
            </span>
          </div>
          <div className="flex flex-wrap items-center gap-4 font-mono-tabular text-[11px] uppercase tracking-[0.12em] text-[#99968F]">
            <span>Streetwear Independente</span>
            <span aria-hidden="true">/</span>
            <span>Catálogo Demonstrativo Configurável</span>
          </div>
        </div>
      </div>
    </footer>
  );
};
