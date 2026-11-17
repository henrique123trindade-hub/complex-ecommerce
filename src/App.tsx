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

const StorefrontRouter: React.FC = () => {
  const { toastMessage } = useStore();
  const [locationUrl, setLocationUrl] = useState<string>(
    () => `${window.location.pathname}${window.location.search}`
  );

  useEffect(() => {
    const onPopState = () => {
      setLocationUrl(`${window.location.pathname}${window.location.search}`);
    };
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);

  const navigate = useCallback((path: string) => {
    const [rawPath, hashPart] = path.split('#');
    window.history.pushState({}, '', path);
    setLocationUrl(rawPath);

    if (hashPart) {
      window.setTimeout(() => {
        document.getElementById(hashPart)?.scrollIntoView({ behavior: 'smooth' });
      }, 60);
    } else {
      window.scrollTo({ top: 0, behavior: 'instant' });
    }
  }, []);

  const [pathname, queryString = ''] = locationUrl.split('?');
  const isAdminRoute = pathname === '/admin';

  const renderPage = () => {
    if (pathname === '/' || pathname === '') return <HomePage onNavigate={navigate} />;
    if (pathname === '/shop') return <ShopPage queryString={queryString} onNavigate={navigate} />;
    if (pathname === '/collections') return <CollectionsPage onNavigate={navigate} />;
    if (pathname === '/about') return <AboutPage onNavigate={navigate} />;
    if (pathname.startsWith('/product/')) {
      const slug = pathname.replace('/product/', '').split('/')[0];
      return <ProductDetailPage slug={slug} onNavigate={navigate} />;
    }
    if (pathname === '/bag') return <BagPage onNavigate={navigate} />;
    if (pathname === '/checkout') return <CheckoutPage onNavigate={navigate} />;
    if (pathname === '/account') return <AccountPage onNavigate={navigate} />;
    if (pathname === '/admin') return <AdminPage onNavigate={navigate} />;
    return <HomePage onNavigate={navigate} />;
  };

  return (
    <div className="min-h-screen flex flex-col bg-[#F1EEE8] text-[#171717]">
      {!isAdminRoute && <Header currentPath={pathname} onNavigate={navigate} />}

      <div className="flex-1">{renderPage()}</div>

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
