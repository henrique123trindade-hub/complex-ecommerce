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
  UserRole,
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
  buildProtectedHeaders,
  checkAuthRateLimit,
  clearServerSession,
  reportSecurityEvent,
  syncServerSession,
} from '../lib/authApi';
import {
  validateAuthEmail,
  validateAuthName,
  validatePasswordStrength,
} from '../utils/authValidation';

const CART_STORAGE_KEY = 'complex_cart_v1';
const DEMO_ORDERS_STORAGE_KEY = 'complex_demo_orders_v1';

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
  '/assets/images/product_detail_cotton_1794952250261.jpg':
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
  addToCart: (product: Product, colorName: string, size: string, quantity?: number) => void;
  updateCartQuantity: (key: string, quantity: number) => void;
  removeFromCart: (key: string) => void;
  clearCart: () => void;
  revalidateCartBeforeCheckout: () => Promise<CartValidationResult>;
}

export interface AuthContextValue {
  user: User | null;
  authReady: boolean;
  isAdmin: boolean;
  userRole: UserRole;
  userProfile: UserProfile | null;
  signInWithGoogle: () => Promise<void>;
  registerWithEmail: (input: { name: string; email: string; password: string }) => Promise<void>;
  signInWithEmail: (input: { email: string; password: string }) => Promise<void>;
  requestPasswordReset: (email: string) => Promise<void>;
  resendVerificationEmail: () => Promise<void>;
  refreshEmailVerification: () => Promise<boolean>;
  inspectPasswordResetCode: (oobCode: string) => Promise<string>;
  confirmResetPasswordWithCode: (oobCode: string, newPassword: string) => Promise<void>;
  applyEmailVerificationCode: (oobCode: string) => Promise<void>;
  linkGoogleAccount: (currentPassword: string) => Promise<void>;
  linkPasswordCredential: (newPassword: string) => Promise<void>;
  changeUserPassword: (currentPassword: string, newPassword: string) => Promise<void>;
  getAuthHeaders: () => Promise<Record<string, string>>;
  logout: () => Promise<void>;
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
  const [userRole, setUserRole] = useState<UserRole>('customer');
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

  const openBag = useCallback(() => setIsBagOpen(true), []);
  const closeBag = useCallback(() => setIsBagOpen(false), []);
  const openSearch = useCallback(() => setIsSearchOpen(true), []);
  const closeSearch = useCallback(() => setIsSearchOpen(false), []);
  const openAdvisor = useCallback(() => setIsAdvisorOpen(true), []);
  const closeAdvisor = useCallback(() => setIsAdvisorOpen(false), []);

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

