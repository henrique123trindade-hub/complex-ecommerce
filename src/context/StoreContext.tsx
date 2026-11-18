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
  EditorialConfig,
  OrderRecord,
  OrderStatus,
  Product,
  UserProfile,
} from '../types/store';
import { clampQuantityForStock } from '../utils/commerce';
import { validateNewsletterEmail } from '../utils/newsletter';
import {
  areCatalogSnapshotsEqual,
  readCatalogSnapshot,
  writeCatalogSnapshot,
} from '../utils/catalogCache';

const CART_STORAGE_KEY = 'complex_cart_v1';
const DEMO_ORDERS_STORAGE_KEY = 'complex_demo_orders_v1';
const BOOTSTRAPPED_ADMIN_EMAIL = 'henrique123trindade@gmail.com';

const LEGACY_IMAGE_MAP: Record<string, string> = {
  '/assets/aistudio/image_e60999db.png': DEFAULT_EDITORIAL.heroDesktopImage,
  '/src/assets/images/hero_mobile_campaign_1794952246363.jpg':
    DEFAULT_EDITORIAL.heroMobileImage,
  '/src/assets/images/editorial_urban_tee_1794952249745.jpg':
    DEFAULT_EDITORIAL.campaignImage,
  '/assets/aistudio/image_340e3e49.png': DEFAULT_EDITORIAL.storyImage,
  '/src/assets/images/campaign_night_lifestyle_1794952250620.jpg':
    '/src/assets/images/optimized/complex_campaign_dusk_4_87617fd1-1672w.webp',
  '/assets/aistudio/Imagem_do_ChatGPT_17_de_nov._de_2026__20_02_47-1_5292459e.png':
    '/src/assets/images/optimized/complex_campaign_1_5292459e-1672w.webp',
  '/assets/aistudio/Imagem_do_ChatGPT_17_de_nov._de_2026__20_02_48-2_ca8505d2.png':
    '/src/assets/images/optimized/complex_model_tee_2_ca8505d2-1122w.webp',
  '/assets/aistudio/Imagem_do_ChatGPT_17_de_nov._de_2026__20_02_48-3_41227f9c.png':
    '/src/assets/images/optimized/complex_model_hoodie_3_41227f9c-1122w.webp',
  '/assets/aistudio/Imagem_do_ChatGPT_17_de_nov._de_2026__20_02_49-4_87617fd1.png':
    '/src/assets/images/optimized/complex_campaign_dusk_4_87617fd1-1672w.webp',
  '/assets/aistudio/image_2e7943ba.png': '/src/assets/images/optimized/image_2e7943ba-786w.webp',
  '/src/assets/images/product_detail_cotton_1794952250261.jpg':
    '/src/assets/images/optimized/product_detail_cotton_1794952250261-1200w.webp',
  '/assets/images/product_boxy_tee_front_1794952251135.jpg':
    '/src/assets/images/optimized/product_boxy_tee_front_1794952251135-896w.webp',
  '/assets/images/product_boxy_tee_back_1794952252777.jpg':
    '/src/assets/images/optimized/product_boxy_tee_back_1794952252777-896w.webp',
  '/assets/images/product_tee_bone_1794952275758.jpg':
    '/src/assets/images/optimized/product_tee_bone_1794952275758-896w.webp',
  '/assets/images/product_hoodie_taupe_1794952251370.jpg':
    '/src/assets/images/optimized/product_hoodie_taupe_1794952251370-896w.webp',
  '/assets/images/product_hoodie_charcoal_1794952276198.jpg':
    '/src/assets/images/optimized/product_hoodie_charcoal_1794952276198-896w.webp',
  '/assets/images/product_crewneck_olive_1794952278742.jpg':
    '/src/assets/images/optimized/product_crewneck_olive_1794952278742-896w.webp',
  '/assets/images/product_cargo_olive_1794952252317.jpg':
    '/src/assets/images/optimized/product_cargo_olive_1794952252317-896w.webp',
  '/assets/images/product_denim_wide_1794952276236.jpg':
    '/src/assets/images/optimized/product_denim_wide_1794952276236-896w.webp',
  '/assets/images/product_jacket_shell_1794952276902.jpg':
    '/src/assets/images/optimized/product_jacket_shell_1794952276902-896w.webp',
  '/assets/images/product_accessories_cap_1794952253579.jpg':
    '/src/assets/images/optimized/product_accessories_cap_1794952253579-896w.webp',
};

