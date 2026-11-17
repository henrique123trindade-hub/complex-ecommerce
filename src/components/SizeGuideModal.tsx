import React, { useEffect } from 'react';
import { X } from 'lucide-react';
import type { Product } from '../types/store';

interface SizeGuideModalProps {
  open: boolean;
  onClose: () => void;
  product: Product;
}

export const SizeGuideModal: React.FC<SizeGuideModalProps> = ({ open, onClose, product }) => {
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && open) onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  const isBottom = product.category === 'Bottoms';
  const entries = Object.entries(product.measurements || {});

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#171717]/50"
      role="dialog"
      aria-modal="true"
      aria-label={`Guia de medidas — ${product.name}`}
    >
      <div className="fixed inset-0" onClick={onClose} aria-hidden="true" />
      <div className="relative z-10 w-full max-w-lg bg-[#F1EEE8] text-[#171717] border border-[#171717]/20 p-6 md:p-8">
        <div className="flex items-start justify-between gap-4 pb-4 border-b border-[#171717]/12">
          <div>
            <p className="font-mono-tabular text-[10px] uppercase tracking-[0.14em] text-[#99968F]">
              GUIA DE MEDIDAS (CM)
            </p>
            <h2 className="font-display text-xl font-bold tracking-tight mt-1">
              {product.name}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar guia de medidas"
            className="w-9 h-9 inline-flex items-center justify-center -mr-2 cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <p className="mt-4 text-xs leading-relaxed text-[#171717]/80">
          {product.fitNotes} Medidas tomadas com a peça estendida em superfície plana (tolerância de ± 1,5 cm).
        </p>

        {entries.length > 0 ? (
          <div className="mt-5 overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-[#171717]/20 font-mono-tabular text-[11px] uppercase tracking-[0.1em] text-[#99968F]">
                  <th className="py-2.5 pr-4">Tamanho</th>
                  <th className="py-2.5 pr-4">{isBottom ? 'Cintura (cm)' : 'Tórax / Largura (cm)'}</th>
                  <th className="py-2.5 pr-4">Comprimento (cm)</th>
                  <th className="py-2.5">{isBottom ? 'Entrepernas (cm)' : 'Ombro a Ombro (cm)'}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#171717]/10 font-mono-tabular text-xs">
                {entries.map(([size, dims]) => (
                  <tr key={size}>
                    <td className="py-2.5 pr-4 font-medium">{size}</td>
                    <td className="py-2.5 pr-4">{dims.widthCm}</td>
                    <td className="py-2.5 pr-4">{dims.lengthCm}</td>
                    <td className="py-2.5">{dims.shoulderOrInseamCm}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="mt-4 text-xs text-[#99968F]">
            Consulte a descrição do produto ou nossa consultoria de caimento para medidas detalhadas.
          </p>
        )}
      </div>
    </div>
  );
};
