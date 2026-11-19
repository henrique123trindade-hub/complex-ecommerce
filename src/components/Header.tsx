import React, { useEffect, useRef, useState } from 'react';
import { ArrowUpRight, Menu, Search, ShoppingBag, User, X } from 'lucide-react';
import { useAuth, useCart, useCatalog, useStoreUI } from '../context/StoreContext';
import { isNavLinkActive } from '../utils/routing';
import { useAnimatedDisclosure } from '../utils/useAnimatedDisclosure';
import { BrandMark } from './BrandMark';

interface HeaderProps {
  currentPath: string;
  currentQuery?: string;
  onNavigate: (path: string) => void;
}

const warmSearch = () => {
  void import('./SearchOverlay');
};

const warmBag = () => {
  void import('./BagDrawer');
};

const warmAccount = () => {
  void import('../pages/AccountPage');
};

export const Header: React.FC<HeaderProps> = React.memo(
  ({ currentPath, currentQuery = '', onNavigate }) => {
    const { editorial } = useCatalog();
    const { cartCount } = useCart();
    const { user, isAdmin } = useAuth();
    const { openBag, openSearch } = useStoreUI();
    const [menuOpen, setMenuOpen] = useState(false);
    const [scrolled, setScrolled] = useState(false);
    const [bagBumpKey, setBagBumpKey] = useState(0);
    const prevCartCountRef = useRef(cartCount);

    const closeMobileMenu = () => setMenuOpen(false);
    const { mounted: menuMounted, visible: menuVisible } = useAnimatedDisclosure(
      menuOpen,
      closeMobileMenu,
      240
    );

    useEffect(() => {
      const onScroll = () => {
        const nextScrolled = window.scrollY > 16;
        setScrolled((prev) => (prev === nextScrolled ? prev : nextScrolled));
      };
      onScroll();
      window.addEventListener('scroll', onScroll, { passive: true });
      return () => window.removeEventListener('scroll', onScroll);
    }, []);

    useEffect(() => {
      if (cartCount !== prevCartCountRef.current) {
        if (cartCount > prevCartCountRef.current) {
          setBagBumpKey((k) => k + 1);
        }
        prevCartCountRef.current = cartCount;
      }
    }, [cartCount]);

    const navLinks = [
      { label: 'Lançamentos', path: '/shop?sort=newest', index: '01' },
      { label: 'Loja', path: '/shop', index: '02' },
      { label: 'Coleções', path: '/collections', index: '03' },
      { label: 'Sobre', path: '/about', index: '04' },
    ];

    const handleNav = (path: string) => {
      closeMobileMenu();
      onNavigate(path);
    };

    return (
      <>
        <header
          className={`sticky top-0 z-40 w-full backdrop-blur-md border-b transition-[background-color,border-color,box-shadow] duration-200 ${
            scrolled
              ? 'bg-[#F1EEE8]/98 border-[#171717]/18 shadow-[0_6px_24px_rgba(23,23,23,0.05)]'
              : 'bg-[#F1EEE8]/95 border-[#171717]/12'
          }`}
        >
          {/* Slim editorial bar */}
          <div className="bg-[#171717] text-[#F1EEE8] h-7 flex items-center justify-center px-4">
            <p className="font-mono-tabular text-[10px] tracking-[0.16em] uppercase truncate">
              {editorial.announcementText}
            </p>
          </div>

          {/* Main 3-zone header */}
          <div className="max-w-[1440px] mx-auto px-4 md:px-8 h-14 flex items-center justify-between gap-4">
            {/* Left: Desktop Navigation / Mobile Menu Trigger */}
            <div className="flex items-center gap-6 min-w-0 flex-1">
              <button
                type="button"
                onClick={() => setMenuOpen(true)}
                aria-label="Abrir menu de navegação"
                aria-expanded={menuVisible}
                className="lg:hidden inline-flex items-center justify-center w-10 h-10 -ml-2 text-[#171717] hover:opacity-70 transition-opacity cursor-pointer"
              >
                <Menu className="w-5 h-5" strokeWidth={1.5} />
              </button>

              <nav aria-label="Navegação principal" className="hidden lg:flex items-center gap-6">
                {navLinks.map((item) => {
                  const isActive = isNavLinkActive(currentPath, currentQuery, item.path);
                  return (
                    <button
                      key={item.label}
                      type="button"
                      onClick={() => handleNav(item.path)}
                      data-active={isActive ? 'true' : 'false'}
                      aria-current={isActive ? 'page' : undefined}
                      className={`nav-link-underline text-[12px] tracking-[0.06em] uppercase whitespace-nowrap shrink-0 pb-0.5 transition-colors duration-200 cursor-pointer ${
                        isActive
                          ? 'text-[#171717] font-medium'
                          : 'text-[#171717]/72 hover:text-[#171717]'
                      }`}
                    >
                      {item.label}
                    </button>
                  );
                })}
              </nav>
            </div>

            {/* Center: BrandMark + Wordmark COMPLEX */}
            <div className="flex items-center justify-center shrink-0">
              <button
                type="button"
                onClick={() => handleNav('/')}
                aria-label="COMPLEX — Página Inicial"
                className="group inline-flex items-center gap-2 font-display text-[20px] md:text-[22px] font-extrabold tracking-[-0.04em] text-[#171717] uppercase whitespace-nowrap shrink-0 cursor-pointer hover:opacity-85 transition-opacity duration-200"
              >
                <BrandMark className="w-7 h-3.5 md:w-8 md:h-4 text-[#171717] shrink-0 transition-transform duration-200 group-hover:scale-[1.04]" />
                <span>COMPLEX</span>
              </button>
            </div>

            {/* Right: Search, Account/Admin, Bag */}
            <div className="flex items-center justify-end gap-3 md:gap-5 flex-1">
              <button
                type="button"
                onClick={openSearch}
                onMouseEnter={warmSearch}
                onFocus={warmSearch}
                aria-label="Buscar produtos"
                className="group inline-flex items-center gap-1.5 text-[12px] tracking-[0.06em] uppercase text-[#171717]/80 hover:text-[#171717] whitespace-nowrap shrink-0 py-2 transition-colors duration-200 cursor-pointer"
              >
                <Search
                  className="w-4 h-4 transition-transform duration-200 group-hover:scale-105"
                  strokeWidth={1.5}
                />
                <span className="hidden sm:inline">Buscar</span>
              </button>

              <button
                type="button"
                onClick={() => handleNav('/account')}
                onMouseEnter={warmAccount}
                onFocus={warmAccount}
                aria-label={user ? 'Minha conta' : 'Entrar na conta'}
                className="group hidden sm:inline-flex items-center gap-1.5 text-[12px] tracking-[0.06em] uppercase text-[#171717]/80 hover:text-[#171717] whitespace-nowrap shrink-0 py-2 transition-colors duration-200 cursor-pointer"
              >
                <User
                  className="w-4 h-4 transition-transform duration-200 group-hover:scale-105"
                  strokeWidth={1.5}
                />
                <span>{user ? 'Conta' : 'Entrar'}</span>
              </button>

              {isAdmin && (
                <button
                  type="button"
                  onClick={() => handleNav('/admin')}
                  className="hidden md:inline-flex text-[11px] font-mono-tabular tracking-[0.08em] uppercase text-[#6A705C] hover:text-[#171717] whitespace-nowrap shrink-0 py-2 transition-colors duration-200 cursor-pointer"
                >
                  Admin
                </button>
              )}

              <button
                type="button"
                onClick={openBag}
                onMouseEnter={warmBag}
                onFocus={warmBag}
                aria-label={`Abrir sacola (${cartCount} itens)`}
                className="group inline-flex items-center gap-1.5 text-[12px] tracking-[0.06em] uppercase text-[#171717] hover:opacity-75 whitespace-nowrap shrink-0 py-2 transition-opacity duration-200 cursor-pointer"
              >
                <ShoppingBag
                  className="w-4 h-4 md:hidden transition-transform duration-200 group-hover:scale-105"
                  strokeWidth={1.5}
                />
                <span
                  key={bagBumpKey}
                  className={`font-mono-tabular inline-block ${bagBumpKey > 0 ? 'value-bump' : ''}`}
                >
                  Sacola ({cartCount})
                </span>
              </button>
            </div>
          </div>
        </header>

        {/* Full-Screen Editorial Mobile Navigation Overlay */}
        {menuMounted && (
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Menu de navegação em tela cheia"
            data-state={menuVisible ? 'open' : 'closed'}
            className={`mobile-menu-overlay fixed inset-0 z-50 lg:hidden bg-[#F1EEE8] text-[#171717] flex flex-col justify-between overflow-y-auto ${
              menuVisible
                ? 'opacity-100 translate-y-0'
                : 'opacity-0 translate-y-2 pointer-events-none'
            }`}
          >
            {/* Top bar */}
            <div>
              <div className="bg-[#171717] text-[#F1EEE8] h-7 flex items-center justify-center px-4">
                <p className="font-mono-tabular text-[10px] tracking-[0.16em] uppercase truncate">
                  {editorial.announcementText}
                </p>
              </div>

              <div className="px-5 h-14 flex items-center justify-between border-b border-[#171717]/12">
                <span className="font-mono-tabular text-[10px] uppercase tracking-[0.16em] text-[#99968F]">
                  ÍNDICE / 01
                </span>
                <button
                  type="button"
                  onClick={() => handleNav('/')}
                  className="inline-flex items-center gap-1.5 font-display text-[20px] font-extrabold tracking-[-0.04em] uppercase cursor-pointer"
                >
                  <BrandMark className="w-6 h-3 text-[#171717] shrink-0" />
                  <span>COMPLEX</span>
                </button>
                <button
                  type="button"
                  onClick={closeMobileMenu}
                  aria-label="Fechar menu"
                  className="inline-flex items-center justify-center w-10 h-10 -mr-2 text-[#171717] hover:opacity-70 transition-opacity cursor-pointer"
                >
                  <X className="w-5 h-5" strokeWidth={1.5} />
                </button>
              </div>

              {/* Large Archivo Editorial Navigation */}
              <nav aria-label="Navegação principal mobile" className="px-5 pt-6 pb-4 flex flex-col">
                {navLinks.map((item) => {
                  const isActive = isNavLinkActive(currentPath, currentQuery, item.path);

                  return (
                    <button
                      key={item.label}
                      type="button"
                      onClick={() => handleNav(item.path)}
                      className={`mobile-menu-item group flex items-baseline justify-between gap-4 py-4 border-b border-[#171717]/12 text-left cursor-pointer ${
                        menuVisible
                          ? 'opacity-100 translate-y-0'
                          : 'opacity-0 translate-y-3'
                      }`}
                    >
                      <div className="flex items-baseline gap-4 min-w-0">
                        <span className="font-mono-tabular text-[11px] tracking-[0.14em] text-[#99968F] shrink-0">
                          {item.index}
                        </span>
                        <span
                          className={`font-display text-[36px] sm:text-[44px] font-extrabold tracking-[-0.035em] leading-[1.02] uppercase transition-transform duration-200 ease-out group-hover:translate-x-1.5 motion-reduce:transition-none motion-reduce:group-hover:translate-x-0 ${
                            isActive ? 'text-[#171717]' : 'text-[#171717]/90 group-hover:text-[#171717]'
                          }`}
                        >
                          {item.label}
                        </span>
                      </div>
                      <ArrowUpRight
                        className={`w-5 h-5 shrink-0 transition-transform duration-200 ease-out group-hover:translate-x-0.5 group-hover:-translate-y-0.5 motion-reduce:transition-none motion-reduce:transform-none ${
                          isActive ? 'text-[#171717]' : 'text-[#99968F] group-hover:text-[#171717]'
                        }`}
                        strokeWidth={1.5}
                      />
                    </button>
                  );
                })}
              </nav>
            </div>

            {/* Bottom Utility & Brand Footer */}
            <div className="px-5 pb-8 pt-6 space-y-6">
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => {
                    closeMobileMenu();
                    openSearch();
                  }}
                  className="h-12 px-4 border border-[#171717]/20 flex items-center justify-between font-mono-tabular text-[11px] uppercase tracking-[0.12em] hover:border-[#171717] transition-colors cursor-pointer"
                >
                  <span>Buscar</span>
                  <Search className="w-3.5 h-3.5" strokeWidth={1.5} />
                </button>

                <button
                  type="button"
                  onClick={() => handleNav('/bag')}
                  className="h-12 px-4 border border-[#171717]/20 flex items-center justify-between font-mono-tabular text-[11px] uppercase tracking-[0.12em] hover:border-[#171717] transition-colors cursor-pointer"
                >
                  <span>Sacola ({cartCount})</span>
                  <ShoppingBag className="w-3.5 h-3.5" strokeWidth={1.5} />
                </button>

                <button
                  type="button"
                  onClick={() => handleNav('/account')}
                  className={`h-12 px-4 border border-[#171717]/20 flex items-center justify-between font-mono-tabular text-[11px] uppercase tracking-[0.12em] hover:border-[#171717] transition-colors cursor-pointer ${
                    isAdmin ? '' : 'col-span-2'
                  }`}
                >
                  <span>{user ? 'Minha Conta' : 'Entrar / Conta'}</span>
                  <User className="w-3.5 h-3.5" strokeWidth={1.5} />
                </button>

                {isAdmin && (
                  <button
                    type="button"
                    onClick={() => handleNav('/admin')}
                    className="h-12 px-4 border border-[#6A705C]/40 text-[#6A705C] flex items-center justify-between font-mono-tabular text-[11px] uppercase tracking-[0.12em] hover:border-[#6A705C] transition-colors cursor-pointer"
                  >
                    <span>Admin</span>
                    <ArrowUpRight className="w-3.5 h-3.5" strokeWidth={1.5} />
                  </button>
                )}
              </div>

              <div className="pt-5 border-t border-[#171717]/12 flex items-center justify-between font-mono-tabular text-[10px] uppercase tracking-[0.14em] text-[#99968F]">
                <span>Coleção 001 / 2026</span>
                <span>Streetwear Independente</span>
              </div>
            </div>
          </div>
        )}
      </>
    );
  }
);

Header.displayName = 'Header';