const mapLegacyUrl = (url: string): string => LEGACY_IMAGE_MAP[url] || url;

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
    try {
      const { collection, doc, getDoc, getDocs, orderBy, query, db } =
        await getFirebaseServices();

      const [prodSnap, catSnap, edSnap] = await Promise.all([
        getDocs(collection(db, 'products')),
        getDocs(query(collection(db, 'categories'), orderBy('orderIndex', 'asc'))),
        getDoc(doc(db, 'editorial', 'homepage')),
      ]);

      const nextProducts: Product[] = !prodSnap.empty
        ? prodSnap.docs.map((d) => {
            const data = d.data() as Product;
            return {
              ...data,
              images: Array.isArray(data.images) ? data.images.map(mapLegacyUrl) : [],
              colors: Array.isArray(data.colors)
                ? data.colors.map((c) => ({
                    ...c,
                    images: Array.isArray(c.images) ? c.images.map(mapLegacyUrl) : [],
                  }))
                : [],
            };
          })
        : DEMO_PRODUCTS;

      const nextSource: 'demo' | 'firestore' = !prodSnap.empty ? 'firestore' : 'demo';

      const nextCategories: CategoryItem[] = !catSnap.empty
        ? catSnap.docs.map((d) => {
            const data = d.data() as CategoryItem;
            return {
              ...data,
              image: data.image ? mapLegacyUrl(data.image) : data.image,
            };
          })
        : DEMO_CATEGORIES;

      let nextEditorial: EditorialConfig = DEFAULT_EDITORIAL;
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
          heroDesktopImage: rawEd.heroDesktopImage
            ? mapLegacyUrl(rawEd.heroDesktopImage)
            : DEFAULT_EDITORIAL.heroDesktopImage,
          heroMobileImage: rawEd.heroMobileImage
            ? mapLegacyUrl(rawEd.heroMobileImage)
            : DEFAULT_EDITORIAL.heroMobileImage,
          campaignImage: rawEd.campaignImage
            ? mapLegacyUrl(rawEd.campaignImage)
            : DEFAULT_EDITORIAL.campaignImage,
          storyImage: rawEd.storyImage
            ? mapLegacyUrl(rawEd.storyImage)
            : DEFAULT_EDITORIAL.storyImage,
        };
        nextEditorial = { ...DEFAULT_EDITORIAL, ...normalizedEd };
      }

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
    } catch {
      // Keep cached or demo catalog when offline or unseeded
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    let unsubAuth: (() => void) | undefined;
    let deferredHandle: number | undefined;

    const safetyTimer = window.setTimeout(() => {
      if (!cancelled) setAuthReady(true);
    }, 1200);

    const bootstrapFirebase = async () => {
      try {
        const {
          auth,
          db,
          doc,
          getDoc,
          onAuthStateChanged,
          serverTimestamp,
          setDoc,
        } = await getFirebaseServices();

        if (cancelled) return;

        // Revalidate catalog silently without blocking first paint
        void refreshCatalog();

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

          const profileRef = doc(db, 'users', firebaseUser.uid);
          const profilePromise = getDoc(profileRef)
            .then(async (profileSnap) => {
              if (profileSnap.exists()) {
                return profileSnap.data() as UserProfile;
              }
              if (firebaseUser.emailVerified) {
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
                return {
                  uid: firebaseUser.uid,
                  displayName: newProfile.displayName,
                  email: newProfile.email,
                  cpf: '',
                  phone: '',
                } as UserProfile;
              }
              return null;
            })
            .catch(() => ({
              uid: firebaseUser.uid,
              displayName: firebaseUser.displayName || 'Cliente COMPLEX',
              email: firebaseUser.email || '',
            }));

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

    // Defer heavy Firebase SDK load just past initial frame render
    deferredHandle = window.requestAnimationFrame(() => {
      void bootstrapFirebase();
    });

    return () => {
      cancelled = true;
      window.clearTimeout(safetyTimer);
      if (deferredHandle !== undefined) window.cancelAnimationFrame(deferredHandle);
      if (unsubAuth) unsubAuth();
    };
  }, [refreshCatalog]);

  const signInWithGoogle = useCallback(async () => {
    const { auth, googleAuthProvider, signInWithPopup } = await getFirebaseServices();
    await signInWithPopup(auth, googleAuthProvider);
  }, []);

  const logout = useCallback(async () => {
    const { auth, signOut } = await getFirebaseServices();
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
      return handleFirestoreError(error, OperationType.LIST, path);
    }
  }, [getDemoOrders, user]);

  const fetchAllOrders = useCallback(async (): Promise<OrderRecord[]> => {
    const path = 'orders';
    const { collection, db, getDocs, handleFirestoreError, OperationType, orderBy, query } =
      await getFirebaseServices();
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
      return handleFirestoreError(error, OperationType.LIST, path);
    }
  }, []);

  const fetchAllCoupons = useCallback(async (): Promise<CouponRecord[]> => {
    const path = 'coupons';
    const { collection, db, getDocs, handleFirestoreError, OperationType } =
      await getFirebaseServices();
    try {
      const snap = await getDocs(collection(db, 'coupons'));
      return snap.docs.map((d) => d.data() as CouponRecord);
    } catch (error) {
      return handleFirestoreError(error, OperationType.LIST, path);
    }
  }, []);

  const fetchAllCustomers = useCallback(async (): Promise<UserProfile[]> => {
    const path = 'users';
    const { collection, db, getDocs, handleFirestoreError, OperationType } =
      await getFirebaseServices();
    try {
      const snap = await getDocs(collection(db, 'users'));
      return snap.docs.map((d) => d.data() as UserProfile);
    } catch (error) {
      return handleFirestoreError(error, OperationType.LIST, path);
    }
  }, []);

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
    [refreshCatalog, showToast]
  );

  const deleteProduct = useCallback(
    async (productId: string) => {
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
    [refreshCatalog, showToast]
  );

  const saveCategory = useCallback(
    async (category: CategoryItem) => {
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
    [refreshCatalog, showToast]
  );

  const saveEditorial = useCallback(
    async (nextEditorial: EditorialConfig) => {
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
    [refreshCatalog, showToast]
  );

  const saveCoupon = useCallback(
    async (coupon: CouponRecord) => {
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
    [showToast]
  );

  const deleteCoupon = useCallback(
    async (code: string) => {
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
    [showToast]
  );

  const updateOrderStatus = useCallback(
    async (orderId: string, status: OrderStatus) => {
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
    [showToast]
  );

  const seedDemoCatalogToFirestore = useCallback(async () => {
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
  }, [refreshCatalog, showToast]);

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