  const syncAuthenticatedUser = useCallback(
    async (firebaseUser: User | null, options?: { forceTokenRefresh?: boolean }) => {
      if (!firebaseUser) {
        setUser(null);
        setIsAdmin(false);
        setUserRole('customer');
        setUserProfile(null);
        setAuthReady(true);
        void clearServerSession();
        return false;
      }

      const authMethods = Array.from(
        new Set(
          (firebaseUser.providerData || [])
            .map((p) => p.providerId)
            .filter((p): p is string => Boolean(p))
        )
      );
      const safeMethods = authMethods.length > 0 ? authMethods.slice(0, 5) : ['password'];

      setUser(firebaseUser);

      try {
        const { db, doc, getDoc, serverTimestamp, setDoc, updateDoc } =
          await getFirebaseServices();

        const idToken = await firebaseUser.getIdToken(Boolean(options?.forceTokenRefresh));
        const serverSession = await syncServerSession(idToken);
        const firestoreAdminCheck = await getDoc(doc(db, 'admins', firebaseUser.uid))
          .then((snap) => snap.exists() && snap.data()?.active !== false)
          .catch(() => false);

        const resolvedRole: UserRole =
          firebaseUser.emailVerified && (serverSession.role === 'admin' || firestoreAdminCheck)
            ? 'admin'
            : 'customer';
        const resolvedIsAdmin = resolvedRole === 'admin';

        // If the server recognized bootstrapped admin ownership before /admins/{uid} existed, materialize /admins/{uid}
        if (resolvedIsAdmin && !firestoreAdminCheck) {
          await setDoc(doc(db, 'admins', firebaseUser.uid), {
            uid: firebaseUser.uid,
            email: (firebaseUser.email || '').toLowerCase(),
            role: 'admin',
            active: true,
            grantedBy: 'owner-bootstrap',
            grantedAt: serverTimestamp(),
          }).catch(() => {});
        }

        const profileRef = doc(db, 'users', firebaseUser.uid);
        let resolvedProfile: UserProfile | null = null;

        if (firebaseUser.emailVerified) {
          try {
            const profileSnap = await getDoc(profileRef);
            if (profileSnap.exists()) {
              const raw = profileSnap.data() as UserProfile & {
                createdAt?: { toDate?: () => Date } | string;
                updatedAt?: { toDate?: () => Date } | string;
              };
              const storedMethods = Array.isArray(raw.authMethods) ? raw.authMethods : [];
              const methodsChanged =
                storedMethods.length !== safeMethods.length ||
                safeMethods.some((m, i) => storedMethods[i] !== m);
              const needsMigration =
                !raw.role || raw.emailVerified !== true || methodsChanged;

              if (needsMigration) {
                const targetRole: UserRole = !raw.role
                  ? 'customer'
                  : (raw.role as UserRole);
                await updateDoc(profileRef, {
                  role: targetRole,
                  authMethods: safeMethods,
                  emailVerified: true,
                  updatedAt: serverTimestamp(),
                }).catch(() => {});
              }

              if (resolvedIsAdmin && raw.role !== 'admin') {
                await updateDoc(profileRef, {
                  role: 'admin',
                  updatedAt: serverTimestamp(),
                }).catch(() => {});
              }

              resolvedProfile = {
                uid: firebaseUser.uid,
                displayName: raw.displayName || firebaseUser.displayName || 'Cliente COMPLEX',
                email: raw.email || firebaseUser.email || '',
                cpf: raw.cpf || '',
                phone: raw.phone || '',
                role: resolvedIsAdmin ? 'admin' : (raw.role as UserRole) || 'customer',
                authMethods: safeMethods,
                emailVerified: true,
                createdAt:
                  raw.createdAt && typeof (raw.createdAt as { toDate?: () => Date }).toDate === 'function'
                    ? (raw.createdAt as { toDate: () => Date }).toDate().toISOString()
                    : typeof raw.createdAt === 'string'
                    ? raw.createdAt
                    : undefined,
                updatedAt:
                  raw.updatedAt && typeof (raw.updatedAt as { toDate?: () => Date }).toDate === 'function'
                    ? (raw.updatedAt as { toDate: () => Date }).toDate().toISOString()
                    : typeof raw.updatedAt === 'string'
                    ? raw.updatedAt
                    : undefined,
              };
            } else {
              // Every newly created profile automatically receives 'customer'
              const initialProfile = {
                uid: firebaseUser.uid,
                displayName: firebaseUser.displayName || 'Cliente COMPLEX',
                email: (firebaseUser.email || '').toLowerCase(),
                cpf: '',
                phone: '',
                role: 'customer' as const,
                authMethods: safeMethods,
                emailVerified: true,
                createdAt: serverTimestamp(),
                updatedAt: serverTimestamp(),
              };
              await setDoc(profileRef, initialProfile);
              if (resolvedIsAdmin) {
                await updateDoc(profileRef, {
                  role: 'admin',
                  updatedAt: serverTimestamp(),
                }).catch(() => {});
              }
              resolvedProfile = {
                uid: firebaseUser.uid,
                displayName: initialProfile.displayName,
                email: initialProfile.email,
                cpf: '',
                phone: '',
                role: resolvedRole,
                authMethods: safeMethods,
                emailVerified: true,
              };
            }
          } catch {
            resolvedProfile = {
              uid: firebaseUser.uid,
              displayName: firebaseUser.displayName || 'Cliente COMPLEX',
              email: firebaseUser.email || '',
              role: resolvedRole,
              authMethods: safeMethods,
              emailVerified: true,
            };
          }
        } else {
          resolvedProfile = {
            uid: firebaseUser.uid,
            displayName: firebaseUser.displayName || 'Cliente COMPLEX',
            email: firebaseUser.email || '',
            role: 'customer',
            authMethods: safeMethods,
            emailVerified: false,
          };
        }

        setIsAdmin(resolvedIsAdmin);
        setUserRole(resolvedRole);
        setUserProfile(resolvedProfile);
        setAuthReady(true);
        return resolvedIsAdmin;
      } catch {
        setIsAdmin(false);
        setUserRole('customer');
        setAuthReady(true);
        return false;
      }
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
        const { auth, onAuthStateChanged } = await getFirebaseServices();
        if (cancelled) return;

        window.setTimeout(() => {
          if (!cancelled) void refreshCatalog();
        }, 40);

        unsubAuth = onAuthStateChanged(auth, async (firebaseUser) => {
          window.clearTimeout(safetyTimer);
          if (cancelled) return;
          await syncAuthenticatedUser(firebaseUser);
        });
      } catch {
        if (!cancelled) setAuthReady(true);
      }
    };

