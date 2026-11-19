import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import type { User } from 'firebase/auth';
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
  CustomerAccountStatus,
  EditorialConfig,
  OrderRecord,
  OrderStatus,
  Product,
  UserProfile,
} from '../types/store';
import {
  clampQuantityForStock,
  validateCartAgainstCatalog,
  type CartValidationResult,
} from '../utils/commerce';
import { validateNewsletterEmail } from '../utils/newsletter';
import {
  areCatalogSnapshotsEqual,
  readCatalogSnapshot,
  writeCatalogSnapshot,
} from '../utils/catalogCache';
import {
  normalizeCategoryRecord,
  normalizeEditorialRecord,
  normalizeOrderRecord,
  normalizeProductRecord,
} from '../utils/catalogNormalization';
import {
  buildCustomerCreatePayload,
  findMissingProfilesFromOrders,
  normalizeUserProfileRecord,
  sanitizeCustomerString,
} from '../utils/customers';

const CART_STORAGE_KEY = 'complex_cart_v1';
const DEMO_ORDERS_STORAGE_KEY = 'complex_demo_orders_v1';
const BOOTSTRAPPED_ADMIN_EMAIL = 'henrique123trindade@gmail.com';

async function loadFirebaseServices() {
  const [firestore, firebaseAuth, firebaseModule] = await Promise.all([
    import('firebase/firestore'),
    import('firebase/auth'),
    import('../lib/firebase'),
  ]);
  return {
    ...firestore,
    ...firebaseAuth,
    ...firebaseModule,
  };
}

let firebaseServicesPromise: ReturnType<typeof loadFirebaseServices> | null = null;
function getFirebaseServices() {
  if (!firebaseServicesPromise) {
    firebaseServicesPromise = loadFirebaseServices();
  }
  return firebaseServicesPromise;
}

export interface CatalogContextValue {
  products: Product[];
  categories: CategoryItem[];
  editorial: EditorialConfig;
  catalogLoading: boolean;
  catalogSource: 'demo' | 'firestore';
  refreshCatalog: () => Promise<Product[]>;
  saveProduct: (product: Product) => Promise<void>;
  deleteProduct: (productId: string) => Promise<void>;
  saveCategory: (category: CategoryItem) => Promise<void>;
  saveEditorial: (editorial: EditorialConfig) => Promise<void>;
  seedDemoCatalogToFirestore: () => Promise<void>;
}

export interface CartContextValue {
  cart: CartItem[];
  cartCount: number;
  cartSubtotal: number;
  addToCart: (
    product: Product,
    colorName: string,
    size: string,
    quantity?: number,
    options?: { openDrawer?: boolean }
  ) => void;
  updateCartQuantity: (key: string, quantity: number) => void;
  removeFromCart: (key: string) => void;
  clearCart: () => void;
  revalidateCartBeforeCheckout: () => Promise<CartValidationResult>;
}

export interface AuthContextValue {
  user: User | null;
  authReady: boolean;
  isAdmin: boolean;
  userProfile: UserProfile | null;
  signInWithGoogle: () => Promise<void>;
  logout: () => Promise<void>;
  validateCoupon: (code: string) => Promise<CouponRecord | null>;
  submitOrder: (order: Omit<OrderRecord, 'createdAt' | 'updatedAt'>) => Promise<OrderRecord>;
  getDemoOrders: () => OrderRecord[];
  fetchUserOrders: () => Promise<OrderRecord[]>;
  fetchAllOrders: () => Promise<OrderRecord[]>;
  fetchAllCoupons: () => Promise<CouponRecord[]>;
  fetchAllCustomers: () => Promise<UserProfile[]>;
  fetchCustomerAddresses: (userId: string) => Promise<BrazilianAddress[]>;
  updateCustomerStatus: (userId: string, status: CustomerAccountStatus) => Promise<void>;
  syncMissingCustomerProfiles: (
    orders: OrderRecord[],
    existingCustomers: UserProfile[]
  ) => Promise<{ createdCount: number; skippedCount: number; failedCount: number }>;
  fetchAddresses: () => Promise<BrazilianAddress[]>;
  saveAddress: (address: Omit<BrazilianAddress, 'createdAt' | 'userId'>) => Promise<void>;
  deleteAddress: (addressId: string) => Promise<void>;
  saveUserProfile: (profile: Partial<UserProfile>) => Promise<void>;
  saveCoupon: (coupon: CouponRecord) => Promise<void>;
  deleteCoupon: (code: string) => Promise<void>;
  updateOrderStatus: (orderId: string, status: OrderStatus) => Promise<void>;
  subscribeNewsletter: (email: string, consent: boolean) => Promise<void>;
}

