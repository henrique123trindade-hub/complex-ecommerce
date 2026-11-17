import React, { useEffect, useState } from 'react';
import { Database, Lock, Plus, Sparkles, Trash2, Upload } from 'lucide-react';
import { useStore } from '../context/StoreContext';
import type {
  CategoryItem,
  CouponRecord,
  EditorialConfig,
  OrderRecord,
  OrderStatus,
  Product,
  UserProfile,
} from '../types/store';
import { STORE_ASSETS } from '../data/assets';
import { formatBrl } from '../utils/commerce';
import { formatFirebaseAuthError } from '../utils/authErrors';
import { OptimizedImage } from '../components/OptimizedImage';

interface AdminPageProps {
  onNavigate: (path: string) => void;
}

type AdminTab = 'dashboard' | 'products' | 'categories' | 'orders' | 'coupons' | 'editorial';

export const AdminPage: React.FC<AdminPageProps> = ({ onNavigate }) => {
  const {
    user,
    authReady,
    isAdmin,
    signInWithGoogle,
    products,
    categories,
    editorial,
    catalogSource,
    saveProduct,
    deleteProduct,
    saveCategory,
    saveEditorial,
    saveCoupon,
    deleteCoupon,
    fetchAllOrders,
    fetchAllCoupons,
    fetchAllCustomers,
    updateOrderStatus,
    seedDemoCatalogToFirestore,
    showToast,
  } = useStore();

  const [tab, setTab] = useState<AdminTab>('dashboard');
  const [authError, setAuthError] = useState('');
  const [orders, setOrders] = useState<OrderRecord[]>([]);
  const [coupons, setCoupons] = useState<CouponRecord[]>([]);
  const [customers, setCustomers] = useState<UserProfile[]>([]);

  // Product editor state
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [aiCopyLoading, setAiCopyLoading] = useState(false);

  // Coupon form state
  const [newCouponCode, setNewCouponCode] = useState('');
  const [newCouponPercent, setNewCouponPercent] = useState(10);
  const [newCouponMinOrder, setNewCouponMinOrder] = useState(200);

  // Editorial form state
  const [editorialDraft, setEditorialDraft] = useState<EditorialConfig>(editorial);

  useEffect(() => {
    setEditorialDraft(editorial);
  }, [editorial]);

  useEffect(() => {
    if (!isAdmin) return;
    fetchAllOrders().then(setOrders).catch(() => {});
    fetchAllCoupons().then(setCoupons).catch(() => {});
    fetchAllCustomers().then(setCustomers).catch(() => {});
  }, [isAdmin, fetchAllOrders, fetchAllCoupons, fetchAllCustomers]);

  if (!authReady) {
    return (
      <main className="min-h-screen bg-[#EAE6DF] flex items-center justify-center font-mono-tabular text-xs uppercase">
        Verificando credenciais administrativas...
      </main>
    );
  }

  if (!user || !isAdmin) {
    return (
      <main className="min-h-screen bg-[#EAE6DF] text-[#171717] flex items-center justify-center px-4">
        <div className="max-w-md w-full bg-[#F1EEE8] border border-[#171717]/20 p-8 space-y-5">
          <div className="inline-flex items-center gap-2 font-mono-tabular text-[11px] uppercase tracking-[0.14em] text-[#99968F]">
            <Lock className="w-3.5 h-3.5" />
            <span>Acesso Restrito — COMPLEX Admin</span>
          </div>
          <h1 className="font-display text-2xl font-bold tracking-tight">
            Painel Administrativo Protegido
          </h1>
          <p className="text-sm leading-relaxed text-[#171717]/75">
            {!user
              ? 'Autentique-se com uma conta autorizada de administrador para gerenciar catálogo, imagens reais, pedidos e conteúdo editorial.'
              : `A conta ${user.email} não possui permissão administrativa registrada no Firestore.`}
          </p>
          <div className="flex flex-wrap gap-3 pt-2">
            {!user && (
              <button
                type="button"
                onClick={async () => {
                  setAuthError('');
                  try {
                    await signInWithGoogle();
                  } catch (err) {
                    const host = typeof window !== 'undefined' ? window.location.hostname : undefined;
                    setAuthError(formatFirebaseAuthError(err, host));
                  }
                }}
                className="px-5 py-2.5 bg-[#171717] text-[#F1EEE8] font-mono-tabular text-xs uppercase tracking-[0.12em] cursor-pointer"
              >
                Entrar com Google
              </button>
            )}
            <button
              type="button"
              onClick={() => onNavigate('/')}
              className="px-5 py-2.5 border border-[#171717]/25 font-mono-tabular text-xs uppercase tracking-[0.12em] cursor-pointer"
            >
              Voltar à Loja
            </button>
          </div>
          {authError && <p className="text-xs text-[#8A2C2C]">{authError}</p>}
        </div>
      </main>
    );
  }

  const startNewProduct = () => {
    const id = `prod-${Date.now()}`;
    setEditingProduct({
      id,
      slug: `nova-peca-${Date.now().toString().slice(-4)}`,
      name: 'Nova Peça COMPLEX',
      category: 'Tees',
      collection: 'Coleção 001',
      priceBrl: 229,
      description: '',
      composition: '100% Algodão heavyweight',
      careInstructions: 'Lavar a frio.',
      fitNotes: 'Modelagem oversized.',
      isNew: true,
      isFeatured: false,
      isDemo: false,
      active: true,
      images: [STORE_ASSETS.boxyTeeFront.url],
      colors: [{ name: 'Carbon Black', hex: '#171717', images: [STORE_ASSETS.boxyTeeFront.url] }],
      sizes: [
        { size: 'S', stock: 5, sku: 'CMP-NEW-S' },
        { size: 'M', stock: 8, sku: 'CMP-NEW-M' },
        { size: 'L', stock: 5, sku: 'CMP-NEW-L' },
      ],
      measurements: {
        S: { widthCm: 59, lengthCm: 68, shoulderOrInseamCm: 55 },
        M: { widthCm: 62, lengthCm: 71, shoulderOrInseamCm: 58 },
        L: { widthCm: 65, lengthCm: 74, shoulderOrInseamCm: 61 },
      },
    });
  };

  const handleSaveEditedProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingProduct) return;
    await saveProduct(editingProduct);
    setEditingProduct(null);
  };

  const handleGenerateAiCopy = async () => {
    if (!editingProduct) return;
    setAiCopyLoading(true);
    try {
      const res = await fetch('/api/ai/catalog-copy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          productName: editingProduct.name,
          category: editingProduct.category,
          fitNotes: editingProduct.fitNotes,
        }),
      });
      const data = (await res.json()) as { description?: string; error?: string };
      if (!res.ok) throw new Error(data.error || 'Erro ao gerar texto.');
      if (data.description) {
        setEditingProduct({ ...editingProduct, description: data.description });
      }
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Falha no assistente editorial.');
    } finally {
      setAiCopyLoading(false);
    }
  };

  const handleLocalImageUpload = (file: File, onUrl: (dataUrl: string) => void) => {
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const maxW = 900;
        const scale = Math.min(1, maxW / img.width);
        canvas.width = Math.round(img.width * scale);
        canvas.height = Math.round(img.height * scale);
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
          onUrl(canvas.toDataURL('image/jpeg', 0.85));
        }
      };
      img.src = String(reader.result || '');
    };
    reader.readAsDataURL(file);
  };

  const totalRevenue = orders
    .filter((o) => o.status !== 'cancelled')
    .reduce((acc, o) => acc + o.totalBrl, 0);

  const lowStockCount = products.reduce(
    (acc, p) => acc + p.sizes.filter((s) => s.stock <= 2).length,
    0
  );

  return (
    <div className="min-h-screen bg-[#EAE6DF] text-[#171717]">
      {/* Distinct Admin Top Bar */}
      <header className="bg-[#171717] text-[#F1EEE8] border-b border-[#F1EEE8]/15">
        <div className="max-w-[1440px] mx-auto px-4 md:px-8 h-14 flex items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <span className="font-display font-extrabold tracking-[-0.04em]">COMPLEX</span>
            <span className="font-mono-tabular text-[11px] uppercase tracking-[0.14em] text-[#99968F]">
              Console Administrativo
            </span>
          </div>
          <div className="flex items-center gap-4">
            <span className="hidden sm:inline font-mono-tabular text-[11px] text-[#99968F]">
              {user.email}
            </span>
            <button
              type="button"
              onClick={() => onNavigate('/')}
              className="px-3.5 py-1.5 border border-[#F1EEE8]/30 font-mono-tabular text-[11px] uppercase tracking-[0.12em] hover:bg-[#F1EEE8]/10 cursor-pointer"
            >
              Ver Loja
            </button>
          </div>
        </div>
      </header>

      <div className="max-w-[1440px] mx-auto px-4 md:px-8 py-8">
        {/* Tabs */}
        <nav className="flex items-center gap-2 overflow-x-auto pb-4 border-b border-[#171717]/15 mb-8">
          {(
            [
              ['dashboard', 'Visão Geral'],
              ['products', 'Produtos & Imagens'],
              ['categories', 'Categorias'],
              ['orders', `Pedidos (${orders.length})`],
              ['coupons', 'Cupons'],
              ['editorial', 'Editorial & Loja'],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              onClick={() => setTab(id)}
              className={`px-4 py-2 font-mono-tabular text-xs uppercase tracking-[0.12em] whitespace-nowrap shrink-0 border cursor-pointer ${
                tab === id
                  ? 'bg-[#171717] text-[#F1EEE8] border-[#171717]'
                  : 'bg-[#F1EEE8] text-[#171717]/80 border-[#171717]/15'
              }`}
            >
              {label}
            </button>
          ))}
        </nav>

        {/* DASHBOARD TAB */}
        {tab === 'dashboard' && (
          <div className="space-y-8">
            {catalogSource === 'demo' && (
              <div className="bg-[#F1EEE8] border border-[#171717]/20 p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <p className="font-mono-tabular text-xs uppercase tracking-[0.12em] font-medium">
                    Catálogo em Modo Demonstrativo Local
                  </p>
                  <p className="text-xs text-[#171717]/75 mt-1">
                    Publique o catálogo inicial no Firestore para editar preços, substituir fotos geradas por fotografias reais e controlar estoque em nuvem.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => void seedDemoCatalogToFirestore()}
                  className="inline-flex items-center gap-2 px-5 py-2.5 bg-[#171717] text-[#F1EEE8] font-mono-tabular text-xs uppercase tracking-[0.12em] shrink-0 cursor-pointer"
                >
                  <Database className="w-3.5 h-3.5" />
                  <span>Sincronizar no Firestore</span>
                </button>
              </div>
            )}

            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="bg-[#F1EEE8] border border-[#171717]/15 p-5">
                <p className="font-mono-tabular text-[11px] uppercase text-[#99968F]">Volume de Pedidos</p>
                <p className="font-mono-tabular text-2xl font-medium mt-2">{formatBrl(totalRevenue)}</p>
              </div>
              <div className="bg-[#F1EEE8] border border-[#171717]/15 p-5">
                <p className="font-mono-tabular text-[11px] uppercase text-[#99968F]">Pedidos Registrados</p>
                <p className="font-mono-tabular text-2xl font-medium mt-2">{orders.length}</p>
              </div>
              <div className="bg-[#F1EEE8] border border-[#171717]/15 p-5">
                <p className="font-mono-tabular text-[11px] uppercase text-[#99968F]">Produtos Ativos</p>
                <p className="font-mono-tabular text-2xl font-medium mt-2">
                  {products.filter((p) => p.active).length}
                </p>
              </div>
              <div className="bg-[#F1EEE8] border border-[#171717]/15 p-5">
                <p className="font-mono-tabular text-[11px] uppercase text-[#99968F]">Alertas de Estoque Baixo</p>
                <p className="font-mono-tabular text-2xl font-medium mt-2">{lowStockCount}</p>
              </div>
            </div>

            <div className="bg-[#F1EEE8] border border-[#171717]/15 p-6">
              <h2 className="font-mono-tabular text-xs uppercase tracking-[0.14em] text-[#99968F] mb-4">
                Clientes Cadastrados ({customers.length})
              </h2>
              {customers.length === 0 ? (
                <p className="text-xs text-[#99968F]">Nenhum cliente registrado no Firestore ainda.</p>
              ) : (
                <div className="divide-y divide-[#171717]/10 text-xs">
                  {customers.map((c) => (
                    <div key={c.uid} className="py-2.5 flex justify-between">
                      <span>{c.displayName || 'Cliente'}</span>
                      <span className="font-mono-tabular text-[#99968F]">{c.email}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* PRODUCTS TAB */}
        {tab === 'products' && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="font-display text-2xl font-bold">Gestão de Produtos & Imagens</h2>
              <button
                type="button"
                onClick={startNewProduct}
                className="inline-flex items-center gap-2 px-5 py-2.5 bg-[#171717] text-[#F1EEE8] font-mono-tabular text-xs uppercase tracking-[0.12em] cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>Novo Produto</span>
              </button>
            </div>

            {editingProduct ? (
              <form
                onSubmit={handleSaveEditedProduct}
                className="bg-[#F1EEE8] border border-[#171717]/20 p-6 space-y-6"
              >
                <div className="flex items-center justify-between border-b border-[#171717]/12 pb-4">
                  <h3 className="font-display text-xl font-bold">
                    {editingProduct.name} ({editingProduct.id})
                  </h3>
                  <button
                    type="button"
                    onClick={() => setEditingProduct(null)}
                    className="font-mono-tabular text-xs uppercase underline cursor-pointer"
                  >
                    Cancelar
                  </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-xs mb-1">Nome do Produto</label>
                    <input
                      type="text"
                      required
                      value={editingProduct.name}
                      onChange={(e) => setEditingProduct({ ...editingProduct, name: e.target.value })}
                      className="w-full h-10 px-3 border border-[#171717]/20 bg-transparent text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs mb-1">Slug URL</label>
                    <input
                      type="text"
                      required
                      value={editingProduct.slug}
                      onChange={(e) =>
                        setEditingProduct({
                          ...editingProduct,
                          slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '-'),
                        })
                      }
                      className="w-full h-10 px-3 border border-[#171717]/20 bg-transparent font-mono-tabular text-xs"
                    />
                  </div>
                  <div>
                    <label className="block text-xs mb-1">Preço (R$)</label>
                    <input
                      type="number"
                      required
                      min={1}
                      value={editingProduct.priceBrl}
                      onChange={(e) =>
                        setEditingProduct({ ...editingProduct, priceBrl: Number(e.target.value) })
                      }
                      className="w-full h-10 px-3 border border-[#171717]/20 bg-transparent font-mono-tabular text-sm"
                    />
                  </div>

                  <div>
                    <label className="block text-xs mb-1">Categoria</label>
                    <select
                      value={editingProduct.category}
                      onChange={(e) =>
                        setEditingProduct({
                          ...editingProduct,
                          category: e.target.value as Product['category'],
                        })
                      }
                      className="w-full h-10 px-3 border border-[#171717]/20 bg-[#F1EEE8] text-sm"
                    >
                      <option value="Tees">Camisetas</option>
                      <option value="Hoodies">Moletons</option>
                      <option value="Bottoms">Calças</option>
                      <option value="Outerwear">Jaquetas</option>
                      <option value="Accessories">Acessórios</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs mb-1">Coleção</label>
                    <input
                      type="text"
                      value={editingProduct.collection}
                      onChange={(e) =>
                        setEditingProduct({ ...editingProduct, collection: e.target.value })
                      }
                      className="w-full h-10 px-3 border border-[#171717]/20 bg-transparent text-sm"
                    />
                  </div>

                  <div className="flex items-end gap-4 pb-2 text-xs">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={editingProduct.isNew}
                        onChange={(e) =>
                          setEditingProduct({ ...editingProduct, isNew: e.target.checked })
                        }
                      />
                      <span>Novidade</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={editingProduct.isDemo}
                        onChange={(e) =>
                          setEditingProduct({ ...editingProduct, isDemo: e.target.checked })
                        }
                      />
                      <span>Item Demo</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={editingProduct.active}
                        onChange={(e) =>
                          setEditingProduct({ ...editingProduct, active: e.target.checked })
                        }
                      />
                      <span>Ativo</span>
                    </label>
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-xs">Descrição Comercial</label>
                    <button
                      type="button"
                      disabled={aiCopyLoading}
                      onClick={() => void handleGenerateAiCopy()}
                      className="inline-flex items-center gap-1 font-mono-tabular text-[11px] uppercase text-[#6A705C] hover:underline cursor-pointer"
                    >
                      <Sparkles className="w-3 h-3" />
                      <span>{aiCopyLoading ? 'Gerando...' : 'Sugerir texto editorial'}</span>
                    </button>
                  </div>
                  <textarea
                    rows={3}
                    value={editingProduct.description}
                    onChange={(e) =>
                      setEditingProduct({ ...editingProduct, description: e.target.value })
                    }
                    className="w-full p-3 border border-[#171717]/20 bg-transparent text-sm"
                  />
                </div>

                {/* Images manager (replace generated images with real photography) */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <p className="font-mono-tabular text-xs uppercase tracking-[0.12em]">
                      Fotografias do Produto ({editingProduct.images.length})
                    </p>
                    <label className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-[#171717]/25 font-mono-tabular text-[11px] uppercase cursor-pointer">
                      <Upload className="w-3.5 h-3.5" />
                      <span>Upload Foto Real</span>
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) {
                            handleLocalImageUpload(file, (url) => {
                              setEditingProduct((prev) =>
                                prev ? { ...prev, images: [...prev.images, url] } : prev
                              );
                            });
                          }
                        }}
                      />
                    </label>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    {editingProduct.images.map((imgUrl, idx) => (
                      <div key={idx} className="border border-[#171717]/15 p-2 space-y-2">
                        <OptimizedImage src={imgUrl} alt={`Foto ${idx + 1}`} sizes="thumb" className="w-full aspect-[3/4]" imgClassName="w-full h-full object-cover object-[50%_18%]" />
                        <input
                          type="text"
                          value={imgUrl}
                          onChange={(e) => {
                            const next = [...editingProduct.images];
                            next[idx] = e.target.value;
                            setEditingProduct({ ...editingProduct, images: next });
                          }}
                          className="w-full px-2 py-1 border border-[#171717]/15 text-[10px] font-mono-tabular"
                        />
                        {editingProduct.images.length > 1 && (
                          <button
                            type="button"
                            onClick={() =>
                              setEditingProduct({
                                ...editingProduct,
                                images: editingProduct.images.filter((_, i) => i !== idx),
                              })
                            }
                            className="text-[11px] text-[#8A2C2C] underline cursor-pointer"
                          >
                            Remover
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                </div>

                {/* Variants & Stock */}
                <div className="space-y-2">
                  <p className="font-mono-tabular text-xs uppercase tracking-[0.12em]">
                    Tamanhos & Estoque
                  </p>
                  <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                    {editingProduct.sizes.map((sz, idx) => (
                      <div key={idx} className="border border-[#171717]/15 p-2.5 space-y-1.5">
                        <span className="font-mono-tabular text-xs font-medium">{sz.size}</span>
                        <input
                          type="number"
                          min={0}
                          value={sz.stock}
                          onChange={(e) => {
                            const next = [...editingProduct.sizes];
                            next[idx] = { ...sz, stock: Math.max(0, Number(e.target.value)) };
                            setEditingProduct({ ...editingProduct, sizes: next });
                          }}
                          className="w-full h-8 px-2 border border-[#171717]/20 font-mono-tabular text-xs"
                        />
                      </div>
                    ))}
                  </div>
                </div>

                <button
                  type="submit"
                  className="px-6 py-3 bg-[#171717] text-[#F1EEE8] font-mono-tabular text-xs uppercase tracking-[0.14em] cursor-pointer"
                >
                  Salvar Produto no Firestore
                </button>
              </form>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {products.map((p) => (
                  <div
                    key={p.id}
                    className="bg-[#F1EEE8] border border-[#171717]/15 p-4 flex items-center gap-4"
                  >
                    <OptimizedImage
                      src={p.images[0]}
                      alt={p.name}
                      sizes="thumb"
                      className="w-16 aspect-[3/4] shrink-0 bg-[#EAE6DF]"
                      imgClassName="w-full h-full object-cover object-[50%_18%]"
                    />
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm truncate">
                        {p.name}{' '}
                        {p.isDemo && (
                          <span className="font-mono-tabular text-[10px] text-[#99968F]">(DEMO)</span>
                        )}
                      </p>
                      <p className="font-mono-tabular text-xs text-[#99968F]">
                        {p.category} · {formatBrl(p.priceBrl)}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setEditingProduct(p)}
                        className="px-3 py-1.5 border border-[#171717]/25 font-mono-tabular text-[11px] uppercase cursor-pointer"
                      >
                        Editar
                      </button>
                      <button
                        type="button"
                        onClick={() => void deleteProduct(p.id)}
                        aria-label={`Remover ${p.name}`}
                        className="p-1.5 text-[#8A2C2C] cursor-pointer"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* CATEGORIES TAB */}
        {tab === 'categories' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {categories.map((cat) => (
              <CategoryEditorRow key={cat.id} category={cat} onSave={saveCategory} />
            ))}
          </div>
        )}

        {/* ORDERS TAB */}
        {tab === 'orders' && (
          <div className="space-y-4">
            <h2 className="font-display text-2xl font-bold">Gestão de Pedidos</h2>
            {orders.length === 0 ? (
              <p className="bg-[#F1EEE8] border border-[#171717]/15 p-8 text-sm text-[#99968F]">
                Nenhum pedido persistido no Firestore ainda.
              </p>
            ) : (
              orders.map((ord) => (
                <div
                  key={ord.id}
                  className="bg-[#F1EEE8] border border-[#171717]/15 p-5 flex flex-col md:flex-row md:items-center justify-between gap-4"
                >
                  <div>
                    <p className="font-mono-tabular text-sm font-medium">
                      {ord.orderNumber} — {ord.customerName}
                    </p>
                    <p className="text-xs text-[#99968F]">
                      {ord.customerEmail} · {ord.shippingAddress.city}/{ord.shippingAddress.state} ·{' '}
                      {formatBrl(ord.totalBrl)}
                    </p>
                  </div>
                  <select
                    aria-label={`Status do pedido ${ord.orderNumber}`}
                    value={ord.status}
                    onChange={(e) => {
                      const next = e.target.value as OrderStatus;
                      void updateOrderStatus(ord.id, next).then(() =>
                        setOrders((prev) =>
                          prev.map((o) => (o.id === ord.id ? { ...o, status: next } : o))
                        )
                      );
                    }}
                    className="h-9 px-3 bg-[#F1EEE8] border border-[#171717]/25 font-mono-tabular text-xs uppercase"
                  >
                    <option value="demo_pending">demo_pending</option>
                    <option value="confirmed">confirmed</option>
                    <option value="preparing">preparing</option>
                    <option value="shipped">shipped</option>
                    <option value="delivered">delivered</option>
                    <option value="cancelled">cancelled</option>
                  </select>
                </div>
              ))
            )}
          </div>
        )}

        {/* COUPONS TAB */}
        {tab === 'coupons' && (
          <div className="space-y-6">
            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (!newCouponCode.trim()) return;
                void saveCoupon({
                  code: newCouponCode.trim().toUpperCase(),
                  discountPercent: newCouponPercent,
                  minOrderBrl: newCouponMinOrder,
                  active: true,
                  usageCount: 0,
                }).then(() => fetchAllCoupons().then(setCoupons));
                setNewCouponCode('');
              }}
              className="bg-[#F1EEE8] border border-[#171717]/15 p-5 grid grid-cols-1 sm:grid-cols-4 gap-3 items-end"
            >
              <div>
                <label className="block text-xs mb-1">Código</label>
                <input
                  type="text"
                  required
                  value={newCouponCode}
                  onChange={(e) => setNewCouponCode(e.target.value.toUpperCase())}
                  placeholder="COMPLEX15"
                  className="w-full h-10 px-3 border border-[#171717]/20 font-mono-tabular text-xs uppercase"
                />
              </div>
              <div>
                <label className="block text-xs mb-1">Desconto (%)</label>
                <input
                  type="number"
                  min={1}
                  max={90}
                  value={newCouponPercent}
                  onChange={(e) => setNewCouponPercent(Number(e.target.value))}
                  className="w-full h-10 px-3 border border-[#171717]/20 font-mono-tabular text-xs"
                />
              </div>
              <div>
                <label className="block text-xs mb-1">Mínimo (R$)</label>
                <input
                  type="number"
                  min={0}
                  value={newCouponMinOrder}
                  onChange={(e) => setNewCouponMinOrder(Number(e.target.value))}
                  className="w-full h-10 px-3 border border-[#171717]/20 font-mono-tabular text-xs"
                />
              </div>
              <button
                type="submit"
                className="h-10 bg-[#171717] text-[#F1EEE8] font-mono-tabular text-xs uppercase tracking-[0.12em] cursor-pointer"
              >
                Criar Cupom
              </button>
            </form>

            <div className="space-y-2">
              {coupons.map((c) => (
                <div
                  key={c.code}
                  className="bg-[#F1EEE8] border border-[#171717]/15 p-4 flex items-center justify-between"
                >
                  <div>
                    <span className="font-mono-tabular font-medium text-sm">{c.code}</span>
                    <span className="ml-3 text-xs text-[#99968F]">
                      {c.discountPercent}% off · Mínimo {formatBrl(c.minOrderBrl)}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() =>
                      void deleteCoupon(c.code).then(() =>
                        setCoupons((prev) => prev.filter((item) => item.code !== c.code))
                      )
                    }
                    className="text-xs text-[#8A2C2C] underline cursor-pointer"
                  >
                    Excluir
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* EDITORIAL & STORE SETTINGS TAB */}
        {tab === 'editorial' && (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void saveEditorial(editorialDraft);
            }}
            className="bg-[#F1EEE8] border border-[#171717]/15 p-6 space-y-5"
          >
            <h2 className="font-display text-2xl font-bold">Conteúdo Editorial & Configurações</h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs mb-1">Barra de Topo</label>
                <input
                  type="text"
                  value={editorialDraft.announcementText}
                  onChange={(e) =>
                    setEditorialDraft({ ...editorialDraft, announcementText: e.target.value })
                  }
                  className="w-full h-10 px-3 border border-[#171717]/20 text-xs font-mono-tabular"
                />
              </div>
              <div>
                <label className="block text-xs mb-1">Título Hero</label>
                <input
                  type="text"
                  value={editorialDraft.heroTitle}
                  onChange={(e) =>
                    setEditorialDraft({ ...editorialDraft, heroTitle: e.target.value })
                  }
                  className="w-full h-10 px-3 border border-[#171717]/20 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs mb-1">Subtítulo Hero</label>
                <input
                  type="text"
                  value={editorialDraft.heroSubtitle}
                  onChange={(e) =>
                    setEditorialDraft({ ...editorialDraft, heroSubtitle: e.target.value })
                  }
                  className="w-full h-10 px-3 border border-[#171717]/20 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs mb-1">Imagem Hero Desktop (URL)</label>
                <input
                  type="text"
                  value={editorialDraft.heroDesktopImage}
                  onChange={(e) =>
                    setEditorialDraft({ ...editorialDraft, heroDesktopImage: e.target.value })
                  }
                  className="w-full h-10 px-3 border border-[#171717]/20 text-xs font-mono-tabular"
                />
              </div>
              <div>
                <label className="block text-xs mb-1">Título Campanha</label>
                <input
                  type="text"
                  value={editorialDraft.campaignTitle}
                  onChange={(e) =>
                    setEditorialDraft({ ...editorialDraft, campaignTitle: e.target.value })
                  }
                  className="w-full h-10 px-3 border border-[#171717]/20 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs mb-1">E-mail de Atendimento</label>
                <input
                  type="text"
                  value={editorialDraft.contactEmail}
                  onChange={(e) =>
                    setEditorialDraft({ ...editorialDraft, contactEmail: e.target.value })
                  }
                  className="w-full h-10 px-3 border border-[#171717]/20 text-sm"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs mb-1">Texto Collection Story</label>
              <textarea
                rows={3}
                value={editorialDraft.storyCopy}
                onChange={(e) =>
                  setEditorialDraft({ ...editorialDraft, storyCopy: e.target.value })
                }
                className="w-full p-3 border border-[#171717]/20 text-sm"
              />
            </div>

            <button
              type="submit"
              className="px-6 py-3 bg-[#171717] text-[#F1EEE8] font-mono-tabular text-xs uppercase tracking-[0.14em] cursor-pointer"
            >
              Publicar Alterações Editoriais
            </button>
          </form>
        )}
      </div>
    </div>
  );
};

const CategoryEditorRow: React.FC<{
  category: CategoryItem;
  onSave: (c: CategoryItem) => Promise<void>;
}> = ({ category, onSave }) => {
  const [draft, setDraft] = useState(category);
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        void onSave(draft);
      }}
      className="bg-[#F1EEE8] border border-[#171717]/15 p-5 space-y-3"
    >
      <div className="flex items-center gap-4">
        <OptimizedImage src={draft.image} alt={draft.name} sizes="thumb" className="w-14 aspect-[3/4] shrink-0" imgClassName="w-full h-full object-cover object-top" />
        <div className="flex-1 space-y-2">
          <input
            type="text"
            value={draft.name}
            onChange={(e) => setDraft({ ...draft, name: e.target.value })}
            className="w-full h-9 px-2.5 border border-[#171717]/20 text-sm font-medium"
          />
          <input
            type="text"
            value={draft.description}
            onChange={(e) => setDraft({ ...draft, description: e.target.value })}
            className="w-full h-9 px-2.5 border border-[#171717]/20 text-xs"
          />
        </div>
      </div>
      <input
        type="text"
        value={draft.image}
        onChange={(e) => setDraft({ ...draft, image: e.target.value })}
        className="w-full h-8 px-2.5 border border-[#171717]/15 font-mono-tabular text-[11px]"
      />
      <button
        type="submit"
        className="px-4 py-2 bg-[#171717] text-[#F1EEE8] font-mono-tabular text-[11px] uppercase cursor-pointer"
      >
        Salvar Categoria
      </button>
    </form>
  );
};
