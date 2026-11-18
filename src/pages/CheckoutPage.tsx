import React, { useEffect, useState } from 'react';
import { Check, Info } from 'lucide-react';
import { useAuth, useCart, useCatalog } from '../context/StoreContext';
import { OptimizedImage } from '../components/OptimizedImage';
import type { BrazilianAddress, CouponRecord, OrderRecord, ShippingQuote } from '../types/store';
import {
  calculateCartTotals,
  calculateShippingQuotes,
  formatBrl,
  formatCep,
  formatCpf,
  validateCep,
  validateCpf,
} from '../utils/commerce';

interface CheckoutPageProps {
  onNavigate: (path: string) => void;
}

export const CheckoutPage: React.FC<CheckoutPageProps> = ({ onNavigate }) => {
  const { refreshCatalog } = useCatalog();
  const { cart, cartSubtotal, revalidateCartBeforeCheckout } = useCart();
  const { user, userProfile, fetchAddresses, validateCoupon, submitOrder } = useAuth();

  const [customerName, setCustomerName] = useState(userProfile?.displayName || user?.displayName || '');
  const [customerEmail, setCustomerEmail] = useState(userProfile?.email || user?.email || '');
  const [customerCpf, setCustomerCpf] = useState(userProfile?.cpf || '');

  const [cep, setCep] = useState('');
  const [street, setStreet] = useState('');
  const [number, setNumber] = useState('');
  const [complement, setComplement] = useState('');
  const [neighborhood, setNeighborhood] = useState('');
  const [city, setCity] = useState('');
  const [stateUf, setStateUf] = useState('');

  const [savedAddresses, setSavedAddresses] = useState<BrazilianAddress[]>([]);
  const [shippingQuotes, setShippingQuotes] = useState<ShippingQuote[]>([]);
  const [selectedShippingId, setSelectedShippingId] = useState<string>('pac');

  const [couponInput, setCouponInput] = useState('');
  const [appliedCoupon, setAppliedCoupon] = useState<CouponRecord | null>(null);
  const [couponMessage, setCouponMessage] = useState('');

  const [paymentMethod, setPaymentMethod] = useState<'pix' | 'cartao'>('pix');
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState('');
  const [confirmedOrder, setConfirmedOrder] = useState<OrderRecord | null>(null);

  useEffect(() => {
    if (userProfile) {
      if (!customerName) setCustomerName(userProfile.displayName || '');
      if (!customerEmail) setCustomerEmail(userProfile.email || '');
      if (!customerCpf && userProfile.cpf) setCustomerCpf(userProfile.cpf);
    }
  }, [userProfile, customerName, customerEmail, customerCpf]);

  useEffect(() => {
    void refreshCatalog();
  }, [refreshCatalog]);

  useEffect(() => {
    if (user) {
      fetchAddresses()
        .then((addrs) => setSavedAddresses(addrs))
        .catch(() => setSavedAddresses([]));
    }
  }, [user, fetchAddresses]);

  const handleCepChange = async (value: string) => {
    const formatted = formatCep(value);
    setCep(formatted);
    if (validateCep(formatted)) {
      const quotes = calculateShippingQuotes(formatted, cartSubtotal);
      setShippingQuotes(quotes);
      if (quotes.length > 0 && !quotes.some((q) => q.id === selectedShippingId)) {
        setSelectedShippingId(quotes[0].id);
      }

      try {
        const res = await fetch(`/api/cep/${formatted.replace(/\D/g, '')}`);
        if (res.ok) {
          const data = (await res.json()) as {
            street?: string;
            neighborhood?: string;
            city?: string;
            state?: string;
          };
          if (data.street) setStreet(data.street);
          if (data.neighborhood) setNeighborhood(data.neighborhood);
          if (data.city) setCity(data.city);
          if (data.state) setStateUf(data.state);
        }
      } catch {
        // User can fill manually
      }
    } else {
      setShippingQuotes([]);
    }
  };

  const applySavedAddress = (addr: BrazilianAddress) => {
    setCustomerName(addr.recipientName);
    setStreet(addr.street);
    setNumber(addr.number);
    setComplement(addr.complement || '');
    setNeighborhood(addr.neighborhood);
    setCity(addr.city);
    setStateUf(addr.state);
    void handleCepChange(addr.cep);
  };

  const handleApplyCoupon = async () => {
    setCouponMessage('');
    const coupon = await validateCoupon(couponInput);
    if (!coupon) {
      setAppliedCoupon(null);
      setCouponMessage('Cupom inválido ou inativo.');
      return;
    }
    if (cartSubtotal < coupon.minOrderBrl) {
      setAppliedCoupon(null);
      setCouponMessage(`Pedido mínimo de ${formatBrl(coupon.minOrderBrl)} para este cupom.`);
      return;
    }
    setAppliedCoupon(coupon);
    setCouponMessage(`Cupom ${coupon.code} aplicado (${coupon.discountPercent}% de desconto).`);
  };

  const activeQuote =
    shippingQuotes.find((q) => q.id === selectedShippingId) || shippingQuotes[0];

  const totals = calculateCartTotals(
    cart,
    activeQuote?.priceBrl ?? 0,
    appliedCoupon?.discountPercent ?? 0,
    appliedCoupon?.minOrderBrl ?? 0
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');

    if (cart.length === 0) {
      setFormError('Sua sacola está vazia.');
      return;
    }
    if (!customerName.trim() || !customerEmail.includes('@')) {
      setFormError('Preencha nome completo e e-mail válido.');
      return;
    }
    if (!validateCpf(customerCpf)) {
      setFormError('Informe um CPF válido com 11 dígitos.');
      return;
    }
    if (!validateCep(cep) || !street.trim() || !number.trim() || !neighborhood.trim() || !city.trim() || stateUf.trim().length !== 2) {
      setFormError('Preencha todos os campos do endereço brasileiro e CEP válido.');
      return;
    }

    setSubmitting(true);
    try {
      const validation = await revalidateCartBeforeCheckout();
      if (!validation.valid || validation.changed) {
        const message =
          validation.issues.length > 0
            ? validation.issues.join(' ')
            : 'Preços ou disponibilidade na sua sacola foram atualizados. Revise o resumo antes de confirmar.';
        setFormError(message);
        return;
      }

      const orderId = `ord-${Date.now()}`;
      const orderNumber = `CMP-${Math.floor(10000 + Math.random() * 90000)}`;
      const created = await submitOrder({
        id: orderId,
        orderNumber,
        userId: user?.uid || 'guest-demo',
        customerName: customerName.trim(),
        customerEmail: customerEmail.trim(),
        customerCpf,
        shippingAddress: {
          recipientName: customerName.trim(),
          cep,
          street: street.trim(),
          number: number.trim(),
          complement: complement.trim(),
          neighborhood: neighborhood.trim(),
          city: city.trim(),
          state: stateUf.trim().toUpperCase(),
        },
        shippingMethod: activeQuote?.label || 'Envio Padrão (Estimativa Demo)',
        shippingCostBrl: totals.shippingCostBrl,
        paymentMethod,
        ...(appliedCoupon ? { couponCode: appliedCoupon.code } : {}),
        discountBrl: totals.discountBrl,
        subtotalBrl: totals.subtotalBrl,
        totalBrl: totals.totalBrl,
        status: 'demo_pending',
        isDemo: true,
        items: cart.map((item) => ({
          productId: item.productId,
          slug: item.slug,
          name: item.name,
          colorName: item.colorName,
          size: item.size,
          sku: item.sku,
          quantity: item.quantity,
          unitPriceBrl: item.priceBrl,
          image: item.image,
        })),
      });

      setConfirmedOrder(created);
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Erro ao registrar pedido demonstrativo.');
    } finally {
      setSubmitting(false);
    }
  };

  if (confirmedOrder) {
    return (
      <main className="bg-[#F1EEE8] text-[#171717] min-h-[75vh]">
        <div className="max-w-3xl mx-auto px-4 md:px-8 py-14 space-y-8">
          <div className="border border-[#6A705C] bg-[#6A705C]/10 p-4 flex items-start gap-3">
            <Check className="w-5 h-5 text-[#6A705C] shrink-0 mt-0.5" />
            <div>
              <p className="font-mono-tabular text-xs uppercase tracking-[0.12em] font-medium">
                Pedido Demonstrativo Registrado — Sem Cobrança Real
              </p>
              <p className="text-xs text-[#171717]/80 mt-1">
                Este fluxo simula o fechamento brasileiro preparado para integração com Mercado Pago / provedor Pix. Nenhuma transação financeira foi executada.
              </p>
            </div>
          </div>

          <div className="border border-[#171717]/15 bg-[#EAE6DF]/50 p-6 md:p-8 space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-5 border-b border-[#171717]/12">
              <div>
                <p className="font-mono-tabular text-[11px] uppercase tracking-[0.14em] text-[#99968F]">
                  NÚMERO DO PEDIDO
                </p>
                <h1 className="font-display text-3xl font-extrabold tracking-tight">
                  {confirmedOrder.orderNumber}
                </h1>
              </div>
              <span className="font-mono-tabular text-xs uppercase tracking-[0.12em] px-3 py-1 border border-[#171717]/20 self-start">
                Aguardando Pagamento (Demo)
              </span>
            </div>

            {confirmedOrder.paymentMethod === 'pix' && (
              <div className="border border-[#171717]/15 bg-[#F1EEE8] p-4 space-y-2">
                <p className="font-mono-tabular text-[11px] uppercase tracking-[0.12em]">
                  Estrutura Pix (Demonstração)
                </p>
                <p className="text-xs text-[#171717]/75">
                  Em produção, o payload copia-e-cola e QR Code do Mercado Pago / Pix são gerados pelo backend usando credenciais seguras do ambiente.
                </p>
                <code className="block p-2.5 bg-[#EAE6DF] font-mono-tabular text-[11px] break-all">
                  00020126580014BR.GOV.BCB.PIX0136DEMO-COMPLEX-{confirmedOrder.orderNumber}
                </code>
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 text-xs">
              <div className="space-y-1">
                <p className="font-mono-tabular uppercase tracking-[0.12em] text-[#99968F]">
                  Destinatário
                </p>
                <p className="font-medium text-sm">{confirmedOrder.customerName}</p>
                <p>{confirmedOrder.customerEmail}</p>
                <p>
                  {confirmedOrder.shippingAddress.street}, {confirmedOrder.shippingAddress.number}{' '}
                  {confirmedOrder.shippingAddress.complement}
                </p>
                <p>
                  {confirmedOrder.shippingAddress.neighborhood} — {confirmedOrder.shippingAddress.city}/
                  {confirmedOrder.shippingAddress.state}
                </p>
                <p className="font-mono-tabular">CEP {confirmedOrder.shippingAddress.cep}</p>
              </div>

              <div className="space-y-1.5">
                <p className="font-mono-tabular uppercase tracking-[0.12em] text-[#99968F]">
                  Resumo Financeiro
                </p>
                <div className="flex justify-between">
                  <span>Subtotal</span>
                  <span className="font-mono-tabular">{formatBrl(confirmedOrder.subtotalBrl)}</span>
                </div>
                {confirmedOrder.discountBrl > 0 && (
                  <div className="flex justify-between text-[#6A705C]">
                    <span>Desconto ({confirmedOrder.couponCode})</span>
                    <span className="font-mono-tabular">-{formatBrl(confirmedOrder.discountBrl)}</span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span>Frete ({confirmedOrder.shippingMethod})</span>
                  <span className="font-mono-tabular">
                    {confirmedOrder.shippingCostBrl === 0
                      ? 'Cortesia'
                      : formatBrl(confirmedOrder.shippingCostBrl)}
                  </span>
                </div>
                <div className="flex justify-between font-medium text-sm pt-2 border-t border-[#171717]/12">
                  <span>Total</span>
                  <span className="font-mono-tabular">{formatBrl(confirmedOrder.totalBrl)}</span>
                </div>
              </div>
            </div>

            <div className="pt-4 flex flex-wrap gap-3">
              <button
                type="button"
                onClick={() => onNavigate('/account')}
                className="px-6 py-3 bg-[#171717] text-[#F1EEE8] font-mono-tabular text-xs uppercase tracking-[0.12em] cursor-pointer"
              >
                Ver meus pedidos
              </button>
              <button
                type="button"
                onClick={() => onNavigate('/shop')}
                className="px-6 py-3 border border-[#171717] font-mono-tabular text-xs uppercase tracking-[0.12em] cursor-pointer"
              >
                Voltar à loja
              </button>
            </div>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="bg-[#F1EEE8] text-[#171717] min-h-[75vh]">
      <div className="max-w-[1440px] mx-auto px-4 md:px-8 py-10 md:py-14">
        {/* Demo mode notice */}
        <div className="mb-8 border border-[#171717]/20 bg-[#EAE6DF] p-4 flex items-start gap-3">
          <Info className="w-4 h-4 shrink-0 mt-0.5 text-[#171717]" />
          <div className="text-xs leading-relaxed">
            <strong className="font-mono-tabular uppercase tracking-[0.1em]">
              Checkout de Demonstração (Sem Cobrança Real):
            </strong>{' '}
            Arquitetura preparada para integração futura via backend com Mercado Pago ou provedor Pix nacional. Nenhum dado de cartão é solicitado ou processado neste ambiente.
          </div>
        </div>

        <h1 className="font-display text-3xl md:text-4xl font-extrabold tracking-[-0.025em] pb-6 border-b border-[#171717]/12">
          Finalizar Pedido
        </h1>

        {cart.length === 0 ? (
          <div className="py-20 text-center space-y-4">
            <p className="text-sm text-[#171717]/75">Adicione peças à sacola antes de finalizar.</p>
            <button
              type="button"
              onClick={() => onNavigate('/shop')}
              className="px-6 py-3 bg-[#171717] text-[#F1EEE8] font-mono-tabular text-xs uppercase tracking-[0.12em] cursor-pointer"
            >
              Explorar catálogo
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="grid grid-cols-1 lg:grid-cols-12 gap-10 pt-8">
            <div className="lg:col-span-7 space-y-8">
              {/* 1. Dados Pessoais */}
              <section className="space-y-4">
                <h2 className="font-mono-tabular text-xs uppercase tracking-[0.14em] text-[#99968F]">
                  01 / Dados Pessoais
                </h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="sm:col-span-2">
                    <label htmlFor="chk-name" className="block text-xs mb-1.5">
                      Nome completo
                    </label>
                    <input
                      id="chk-name"
                      type="text"
                      required
                      value={customerName}
                      onChange={(e) => setCustomerName(e.target.value)}
                      className="w-full h-11 px-3.5 bg-transparent border border-[#171717]/25 text-sm focus:outline-none focus:border-[#171717]"
                    />
                  </div>
                  <div>
                    <label htmlFor="chk-email" className="block text-xs mb-1.5">
                      E-mail
                    </label>
                    <input
                      id="chk-email"
                      type="email"
                      required
                      value={customerEmail}
                      onChange={(e) => setCustomerEmail(e.target.value)}
                      className="w-full h-11 px-3.5 bg-transparent border border-[#171717]/25 text-sm focus:outline-none focus:border-[#171717]"
                    />
                  </div>
                  <div>
                    <label htmlFor="chk-cpf" className="block text-xs mb-1.5">
                      CPF
                    </label>
                    <input
                      id="chk-cpf"
                      type="text"
                      required
                      value={customerCpf}
                      onChange={(e) => setCustomerCpf(formatCpf(e.target.value))}
                      placeholder="000.000.000-00"
                      className="w-full h-11 px-3.5 bg-transparent border border-[#171717]/25 font-mono-tabular text-sm focus:outline-none focus:border-[#171717]"
                    />
                  </div>
                </div>
              </section>

              {/* 2. Endereço Brasileiro */}
              <section className="space-y-4 pt-6 border-t border-[#171717]/12">
                <div className="flex items-center justify-between">
                  <h2 className="font-mono-tabular text-xs uppercase tracking-[0.14em] text-[#99968F]">
                    02 / Endereço de Entrega
                  </h2>
                  {savedAddresses.length > 0 && (
                    <select
                      aria-label="Usar endereço salvo"
                      onChange={(e) => {
                        const found = savedAddresses.find((a) => a.id === e.target.value);
                        if (found) applySavedAddress(found);
                      }}
                      defaultValue=""
                      className="h-8 px-2 bg-[#F1EEE8] border border-[#171717]/20 text-xs"
                    >
                      <option value="" disabled>
                        Usar endereço salvo...
                      </option>
                      {savedAddresses.map((addr) => (
                        <option key={addr.id} value={addr.id}>
                          {addr.label} — {addr.street}, {addr.number}
                        </option>
                      ))}
                    </select>
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-6 gap-4">
                  <div className="sm:col-span-2">
                    <label htmlFor="chk-cep" className="block text-xs mb-1.5">
                      CEP
                    </label>
                    <input
                      id="chk-cep"
                      type="text"
                      required
                      value={cep}
                      onChange={(e) => void handleCepChange(e.target.value)}
                      placeholder="00000-000"
                      className="w-full h-11 px-3.5 bg-transparent border border-[#171717]/25 font-mono-tabular text-sm focus:outline-none focus:border-[#171717]"
                    />
                  </div>

                  <div className="sm:col-span-4">
                    <label htmlFor="chk-street" className="block text-xs mb-1.5">
                      Logradouro
                    </label>
                    <input
                      id="chk-street"
                      type="text"
                      required
                      value={street}
                      onChange={(e) => setStreet(e.target.value)}
                      className="w-full h-11 px-3.5 bg-transparent border border-[#171717]/25 text-sm focus:outline-none focus:border-[#171717]"
                    />
                  </div>

                  <div className="sm:col-span-2">
                    <label htmlFor="chk-number" className="block text-xs mb-1.5">
                      Número
                    </label>
                    <input
                      id="chk-number"
                      type="text"
                      required
                      value={number}
                      onChange={(e) => setNumber(e.target.value)}
                      className="w-full h-11 px-3.5 bg-transparent border border-[#171717]/25 text-sm focus:outline-none focus:border-[#171717]"
                    />
                  </div>

                  <div className="sm:col-span-4">
                    <label htmlFor="chk-complement" className="block text-xs mb-1.5">
                      Complemento (opcional)
                    </label>
                    <input
                      id="chk-complement"
                      type="text"
                      value={complement}
                      onChange={(e) => setComplement(e.target.value)}
                      className="w-full h-11 px-3.5 bg-transparent border border-[#171717]/25 text-sm focus:outline-none focus:border-[#171717]"
                    />
                  </div>

                  <div className="sm:col-span-2">
                    <label htmlFor="chk-neighborhood" className="block text-xs mb-1.5">
                      Bairro
                    </label>
                    <input
                      id="chk-neighborhood"
                      type="text"
                      required
                      value={neighborhood}
                      onChange={(e) => setNeighborhood(e.target.value)}
                      className="w-full h-11 px-3.5 bg-transparent border border-[#171717]/25 text-sm focus:outline-none focus:border-[#171717]"
                    />
                  </div>

                  <div className="sm:col-span-3">
                    <label htmlFor="chk-city" className="block text-xs mb-1.5">
                      Cidade
                    </label>
                    <input
                      id="chk-city"
                      type="text"
                      required
                      value={city}
                      onChange={(e) => setCity(e.target.value)}
                      className="w-full h-11 px-3.5 bg-transparent border border-[#171717]/25 text-sm focus:outline-none focus:border-[#171717]"
                    />
                  </div>

                  <div className="sm:col-span-1">
                    <label htmlFor="chk-uf" className="block text-xs mb-1.5">
                      UF
                    </label>
                    <input
                      id="chk-uf"
                      type="text"
                      required
                      maxLength={2}
                      value={stateUf}
                      onChange={(e) => setStateUf(e.target.value.toUpperCase())}
                      placeholder="SP"
                      className="w-full h-11 px-3 bg-transparent border border-[#171717]/25 font-mono-tabular uppercase text-sm focus:outline-none focus:border-[#171717]"
                    />
                  </div>
                </div>
              </section>

              {/* 3. Entrega */}
              {shippingQuotes.length > 0 && (
                <section className="space-y-3 pt-6 border-t border-[#171717]/12">
                  <h2 className="font-mono-tabular text-xs uppercase tracking-[0.14em] text-[#99968F]">
                    03 / Opções de Entrega (Configuráveis)
                  </h2>
                  <div className="space-y-2">
                    {shippingQuotes.map((quote) => (
                      <label
                        key={quote.id}
                        className={`flex items-center justify-between p-4 border cursor-pointer ${
                          selectedShippingId === quote.id
                            ? 'border-[#171717] bg-[#EAE6DF]/60'
                            : 'border-[#171717]/20'
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <input
                            type="radio"
                            name="shipping"
                            checked={selectedShippingId === quote.id}
                            onChange={() => setSelectedShippingId(quote.id)}
                            className="accent-[#171717]"
                          />
                          <div>
                            <p className="text-sm font-medium">{quote.label}</p>
                            <p className="text-xs text-[#99968F]">Prazo estimado: {quote.estimatedDays}</p>
                          </div>
                        </div>
                        <span className="font-mono-tabular text-sm font-medium">
                          {quote.priceBrl === 0 ? 'Cortesia' : formatBrl(quote.priceBrl)}
                        </span>
                      </label>
                    ))}
                  </div>
                </section>
              )}

              {/* 4. Pagamento */}
              <section className="space-y-4 pt-6 border-t border-[#171717]/12">
                <h2 className="font-mono-tabular text-xs uppercase tracking-[0.14em] text-[#99968F]">
                  04 / Método de Pagamento (Estrutura Demonstração)
                </h2>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setPaymentMethod('pix')}
                    className={`p-4 border text-left cursor-pointer ${
                      paymentMethod === 'pix'
                        ? 'border-[#171717] bg-[#171717] text-[#F1EEE8]'
                        : 'border-[#171717]/25'
                    }`}
                  >
                    <p className="font-mono-tabular text-xs uppercase tracking-[0.12em]">Pix</p>
                    <p className="text-[11px] opacity-75 mt-1">Aprovação imediata (Demo)</p>
                  </button>

                  <button
                    type="button"
                    onClick={() => setPaymentMethod('cartao')}
                    className={`p-4 border text-left cursor-pointer ${
                      paymentMethod === 'cartao'
                        ? 'border-[#171717] bg-[#171717] text-[#F1EEE8]'
                        : 'border-[#171717]/25'
                    }`}
                  >
                    <p className="font-mono-tabular text-xs uppercase tracking-[0.12em]">Cartão de Crédito</p>
                    <p className="text-[11px] opacity-75 mt-1">Estrutura Mercado Pago (Demo)</p>
                  </button>
                </div>

                <p className="text-xs text-[#99968F]">
                  {paymentMethod === 'pix'
                    ? 'Ao confirmar, um código Pix demonstrativo será gerado sem movimentação bancária.'
                    : 'Em produção, a tokenização segura do cartão ocorre via SDK oficial do Mercado Pago no checkout.'}
                </p>
              </section>
            </div>

            {/* Order Summary Sidebar */}
            <aside className="lg:col-span-5">
              <div className="border border-[#171717]/15 bg-[#EAE6DF]/55 p-6 space-y-5 lg:sticky lg:top-24">
                <h2 className="font-mono-tabular text-xs uppercase tracking-[0.14em] text-[#99968F]">
                  Resumo do Pedido ({totals.itemCount})
                </h2>

                <div className="divide-y divide-[#171717]/10 max-h-72 overflow-y-auto">
                  {cart.map((item) => (
                    <div key={item.key} className="py-3 flex items-center gap-3">
                      <OptimizedImage
                        src={item.image}
                        alt={item.name}
                        sizes="thumb"
                        className="w-12 aspect-[3/4] shrink-0"
                        imgClassName="w-full h-full object-cover"
                      />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{item.name}</p>
                        <p className="font-mono-tabular text-[11px] text-[#99968F]">
                          {item.colorName} · Tam {item.size} · Qtd {item.quantity}
                        </p>
                      </div>
                      <span className="font-mono-tabular text-xs shrink-0">
                        {formatBrl(item.priceBrl * item.quantity)}
                      </span>
                    </div>
                  ))}
                </div>

                {/* Coupon */}
                <div className="pt-2 border-t border-[#171717]/12 space-y-2">
                  <div className="flex gap-2">
                    <label htmlFor="chk-coupon" className="sr-only">
                      Código do cupom
                    </label>
                    <input
                      id="chk-coupon"
                      type="text"
                      value={couponInput}
                      onChange={(e) => setCouponInput(e.target.value.toUpperCase())}
                      placeholder="Cupom (ex: COMPLEX10)"
                      className="flex-1 h-10 px-3 bg-[#F1EEE8] border border-[#171717]/20 font-mono-tabular text-xs uppercase focus:outline-none"
                    />
                    <button
                      type="button"
                      onClick={() => void handleApplyCoupon()}
                      className="h-10 px-4 border border-[#171717] font-mono-tabular text-[11px] uppercase tracking-[0.12em] cursor-pointer"
                    >
                      Aplicar
                    </button>
                  </div>
                  {couponMessage && <p className="text-xs text-[#6A705C]">{couponMessage}</p>}
                </div>

                <div className="space-y-2 text-sm border-t border-[#171717]/12 pt-4">
                  <div className="flex justify-between">
                    <span className="text-[#171717]/75">Subtotal</span>
                    <span className="font-mono-tabular">{formatBrl(totals.subtotalBrl)}</span>
                  </div>
                  {totals.discountBrl > 0 && (
                    <div className="flex justify-between text-[#6A705C]">
                      <span>Desconto</span>
                      <span className="font-mono-tabular">-{formatBrl(totals.discountBrl)}</span>
                    </div>
                  )}
                  <div className="flex justify-between">
                    <span className="text-[#171717]/75">Frete estimado</span>
                    <span className="font-mono-tabular">
                      {shippingQuotes.length === 0
                        ? 'Informe o CEP'
                        : totals.shippingCostBrl === 0
                        ? 'Cortesia'
                        : formatBrl(totals.shippingCostBrl)}
                    </span>
                  </div>
                </div>

                <div className="flex justify-between items-baseline border-t border-[#171717]/15 pt-4">
                  <span className="font-medium">Total</span>
                  <span className="font-mono-tabular text-xl font-medium">
                    {formatBrl(totals.totalBrl)}
                  </span>
                </div>

                {formError && (
                  <p className="text-xs text-[#8A2C2C] border border-[#8A2C2C]/30 bg-[#8A2C2C]/5 p-3">
                    {formError}
                  </p>
                )}

                <button
                  type="submit"
                  disabled={submitting}
                  className="w-full h-12 bg-[#171717] text-[#F1EEE8] font-mono-tabular text-xs uppercase tracking-[0.14em] hover:bg-[#171717]/90 disabled:opacity-50 cursor-pointer"
                >
                  {submitting ? 'Registrando pedido...' : 'Confirmar Pedido (Modo Demo)'}
                </button>
              </div>
            </aside>
          </form>
        )}
      </div>
    </main>
  );
};