    let delayHandle: number | undefined;
    let onLoadHandler: (() => void) | undefined;

    const currentPath =
      typeof window !== 'undefined' ? window.location.pathname : '/';
    const isAuthCriticalRoute =
      currentPath.startsWith('/account') || currentPath.startsWith('/admin');

    const startDeferredBootstrap = () => {
      if (isAuthCriticalRoute) {
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

    if (document.readyState === 'complete' || isAuthCriticalRoute) {
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
  }, [refreshCatalog, syncAuthenticatedUser]);

  const getAuthHeaders = useCallback(async (): Promise<Record<string, string>> => {
    let idToken: string | null = null;
    if (user) {
      idToken = await user.getIdToken();
    } else {
      const { auth } = await getFirebaseServices();
      if (auth.currentUser) {
        idToken = await auth.currentUser.getIdToken();
      }
    }
    return buildProtectedHeaders(idToken);
  }, [user]);

  const signInWithGoogle = useCallback(async () => {
    await checkAuthRateLimit('login', 'google');
    const { auth, googleAuthProvider, signInWithPopup } = await getFirebaseServices();
    const credential = await signInWithPopup(auth, googleAuthProvider);
    await syncAuthenticatedUser(credential.user, { forceTokenRefresh: true });
  }, [syncAuthenticatedUser]);

  const registerWithEmail = useCallback(
    async (input: { name: string; email: string; password: string }) => {
      const nameCheck = validateAuthName(input.name);
      if (!nameCheck.valid) throw new Error(nameCheck.message);
      const emailCheck = validateAuthEmail(input.email);
      if (!emailCheck.valid) throw new Error(emailCheck.message);
      const pwdCheck = validatePasswordStrength(input.password);
      if (!pwdCheck.valid) throw new Error(pwdCheck.errors[0]);

      await checkAuthRateLimit('register', emailCheck.normalized);
      const {
        auth,
        createUserWithEmailAndPassword,
        sendEmailVerification,
        updateProfile,
      } = await getFirebaseServices();

      const credential = await createUserWithEmailAndPassword(
        auth,
        emailCheck.normalized,
        input.password
      );
      await updateProfile(credential.user, { displayName: nameCheck.normalized });
      await sendEmailVerification(credential.user);
      const token = await credential.user.getIdToken(true);
      await reportSecurityEvent('AUTH_REGISTER', 'success', token, { provider: 'password' });
      await syncAuthenticatedUser(credential.user, { forceTokenRefresh: true });
    },
    [syncAuthenticatedUser]
  );

  const signInWithEmail = useCallback(
    async (input: { email: string; password: string }) => {
      const emailCheck = validateAuthEmail(input.email);
      if (!emailCheck.valid) throw new Error(emailCheck.message);
      if (!input.password) throw new Error('Informe sua senha.');

      await checkAuthRateLimit('login', emailCheck.normalized);
      const { auth, signInWithEmailAndPassword } = await getFirebaseServices();
      try {
        const credential = await signInWithEmailAndPassword(
          auth,
          emailCheck.normalized,
          input.password
        );
        await syncAuthenticatedUser(credential.user, { forceTokenRefresh: true });
      } catch (err) {
        void reportSecurityEvent('AUTH_LOGIN_FAILED', 'denied', null, { provider: 'password' });
        throw err;
      }
    },
    [syncAuthenticatedUser]
  );

  const requestPasswordReset = useCallback(async (email: string) => {
    const emailCheck = validateAuthEmail(email);
    if (!emailCheck.valid) throw new Error(emailCheck.message);

    await checkAuthRateLimit('password-reset', emailCheck.normalized);
    const { auth, sendPasswordResetEmail } = await getFirebaseServices();
    try {
      await sendPasswordResetEmail(auth, emailCheck.normalized);
    } catch (err) {
      const code =
        typeof err === 'object' && err !== null && 'code' in err ? String(err.code) : '';
      // Anti-enumeration: never expose whether an account exists during password reset
      if (code !== 'auth/user-not-found') {
        throw err;
      }
    }
    void reportSecurityEvent('AUTH_PASSWORD_RESET_REQUEST', 'success', null);
  }, []);

  const resendVerificationEmail = useCallback(async () => {
    const { auth, sendEmailVerification } = await getFirebaseServices();
    if (!auth.currentUser) throw new Error('Faça login para reenviar a confirmação.');
    await checkAuthRateLimit('resend-verification', auth.currentUser.email || auth.currentUser.uid);
    await sendEmailVerification(auth.currentUser);
    const token = await auth.currentUser.getIdToken();
    void reportSecurityEvent('AUTH_EMAIL_VERIFICATION_SENT', 'success', token);
  }, []);

  const refreshEmailVerification = useCallback(async (): Promise<boolean> => {
    const { auth } = await getFirebaseServices();
    if (!auth.currentUser) return false;
    await auth.currentUser.reload();
    await syncAuthenticatedUser(auth.currentUser, { forceTokenRefresh: true });
    return Boolean(auth.currentUser.emailVerified);
  }, [syncAuthenticatedUser]);

  const inspectPasswordResetCode = useCallback(async (oobCode: string): Promise<string> => {
    const { auth, verifyPasswordResetCode } = await getFirebaseServices();
    return verifyPasswordResetCode(auth, oobCode);
  }, []);

  const confirmResetPasswordWithCode = useCallback(
    async (oobCode: string, newPassword: string) => {
      const pwdCheck = validatePasswordStrength(newPassword);
      if (!pwdCheck.valid) throw new Error(pwdCheck.errors[0]);
      await checkAuthRateLimit('password-reset', 'confirm');
      const { auth, confirmPasswordReset } = await getFirebaseServices();
      await confirmPasswordReset(auth, oobCode, newPassword);
      void reportSecurityEvent('AUTH_PASSWORD_RESET_CONFIRMED', 'success', null);
    },
    []
  );

  const applyEmailVerificationCode = useCallback(
    async (oobCode: string) => {
      const { applyActionCode, auth } = await getFirebaseServices();
      await applyActionCode(auth, oobCode);
      if (auth.currentUser) {
        await auth.currentUser.reload();
        await syncAuthenticatedUser(auth.currentUser, { forceTokenRefresh: true });
      }
    },
    [syncAuthenticatedUser]
  );

  const linkGoogleAccount = useCallback(
    async (currentPassword: string) => {
      const {
        EmailAuthProvider,
        auth,
        googleAuthProvider,
        linkWithPopup,
        reauthenticateWithCredential,
      } = await getFirebaseServices();
      const currentUser = auth.currentUser;
      if (!currentUser || !currentUser.email) {
        throw new Error('Sessão inválida. Entre novamente antes de vincular.');
      }
      if (!currentPassword) {
        throw new Error('Confirme sua senha atual antes de vincular a Conta Google.');
      }

      await checkAuthRateLimit('link-account', currentUser.uid);
      const emailCred = EmailAuthProvider.credential(currentUser.email, currentPassword);
      await reauthenticateWithCredential(currentUser, emailCred);
      const linked = await linkWithPopup(currentUser, googleAuthProvider);
      const token = await linked.user.getIdToken(true);
      await reportSecurityEvent('AUTH_ACCOUNT_LINKED', 'success', token, { method: 'google.com' });
      await syncAuthenticatedUser(linked.user, { forceTokenRefresh: true });
    },
    [syncAuthenticatedUser]
  );

  const linkPasswordCredential = useCallback(
    async (newPassword: string) => {
      const pwdCheck = validatePasswordStrength(newPassword);
      if (!pwdCheck.valid) throw new Error(pwdCheck.errors[0]);

      const {
        EmailAuthProvider,
        auth,
        googleAuthProvider,
        linkWithCredential,
        reauthenticateWithPopup,
      } = await getFirebaseServices();
      const currentUser = auth.currentUser;
      if (!currentUser || !currentUser.email) {
        throw new Error('Sessão inválida. Entre novamente antes de vincular.');
      }

      await checkAuthRateLimit('link-account', currentUser.uid);
      // Require fresh interactive Google verification before adding password auth
      await reauthenticateWithPopup(currentUser, googleAuthProvider);
      const credential = EmailAuthProvider.credential(currentUser.email, newPassword);
      const linked = await linkWithCredential(currentUser, credential);
      const token = await linked.user.getIdToken(true);
      await reportSecurityEvent('AUTH_ACCOUNT_LINKED', 'success', token, { method: 'password' });
      await syncAuthenticatedUser(linked.user, { forceTokenRefresh: true });
    },
    [syncAuthenticatedUser]
  );

  const changeUserPassword = useCallback(
    async (currentPassword: string, newPassword: string) => {
      const pwdCheck = validatePasswordStrength(newPassword);
      if (!pwdCheck.valid) throw new Error(pwdCheck.errors[0]);

      const { EmailAuthProvider, auth, reauthenticateWithCredential, updatePassword } =
        await getFirebaseServices();
      const currentUser = auth.currentUser;
      if (!currentUser || !currentUser.email) {
        throw new Error('Sessão inválida. Entre novamente.');
      }
      if (!currentPassword) {
        throw new Error('Informe sua senha atual.');
      }

      await checkAuthRateLimit('link-account', currentUser.uid);
      const cred = EmailAuthProvider.credential(currentUser.email, currentPassword);
      await reauthenticateWithCredential(currentUser, cred);
      await updatePassword(currentUser, newPassword);
      const token = await currentUser.getIdToken(true);
      await reportSecurityEvent('AUTH_PASSWORD_UPDATED', 'success', token);
    },
    []
  );

  const logout = useCallback(async () => {
    const { auth, signOut } = await getFirebaseServices();
    await clearServerSession();
    await signOut(auth);
    setUser(null);
    setIsAdmin(false);
    setUserRole('customer');
    setUserProfile(null);
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
      // 1. Register via Express server (CSRF + Bearer ownership enforcement)
      const headers = await getAuthHeaders();
      const res = await fetch('/api/orders', {
        method: 'POST',
        credentials: 'same-origin',
        headers,
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
    [clearCart, getAuthHeaders, getDemoOrders, user]
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
      if (!user.emailVerified) {
        throw new Error('Confirme seu e-mail antes de editar os dados do perfil.');
      }
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
        setUserProfile((prev) =>
          prev
            ? {
                ...prev,
                displayName: profile.displayName ?? prev.displayName,
                cpf: profile.cpf ?? prev.cpf,
                phone: profile.phone ?? prev.phone,
              }
            : prev
        );
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
      userRole,
      userProfile,
      signInWithGoogle,
      registerWithEmail,
      signInWithEmail,
      requestPasswordReset,
      resendVerificationEmail,
      refreshEmailVerification,
      inspectPasswordResetCode,
      confirmResetPasswordWithCode,
      applyEmailVerificationCode,
      linkGoogleAccount,
      linkPasswordCredential,
      changeUserPassword,
      getAuthHeaders,
      logout,
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
      saveCoupon,
      deleteCoupon,
      updateOrderStatus,
      subscribeNewsletter,
    }),
    [
      user,
      authReady,
      isAdmin,
      userRole,
      userProfile,
      signInWithGoogle,
      registerWithEmail,
      signInWithEmail,
      requestPasswordReset,
      resendVerificationEmail,
      refreshEmailVerification,
      inspectPasswordResetCode,
      confirmResetPasswordWithCode,
      applyEmailVerificationCode,
      linkGoogleAccount,
      linkPasswordCredential,
      changeUserPassword,
      getAuthHeaders,
      logout,
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
