import React, { useCallback, useEffect, useState } from 'react';
import { StoreProvider, useStore } from './context/StoreContext';
import { ErrorBoundary } from './components/ErrorBoundary';
import { Header } from './components/Header';
import { Footer } from './components/Footer';
import { BagDrawer } from './components/BagDrawer';
import { SearchOverlay } from './components/SearchOverlay';
import { StyleAssistantDrawer } from './components/StyleAssistantDrawer';
import { HomePage } from './pages/HomePage';
import { ShopPage } from './pages/ShopPage';
import { ProductDetailPage } from './pages/ProductDetailPage';
import { CollectionsPage } from './pages/CollectionsPage';
import { AboutPage } from './pages/AboutPage';
import { BagPage } from './pages/BagPage';
import { CheckoutPage } from './pages/CheckoutPage';
import { AccountPage } from './pages/AccountPage';
import { AdminPage } from './pages/AdminPage';
import {
  parseNavigationTarget,
  resolveStorefrontRoute,
} from './utils/routing';

function readCurrentLocationUrl(): string {
  const parsed = parseNavigationTarget(
    `${window.location.pathname}${window.location.search}${window.location.hash}`
  );
  return parsed.locationUrl;
}

const StorefrontRouter: React.FC = () => {
  const { toastMessage } = useStore();
  const [locationUrl, setLocationUrl] = useState<string>(() => readCurrentLocationUrl());

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

      <div key={pathname} className="flex-1 page-transition-enter">
        {renderPage()}
      </div>

      {!isAdminRoute && <Footer onNavigate={navigate} />}

      <BagDrawer onNavigate={navigate} />
      <SearchOverlay onNavigate={navigate} />
      <StyleAssistantDrawer />

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
