import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
} from 'firebase/firestore';
import { onAuthStateChanged, signInWithPopup, signOut, type User } from 'firebase/auth';
import {
  auth,
  db,
  googleAuthProvider,
  handleFirestoreError,
  OperationType,
} from '../lib/firebase';
import {
  DEFAULT_EDITORIAL,
  DEMO_CATEGORIES,
  DEMO_COUPONS,
  DEMO_PRODUCTS,
} from '../data/seedCatalog';
import type {
  BrazilianAddress,
  CartItem,
  CategoryItem,
  CouponRecord,
  EditorialConfig,
  OrderRecord,
  OrderStatus,
  Product,
  UserProfile,
} from '../types/store';
import { clampQuantityForStock } from '../utils/commerce';

const CART_STORAGE_KEY = 'complex_cart_v1';
const DEMO_ORDERS_STORAGE_KEY = 'complex_demo_orders_v1';
const BOOTSTRAPPED_ADMIN_EMAIL = 'henrique123trindade@gmail.com';

interface StoreContextValue {
  products: Product[];
  categories: CategoryItem[];
  editorial: EditorialConfig;
  catalogLoading: boolean;
  catalogSource: 'demo' | 'firestore';
  user: User | null;
  authReady: boolean;
  isAdmin: boolean;
  userProfile: UserProfile | null;
  cart: CartItem[];
  cartCount: number;
  cartSubtotal: number;
  isBagOpen: boolean;
  isSearchOpen: boolean;
  isAdvisorOpen: boolean;
  toastMessage: string | null;
  openBag: () => void;
  closeBag: () => void;
  openSearch: () => void;
  closeSearch: () => void;
  openAdvisor: () => void;
  closeAdvisor: () => void;
  showToast: (msg: string) => void;
  addToCart: (product: Product, colorName: string, size: string, quantity?: number) => void;
  updateCartQuantity: (key: string, quantity: number) => void;
  removeFromCart: (key: string) => void;
  clearCart: () => void;
  signInWithGoogle: () => Promise<void>;
  logout: () => Promise<void>;
  refreshCatalog: () => Promise<void>;
  validateCoupon: (code: string) => Promise<CouponRecord | null>;
  submitOrder: (order: Omit<OrderRecord, 'createdAt' | 'updatedAt'>) => Promise<OrderRecord>;
  getDemoOrders: () => OrderRecord[];
  fetchUserOrders: () => Promise<OrderRecord[]>;
  fetchAllOrders: () => Promise<OrderRecord[]>;
  fetchAllCoupons: () => Promise<CouponRecord[]>;
  fetchAllCustomers: () => Promise<UserProfile[]>;
  fetchAddresses: () => Promise<BrazilianAddress[]>;
  saveAddress: (address: Omit<BrazilianAddress, 'createdAt' | 'userId'>) => Promise<void>;
  deleteAddress: (addressId: string) => Promise<void>;
  saveUserProfile: (profile: Partial<UserProfile>) => Promise<void>;
  saveProduct: (product: Product) => Promise<void>;
  deleteProduct: (productId: string) => Promise<void>;
  saveCategory: (category: CategoryItem) => Promise<void>;
  saveEditorial: (editorial: EditorialConfig) => Promise<void>;
  saveCoupon: (coupon: CouponRecord) => Promise<void>;
  deleteCoupon: (code: string) => Promise<void>;
  updateOrderStatus: (orderId: string, status: OrderStatus) => Promise<void>;
  seedDemoCatalogToFirestore: () => Promise<void>;
  subscribeNewsletter: (email: string, consent: boolean) => Promise<void>;
}

const StoreContext = createContext<StoreContextValue | null>(null);