export interface StoreUIContextValue {
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
}

export type StoreContextValue = CatalogContextValue &
  CartContextValue &
  AuthContextValue &
  StoreUIContextValue;

const CatalogContext = createContext<CatalogContextValue | null>(null);
const CartContext = createContext<CartContextValue | null>(null);
const AuthContext = createContext<AuthContextValue | null>(null);
const StoreUIContext = createContext<StoreUIContextValue | null>(null);

export const StoreProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const initialSnapshot = useMemo(() => readCatalogSnapshot(), []);

  const [products, setProducts] = useState<Product[]>(
    () => initialSnapshot?.products ?? DEMO_PRODUCTS
  );
  const [categories, setCategories] = useState<CategoryItem[]>(
    () => initialSnapshot?.categories ?? DEMO_CATEGORIES
  );
  const [editorial, setEditorial] = useState<EditorialConfig>(
    () => initialSnapshot?.editorial ?? DEFAULT_EDITORIAL
  );
  const [catalogLoading] = useState<boolean>(false);
  const [catalogSource, setCatalogSource] = useState<'demo' | 'firestore'>(
    () => initialSnapshot?.source ?? 'demo'
  );

  const snapshotRef = useRef({
    products,
    categories,
    editorial,
    source: catalogSource,
  });
  snapshotRef.current = { products, categories, editorial, source: catalogSource };

  const refreshInFlightRef = useRef<Promise<Product[]> | null>(null);

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
  const cartRef = useRef(cart);
  cartRef.current = cart;

  const [isBagOpen, setIsBagOpen] = useState(false);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [isAdvisorOpen, setIsAdvisorOpen] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const toastTimerRef = useRef<number | null>(null);
  const isAdminRef = useRef(isAdmin);
  isAdminRef.current = isAdmin;

  const assertAdminAccess = useCallback(() => {
    if (!isAdminRef.current) {
      throw new Error('Permissão administrativa necessária para esta operação.');
    }
  }, []);

  const openBag = useCallback(() => setIsBagOpen(true), []);
  const closeBag = useCallback(() => setIsBagOpen(false), []);
  const openSearch = useCallback(() => setIsSearchOpen(true), []);
  const closeSearch = useCallback(() => setIsSearchOpen(false), []);
  const openAdvisor = useCallback(() => setIsAdvisorOpen(true), []);
  const closeAdvisor = useCallback(() => setIsAdvisorOpen(false), []);

  const showToast = useCallback((msg: string) => {
    setToastMessage(msg);
    if (toastTimerRef.current !== null) {
      window.clearTimeout(toastTimerRef.current);
    }
    toastTimerRef.current = window.setTimeout(() => {
      setToastMessage(null);
      toastTimerRef.current = null;
    }, 3200);
  }, []);

  useEffect(() => {
    return () => {
      if (toastTimerRef.current !== null) {
        window.clearTimeout(toastTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(cart));
    } catch {
      // Ignore quota errors
    }
  }, [cart]);

  const refreshCatalog = useCallback((): Promise<Product[]> => {
    if (refreshInFlightRef.current) {
      return refreshInFlightRef.current;
    }

    const request = (async () => {
      try {
        const { collection, doc, getDoc, getDocs, orderBy, query, db } =
          await getFirebaseServices();

        const [prodSnap, catSnap, edSnap] = await Promise.all([
          getDocs(collection(db, 'products')),
          getDocs(query(collection(db, 'categories'), orderBy('orderIndex', 'asc'))),
          getDoc(doc(db, 'editorial', 'homepage')),
        ]);

        const nextProducts: Product[] = !prodSnap.empty
          ? prodSnap.docs.map((d) => normalizeProductRecord(d.data() as Product))
          : DEMO_PRODUCTS;

        const nextSource: 'demo' | 'firestore' = !prodSnap.empty ? 'firestore' : 'demo';

        const nextCategories: CategoryItem[] = !catSnap.empty
          ? catSnap.docs.map((d) => normalizeCategoryRecord(d.data() as CategoryItem))
          : DEMO_CATEGORIES;

        const nextEditorial: EditorialConfig = edSnap.exists()
          ? normalizeEditorialRecord(edSnap.data() as Partial<EditorialConfig>)
          : DEFAULT_EDITORIAL;

        const nextSnapshot = {
          products: nextProducts,
          categories: nextCategories,
          editorial: nextEditorial,
          source: nextSource,
        };

        writeCatalogSnapshot(nextSnapshot);

        if (!areCatalogSnapshotsEqual(snapshotRef.current, nextSnapshot)) {
          setProducts(nextProducts);
          setCategories(nextCategories);
          setEditorial(nextEditorial);
          setCatalogSource(nextSource);
        }

        return nextProducts;
      } catch {
        return snapshotRef.current.products;
      } finally {
        refreshInFlightRef.current = null;
      }
    })();

    refreshInFlightRef.current = request;
    return request;
  }, []);

  const touchedLoginUidsRef = useRef<Set<string>>(new Set());

  const ensureUserProfileRecord = useCallback(
    async (
      firebaseUser: User,
      options?: { touchLastLogin?: boolean }
    ): Promise<UserProfile | null> => {
      const { db, doc, getDoc, serverTimestamp, setDoc, updateDoc } =
        await getFirebaseServices();
      const profileRef = doc(db, 'users', firebaseUser.uid);

      const profileSnap = await getDoc(profileRef);
      if (profileSnap.exists()) {
        const existingProfile = normalizeUserProfileRecord(
          profileSnap.data() as Record<string, unknown>,
          firebaseUser.uid
        );

        if (options?.touchLastLogin && firebaseUser.emailVerified) {
          const nowIso = new Date().toISOString();
          try {
            await updateDoc(profileRef, {
              lastLoginAt: serverTimestamp(),
              updatedAt: serverTimestamp(),
            });
            touchedLoginUidsRef.current.add(firebaseUser.uid);
            return {
              ...existingProfile,
              lastLoginAt: nowIso,
              updatedAt: nowIso,
            };
          } catch (error) {
            console.error('Falha ao atualizar último acesso do cliente:', error);
          }
        }

        return existingProfile;
      }

      if (!firebaseUser.emailVerified || !firebaseUser.email) {
        return null;
      }

      const nowIso = new Date().toISOString();
      const createPayload = buildCustomerCreatePayload(
        {
          uid: firebaseUser.uid,
          displayName: firebaseUser.displayName,
          email: firebaseUser.email,
          cpf: '',
          phone: '',
          status: 'active',
        },
        serverTimestamp()
      );

      await setDoc(profileRef, createPayload);
      touchedLoginUidsRef.current.add(firebaseUser.uid);

      return normalizeUserProfileRecord(
        {
          ...createPayload,
          createdAt: nowIso,
          updatedAt: nowIso,
          lastLoginAt: nowIso,
        },
        firebaseUser.uid
      );
    },
    []
  );

  useEffect(() => {
    let cancelled = false;
    let unsubAuth: (() => void) | undefined;
    let idleHandle: number | undefined;
    let timeoutHandle: number | undefined;

    const safetyTimer = window.setTimeout(() => {
      if (!cancelled) setAuthReady(true);
    }, 2600);

    const scheduleIdle = (cb: () => void) => {
      const winWithIdle = window as Window & {
        requestIdleCallback?: (fn: () => void, opts?: { timeout: number }) => number;
        cancelIdleCallback?: (id: number) => void;
      };
      if (typeof winWithIdle.requestIdleCallback === 'function') {
        idleHandle = winWithIdle.requestIdleCallback(cb, { timeout: 2500 });
      } else {
        timeoutHandle = window.setTimeout(cb, 500);
      }
    };

    const bootstrapFirebase = async () => {
      try {
        const { auth, db, doc, getDoc, onAuthStateChanged } = await getFirebaseServices();

        if (cancelled) return;

        // Yield a frame so Firebase module evaluation & onAuthStateChanged don't stack with catalog fetch into one Long Task
        window.setTimeout(() => {
          if (!cancelled) void refreshCatalog();
        }, 40);

        unsubAuth = onAuthStateChanged(auth, async (firebaseUser) => {
          window.clearTimeout(safetyTimer);
          if (cancelled) return;

          setUser(firebaseUser);
          if (!firebaseUser) {
            setIsAdmin(false);
            setUserProfile(null);
            setAuthReady(true);
            return;
          }

          const bootAdmin =
            firebaseUser.email === BOOTSTRAPPED_ADMIN_EMAIL && firebaseUser.emailVerified;
          setIsAdmin(bootAdmin);
          setAuthReady(true);

          const adminPromise = bootAdmin
            ? Promise.resolve(true)
            : getDoc(doc(db, 'admins', firebaseUser.uid))
                .then((snap) => snap.exists())
                .catch(() => false);

          const shouldTouchLogin = !touchedLoginUidsRef.current.has(firebaseUser.uid);
          const profilePromise = ensureUserProfileRecord(firebaseUser, {
            touchLastLogin: shouldTouchLogin,
          }).catch((error) => {
            console.error('Erro ao sincronizar perfil do cliente no Firestore:', error);
            return {
              uid: firebaseUser.uid,
              displayName: firebaseUser.displayName || 'Cliente COMPLEX',
              email: (firebaseUser.email || '').toLowerCase(),
              status: 'active' as CustomerAccountStatus,
            };
          });

          const [resolvedAdmin, resolvedProfile] = await Promise.all([
            adminPromise,
            profilePromise,
          ]);

          if (!cancelled) {
            setIsAdmin(resolvedAdmin);
            if (resolvedProfile) setUserProfile(resolvedProfile);
          }
        });
      } catch {
        if (!cancelled) setAuthReady(true);
      }
    };

    // Immediate auth bootstrap on account/admin/checkout routes so sign-in & permissions never stall;
    // keep deferred idle bootstrap on public storefront pages to preserve fast LCP & INP.
    let delayHandle: number | undefined;
    let onLoadHandler: (() => void) | undefined;
    const currentPath =
      typeof window !== 'undefined' ? window.location.pathname.toLowerCase() : '/';
    const requiresImmediateAuth =
      currentPath.startsWith('/account') ||
      currentPath.startsWith('/admin') ||
      currentPath.startsWith('/checkout');

    const startDeferredBootstrap = () => {
      if (requiresImmediateAuth) {
        if (!cancelled) void bootstrapFirebase();
        return;
      }
      delayHandle = window.setTimeout(() => {
        if (!cancelled) {
          scheduleIdle(() => {
            if (!cancelled) void bootstrapFirebase();
          });
        }
      }, 1800);
    };

    if (requiresImmediateAuth || document.readyState === 'complete') {
      startDeferredBootstrap();
    } else {
      onLoadHandler = () => {
        startDeferredBootstrap();
      };
      window.addEventListener('load', onLoadHandler, { once: true });
    }

    return () => {
      cancelled = true;
      window.clearTimeout(safetyTimer);
      if (onLoadHandler) {
        window.removeEventListener('load', onLoadHandler);
      }
      if (delayHandle !== undefined) {
        window.clearTimeout(delayHandle);
      }
      const winWithIdle = window as Window & {
        cancelIdleCallback?: (id: number) => void;
      };
      if (idleHandle !== undefined && typeof winWithIdle.cancelIdleCallback === 'function') {
        winWithIdle.cancelIdleCallback(idleHandle);
      }
      if (timeoutHandle !== undefined) {
        window.clearTimeout(timeoutHandle);
      }
      if (unsubAuth) unsubAuth();
    };
  }, [ensureUserProfileRecord, refreshCatalog]);

  const signInWithGoogle = useCallback(async () => {
    const { auth, db, doc, getDoc, googleAuthProvider, signInWithPopup } =
      await getFirebaseServices();
    const credential = await signInWithPopup(auth, googleAuthProvider);
    const signedInUser = credential.user;

    setUser(signedInUser);
    const bootAdmin =
      signedInUser.email === BOOTSTRAPPED_ADMIN_EMAIL && signedInUser.emailVerified;
    const resolvedAdmin = bootAdmin
      ? true
      : await getDoc(doc(db, 'admins', signedInUser.uid))
          .then((snap) => snap.exists())
          .catch(() => false);

    setIsAdmin(resolvedAdmin);
    setAuthReady(true);

    // Guarantee persistent customer profile creation/lastLoginAt sync immediately upon login
    try {
      const persistedProfile = await ensureUserProfileRecord(signedInUser, {
        touchLastLogin: true,
      });
      if (persistedProfile) {
        setUserProfile(persistedProfile);
      }
    } catch (firstError) {
      try {
        const retriedProfile = await ensureUserProfileRecord(signedInUser, {
          touchLastLogin: true,
        });
        if (retriedProfile) {
          setUserProfile(retriedProfile);
        }
      } catch (secondError) {
        console.error(
          'Falha persistente ao gravar perfil do cliente no Firestore após login:',
          firstError,
          secondError
        );
        showToast('Login concluído. Tentaremos sincronizar seu perfil novamente em instantes.');
      }
    }
  }, [ensureUserProfileRecord, showToast]);

  const logout = useCallback(async () => {
    const { auth, signOut } = await getFirebaseServices();
    touchedLoginUidsRef.current.clear();
    await signOut(auth);
    showToast('Sessão encerrada.');
  }, [showToast]);

  const addToCart = useCallback(
    (
      product: Product,
      colorName: string,
      size: string,
      quantity = 1,
      options?: { openDrawer?: boolean }
    ) => {
      const sizeEntry = product.sizes.find((s) => s.size === size);
      if (!sizeEntry || sizeEntry.stock <= 0) {
        showToast('Tamanho indisponível no momento.');
        return;
      }

      const colorObj =
        product.colors.find((c) => c.name === colorName) || product.colors[0];
      const key = `${product.id}::${colorObj?.name || 'Padrão'}::${size}`;

      const existingItem = cartRef.current.find((item) => item.key === key);
      if (existingItem && existingItem.quantity >= sizeEntry.stock) {
        if (options?.openDrawer !== false) {
          setIsBagOpen(true);
        }
        showToast(`Limite disponível (${sizeEntry.stock} un.) já está na sacola.`);
        return;
      }

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

      if (options?.openDrawer !== false) {
        setIsBagOpen(true);
      }
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

  const revalidateCartBeforeCheckout = useCallback(async (): Promise<CartValidationResult> => {
    const latestProducts = await refreshCatalog();
    const validation = validateCartAgainstCatalog(cartRef.current, latestProducts);
    if (validation.changed) {
      setCart(validation.adjustedCart);
    }
    return validation;
  }, [refreshCatalog]);

  const validateCoupon = useCallback(async (rawCode: string): Promise<CouponRecord | null> => {
    const code = rawCode.trim().toUpperCase();
    if (!code || !/^[A-Z0-9_-]+$/.test(code)) return null;

    try {
      const { db, doc, getDoc } = await getFirebaseServices();
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
        const {
          db,
          doc,
          handleFirestoreError,
          OperationType,
          serverTimestamp,
          setDoc,
        } = await getFirebaseServices();
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
    const {
      collection,
      db,
      getDocs,
      handleFirestoreError,
      OperationType,
      orderBy,
      query,
      where,
    } = await getFirebaseServices();
    try {
      const q = query(
        collection(db, 'orders'),
        where('userId', '==', user.uid),
        orderBy('createdAt', 'desc')
      );
      const snap = await getDocs(q);
      return snap.docs.map((d) => normalizeOrderRecord(d.data() as Record<string, unknown>));
    } catch (error) {
      return handleFirestoreError(error, OperationType.LIST, path);
    }
  }, [getDemoOrders, user]);

  const fetchAllOrders = useCallback(async (): Promise<OrderRecord[]> => {
    assertAdminAccess();
    const path = 'orders';
    const { collection, db, getDocs, handleFirestoreError, OperationType, orderBy, query } =
      await getFirebaseServices();
    try {
      const snap = await getDocs(query(collection(db, 'orders'), orderBy('createdAt', 'desc')));
      return snap.docs.map((d) => normalizeOrderRecord(d.data() as Record<string, unknown>));
    } catch (error) {
      return handleFirestoreError(error, OperationType.LIST, path);
    }
  }, [assertAdminAccess]);

  const fetchAllCoupons = useCallback(async (): Promise<CouponRecord[]> => {
    assertAdminAccess();
    const path = 'coupons';
    const { collection, db, getDocs, handleFirestoreError, OperationType } =
      await getFirebaseServices();
    try {
      const snap = await getDocs(collection(db, 'coupons'));
      return snap.docs.map((d) => d.data() as CouponRecord);
    } catch (error) {
      return handleFirestoreError(error, OperationType.LIST, path);
    }
  }, [assertAdminAccess]);

  const fetchAllCustomers = useCallback(async (): Promise<UserProfile[]> => {
    assertAdminAccess();
    const path = 'users';
    const { collection, db, getDocs, handleFirestoreError, OperationType } =
      await getFirebaseServices();
    try {
      const snap = await getDocs(collection(db, 'users'));
      return snap.docs.map((d) =>
        normalizeUserProfileRecord(d.data() as Record<string, unknown>, d.id)
      );
    } catch (error) {
      return handleFirestoreError(error, OperationType.LIST, path);
    }
  }, [assertAdminAccess]);

  const fetchCustomerAddresses = useCallback(
    async (userId: string): Promise<BrazilianAddress[]> => {
      assertAdminAccess();
      const path = `users/${userId}/addresses`;
      const { collection, db, getDocs, handleFirestoreError, OperationType } =
        await getFirebaseServices();
      try {
        const snap = await getDocs(collection(db, 'users', userId, 'addresses'));
        return snap.docs.map((d) => d.data() as BrazilianAddress);
      } catch (error) {
        return handleFirestoreError(error, OperationType.LIST, path);
      }
    },
    [assertAdminAccess]
  );

  const updateCustomerStatus = useCallback(
    async (userId: string, status: CustomerAccountStatus) => {
      assertAdminAccess();
      const path = `users/${userId}`;
      const { db, doc, handleFirestoreError, OperationType, serverTimestamp, updateDoc } =
        await getFirebaseServices();
      try {
        await updateDoc(doc(db, 'users', userId), {
          status,
          updatedAt: serverTimestamp(),
        });
        showToast(
          status === 'active'
            ? 'Conta do cliente marcada como ativa.'
            : 'Conta do cliente marcada como inativa.'
        );
      } catch (error) {
        handleFirestoreError(error, OperationType.UPDATE, path);
      }
    },
    [assertAdminAccess, showToast]
  );

  const syncMissingCustomerProfiles = useCallback(
    async (
      ordersList: OrderRecord[],
      existingCustomers: UserProfile[]
    ): Promise<{ createdCount: number; skippedCount: number; failedCount: number }> => {
      assertAdminAccess();
      const candidates = findMissingProfilesFromOrders(existingCustomers, ordersList);
      if (candidates.length === 0) {
        return { createdCount: 0, skippedCount: 0, failedCount: 0 };
      }

      const { db, doc, getDoc, serverTimestamp, setDoc } = await getFirebaseServices();
      let createdCount = 0;
      let skippedCount = 0;
      let failedCount = 0;

      for (const candidate of candidates) {
        try {
          const ref = doc(db, 'users', candidate.uid);
          const snap = await getDoc(ref);
          if (snap.exists()) {
            skippedCount += 1;
            continue;
          }

          const payload = buildCustomerCreatePayload(
            {
              uid: candidate.uid,
              displayName: candidate.displayName,
              email: candidate.email,
              cpf: candidate.cpf,
              phone: candidate.phone,
              status: 'active',
            },
            serverTimestamp()
          );

          await setDoc(ref, payload);
          createdCount += 1;
        } catch (error) {
          console.error(`Falha ao recuperar perfil do cliente ${candidate.uid}:`, error);
          failedCount += 1;
        }
      }

      return { createdCount, skippedCount, failedCount };
    },
    [assertAdminAccess]
  );

  const fetchAddresses = useCallback(async (): Promise<BrazilianAddress[]> => {
    if (!user) return [];
    const path = `users/${user.uid}/addresses`;
    const { collection, db, getDocs, handleFirestoreError, OperationType } =
      await getFirebaseServices();
    try {
      const snap = await getDocs(collection(db, 'users', user.uid, 'addresses'));
      return snap.docs.map((d) => d.data() as BrazilianAddress);
    } catch (error) {
      return handleFirestoreError(error, OperationType.LIST, path);
    }
  }, [user]);

  const saveAddress = useCallback(
    async (address: Omit<BrazilianAddress, 'createdAt' | 'userId'>) => {
      if (!user) throw new Error('Faça login para salvar endereços.');
      const path = `users/${user.uid}/addresses/${address.id}`;
      const { db, doc, handleFirestoreError, OperationType, serverTimestamp, setDoc } =
        await getFirebaseServices();
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
      const { db, deleteDoc, doc, handleFirestoreError, OperationType } =
        await getFirebaseServices();
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
      const { db, doc, handleFirestoreError, OperationType, serverTimestamp, updateDoc } =
        await getFirebaseServices();
      try {
        // Ensure persistent profile document exists before updating (idempotent)
        await ensureUserProfileRecord(user, { touchLastLogin: false });
        const nextDisplayName = sanitizeCustomerString(
          profile.displayName ?? userProfile?.displayName ?? user.displayName ?? 'Cliente COMPLEX',
          120
        );
        const nextCpf = sanitizeCustomerString(profile.cpf ?? userProfile?.cpf ?? '', 20);
        const nextPhone = sanitizeCustomerString(profile.phone ?? userProfile?.phone ?? '', 30);

        await updateDoc(doc(db, 'users', user.uid), {
          displayName: nextDisplayName,
          cpf: nextCpf,
          phone: nextPhone,
          updatedAt: serverTimestamp(),
        });
        setUserProfile((prev) =>
          prev
            ? {
                ...prev,
                displayName: nextDisplayName,
                cpf: nextCpf,
                phone: nextPhone,
                updatedAt: new Date().toISOString(),
              }
            : {
                uid: user.uid,
                displayName: nextDisplayName,
                email: (user.email || '').toLowerCase(),
                cpf: nextCpf,
                phone: nextPhone,
                status: 'active',
                updatedAt: new Date().toISOString(),
              }
        );
        showToast('Perfil atualizado.');
      } catch (error) {
        handleFirestoreError(error, OperationType.UPDATE, path);
      }
    },
    [ensureUserProfileRecord, showToast, user, userProfile]
  );

  const saveProduct = useCallback(
    async (product: Product) => {
      assertAdminAccess();
      const path = `products/${product.id}`;
      const {
        db,
        doc,
        getDoc,
        handleFirestoreError,
        OperationType,
        serverTimestamp,
        setDoc,
      } = await getFirebaseServices();
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
    [assertAdminAccess, refreshCatalog, showToast]
  );

  const deleteProduct = useCallback(
    async (productId: string) => {
      assertAdminAccess();
      const path = `products/${productId}`;
      const { db, deleteDoc, doc, handleFirestoreError, OperationType } =
        await getFirebaseServices();
      try {
        await deleteDoc(doc(db, 'products', productId));
        await refreshCatalog();
        showToast('Produto removido.');
      } catch (error) {
        handleFirestoreError(error, OperationType.DELETE, path);
      }
    },
    [assertAdminAccess, refreshCatalog, showToast]
  );

  const saveCategory = useCallback(
    async (category: CategoryItem) => {
      assertAdminAccess();
      const path = `categories/${category.id}`;
      const { db, doc, handleFirestoreError, OperationType, serverTimestamp, setDoc } =
        await getFirebaseServices();
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
    [assertAdminAccess, refreshCatalog, showToast]
  );

  const saveEditorial = useCallback(
    async (nextEditorial: EditorialConfig) => {
      assertAdminAccess();
      const path = 'editorial/homepage';
      const { db, doc, handleFirestoreError, OperationType, serverTimestamp, setDoc } =
        await getFirebaseServices();
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
    [assertAdminAccess, refreshCatalog, showToast]
  );

  const saveCoupon = useCallback(
    async (coupon: CouponRecord) => {
      assertAdminAccess();
      const normalized = coupon.code.trim().toUpperCase();
      const path = `coupons/${normalized}`;
      const { db, doc, handleFirestoreError, OperationType, serverTimestamp, setDoc } =
        await getFirebaseServices();
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
    [assertAdminAccess, showToast]
  );

  const deleteCoupon = useCallback(
    async (code: string) => {
      assertAdminAccess();
      const path = `coupons/${code}`;
      const { db, deleteDoc, doc, handleFirestoreError, OperationType } =
        await getFirebaseServices();
      try {
        await deleteDoc(doc(db, 'coupons', code));
        showToast(`Cupom ${code} removido.`);
      } catch (error) {
        handleFirestoreError(error, OperationType.DELETE, path);
      }
    },
    [assertAdminAccess, showToast]
  );

  const updateOrderStatus = useCallback(
    async (orderId: string, status: OrderStatus) => {
      assertAdminAccess();
      const path = `orders/${orderId}`;
      const { db, doc, handleFirestoreError, OperationType, serverTimestamp, updateDoc } =
        await getFirebaseServices();
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
    [assertAdminAccess, showToast]
  );

  const seedDemoCatalogToFirestore = useCallback(async () => {
    assertAdminAccess();
    const { db, doc, handleFirestoreError, OperationType, serverTimestamp, setDoc } =
      await getFirebaseServices();
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
  }, [assertAdminAccess, refreshCatalog, showToast]);

  const subscribeNewsletter = useCallback(
    async (email: string, consent: boolean) => {
      const check = validateNewsletterEmail(email, { enforceRequired: true });
      if (check.status !== 'valid') {
        throw new Error(check.message || 'Informe um e-mail válido.');
      }
      if (!consent) throw new Error('Confirme o consentimento para recebimento de novidades.');
      const id = `sub-${Date.now()}`;
      const path = `newsletter/${id}`;
      const { db, doc, handleFirestoreError, OperationType, serverTimestamp, setDoc } =
        await getFirebaseServices();
      try {
        await setDoc(doc(db, 'newsletter', id), {
          id,
          email: check.normalized,
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

  const catalogValue = useMemo<CatalogContextValue>(
    () => ({
      products,
      categories,
      editorial,
      catalogLoading,
      catalogSource,
      refreshCatalog,
      saveProduct,
      deleteProduct,
      saveCategory,
      saveEditorial,
      seedDemoCatalogToFirestore,
    }),
    [
      products,
      categories,
      editorial,
      catalogLoading,
      catalogSource,
      refreshCatalog,
      saveProduct,
      deleteProduct,
      saveCategory,
      saveEditorial,
      seedDemoCatalogToFirestore,
    ]
  );

  const cartValue = useMemo<CartContextValue>(
    () => ({
      cart,
      cartCount,
      cartSubtotal,
      addToCart,
      updateCartQuantity,
      removeFromCart,
      clearCart,
      revalidateCartBeforeCheckout,
    }),
    [
      cart,
      cartCount,
      cartSubtotal,
      addToCart,
      updateCartQuantity,
      removeFromCart,
      clearCart,
      revalidateCartBeforeCheckout,
    ]
  );

  const authValue = useMemo<AuthContextValue>(
    () => ({
      user,
      authReady,
      isAdmin,
      userProfile,
      signInWithGoogle,
      logout,
      validateCoupon,
      submitOrder,
      getDemoOrders,
      fetchUserOrders,
      fetchAllOrders,
      fetchAllCoupons,
      fetchAllCustomers,
      fetchCustomerAddresses,
      updateCustomerStatus,
      syncMissingCustomerProfiles,
      fetchAddresses,
      saveAddress,
      deleteAddress,
      saveUserProfile,
      saveCoupon,
      deleteCoupon,
      updateOrderStatus,
      subscribeNewsletter,
    }),
    [
      user,
      authReady,
      isAdmin,
      userProfile,
      signInWithGoogle,
      logout,
      validateCoupon,
      submitOrder,
      getDemoOrders,
      fetchUserOrders,
      fetchAllOrders,
      fetchAllCoupons,
      fetchAllCustomers,
      fetchCustomerAddresses,
      updateCustomerStatus,
      syncMissingCustomerProfiles,
      fetchAddresses,
      saveAddress,
      deleteAddress,
      saveUserProfile,
      saveCoupon,
      deleteCoupon,
      updateOrderStatus,
      subscribeNewsletter,
    ]
  );

  const uiValue = useMemo<StoreUIContextValue>(
    () => ({
      isBagOpen,
      isSearchOpen,
      isAdvisorOpen,
      toastMessage,
      openBag,
      closeBag,
      openSearch,
      closeSearch,
      openAdvisor,
      closeAdvisor,
      showToast,
    }),
    [
      isBagOpen,
      isSearchOpen,
      isAdvisorOpen,
      toastMessage,
      openBag,
      closeBag,
      openSearch,
      closeSearch,
      openAdvisor,
      closeAdvisor,
      showToast,
    ]
  );

  return (
    <CatalogContext.Provider value={catalogValue}>
      <CartContext.Provider value={cartValue}>
        <AuthContext.Provider value={authValue}>
          <StoreUIContext.Provider value={uiValue}>{children}</StoreUIContext.Provider>
        </AuthContext.Provider>
      </CartContext.Provider>
    </CatalogContext.Provider>
  );
};

export function useCatalog(): CatalogContextValue {
  const ctx = useContext(CatalogContext);
  if (!ctx) throw new Error('useCatalog must be used inside StoreProvider');
  return ctx;
}

export function useCart(): CartContextValue {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error('useCart must be used inside StoreProvider');
  return ctx;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside StoreProvider');
  return ctx;
}

export function useStoreUI(): StoreUIContextValue {
  const ctx = useContext(StoreUIContext);
  if (!ctx) throw new Error('useStoreUI must be used inside StoreProvider');
  return ctx;
}

export function useStore(): StoreContextValue {
  const catalog = useCatalog();
  const cart = useCart();
  const auth = useAuth();
  const ui = useStoreUI();

  return useMemo(
    () => ({
      ...catalog,
      ...cart,
      ...auth,
      ...ui,
    }),
    [catalog, cart, auth, ui]
  );
}
