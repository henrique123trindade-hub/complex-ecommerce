import React, { useEffect, useRef, useState } from 'react';
import { ImagePlus, Send, X } from 'lucide-react';
import { useCatalog, useStoreUI } from '../context/StoreContext';
import { useAnimatedDisclosure } from '../utils/useAnimatedDisclosure';

interface ChatMessage {
  role: 'user' | 'model';
  text: string;
}

export const StyleAssistantDrawer: React.FC = () => {
  const { products } = useCatalog();
  const { isAdvisorOpen, closeAdvisor } = useStoreUI();
  const { mounted, visible } = useAnimatedDisclosure(isAdvisorOpen, closeAdvisor, 320);

  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      role: 'model',
      text: 'Olá. Posso orientar sobre modelagem oversized, escolha de tamanho (XS a XL) ou combinações da Coleção 01. Você também pode enviar uma foto de uma peça ou referência para análise de proporções.',
    },
  ]);
  const [input, setInput] = useState('');
  const [deepMode, setDeepMode] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  if (!mounted) return null;

  const catalogSummary = products
    .filter((p) => p.active)
    .map(
      (p) =>
        `${p.name} (${p.category}, R$ ${p.priceBrl}, cores: ${p.colors.map((c) => c.name).join('/')}, caimento: ${p.fitNotes})`
    )
    .join('\n');

  const sendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    const text = input.trim();
    if (!text || loading) return;

    const nextHistory: ChatMessage[] = [...messages, { role: 'user', text }];
    setMessages(nextHistory);
    setInput('');
    setErrorMsg(null);
    setLoading(true);

    try {
      const res = await fetch('/api/ai/style-advisor', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: nextHistory,
          catalogSummary,
          deepMode,
        }),
      });
      const data = (await res.json()) as { reply?: string; error?: string };
      if (!res.ok) throw new Error(data.error || 'Falha ao consultar assistente.');
      setMessages((prev) => [...prev, { role: 'model', text: data.reply || '' }]);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Erro de comunicação com o servidor.');
    } finally {
      setLoading(false);
    }
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setErrorMsg(null);
    setLoading(true);

    const reader = new FileReader();
    reader.onload = async () => {
      try {
        const base64 = String(reader.result || '');
        setMessages((prev) => [
          ...prev,
          { role: 'user', text: `[Imagem enviada: ${file.name}] Analisar proporções e combinações na COMPLEX.` },
        ]);

        const res = await fetch('/api/ai/analyze-garment', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            imageBase64: base64,
            mimeType: file.type || 'image/jpeg',
            catalogSummary,
          }),
        });
        const data = (await res.json()) as { analysis?: string; error?: string };
        if (!res.ok) throw new Error(data.error || 'Falha ao analisar imagem.');
        setMessages((prev) => [...prev, { role: 'model', text: data.analysis || '' }]);
      } catch (err) {
        setErrorMsg(err instanceof Error ? err.message : 'Erro ao analisar imagem.');
      } finally {
        setLoading(false);
        if (fileInputRef.current) fileInputRef.current.value = '';
      }
    };
    reader.readAsDataURL(file);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex justify-end"
      role="dialog"
      aria-modal="true"
      aria-label="Consultoria de Estilo e Caimento COMPLEX"
    >
      <div
        className={`overlay-backdrop fixed inset-0 bg-[#171717]/40 backdrop-blur-[1px] ${
          visible ? 'opacity-100' : 'opacity-0'
        }`}
        onClick={closeAdvisor}
        aria-hidden="true"
      />
      <aside
        className={`drawer-panel-right relative z-10 w-full max-w-md h-full bg-[#F1EEE8] text-[#171717] border-l border-[#171717]/15 shadow-2xl flex flex-col ${
          visible ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        <div className="px-6 py-5 border-b border-[#171717]/12 flex items-center justify-between">
          <div>
            <p className="font-mono-tabular text-[10px] uppercase tracking-[0.14em] text-[#99968F]">
              ESTÚDIO COMPLEX / ATENDIMENTO
            </p>
            <h2 className="font-display text-lg font-bold tracking-tight">
              Consultoria de Caimento
            </h2>
          </div>
          <button
            type="button"
            onClick={closeAdvisor}
            aria-label="Fechar consultoria"
            className="w-10 h-10 inline-flex items-center justify-center hover:opacity-65 transition-opacity cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="px-6 py-2.5 border-b border-[#171717]/10 bg-[#EAE6DF]/60 flex items-center justify-between text-[11px]">
          <span className="font-mono-tabular uppercase tracking-[0.08em] text-[#171717]/75">
            Análise detalhada de medidas
          </span>
          <button
            type="button"
            onClick={() => setDeepMode((v) => !v)}
            className={`px-2.5 py-1 font-mono-tabular uppercase tracking-[0.08em] border cursor-pointer transition-colors ${
              deepMode
                ? 'bg-[#171717] text-[#F1EEE8] border-[#171717]'
                : 'border-[#171717]/25 text-[#171717]/70 hover:border-[#171717]'
            }`}
          >
            {deepMode ? 'Modo Detalhado' : 'Resposta Rápida'}
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4">
          {messages.map((msg, idx) => (
            <div
              key={idx}
              className={`cart-item-enter p-3.5 text-sm leading-relaxed whitespace-pre-wrap ${
                msg.role === 'user'
                  ? 'bg-[#171717] text-[#F1EEE8] ml-8'
                  : 'bg-[#EAE6DF] text-[#171717] mr-6 border border-[#171717]/10'
              }`}
            >
              {msg.text}
            </div>
          ))}
          {loading && (
            <p className="font-mono-tabular text-xs text-[#99968F] animate-pulse">
              Analisando solicitação...
            </p>
          )}
          {errorMsg && (
            <p className="text-xs text-[#8A2C2C] border border-[#8A2C2C]/30 bg-[#8A2C2C]/5 p-3">
              {errorMsg}
            </p>
          )}
          <div ref={endRef} />
        </div>

        <form onSubmit={sendMessage} className="p-4 border-t border-[#171717]/12 bg-[#F1EEE8] space-y-2">
          <div className="flex items-center gap-2">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleImageUpload}
              className="hidden"
              id="garment-photo-upload"
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={loading}
              aria-label="Enviar foto de peça para análise"
              title="Analisar foto de peça ou look"
              className="w-10 h-10 shrink-0 border border-[#171717]/20 inline-flex items-center justify-center hover:bg-[#171717]/5 transition-colors cursor-pointer"
            >
              <ImagePlus className="w-4 h-4" />
            </button>
            <label htmlFor="advisor-input" className="sr-only">
              Pergunte sobre tamanhos, tecidos ou combinações
            </label>
            <input
              id="advisor-input"
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ex: Tenho 1,78m e 75kg, qual tamanho de hoodie?"
              className="flex-1 h-10 px-3 bg-transparent border border-[#171717]/20 text-sm focus:outline-none focus:border-[#171717] transition-colors"
            />
            <button
              type="submit"
              disabled={loading || !input.trim()}
              aria-label="Enviar mensagem"
              className="w-10 h-10 shrink-0 bg-[#171717] text-[#F1EEE8] inline-flex items-center justify-center disabled:opacity-40 hover:bg-[#171717]/88 transition-colors cursor-pointer"
            >
              <Send className="w-4 h-4" />
            </button>
          </div>
        </form>
      </aside>
    </div>
  );
};
