import React, { Suspense, lazy, useCallback, useEffect, useState } from 'react';
import { StoreProvider, useStore } from './context/StoreContext';
import { ErrorBoundary } from './components/ErrorBoundary';
import { Header } from './components/Header';
import { Footer } from './components/Footer';
import { HomePage } from './pages/HomePage';
import {
  parseNavigationTarget,
  resolveStorefrontRoute,
} from './utils/routing';

const ShopPage = lazy(() =>
  import('./pages/ShopPage').then((m) => ({ default: m.ShopPage }))
);
const ProductDetailPage = lazy(() =>
  import('./pages/ProductDetailPage').then((m) => ({ default: m.ProductDetailPage }))
);
const CollectionsPage = lazy(() =>
  import('./pages/CollectionsPage').then((m) => ({ default: m.CollectionsPage }))
);
const AboutPage = lazy(() =>
  import('./pages/AboutPage').then((m) => ({ default: m.AboutPage }))
);
const BagPage = lazy(() =>
  import('./pages/BagPage').then((m) => ({ default: m.BagPage }))
);
const CheckoutPage = lazy(() =>
  import('./pages/CheckoutPage').then((m) => ({ default: m.CheckoutPage }))
);
const AccountPage = lazy(() =>
  import('./pages/AccountPage').then((m) => ({ default: m.AccountPage }))
);
const AdminPage = lazy(() =>
  import('./pages/AdminPage').then((m) => ({ default: m.AdminPage }))
);

const BagDrawer = lazy(() =>
  import('./components/BagDrawer').then((m) => ({ default: m.BagDrawer }))
);
const SearchOverlay = lazy(() =>
  import('./components/SearchOverlay').then((m) => ({ default: m.SearchOverlay }))
);
const StyleAssistantDrawer = lazy(() =>
  import('./components/StyleAssistantDrawer').then((m) => ({
    default: m.StyleAssistantDrawer,
  }))
);

function readCurrentLocationUrl(): string {
  const parsed = parseNavigationTarget(
    `${window.location.pathname}${window.location.search}${window.location.hash}`
  );
  return parsed.locationUrl;
}

const RouteFallback: React.FC = () => (
  <main className="min-h-[75vh] bg-[#F1EEE8] text-[#171717]" aria-busy="true" />
);

const StorefrontRouter: React.FC = () => {
  const { toastMessage, isBagOpen, isSearchOpen, isAdvisorOpen } = useStore();
  const [locationUrl, setLocationUrl] = useState<string>(() => readCurrentLocationUrl());
  const [hasNavigated, setHasNavigated] = useState<boolean>(false);

  useEffect(() => {
    const parsed = parseNavigationTarget(
      `${window.location.pathname}${window.location.search}${window.location.hash}`
    );
    const currentRaw = `${window.location.pathname}${window.location.search}${window.location.hash}`;
    if (parsed.fullUrl !== currentRaw) {
      window.history.replaceState({}, '', parsed.fullUrl);
    }

    const onPopState = () => {
      const next = parseNavigationTarget(
        `${window.location.pathname}${window.location.search}${window.location.hash}`
      );
      setHasNavigated(true);
      setLocationUrl(next.locationUrl);
      if (next.hash) {
        window.setTimeout(() => {
          document.getElementById(next.hash)?.scrollIntoView({ behavior: 'smooth' });
        }, 60);
      }
    };
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);

  const navigate = useCallback((path: string) => {
    const target = parseNavigationTarget(path);
    const currentFull = `${window.location.pathname}${window.location.search}${window.location.hash}`;

    if (currentFull !== target.fullUrl) {
      window.history.pushState({}, '', target.fullUrl);
    }
    setHasNavigated(true);
    setLocationUrl(target.locationUrl);

    if (target.hash) {
      window.setTimeout(() => {
        document.getElementById(target.hash)?.scrollIntoView({ behavior: 'smooth' });
      }, 60);
    } else {
      window.scrollTo({ top: 0, behavior: 'instant' });
    }
  }, []);

  const [rawPathname, queryString = ''] = locationUrl.split('?');
  const route = resolveStorefrontRoute(rawPathname);
  const pathname = route.pathname;
  const isAdminRoute = route.page === 'admin';

  const renderPage = () => {
    switch (route.page) {
      case 'home':
        return <HomePage onNavigate={navigate} />;
      case 'shop':
        return <ShopPage queryString={queryString} onNavigate={navigate} />;
      case 'collections':
        return <CollectionsPage onNavigate={navigate} />;
      case 'about':
        return <AboutPage onNavigate={navigate} />;
      case 'product':
        return <ProductDetailPage slug={route.slug} onNavigate={navigate} />;
      case 'bag':
        return <BagPage onNavigate={navigate} />;
      case 'checkout':
        return <CheckoutPage onNavigate={navigate} />;
      case 'account':
        return <AccountPage onNavigate={navigate} />;
      case 'admin':
        return <AdminPage onNavigate={navigate} />;
      default:
        return <HomePage onNavigate={navigate} />;
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-[#F1EEE8] text-[#171717]">
      {!isAdminRoute && <Header currentPath={pathname} onNavigate={navigate} />}

      <div
        key={pathname}
        className={hasNavigated ? 'flex-1 page-transition-enter' : 'flex-1'}
      >
        <Suspense fallback={<RouteFallback />}>{renderPage()}</Suspense>
      </div>

      {!isAdminRoute && <Footer onNavigate={navigate} />}

      {isBagOpen && (
        <Suspense fallback={null}>
          <BagDrawer onNavigate={navigate} />
        </Suspense>
      )}
      {isSearchOpen && (
        <Suspense fallback={null}>
          <SearchOverlay onNavigate={navigate} />
        </Suspense>
      )}
      {isAdvisorOpen && (
        <Suspense fallback={null}>
          <StyleAssistantDrawer />
        </Suspense>
      )}

      {toastMessage && (
        <div
          role="status"
          aria-live="polite"
          className="fixed bottom-5 right-5 z-50 bg-[#171717] text-[#F1EEE8] px-4 py-3 font-mono-tabular text-xs tracking-[0.06em] border border-[#F1EEE8]/20 max-w-sm"
        >
          {toastMessage}
        </div>
      )}
    </div>
  );
};

export default function App() {
  return (
    <ErrorBoundary>
      <StoreProvider>
        <StorefrontRouter />
      </StoreProvider>
    </ErrorBoundary>
  );
}
