import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  MapPin,
  Package,
  RefreshCw,
  Search,
  UserCheck,
  Users,
} from 'lucide-react';
import type {
  AdminCustomerSummary,
  BrazilianAddress,
  CustomerAccountStatus,
  OrderRecord,
  UserProfile,
} from '../types/store';
import { formatBrl, getOrderStatusLabel } from '../utils/commerce';
import {
  aggregateCustomersWithOrders,
  filterSortPaginateCustomers,
  findMissingProfilesFromOrders,
  formatCustomerDateTime,
  getCustomerStatusLabel,
  type CustomerSortOption,
  type CustomerStatusFilter,
} from '../utils/customers';

interface AdminCustomersPanelProps {
  customers: UserProfile[];
  orders: OrderRecord[];
  currentUserUid?: string | null;
  loading: boolean;
  error: string | null;
  onRefresh: () => Promise<void>;
  onSyncMissingProfiles: () => Promise<{
    createdCount: number;
    skippedCount: number;
    failedCount: number;
  }>;
  onUpdateCustomerStatus: (userId: string, status: CustomerAccountStatus) => Promise<void>;
  onFetchCustomerAddresses: (userId: string) => Promise<BrazilianAddress[]>;
}

const PAGE_SIZE = 10;

export const AdminCustomersPanel: React.FC<AdminCustomersPanelProps> = ({
  customers,
  orders,
  currentUserUid,
  loading,
  error,
  onRefresh,
  onSyncMissingProfiles,
  onUpdateCustomerStatus,
  onFetchCustomerAddresses,
}) => {
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<CustomerStatusFilter>('ALL');
  const [sortBy, setSortBy] = useState<CustomerSortOption>('recent');
  const [page, setPage] = useState(1);

  const [selectedUid, setSelectedUid] = useState<string | null>(null);
  const [addresses, setAddresses] = useState<BrazilianAddress[]>([]);
  const [addressesLoading, setAddressesLoading] = useState(false);
  const [addressesError, setAddressesError] = useState<string | null>(null);

  const [syncing, setSyncing] = useState(false);
  const [syncFeedback, setSyncFeedback] = useState<string | null>(null);
  const [updatingStatusUid, setUpdatingStatusUid] = useState<string | null>(null);

  const summaries = useMemo(
    () => aggregateCustomersWithOrders(customers, orders, currentUserUid),
    [customers, orders, currentUserUid]
  );

  const missingCandidates = useMemo(
    () => findMissingProfilesFromOrders(customers, orders),
    [customers, orders]
  );

  const pageResult = useMemo(
    () =>
      filterSortPaginateCustomers(summaries, {
        query,
        status: statusFilter,
        sort: sortBy,
        page,
        pageSize: PAGE_SIZE,
      }),
    [summaries, query, statusFilter, sortBy, page]
  );

  useEffect(() => {
    setPage(1);
  }, [query, statusFilter, sortBy]);

  const selectedCustomer: AdminCustomerSummary | null = useMemo(
    () => (selectedUid ? summaries.find((s) => s.profile.uid === selectedUid) ?? null : null),
    [selectedUid, summaries]
  );

  useEffect(() => {
    if (!selectedUid) {
      setAddresses([]);
      setAddressesError(null);
      return;
    }

    let cancelled = false;
    setAddressesLoading(true);
    setAddressesError(null);

    onFetchCustomerAddresses(selectedUid)
      .then((list) => {
        if (!cancelled) setAddresses(list);
      })
      .catch(() => {
        if (!cancelled) {
          setAddresses([]);
          setAddressesError('Não foi possível carregar os endereços salvos deste cliente.');
        }
      })
      .finally(() => {
        if (!cancelled) setAddressesLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [selectedUid, onFetchCustomerAddresses]);

  const activeCount = useMemo(
    () => summaries.filter((s) => s.profile.status !== 'inactive').length,
    [summaries]
  );

  const customersWithOrdersCount = useMemo(
    () => summaries.filter((s) => s.orderCount > 0).length,
    [summaries]
  );

  const handleSyncClick = async () => {
    setSyncing(true);
    setSyncFeedback(null);
    try {
      const result = await onSyncMissingProfiles();
      if (result.createdCount > 0) {
        setSyncFeedback(
          `${result.createdCount} ${
            result.createdCount === 1 ? 'perfil recuperado' : 'perfis recuperados'
          } a partir do histórico de pedidos sem sobrescrever contas existentes.`
        );
      } else if (result.failedCount > 0) {
        setSyncFeedback(
          `Não foi possível sincronizar ${result.failedCount} registro(s). Verifique as permissões e tente novamente.`
        );
      } else {
        setSyncFeedback('Todos os clientes com pedidos já possuem perfil sincronizado no Firestore.');
      }
    } catch {
      setSyncFeedback('Erro ao executar a sincronização de perfis ausentes.');
    } finally {
      setSyncing(false);
    }
  };

  const handleToggleStatus = async (customer: AdminCustomerSummary) => {
    const nextStatus: CustomerAccountStatus =
      customer.profile.status === 'inactive' ? 'active' : 'inactive';
    setUpdatingStatusUid(customer.profile.uid);
    try {
      await onUpdateCustomerStatus(customer.profile.uid, nextStatus);
    } finally {
      setUpdatingStatusUid(null);
    }
  };

  // DETAIL VIEW
  if (selectedCustomer) {
    const isInactive = selectedCustomer.profile.status === 'inactive';
    const isUpdating = updatingStatusUid === selectedCustomer.profile.uid;

    return (
      <div className="space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-[#171717]/15 pb-4">
          <button
            type="button"
            onClick={() => setSelectedUid(null)}
            className="inline-flex items-center gap-2 font-mono-tabular text-xs uppercase tracking-[0.12em] hover:opacity-70 transition-opacity cursor-pointer"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Voltar para lista de clientes</span>
          </button>

          <button
            type="button"
            disabled={isUpdating}
            onClick={() => void handleToggleStatus(selectedCustomer)}
            className="px-4 py-2 border border-[#171717]/25 bg-[#F1EEE8] font-mono-tabular text-[11px] uppercase tracking-[0.12em] hover:border-[#171717] transition-colors disabled:opacity-50 cursor-pointer"
          >
            {isUpdating
              ? 'Atualizando...'
              : isInactive
                ? 'Reativar Conta'
                : 'Marcar como Inativo'}
          </button>
        </div>

        {/* Customer Header & Metrics */}
        <div className="bg-[#F1EEE8] border border-[#171717]/15 p-6 space-y-6">
          <div className="flex flex-col md:flex-row md:items-start justify-between gap-4 border-b border-[#171717]/10 pb-5">
            <div className="space-y-1.5">
              <div className="flex flex-wrap items-center gap-2.5">
                <h2 className="font-display text-2xl font-bold tracking-tight">
                  {selectedCustomer.profile.displayName || 'Cliente COMPLEX'}
                </h2>
                <span
                  className={`px-2 py-0.5 border font-mono-tabular text-[10px] uppercase tracking-[0.12em] ${
                    isInactive
                      ? 'border-[#99968F] text-[#99968F]'
                      : 'border-[#6A705C] text-[#6A705C]'
                  }`}
                >
                  {getCustomerStatusLabel(selectedCustomer.profile.status)}
                </span>
                {selectedCustomer.isCurrentSessionUser && (
                  <span className="px-2 py-0.5 bg-[#171717] text-[#F1EEE8] font-mono-tabular text-[10px] uppercase tracking-[0.12em]">
                    Sessão atual
                  </span>
                )}
              </div>
              <p className="font-mono-tabular text-xs text-[#171717]/75">
                {selectedCustomer.profile.email}
              </p>
              <p className="font-mono-tabular text-[11px] text-[#99968F]">
                UID: {selectedCustomer.profile.uid}
              </p>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 md:text-right">
              <div>
                <p className="font-mono-tabular text-[10px] uppercase text-[#99968F]">
                  Pedidos Reais
                </p>
                <p className="font-mono-tabular text-lg font-medium mt-0.5">
                  {selectedCustomer.orderCount}
                </p>
              </div>
              <div>
                <p className="font-mono-tabular text-[10px] uppercase text-[#99968F]">
                  Total Gasto (Válidos)
                </p>
                <p className="font-mono-tabular text-lg font-medium mt-0.5">
                  {formatBrl(selectedCustomer.totalSpentBrl)}
                </p>
              </div>
              <div>
                <p className="font-mono-tabular text-[10px] uppercase text-[#99968F]">
                  Último Pedido
                </p>
                <p className="font-mono-tabular text-xs mt-1.5">
                  {formatCustomerDateTime(selectedCustomer.lastOrderAt)}
                </p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 text-xs">
            <div>
              <p className="font-mono-tabular text-[10px] uppercase text-[#99968F]">
                Data de Cadastro
              </p>
              <p className="font-mono-tabular mt-1">
                {formatCustomerDateTime(selectedCustomer.profile.createdAt)}
              </p>
            </div>
            <div>
              <p className="font-mono-tabular text-[10px] uppercase text-[#99968F]">
                Último Acesso
              </p>
              <p className="font-mono-tabular mt-1">
                {formatCustomerDateTime(selectedCustomer.profile.lastLoginAt)}
              </p>
            </div>
            <div>
              <p className="font-mono-tabular text-[10px] uppercase text-[#99968F]">Telefone</p>
              <p className="font-mono-tabular mt-1">
                {selectedCustomer.profile.phone || 'Não informado'}
              </p>
            </div>
            <div>
              <p className="font-mono-tabular text-[10px] uppercase text-[#99968F]">CPF</p>
              <p className="font-mono-tabular mt-1">
                {selectedCustomer.profile.cpf || 'Não informado'}
              </p>
            </div>
          </div>
        </div>

        {/* Addresses & Order History */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-5 bg-[#F1EEE8] border border-[#171717]/15 p-6 space-y-4">
            <h3 className="font-mono-tabular text-xs uppercase tracking-[0.14em] text-[#99968F] inline-flex items-center gap-1.5">
              <MapPin className="w-3.5 h-3.5" />
              <span>Endereços Salvos ({addresses.length})</span>
            </h3>

            {addressesLoading ? (
              <p className="text-xs text-[#99968F] font-mono-tabular">Carregando endereços...</p>
            ) : addressesError ? (
              <p className="text-xs text-[#8A2C2C]">{addressesError}</p>
            ) : addresses.length === 0 ? (
              <p className="text-xs text-[#99968F]">
                Nenhum endereço cadastrado por este cliente.
              </p>
            ) : (
              <div className="space-y-3">
                {addresses.map((addr) => (
                  <div
                    key={addr.id}
                    className="p-3.5 bg-[#EAE6DF]/60 border border-[#171717]/10 text-xs space-y-1"
                  >
                    <p className="font-mono-tabular uppercase tracking-[0.08em] font-medium">
                      {addr.label || 'Endereço'} — {addr.recipientName}
                    </p>
                    <p>
                      {addr.street}, {addr.number}
                      {addr.complement ? ` (${addr.complement})` : ''} — {addr.neighborhood}
                    </p>
                    <p className="font-mono-tabular text-[#99968F]">
                      {addr.city}/{addr.state} · CEP {addr.cep}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="lg:col-span-7 bg-[#F1EEE8] border border-[#171717]/15 p-6 space-y-4">
            <h3 className="font-mono-tabular text-xs uppercase tracking-[0.14em] text-[#99968F] inline-flex items-center gap-1.5">
              <Package className="w-3.5 h-3.5" />
              <span>Histórico de Pedidos ({selectedCustomer.orders.length})</span>
            </h3>

            {selectedCustomer.orders.length === 0 ? (
              <p className="text-xs text-[#99968F]">
                Nenhum pedido realizado por este cliente ainda.
              </p>
            ) : (
              <div className="space-y-3">
                {selectedCustomer.orders.map((ord) => (
                  <div
                    key={ord.id}
                    className="border border-[#171717]/12 p-4 space-y-2.5 text-xs"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <span className="font-mono-tabular font-medium text-sm">
                          {ord.orderNumber}
                        </span>
                        <span className="ml-3 font-mono-tabular text-[11px] uppercase text-[#99968F]">
                          {getOrderStatusLabel(ord.status)}
                        </span>
                      </div>
                      <span className="font-mono-tabular text-sm font-medium">
                        {formatBrl(ord.totalBrl)}
                      </span>
                    </div>
                    <p className="font-mono-tabular text-[11px] text-[#99968F]">
                      {formatCustomerDateTime(ord.createdAt)} · {ord.shippingAddress.city}/
                      {ord.shippingAddress.state}
                    </p>
                    {ord.items.length > 0 && (
                      <div className="pt-2 border-t border-[#171717]/10 space-y-1">
                        {ord.items.map((item, idx) => (
                          <div key={idx} className="flex justify-between gap-4">
                            <span>
                              {item.quantity}x {item.name} ({item.colorName}, {item.size})
                            </span>
                            <span className="font-mono-tabular shrink-0">
                              {formatBrl(item.unitPriceBrl * item.quantity)}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  // LIST VIEW
  const rangeStart =
    pageResult.totalFiltered === 0 ? 0 : (pageResult.safePage - 1) * PAGE_SIZE + 1;
  const rangeEnd = Math.min(pageResult.safePage * PAGE_SIZE, pageResult.totalFiltered);

  return (
    <div className="space-y-6">
      {/* Header & Actions */}
      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4">
        <div className="space-y-1">
          <div className="inline-flex items-center gap-2 font-mono-tabular text-[11px] uppercase tracking-[0.14em] text-[#99968F]">
            <Users className="w-3.5 h-3.5" />
            <span>Base Persistida no Firestore (/users)</span>
          </div>
          <h2 className="font-display text-2xl font-bold tracking-tight">
            Clientes Cadastrados ({summaries.length})
          </h2>
          <p className="text-xs text-[#171717]/70 max-w-2xl">
            Exibe todas as contas registradas na COMPLEX diretamente do banco de dados,
            independentemente de quais clientes estejam conectados no momento.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            type="button"
            disabled={syncing || loading}
            onClick={() => void handleSyncClick()}
            className={`inline-flex items-center gap-2 px-4 py-2 border font-mono-tabular text-[11px] uppercase tracking-[0.12em] transition-colors disabled:opacity-50 cursor-pointer ${
              missingCandidates.length > 0
                ? 'bg-[#6A705C] text-[#F1EEE8] border-[#6A705C] hover:opacity-90'
                : 'bg-[#F1EEE8] text-[#171717] border-[#171717]/20 hover:border-[#171717]'
            }`}
          >
            <UserCheck className="w-3.5 h-3.5" />
            <span>
              {syncing
                ? 'Sincronizando...'
                : missingCandidates.length > 0
                  ? `Recuperar ${missingCandidates.length} perfil(is) ausente(s)`
                  : 'Verificar Perfis Ausentes'}
            </span>
          </button>

          <button
            type="button"
            disabled={loading}
            onClick={() => void onRefresh()}
            className="inline-flex items-center gap-2 px-4 py-2 bg-[#171717] text-[#F1EEE8] font-mono-tabular text-[11px] uppercase tracking-[0.12em] hover:bg-[#171717]/88 transition-colors disabled:opacity-50 cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>{loading ? 'Atualizando...' : 'Atualizar Lista'}</span>
          </button>
        </div>
      </div>

      {/* Summary KPI Strip */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-[#F1EEE8] border border-[#171717]/15 p-4">
          <p className="font-mono-tabular text-[10px] uppercase tracking-[0.12em] text-[#99968F]">
            Total de Contas
          </p>
          <p className="font-mono-tabular text-2xl font-medium mt-1.5">{summaries.length}</p>
        </div>
        <div className="bg-[#F1EEE8] border border-[#171717]/15 p-4">
          <p className="font-mono-tabular text-[10px] uppercase tracking-[0.12em] text-[#99968F]">
            Contas Ativas
          </p>
          <p className="font-mono-tabular text-2xl font-medium mt-1.5">{activeCount}</p>
        </div>
        <div className="bg-[#F1EEE8] border border-[#171717]/15 p-4">
          <p className="font-mono-tabular text-[10px] uppercase tracking-[0.12em] text-[#99968F]">
            Com Pedidos Reais
          </p>
          <p className="font-mono-tabular text-2xl font-medium mt-1.5">
            {customersWithOrdersCount}
          </p>
        </div>
        <div className="bg-[#F1EEE8] border border-[#171717]/15 p-4">
          <p className="font-mono-tabular text-[10px] uppercase tracking-[0.12em] text-[#99968F]">
            Sem Perfil (Em Pedidos)
          </p>
          <p className="font-mono-tabular text-2xl font-medium mt-1.5">
            {missingCandidates.length}
          </p>
        </div>
      </div>

      {syncFeedback && (
        <div className="bg-[#F1EEE8] border border-[#6A705C] px-4 py-3 text-xs text-[#171717] flex items-center justify-between gap-4">
          <span>{syncFeedback}</span>
          <button
            type="button"
            onClick={() => setSyncFeedback(null)}
            className="font-mono-tabular text-[11px] uppercase underline cursor-pointer shrink-0"
          >
            Fechar
          </button>
        </div>
      )}

      {error && (
        <div className="bg-[#F1EEE8] border border-[#8A2C2C] p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            <AlertCircle className="w-4 h-4 text-[#8A2C2C] shrink-0 mt-0.5" />
            <div className="space-y-1">
              <p className="font-mono-tabular text-xs uppercase text-[#8A2C2C]">
                Falha ao carregar lista de clientes
              </p>
              <p className="text-xs text-[#171717]/80">{error}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => void onRefresh()}
            className="px-4 py-2 bg-[#171717] text-[#F1EEE8] font-mono-tabular text-[11px] uppercase tracking-[0.12em] shrink-0 cursor-pointer"
          >
            Tentar Novamente
          </button>
        </div>
      )}

      {/* Search, Filter & Sort Controls */}
      <div className="bg-[#F1EEE8] border border-[#171717]/15 p-4 grid grid-cols-1 md:grid-cols-12 gap-3">
        <div className="md:col-span-6 relative">
          <Search className="w-4 h-4 text-[#99968F] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar cliente por nome, e-mail ou telefone..."
            aria-label="Buscar clientes"
            className="w-full h-10 pl-9 pr-3 bg-transparent border border-[#171717]/20 text-sm focus:outline-none focus:border-[#171717]"
          />
        </div>

        <div className="md:col-span-3">
          <select
            aria-label="Filtrar por status da conta"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as CustomerStatusFilter)}
            className="w-full h-10 px-3 bg-[#F1EEE8] border border-[#171717]/20 font-mono-tabular text-xs focus:outline-none focus:border-[#171717]"
          >
            <option value="ALL">Status: Todos</option>
            <option value="active">Status: Ativos</option>
            <option value="inactive">Status: Inativos</option>
          </select>
        </div>

        <div className="md:col-span-3">
          <select
            aria-label="Ordenar clientes"
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as CustomerSortOption)}
            className="w-full h-10 px-3 bg-[#F1EEE8] border border-[#171717]/20 font-mono-tabular text-xs focus:outline-none focus:border-[#171717]"
          >
            <option value="recent">Ordenar: Cadastro mais recente</option>
            <option value="last-login">Ordenar: Último acesso</option>
            <option value="spent-desc">Ordenar: Maior valor gasto</option>
            <option value="orders-desc">Ordenar: Mais pedidos</option>
            <option value="name-asc">Ordenar: Nome (A–Z)</option>
          </select>
        </div>
      </div>

      {/* Customer List */}
      <div className="bg-[#F1EEE8] border border-[#171717]/15">
        {loading && summaries.length === 0 ? (
          <div className="p-10 text-center font-mono-tabular text-xs uppercase text-[#99968F]">
            Carregando base de clientes do Firestore...
          </div>
        ) : pageResult.totalFiltered === 0 ? (
          <div className="p-10 text-center space-y-3">
            <p className="text-sm text-[#171717]/75">
              {summaries.length === 0
                ? 'Nenhum cliente persistido na coleção /users do Firestore ainda.'
                : 'Nenhum cliente corresponde aos filtros aplicados.'}
            </p>
            {(query || statusFilter !== 'ALL') && (
              <button
                type="button"
                onClick={() => {
                  setQuery('');
                  setStatusFilter('ALL');
                }}
                className="px-4 py-2 border border-[#171717]/25 font-mono-tabular text-[11px] uppercase tracking-[0.12em] hover:border-[#171717] cursor-pointer"
              >
                Limpar filtros
              </button>
            )}
          </div>
        ) : (
          <>
            {/* Desktop Table */}
            <div className="hidden lg:block overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-[#171717]/15 font-mono-tabular text-[10px] uppercase tracking-[0.12em] text-[#99968F]">
                    <th className="py-3.5 px-4 font-normal">Cliente</th>
                    <th className="py-3.5 px-4 font-normal">E-mail</th>
                    <th className="py-3.5 px-4 font-normal">Cadastro</th>
                    <th className="py-3.5 px-4 font-normal">Último Acesso</th>
                    <th className="py-3.5 px-4 font-normal">Status</th>
                    <th className="py-3.5 px-4 font-normal text-right">Pedidos</th>
                    <th className="py-3.5 px-4 font-normal text-right">Total Gasto</th>
                    <th className="py-3.5 px-4 font-normal text-right">Ação</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#171717]/10 text-xs">
                  {pageResult.items.map((row) => {
                    const isInactive = row.profile.status === 'inactive';
                    return (
                      <tr
                        key={row.profile.uid}
                        className="hover:bg-[#EAE6DF]/45 transition-colors"
                      >
                        <td className="py-3.5 px-4">
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-sm">
                              {row.profile.displayName || 'Cliente COMPLEX'}
                            </span>
                            {row.isCurrentSessionUser && (
                              <span className="px-1.5 py-0.5 bg-[#171717] text-[#F1EEE8] font-mono-tabular text-[9px] uppercase tracking-[0.1em]">
                                Sessão atual
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="py-3.5 px-4 font-mono-tabular text-[#171717]/80">
                          {row.profile.email}
                        </td>
                        <td className="py-3.5 px-4 font-mono-tabular text-[#99968F] whitespace-nowrap">
                          {formatCustomerDateTime(row.profile.createdAt)}
                        </td>
                        <td className="py-3.5 px-4 font-mono-tabular text-[#99968F] whitespace-nowrap">
                          {formatCustomerDateTime(row.profile.lastLoginAt)}
                        </td>
                        <td className="py-3.5 px-4">
                          <span
                            className={`inline-block px-2 py-0.5 border font-mono-tabular text-[10px] uppercase tracking-[0.1em] ${
                              isInactive
                                ? 'border-[#99968F] text-[#99968F]'
                                : 'border-[#6A705C] text-[#6A705C]'
                            }`}
                          >
                            {getCustomerStatusLabel(row.profile.status)}
                          </span>
                        </td>
                        <td className="py-3.5 px-4 font-mono-tabular text-right">
                          {row.orderCount}
                        </td>
                        <td className="py-3.5 px-4 font-mono-tabular text-right font-medium whitespace-nowrap">
                          {formatBrl(row.totalSpentBrl)}
                        </td>
                        <td className="py-3.5 px-4 text-right">
                          <button
                            type="button"
                            onClick={() => setSelectedUid(row.profile.uid)}
                            className="px-3 py-1.5 border border-[#171717]/25 font-mono-tabular text-[10px] uppercase tracking-[0.1em] hover:border-[#171717] transition-colors cursor-pointer"
                          >
                            Detalhes
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Mobile & Tablet Cards */}
            <div className="lg:hidden divide-y divide-[#171717]/10">
              {pageResult.items.map((row) => {
                const isInactive = row.profile.status === 'inactive';
                return (
                  <div key={row.profile.uid} className="p-4 space-y-3 text-xs">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="font-medium text-sm truncate">
                            {row.profile.displayName || 'Cliente COMPLEX'}
                          </p>
                          {row.isCurrentSessionUser && (
                            <span className="px-1.5 py-0.5 bg-[#171717] text-[#F1EEE8] font-mono-tabular text-[9px] uppercase tracking-[0.1em]">
                              Sessão atual
                            </span>
                          )}
                        </div>
                        <p className="font-mono-tabular text-[11px] text-[#99968F] truncate mt-0.5">
                          {row.profile.email}
                        </p>
                      </div>
                      <span
                        className={`shrink-0 px-2 py-0.5 border font-mono-tabular text-[10px] uppercase tracking-[0.1em] ${
                          isInactive
                            ? 'border-[#99968F] text-[#99968F]'
                            : 'border-[#6A705C] text-[#6A705C]'
                        }`}
                      >
                        {getCustomerStatusLabel(row.profile.status)}
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-2 font-mono-tabular text-[11px] text-[#99968F]">
                      <div>
                        <span className="block text-[10px] uppercase">Cadastro</span>
                        <span className="text-[#171717]">
                          {formatCustomerDateTime(row.profile.createdAt)}
                        </span>
                      </div>
                      <div>
                        <span className="block text-[10px] uppercase">Último acesso</span>
                        <span className="text-[#171717]">
                          {formatCustomerDateTime(row.profile.lastLoginAt)}
                        </span>
                      </div>
                      <div>
                        <span className="block text-[10px] uppercase">Pedidos reais</span>
                        <span className="text-[#171717]">{row.orderCount}</span>
                      </div>
                      <div>
                        <span className="block text-[10px] uppercase">Total gasto</span>
                        <span className="text-[#171717] font-medium">
                          {formatBrl(row.totalSpentBrl)}
                        </span>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => setSelectedUid(row.profile.uid)}
                      className="w-full py-2 border border-[#171717]/25 font-mono-tabular text-[11px] uppercase tracking-[0.12em] hover:border-[#171717] cursor-pointer"
                    >
                      Ver detalhes do cliente
                    </button>
                  </div>
                );
              })}
            </div>

            {/* Pagination Footer */}
            <div className="border-t border-[#171717]/15 px-4 py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3 font-mono-tabular text-[11px] text-[#99968F]">
              <span>
                Exibindo {rangeStart}–{rangeEnd} de {pageResult.totalFiltered}{' '}
                {pageResult.totalFiltered === 1 ? 'cliente' : 'clientes'}
              </span>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={pageResult.safePage <= 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  className="inline-flex items-center gap-1 px-3 py-1.5 border border-[#171717]/20 text-[#171717] disabled:opacity-40 cursor-pointer"
                >
                  <ChevronLeft className="w-3.5 h-3.5" />
                  <span>Anterior</span>
                </button>
                <span className="px-2 text-[#171717]">
                  Página {pageResult.safePage} de {pageResult.totalPages}
                </span>
                <button
                  type="button"
                  disabled={pageResult.safePage >= pageResult.totalPages}
                  onClick={() => setPage((p) => Math.min(pageResult.totalPages, p + 1))}
                  className="inline-flex items-center gap-1 px-3 py-1.5 border border-[#171717]/20 text-[#171717] disabled:opacity-40 cursor-pointer"
                >
                  <span>Próxima</span>
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
};