export const StoreProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [products, setProducts] = useState<Product[]>(DEMO_PRODUCTS);
  const [categories, setCategories] = useState<CategoryItem[]>(DEMO_CATEGORIES);
  const [editorial, setEditorial] = useState<EditorialConfig>(DEFAULT_EDITORIAL);
  const [catalogLoading, setCatalogLoading] = useState<boolean>(true);
  const [catalogSource, setCatalogSource] = useState<'demo' | 'firestore'>('demo');

  const [user, setUser] = useState<User | null>(null);
  const [authReady, setAuthReady] = useState<boolean>(false);
  const [isAdmin, setIsAdmin] = useState<boolean>(false);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);

  const [cart, setCart] = useState<CartItem[]>(() => {
    try {
      const saved = localStorage.getItem(CART_STORAGE_KEY);
      return saved ? (JSON.parse(saved) as CartItem[]) : [];
    } catch {
      return [];
    }
  });

  const [isBagOpen, setIsBagOpen] = useState(false);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [isAdvisorOpen, setIsAdvisorOpen] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = useCallback((msg: string) => {
    setToastMessage(msg);
    window.setTimeout(() => {
      setToastMessage((current) => (current === msg ? null : current));
    }, 3200);
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(cart));
    } catch {
      // Ignore quota errors
    }
  }, [cart]);

  const refreshCatalog = useCallback(async () => {
    setCatalogLoading(true);
    try {
      const [prodSnap, catSnap, edSnap] = await Promise.all([
        getDocs(collection(db, 'products')),
        getDocs(query(collection(db, 'categories'), orderBy('orderIndex', 'asc'))),
        getDoc(doc(db, 'editorial', 'homepage')),
      ]);

      if (!prodSnap.empty) {
        const loadedProducts = prodSnap.docs.map((d) => d.data() as Product);
        setProducts(loadedProducts);
        setCatalogSource('firestore');
      } else {
        setProducts(DEMO_PRODUCTS);
        setCatalogSource('demo');
      }

      if (!catSnap.empty) {
        setCategories(catSnap.docs.map((d) => d.data() as CategoryItem));
      } else {
        setCategories(DEMO_CATEGORIES);
      }

      if (edSnap.exists()) {
        const rawEd = edSnap.data() as Partial<EditorialConfig>;
        const normalizedEd: Partial<EditorialConfig> = {
          ...rawEd,
          heroTitle:
            rawEd.heroTitle === 'NEW PERSPECTIVE.' ? 'NOVA PERSPECTIVA.' : rawEd.heroTitle,
          campaignTitle:
            rawEd.campaignTitle === 'BUILT FOR EVERYDAY.'
              ? 'FEITO PARA O DIA A DIA.'
              : rawEd.campaignTitle,
        };
        setEditorial({ ...DEFAULT_EDITORIAL, ...normalizedEd });
      } else {
        setEditorial(DEFAULT_EDITORIAL);
      }
    } catch {
      // Preserve demo catalog on offline or unseeded Firestore
      setProducts(DEMO_PRODUCTS);
      setCategories(DEMO_CATEGORIES);
      setEditorial(DEFAULT_EDITORIAL);
      setCatalogSource('demo');
    } finally {
      setCatalogLoading(false);
    }
  }, []);

  useEffect(() => {
    void refreshCatalog();
  }, [refreshCatalog]);

  useEffect(() => {
    let settled = false;
    const safetyTimer = window.setTimeout(() => {
      if (!settled) setAuthReady(true);
    }, 1500);

    const unsub = onAuthStateChanged(auth, async (firebaseUser) => {
      settled = true;
      window.clearTimeout(safetyTimer);
      setUser(firebaseUser);
      if (!firebaseUser) {
        setIsAdmin(false);
        setUserProfile(null);
        setAuthReady(true);
        return;
      }

      let adminFlag =
        firebaseUser.email === BOOTSTRAPPED_ADMIN_EMAIL && firebaseUser.emailVerified;

      if (!adminFlag) {
        try {
          const adminDoc = await getDoc(doc(db, 'admins', firebaseUser.uid));
          adminFlag = adminDoc.exists();
        } catch {
          adminFlag = false;
        }
      }
      setIsAdmin(adminFlag);

      try {
        const profileRef = doc(db, 'users', firebaseUser.uid);
        const profileSnap = await getDoc(profileRef);
        if (profileSnap.exists()) {
          const data = profileSnap.data() as UserProfile;
          setUserProfile(data);
        } else if (firebaseUser.emailVerified) {
          const newProfile = {
            uid: firebaseUser.uid,
            displayName: firebaseUser.displayName || 'Cliente COMPLEX',
            email: firebaseUser.email || '',
            cpf: '',
            phone: '',
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          };
          await setDoc(profileRef, newProfile);
          setUserProfile({
            uid: firebaseUser.uid,
            displayName: newProfile.displayName,
            email: newProfile.email,
            cpf: '',
            phone: '',
          });
        }
      } catch {
        setUserProfile({
          uid: firebaseUser.uid,
          displayName: firebaseUser.displayName || 'Cliente COMPLEX',
          email: firebaseUser.email || '',
        });
      }

      setAuthReady(true);
    });

    return () => {
      window.clearTimeout(safetyTimer);
      unsub();
    };
  }, []);

  const signInWithGoogle = useCallback(async () => {
    await signInWithPopup(auth, googleAuthProvider);
  }, []);

  const logout = useCallback(async () => {
    await signOut(auth);
    showToast('Sessão encerrada.');
  }, [showToast]);

  const addToCart = useCallback(
    (product: Product, colorName: string, size: string, quantity = 1) => {
      const sizeEntry = product.sizes.find((s) => s.size === size);
      if (!sizeEntry || sizeEntry.stock <= 0) {
        showToast('Tamanho indisponível no momento.');
        return;
      }

      const colorObj =
        product.colors.find((c) => c.name === colorName) || product.colors[0];
      const key = `${product.id}::${colorObj?.name || 'Padrão'}::${size}`;

      setCart((prev) => {
        const existing = prev.find((item) => item.key === key);
        if (existing) {
          const nextQty = clampQuantityForStock(existing.quantity + quantity, sizeEntry.stock);
          return prev.map((item) =>
            item.key === key ? { ...item, quantity: nextQty, maxStock: sizeEntry.stock } : item
          );
        }
        const safeQty = clampQuantityForStock(quantity, sizeEntry.stock);
        return [
          ...prev,
          {
            key,
            productId: product.id,
            slug: product.slug,
            name: product.name,
            priceBrl: product.priceBrl,
            colorName: colorObj?.name || 'Padrão',
            colorHex: colorObj?.hex || '#171717',
            size,
            sku: sizeEntry.sku,
            quantity: safeQty,
            maxStock: sizeEntry.stock,
            image: colorObj?.images?.[0] || product.images[0],
          },
        ];
      });

      setIsBagOpen(true);
      showToast(`${product.name} (${size}) adicionado à sacola.`);
    },
    [showToast]
  );

  const updateCartQuantity = useCallback((key: string, quantity: number) => {
    setCart((prev) =>
      prev
        .map((item) => {
          if (item.key !== key) return item;
          if (quantity <= 0) return null;
          return {
            ...item,
            quantity: clampQuantityForStock(quantity, item.maxStock),
          };
        })
        .filter((x): x is CartItem => x !== null)
    );
  }, []);

  const removeFromCart = useCallback((key: string) => {
    setCart((prev) => prev.filter((item) => item.key !== key));
  }, []);

  const clearCart = useCallback(() => {
    setCart([]);
  }, []);

  const validateCoupon = useCallback(async (rawCode: string): Promise<CouponRecord | null> => {
    const code = rawCode.trim().toUpperCase();
    if (!code || !/^[A-Z0-9_-]+$/.test(code)) return null;

    try {
      const snap = await getDoc(doc(db, 'coupons', code));
      if (snap.exists()) {
        const coupon = snap.data() as CouponRecord;
        return coupon.active ? coupon : null;
      }
    } catch {
      // Fallback to demo coupon
    }

    const demoMatch = DEMO_COUPONS.find((c) => c.code === code && c.active);
    return demoMatch || null;
  }, []);

  const getDemoOrders = useCallback((): OrderRecord[] => {
    try {
      const raw = localStorage.getItem(DEMO_ORDERS_STORAGE_KEY);
      return raw ? (JSON.parse(raw) as OrderRecord[]) : [];
    } catch {
      return [];
    }
  }, []);

  const submitOrder = useCallback(
    async (orderInput: Omit<OrderRecord, 'createdAt' | 'updatedAt'>): Promise<OrderRecord> => {
      // 1. Register via Express server (real server-side validation for demo order)
      const res = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(orderInput),
      });

      if (!res.ok) {
        const errBody = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(errBody.error || 'Falha ao registrar pedido de demonstração.');
      }

      const serverOrder = (await res.json()) as OrderRecord;

      // 2. If signed in & verified, persist to Firestore /orders/{id}
      if (user && user.emailVerified) {
        const firestorePath = `orders/${serverOrder.id}`;
        try {
          await setDoc(doc(db, 'orders', serverOrder.id), {
            id: serverOrder.id,
            orderNumber: serverOrder.orderNumber,
            userId: user.uid,
            customerName: serverOrder.customerName,
            customerEmail: serverOrder.customerEmail,
            ...(serverOrder.customerCpf ? { customerCpf: serverOrder.customerCpf } : {}),
            shippingAddress: serverOrder.shippingAddress,
            shippingMethod: serverOrder.shippingMethod,
            shippingCostBrl: serverOrder.shippingCostBrl,
            paymentMethod: serverOrder.paymentMethod,
            ...(serverOrder.couponCode ? { couponCode: serverOrder.couponCode } : {}),
            discountBrl: serverOrder.discountBrl,
            subtotalBrl: serverOrder.subtotalBrl,
            totalBrl: serverOrder.totalBrl,
            status: 'demo_pending',
            isDemo: true,
            items: serverOrder.items,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          });
        } catch (error) {
          handleFirestoreError(error, OperationType.CREATE, firestorePath);
        }
      }

      // 3. Also store locally in browser demo history
      try {
        const existing = getDemoOrders();
        localStorage.setItem(
          DEMO_ORDERS_STORAGE_KEY,
          JSON.stringify([serverOrder, ...existing].slice(0, 20))
        );
      } catch {
        // Ignore storage quota
      }

      clearCart();
      return serverOrder;
    },
    [clearCart, getDemoOrders, user]
  );

  const fetchUserOrders = useCallback(async (): Promise<OrderRecord[]> => {
    if (!user) return getDemoOrders();
    const path = 'orders';
    try {
      const q = query(
        collection(db, 'orders'),
        where('userId', '==', user.uid),
        orderBy('createdAt', 'desc')
      );
      const snap = await getDocs(q);
      return snap.docs.map((d) => {
        const raw = d.data() as Record<string, unknown>;
        return {
          ...(raw as unknown as OrderRecord),
          createdAt:
            raw.createdAt && typeof (raw.createdAt as { toDate?: () => Date }).toDate === 'function'
              ? (raw.createdAt as { toDate: () => Date }).toDate().toISOString()
              : String(raw.createdAt || new Date().toISOString()),
          updatedAt:
            raw.updatedAt && typeof (raw.updatedAt as { toDate?: () => Date }).toDate === 'function'
              ? (raw.updatedAt as { toDate: () => Date }).toDate().toISOString()
              : String(raw.updatedAt || new Date().toISOString()),
        };
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.LIST, path);
    }
  }, [getDemoOrders, user]);

  const fetchAllOrders = useCallback(async (): Promise<OrderRecord[]> => {
    const path = 'orders';
    try {
      const snap = await getDocs(query(collection(db, 'orders'), orderBy('createdAt', 'desc')));
      return snap.docs.map((d) => {
        const raw = d.data() as Record<string, unknown>;
        return {
          ...(raw as unknown as OrderRecord),
          createdAt:
            raw.createdAt && typeof (raw.createdAt as { toDate?: () => Date }).toDate === 'function'
              ? (raw.createdAt as { toDate: () => Date }).toDate().toISOString()
              : String(raw.createdAt || new Date().toISOString()),
          updatedAt:
            raw.updatedAt && typeof (raw.updatedAt as { toDate?: () => Date }).toDate === 'function'
              ? (raw.updatedAt as { toDate: () => Date }).toDate().toISOString()
              : String(raw.updatedAt || new Date().toISOString()),
        };
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.LIST, path);
    }
  }, []);

  const fetchAllCoupons = useCallback(async (): Promise<CouponRecord[]> => {
    const path = 'coupons';
    try {
      const snap = await getDocs(collection(db, 'coupons'));
      return snap.docs.map((d) => d.data() as CouponRecord);
    } catch (error) {
      handleFirestoreError(error, OperationType.LIST, path);
    }
  }, []);

  const fetchAllCustomers = useCallback(async (): Promise<UserProfile[]> => {
    const path = 'users';
    try {
      const snap = await getDocs(collection(db, 'users'));
      return snap.docs.map((d) => d.data() as UserProfile);
    } catch (error) {
      handleFirestoreError(error, OperationType.LIST, path);
    }
  }, []);

  const fetchAddresses = useCallback(async (): Promise<BrazilianAddress[]> => {
    if (!user) return [];
    const path = `users/${user.uid}/addresses`;
    try {
      const snap = await getDocs(collection(db, 'users', user.uid, 'addresses'));
      return snap.docs.map((d) => d.data() as BrazilianAddress);
    } catch (error) {
      handleFirestoreError(error, OperationType.LIST, path);
    }
  }, [user]);

  const saveAddress = useCallback(
    async (address: Omit<BrazilianAddress, 'createdAt' | 'userId'>) => {
      if (!user) throw new Error('Faça login para salvar endereços.');
      const path = `users/${user.uid}/addresses/${address.id}`;
      try {
        await setDoc(doc(db, 'users', user.uid, 'addresses', address.id), {
          ...address,
          userId: user.uid,
          createdAt: serverTimestamp(),
        });
      } catch (error) {
        handleFirestoreError(error, OperationType.WRITE, path);
      }
    },
    [user]
  );

  const deleteAddress = useCallback(
    async (addressId: string) => {
      if (!user) return;
      const path = `users/${user.uid}/addresses/${addressId}`;
      try {
        await deleteDoc(doc(db, 'users', user.uid, 'addresses', addressId));
      } catch (error) {
        handleFirestoreError(error, OperationType.DELETE, path);
      }
    },
    [user]
  );

  const saveUserProfile = useCallback(
    async (profile: Partial<UserProfile>) => {
      if (!user) return;
      const path = `users/${user.uid}`;
      try {
        await updateDoc(doc(db, 'users', user.uid), {
          displayName: profile.displayName ?? userProfile?.displayName ?? '',
          cpf: profile.cpf ?? userProfile?.cpf ?? '',
          phone: profile.phone ?? userProfile?.phone ?? '',
          updatedAt: serverTimestamp(),
        });
        setUserProfile((prev) => (prev ? { ...prev, ...profile } : prev));
        showToast('Perfil atualizado.');
      } catch (error) {
        handleFirestoreError(error, OperationType.UPDATE, path);
      }
    },
    [showToast, user, userProfile]
  );

  const saveProduct = useCallback(
    async (product: Product) => {
      const path = `products/${product.id}`;
      try {
        const ref = doc(db, 'products', product.id);
        const existing = await getDoc(ref);
        const payload = {
          id: product.id,
          slug: product.slug,
          name: product.name,
          category: product.category,
          collection: product.collection,
          priceBrl: Number(product.priceBrl),
          description: product.description,
          composition: product.composition,
          careInstructions: product.careInstructions,
          fitNotes: product.fitNotes,
          isNew: Boolean(product.isNew),
          isFeatured: Boolean(product.isFeatured),
          isDemo: Boolean(product.isDemo),
          active: Boolean(product.active),
          images: product.images.slice(0, 12),
          colors: product.colors.slice(0, 10),
          sizes: product.sizes.slice(0, 10),
          measurements: product.measurements || {},
          createdAt: existing.exists() ? existing.data().createdAt : serverTimestamp(),
          updatedAt: serverTimestamp(),
        };
        await setDoc(ref, payload);
        await refreshCatalog();
        showToast('Produto salvo no catálogo.');
      } catch (error) {
        handleFirestoreError(error, OperationType.WRITE, path);
      }
    },
    [refreshCatalog, showToast]
  );

  const deleteProduct = useCallback(
    async (productId: string) => {
      const path = `products/${productId}`;
      try {
        await deleteDoc(doc(db, 'products', productId));
        await refreshCatalog();
        showToast('Produto removido.');
      } catch (error) {
        handleFirestoreError(error, OperationType.DELETE, path);
      }
    },
    [refreshCatalog, showToast]
  );

  const saveCategory = useCallback(
    async (category: CategoryItem) => {
      const path = `categories/${category.id}`;
      try {
        await setDoc(doc(db, 'categories', category.id), {
          ...category,
          updatedAt: serverTimestamp(),
        });
        await refreshCatalog();
        showToast('Categoria atualizada.');
      } catch (error) {
        handleFirestoreError(error, OperationType.WRITE, path);
      }
    },
    [refreshCatalog, showToast]
  );

  const saveEditorial = useCallback(
    async (nextEditorial: EditorialConfig) => {
      const path = 'editorial/homepage';
      try {
        await setDoc(doc(db, 'editorial', 'homepage'), {
          ...nextEditorial,
          id: 'homepage',
          updatedAt: serverTimestamp(),
        });
        await refreshCatalog();
        showToast('Conteúdo editorial atualizado.');
      } catch (error) {
        handleFirestoreError(error, OperationType.WRITE, path);
      }
    },
    [refreshCatalog, showToast]
  );

  const saveCoupon = useCallback(
    async (coupon: CouponRecord) => {
      const normalized = coupon.code.trim().toUpperCase();
      const path = `coupons/${normalized}`;
      try {
        await setDoc(doc(db, 'coupons', normalized), {
          code: normalized,
          discountPercent: Number(coupon.discountPercent),
          minOrderBrl: Number(coupon.minOrderBrl),
          active: Boolean(coupon.active),
          usageCount: Number(coupon.usageCount || 0),
          updatedAt: serverTimestamp(),
        });
        showToast(`Cupom ${normalized} salvo.`);
      } catch (error) {
        handleFirestoreError(error, OperationType.WRITE, path);
      }
    },
    [showToast]
  );

  const deleteCoupon = useCallback(
    async (code: string) => {
      const path = `coupons/${code}`;
      try {
        await deleteDoc(doc(db, 'coupons', code));
        showToast(`Cupom ${code} removido.`);
      } catch (error) {
        handleFirestoreError(error, OperationType.DELETE, path);
      }
    },
    [showToast]
  );

  const updateOrderStatus = useCallback(
    async (orderId: string, status: OrderStatus) => {
      const path = `orders/${orderId}`;
      try {
        await updateDoc(doc(db, 'orders', orderId), {
          status,
          updatedAt: serverTimestamp(),
        });
        showToast('Status do pedido atualizado.');
      } catch (error) {
        handleFirestoreError(error, OperationType.UPDATE, path);
      }
    },
    [showToast]
  );

  const seedDemoCatalogToFirestore = useCallback(async () => {
    try {
      await Promise.all([
        ...DEMO_PRODUCTS.map((p) =>
          setDoc(doc(db, 'products', p.id), {
            ...p,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          })
        ),
        ...DEMO_CATEGORIES.map((c) =>
          setDoc(doc(db, 'categories', c.id), {
            ...c,
            slug: c.slug.toLowerCase(),
            updatedAt: serverTimestamp(),
          })
        ),
        ...DEMO_COUPONS.map((cp) =>
          setDoc(doc(db, 'coupons', cp.code), {
            ...cp,
            updatedAt: serverTimestamp(),
          })
        ),
        setDoc(doc(db, 'editorial', 'homepage'), {
          ...DEFAULT_EDITORIAL,
          updatedAt: serverTimestamp(),
        }),
      ]);
      await refreshCatalog();
      showToast('Catálogo demonstrativo sincronizado com o Firestore.');
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'products');
    }
  }, [refreshCatalog, showToast]);

  const subscribeNewsletter = useCallback(
    async (email: string, consent: boolean) => {
      if (!consent) throw new Error('Confirme o consentimento para recebimento de novidades.');
      const trimmed = email.trim().toLowerCase();
      if (!trimmed || !trimmed.includes('@')) throw new Error('Informe um e-mail válido.');
      const id = `sub-${Date.now()}`;
      const path = `newsletter/${id}`;
      try {
        await setDoc(doc(db, 'newsletter', id), {
          id,
          email: trimmed,
          consent: true,
          createdAt: serverTimestamp(),
        });
      } catch (error) {
        handleFirestoreError(error, OperationType.CREATE, path);
      }
    },
    []
  );

  const cartCount = useMemo(
    () => cart.reduce((acc, item) => acc + item.quantity, 0),
    [cart]
  );

  const cartSubtotal = useMemo(
    () => cart.reduce((acc, item) => acc + item.priceBrl * item.quantity, 0),
    [cart]
  );

  const value: StoreContextValue = {
    products,
    categories,
    editorial,
    catalogLoading,
    catalogSource,
    user,
    authReady,
    isAdmin,
    userProfile,
    cart,
    cartCount,
    cartSubtotal,
    isBagOpen,
    isSearchOpen,
    isAdvisorOpen,
    toastMessage,
    openBag: () => setIsBagOpen(true),
    closeBag: () => setIsBagOpen(false),
    openSearch: () => setIsSearchOpen(true),
    closeSearch: () => setIsSearchOpen(false),
    openAdvisor: () => setIsAdvisorOpen(true),
    closeAdvisor: () => setIsAdvisorOpen(false),
    showToast,
    addToCart,
    updateCartQuantity,
    removeFromCart,
    clearCart,
    signInWithGoogle,
    logout,
    refreshCatalog,
    validateCoupon,
    submitOrder,
    getDemoOrders,
    fetchUserOrders,
    fetchAllOrders,
    fetchAllCoupons,
    fetchAllCustomers,
    fetchAddresses,
    saveAddress,
    deleteAddress,
    saveUserProfile,
    saveProduct,
    deleteProduct,
    saveCategory,
    saveEditorial,
    saveCoupon,
    deleteCoupon,
    updateOrderStatus,
    seedDemoCatalogToFirestore,
    subscribeNewsletter,
  };

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
};

export function useStore(): StoreContextValue {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error('useStore must be used inside StoreProvider');
  return ctx;
}
