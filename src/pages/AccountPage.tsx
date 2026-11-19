import React, { useEffect, useState } from 'react';
import { LogOut, MapPin, Package, Plus, Trash2 } from 'lucide-react';
import { useAuth, useStoreUI } from '../context/StoreContext';
import type { BrazilianAddress, OrderRecord } from '../types/store';
import { formatBrl, formatCep, formatCpf, getOrderStatusLabel, validateCep } from '../utils/commerce';
import { formatFirebaseAuthError } from '../utils/authErrors';

interface AccountPageProps {
  onNavigate: (path: string) => void;
}

export const AccountPage: React.FC<AccountPageProps> = ({ onNavigate }) => {
  const {
    user,
    authReady,
    isAdmin,
    userProfile,
    signInWithGoogle,
    logout,
    saveUserProfile,
    fetchAddresses,
    saveAddress,
    deleteAddress,
    fetchUserOrders,
    getDemoOrders,
  } = useAuth();
  const { showToast } = useStoreUI();

  const [displayName, setDisplayName] = useState('');
  const [cpf, setCpf] = useState('');
  const [phone, setPhone] = useState('');

  const [addresses, setAddresses] = useState<BrazilianAddress[]>([]);
  const [newAddressOpen, setNewAddressOpen] = useState(false);
  const [addrLabel, setAddrLabel] = useState('Casa');
  const [addrRecipient, setAddrRecipient] = useState('');
  const [addrCep, setAddrCep] = useState('');
  const [addrStreet, setAddrStreet] = useState('');
  const [addrNumber, setAddrNumber] = useState('');
  const [addrNeighborhood, setAddrNeighborhood] = useState('');
  const [addrCity, setAddrCity] = useState('');
  const [addrState, setAddrState] = useState('');

  const [orders, setOrders] = useState<OrderRecord[]>([]);
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);
  const [authError, setAuthError] = useState('');

  useEffect(() => {
    if (userProfile) {
      setDisplayName(userProfile.displayName || '');
      setCpf(userProfile.cpf || '');
      setPhone(userProfile.phone || '');
    }
  }, [userProfile]);

  useEffect(() => {
    if (!authReady) return;
    if (user) {
      fetchAddresses().then(setAddresses).catch(() => {});
      fetchUserOrders().then(setOrders).catch(() => {});
    } else {
      setOrders(getDemoOrders());
    }
  }, [authReady, user, fetchAddresses, fetchUserOrders, getDemoOrders]);

  const handleSignIn = async () => {
    setAuthError('');
    try {
      await signInWithGoogle();
    } catch (err) {
      const host = typeof window !== 'undefined' ? window.location.hostname : undefined;
      setAuthError(formatFirebaseAuthError(err, host));
    }
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    await saveUserProfile({ displayName, cpf, phone });
  };

  const handleAddressCepChange = async (value: string) => {
    const formatted = formatCep(value);
    setAddrCep(formatted);
    if (!validateCep(formatted)) return;
    try {
      const res = await fetch(`/api/cep/${formatted.replace(/\D/g, '')}`);
      if (res.ok) {
        const data = (await res.json()) as {
          street?: string;
          neighborhood?: string;
          city?: string;
          state?: string;
        };
        if (data.street) setAddrStreet(data.street);
        if (data.neighborhood) setAddrNeighborhood(data.neighborhood);
        if (data.city) setAddrCity(data.city);
        if (data.state) setAddrState(data.state);
      }
    } catch {
      // Allow manual completion
    }
  };

  const handleAddAddress = async (e: React.FormEvent) => {
    e.preventDefault();
    const id = `addr-${Date.now()}`;
    await saveAddress({
      id,
      label: addrLabel || 'Principal',
      recipientName: addrRecipient || displayName || 'Destinatário',
      cep: addrCep,
      street: addrStreet,
      number: addrNumber,
      neighborhood: addrNeighborhood,
      city: addrCity,
      state: addrState.toUpperCase().slice(0, 2),
      isDefault: addresses.length === 0,
    });
    const updated = await fetchAddresses();
    setAddresses(updated);
    setNewAddressOpen(false);
    setAddrCep('');
    setAddrStreet('');
    setAddrNumber('');
    setAddrNeighborhood('');
    setAddrCity('');
    setAddrState('');
    showToast('Endereço salvo na sua conta.');
  };

  const handleRemoveAddress = async (id: string) => {
    await deleteAddress(id);
    setAddresses((prev) => prev.filter((a) => a.id !== id));
  };

  if (!authReady) {
    return (
      <main className="max-w-[1440px] mx-auto px-4 md:px-8 py-24 text-center font-mono-tabular text-xs uppercase">
        Carregando conta...
      </main>
    );
  }

  return (
    <main className="bg-[#F1EEE8] text-[#171717] min-h-[75vh]">
      <div className="max-w-[1440px] mx-auto px-4 md:px-8 py-12 md:py-16">
        <div className="pb-8 border-b border-[#171717]/12 flex flex-col sm:flex-row sm:items-end justify-between gap-4">
          <div>
            <p className="font-mono-tabular text-[11px] uppercase tracking-[0.14em] text-[#99968F] mb-1">
              ÁREA DO CLIENTE
            </p>
            <h1 className="font-display text-3xl md:text-4xl font-extrabold tracking-[-0.025em]">
              {user ? `Olá, ${userProfile?.displayName || user.displayName || 'Cliente'}` : 'Entrar ou Criar Conta'}
            </h1>
          </div>

          {user && (
            <div className="flex items-center gap-3">
              {isAdmin && (
                <button
                  type="button"
                  onClick={() => onNavigate('/admin')}
                  className="px-4 py-2 border border-[#6A705C] text-[#6A705C] font-mono-tabular text-xs uppercase tracking-[0.12em] hover:bg-[#6A705C]/10 transition-colors cursor-pointer"
                >
                  Acessar Painel Admin
                </button>
              )}
              <button
                type="button"
                onClick={() => void logout()}
                className="inline-flex items-center gap-2 px-4 py-2 border border-[#171717]/25 font-mono-tabular text-xs uppercase tracking-[0.12em] hover:border-[#171717] transition-colors cursor-pointer"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span>Sair</span>
              </button>
            </div>
          )}
        </div>

        {!user ? (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 pt-10">
            <div className="lg:col-span-5 space-y-6">
              <div className="border border-[#171717]/15 p-8 bg-[#EAE6DF]/45 space-y-5">
                <h2 className="font-display text-2xl font-bold tracking-tight">
                  Acesse sua conta COMPLEX
                </h2>
                <p className="text-sm leading-relaxed text-[#171717]/75">
                  A autenticação e recuperação de senha são gerenciadas com segurança pela sua Conta Google via Firebase Authentication.
                </p>

                <button
                  type="button"
                  onClick={() => void handleSignIn()}
                  className="w-full h-12 bg-[#171717] text-[#F1EEE8] font-mono-tabular text-xs uppercase tracking-[0.14em] hover:bg-[#171717]/88 active:scale-[0.99] transition-[background-color,transform] duration-200 cursor-pointer"
                >
                  Entrar / Cadastrar com Google
                </button>

                {authError && <p className="text-xs text-[#8A2C2C]">{authError}</p>}

                <p className="text-[11px] text-[#99968F]">
                  Precisa recuperar o acesso? Utilize a recuperação oficial da sua conta Google antes de autenticar.
                </p>
              </div>
            </div>

            <div className="lg:col-span-7 space-y-4">
              <h2 className="font-mono-tabular text-xs uppercase tracking-[0.14em] text-[#99968F]">
                Pedidos de Demonstração Nesta Sessão ({orders.length})
              </h2>
              {orders.length === 0 ? (
                <p className="text-sm text-[#171717]/70 py-6 border-t border-[#171717]/10">
                  Nenhum pedido registrado nesta sessão ainda.
                </p>
              ) : (
                <div className="space-y-3">
                  {orders.map((ord) => (
                    <div key={ord.id} className="border border-[#171717]/15 p-4 flex items-center justify-between gap-4">
                      <div>
                        <p className="font-mono-tabular text-sm font-medium">{ord.orderNumber}</p>
                        <p className="text-xs text-[#99968F]">
                          {getOrderStatusLabel(ord.status)} · {ord.items.length}{' '}
                          {ord.items.length === 1 ? 'item' : 'itens'}
                        </p>
                      </div>
                      <span className="font-mono-tabular text-sm font-medium">
                        {formatBrl(ord.totalBrl)}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 pt-10">
            {/* Profile & Addresses */}
            <div className="lg:col-span-5 space-y-8">
              <form onSubmit={handleSaveProfile} className="border border-[#171717]/15 p-6 space-y-4">
                <h2 className="font-mono-tabular text-xs uppercase tracking-[0.14em] text-[#99968F]">
                  Perfil do Cliente
                </h2>
                <div>
                  <label htmlFor="acc-name" className="block text-xs mb-1">Nome</label>
                  <input
                    id="acc-name"
                    type="text"
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    className="w-full h-10 px-3 bg-transparent border border-[#171717]/20 text-sm focus:outline-none focus:border-[#171717] transition-colors"
                  />
                </div>
                <div>
                  <label htmlFor="acc-email" className="block text-xs mb-1">E-mail</label>
                  <input
                    id="acc-email"
                    type="email"
                    disabled
                    value={user.email || ''}
                    className="w-full h-10 px-3 bg-[#EAE6DF]/60 border border-[#171717]/15 text-sm text-[#99968F]"
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label htmlFor="acc-cpf" className="block text-xs mb-1">CPF</label>
                    <input
                      id="acc-cpf"
                      type="text"
                      value={cpf}
                      onChange={(e) => setCpf(formatCpf(e.target.value))}
                      placeholder="000.000.000-00"
                      className="w-full h-10 px-3 bg-transparent border border-[#171717]/20 font-mono-tabular text-xs focus:outline-none focus:border-[#171717] transition-colors"
                    />
                  </div>
                  <div>
                    <label htmlFor="acc-phone" className="block text-xs mb-1">Telefone</label>
                    <input
                      id="acc-phone"
                      type="text"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      placeholder="(11) 99999-9999"
                      className="w-full h-10 px-3 bg-transparent border border-[#171717]/20 font-mono-tabular text-xs focus:outline-none focus:border-[#171717] transition-colors"
                    />
                  </div>
                </div>
                <button
                  type="submit"
                  className="px-5 py-2.5 bg-[#171717] text-[#F1EEE8] font-mono-tabular text-xs uppercase tracking-[0.12em] hover:bg-[#171717]/88 transition-colors cursor-pointer"
                >
                  Salvar Perfil
                </button>
              </form>

              {/* Saved Addresses */}
              <div className="border border-[#171717]/15 p-6 space-y-4">
                <div className="flex items-center justify-between">
                  <h2 className="font-mono-tabular text-xs uppercase tracking-[0.14em] text-[#99968F] inline-flex items-center gap-1.5">
                    <MapPin className="w-3.5 h-3.5" />
                    <span>Endereços Salvos ({addresses.length})</span>
                  </h2>
                  <button
                    type="button"
                    onClick={() => setNewAddressOpen((v) => !v)}
                    aria-expanded={newAddressOpen}
                    className="inline-flex items-center gap-1 font-mono-tabular text-[11px] uppercase underline underline-offset-4 hover:opacity-70 transition-opacity cursor-pointer"
                  >
                    <Plus className={`w-3.5 h-3.5 transition-transform duration-200 ${newAddressOpen ? 'rotate-45' : ''}`} />
                    <span>{newAddressOpen ? 'Fechar' : 'Adicionar'}</span>
                  </button>
                </div>

                <div className="accordion-panel" data-open={newAddressOpen ? 'true' : 'false'}>
                  <div>
                    <form onSubmit={handleAddAddress} className="space-y-3 pt-2 border-t border-[#171717]/10">
                      <div className="grid grid-cols-2 gap-2">
                        <input
                          type="text"
                          placeholder="Etiqueta (Casa, Trabalho)"
                          value={addrLabel}
                          onChange={(e) => setAddrLabel(e.target.value)}
                          className="h-9 px-2.5 bg-transparent border border-[#171717]/20 text-xs focus:outline-none focus:border-[#171717]"
                        />
                        <input
                          type="text"
                          required
                          placeholder="CEP"
                          value={addrCep}
                          onChange={(e) => void handleAddressCepChange(e.target.value)}
                          className="h-9 px-2.5 bg-transparent border border-[#171717]/20 font-mono-tabular text-xs focus:outline-none focus:border-[#171717]"
                        />
                      </div>
                      <input
                        type="text"
                        required
                        placeholder="Destinatário"
                        value={addrRecipient}
                        onChange={(e) => setAddrRecipient(e.target.value)}
                        className="w-full h-9 px-2.5 bg-transparent border border-[#171717]/20 text-xs focus:outline-none focus:border-[#171717]"
                      />
                      <div className="grid grid-cols-3 gap-2">
                        <input
                          type="text"
                          required
                          placeholder="Rua / Av."
                          value={addrStreet}
                          onChange={(e) => setAddrStreet(e.target.value)}
                          className="col-span-2 h-9 px-2.5 bg-transparent border border-[#171717]/20 text-xs focus:outline-none focus:border-[#171717]"
                        />
                        <input
                          type="text"
                          required
                          placeholder="Nº"
                          value={addrNumber}
                          onChange={(e) => setAddrNumber(e.target.value)}
                          className="h-9 px-2.5 bg-transparent border border-[#171717]/20 text-xs focus:outline-none focus:border-[#171717]"
                        />
                      </div>
                      <div className="grid grid-cols-3 gap-2">
                        <input
                          type="text"
                          required
                          placeholder="Bairro"
                          value={addrNeighborhood}
                          onChange={(e) => setAddrNeighborhood(e.target.value)}
                          className="h-9 px-2.5 bg-transparent border border-[#171717]/20 text-xs focus:outline-none focus:border-[#171717]"
                        />
                        <input
                          type="text"
                          required
                          placeholder="Cidade"
                          value={addrCity}
                          onChange={(e) => setAddrCity(e.target.value)}
                          className="h-9 px-2.5 bg-transparent border border-[#171717]/20 text-xs focus:outline-none focus:border-[#171717]"
                        />
                        <input
                          type="text"
                          required
                          maxLength={2}
                          placeholder="UF"
                          value={addrState}
                          onChange={(e) => setAddrState(e.target.value.toUpperCase())}
                          className="h-9 px-2.5 bg-transparent border border-[#171717]/20 font-mono-tabular text-xs uppercase focus:outline-none focus:border-[#171717]"
                        />
                      </div>
                      <button
                        type="submit"
                        className="px-4 py-2 bg-[#171717] text-[#F1EEE8] font-mono-tabular text-[11px] uppercase hover:bg-[#171717]/88 transition-colors cursor-pointer"
                      >
                        Salvar Endereço
                      </button>
                    </form>
                  </div>
                </div>

                <div className="space-y-3">
                  {addresses.map((addr) => (
                    <div key={addr.id} className="p-3 bg-[#EAE6DF]/55 flex items-start justify-between gap-3 text-xs">
                      <div>
                        <p className="font-mono-tabular uppercase tracking-[0.08em] font-medium">
                          {addr.label}
                        </p>
                        <p className="mt-0.5">
                          {addr.street}, {addr.number} — {addr.neighborhood}
                        </p>
                        <p className="text-[#99968F]">
                          {addr.city}/{addr.state} · CEP {addr.cep}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => void handleRemoveAddress(addr.id)}
                        aria-label={`Remover endereço ${addr.label}`}
                        className="text-[#99968F] hover:text-[#171717] transition-colors cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                  {addresses.length === 0 && !newAddressOpen && (
                    <p className="text-xs text-[#99968F]">Nenhum endereço salvo.</p>
                  )}
                </div>
              </div>
            </div>

            {/* Order History */}
            <div className="lg:col-span-7 space-y-4">
              <h2 className="font-mono-tabular text-xs uppercase tracking-[0.14em] text-[#99968F] inline-flex items-center gap-1.5">
                <Package className="w-3.5 h-3.5" />
                <span>Histórico de Pedidos ({orders.length})</span>
              </h2>

              {orders.length === 0 ? (
                <div className="border border-[#171717]/15 p-10 text-center space-y-3">
                  <p className="text-sm text-[#171717]/75">Você ainda não realizou pedidos.</p>
                  <button
                    type="button"
                    onClick={() => onNavigate('/shop')}
                    className="px-5 py-2.5 bg-[#171717] text-[#F1EEE8] font-mono-tabular text-xs uppercase tracking-[0.12em] hover:bg-[#171717]/88 transition-colors cursor-pointer"
                  >
                    Explorar catálogo
                  </button>
                </div>
              ) : (
                <div className="space-y-3">
                  {orders.map((ord) => {
                    const isOpen = selectedOrderId === ord.id;
                    return (
                      <div key={ord.id} className="border border-[#171717]/15 p-5">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div>
                            <span className="font-mono-tabular text-sm font-medium">
                              {ord.orderNumber}
                            </span>
                            <span className="ml-3 font-mono-tabular text-[11px] uppercase text-[#99968F]">
                              {getOrderStatusLabel(ord.status)}
                            </span>
                          </div>
                          <div className="flex items-center gap-4">
                            <span className="font-mono-tabular text-sm font-medium">
                              {formatBrl(ord.totalBrl)}
                            </span>
                            <button
                              type="button"
                              aria-expanded={isOpen}
                              onClick={() => setSelectedOrderId(isOpen ? null : ord.id)}
                              className="font-mono-tabular text-[11px] uppercase underline underline-offset-4 hover:opacity-70 transition-opacity cursor-pointer"
                            >
                              {isOpen ? 'Ocultar' : 'Detalhes'}
                            </button>
                          </div>
                        </div>

                        <div className="accordion-panel" data-open={isOpen ? 'true' : 'false'}>
                          <div>
                            <div className="pt-3 mt-3 border-t border-[#171717]/10 space-y-2 text-xs">
                              {ord.items.map((it, idx) => (
                                <div key={idx} className="flex justify-between">
                                  <span>
                                    {it.quantity}x {it.name} ({it.colorName}, Tam {it.size})
                                  </span>
                                  <span className="font-mono-tabular">
                                    {formatBrl(it.unitPriceBrl * it.quantity)}
                                  </span>
                                </div>
                              ))}
                              <p className="text-[#99968F] pt-1">
                                Entrega: {ord.shippingAddress.street}, {ord.shippingAddress.number} —{' '}
                                {ord.shippingAddress.city}/{ord.shippingAddress.state}
                              </p>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </main>
  );
};
