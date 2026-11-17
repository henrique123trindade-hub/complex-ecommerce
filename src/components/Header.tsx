import React, { useEffect, useState } from 'react';
import { Menu, Search, ShoppingBag, User, X } from 'lucide-react';
import { useStore } from '../context/StoreContext';

interface HeaderProps {
  currentPath: string;
  onNavigate: (path: string) => void;
}

export const Header: React.FC<HeaderProps> = ({ currentPath, onNavigate }) => {
  const { editorial, cartCount, openBag, openSearch, user, isAdmin } = useStore();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMobileMenuOpen(false);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  const navLinks = [
    { label: 'New Arrivals', path: '/shop?sort=newest' },
    { label: 'Shop', path: '/shop' },
    { label: 'Collections', path: '/collections' },
    { label: 'About', path: '/about' },
  ];

  const handleNav = (path: string) => {
    setMobileMenuOpen(false);
    onNavigate(path);
  };

  return (
    <>
    <header className="sticky top-0 z-40 w-full bg-[#F1EEE8]/95 backdrop-blur-sm border-b border-[#171717]/12">
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
            onClick={() => setMobileMenuOpen(true)}
            aria-label="Abrir menu de navegação"
            className="lg:hidden inline-flex items-center justify-center w-10 h-10 -ml-2 text-[#171717] hover:opacity-70 transition-opacity cursor-pointer"
          >
            <Menu className="w-5 h-5" strokeWidth={1.5} />
          </button>

          <nav aria-label="Navegação principal" className="hidden lg:flex items-center gap-6">
            {navLinks.map((item) => {
              const isActive =
                item.path === '/shop'
                  ? currentPath === '/shop'
                  : currentPath.startsWith(item.path.split('?')[0]);
              return (
                <button
                  key={item.label}
                  type="button"
                  onClick={() => handleNav(item.path)}
                  className={`text-[12px] tracking-[0.06em] uppercase whitespace-nowrap shrink-0 pb-0.5 transition-colors cursor-pointer ${
                    isActive
                      ? 'text-[#171717] border-b border-[#171717]'
                      : 'text-[#171717]/75 hover:text-[#171717]'
                  }`}
                >
                  {item.label}
                </button>
              );
            })}
          </nav>
        </div>

        {/* Center: Wordmark COMPLEX */}
        <div className="flex items-center justify-center shrink-0">
          <button
            type="button"
            onClick={() => handleNav('/')}
            aria-label="COMPLEX — Página Inicial"
            className="font-display text-[20px] md:text-[22px] font-extrabold tracking-[-0.04em] text-[#171717] uppercase whitespace-nowrap shrink-0 cursor-pointer"
          >
            COMPLEX
          </button>
        </div>

        {/* Right: Search, Account/Admin, Bag */}
        <div className="flex items-center justify-end gap-3 md:gap-5 flex-1">
          <button
            type="button"
            onClick={openSearch}
            aria-label="Buscar produtos"
            className="inline-flex items-center gap-1.5 text-[12px] tracking-[0.06em] uppercase text-[#171717]/80 hover:text-[#171717] whitespace-nowrap shrink-0 py-2 cursor-pointer"
          >
            <Search className="w-4 h-4" strokeWidth={1.5} />
            <span className="hidden sm:inline">Buscar</span>
          </button>

          <button
            type="button"
            onClick={() => handleNav('/account')}
            aria-label={user ? 'Minha conta' : 'Entrar na conta'}
            className="hidden sm:inline-flex items-center gap-1.5 text-[12px] tracking-[0.06em] uppercase text-[#171717]/80 hover:text-[#171717] whitespace-nowrap shrink-0 py-2 cursor-pointer"
          >
            <User className="w-4 h-4" strokeWidth={1.5} />
            <span>{user ? 'Conta' : 'Entrar'}</span>
          </button>

          {isAdmin && (
            <button
              type="button"
              onClick={() => handleNav('/admin')}
              className="hidden md:inline-flex text-[11px] font-mono-tabular tracking-[0.08em] uppercase text-[#6A705C] hover:text-[#171717] whitespace-nowrap shrink-0 py-2 cursor-pointer"
            >
              Admin
            </button>
          )}

          <button
            type="button"
            onClick={openBag}
            aria-label={`Abrir sacola (${cartCount} itens)`}
            className="inline-flex items-center gap-1.5 text-[12px] tracking-[0.06em] uppercase text-[#171717] hover:opacity-75 whitespace-nowrap shrink-0 py-2 cursor-pointer"
          >
            <ShoppingBag className="w-4 h-4 md:hidden" strokeWidth={1.5} />
            <span className="font-mono-tabular">Sacola ({cartCount})</span>
          </button>
        </div>
      </div>

    </header>

      {/* Mobile Refined Slide-Out Drawer (outside header so backdrop-filter never clips fixed positioning) */}
      {mobileMenuOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Menu de navegação"
          className="fixed inset-0 z-50 lg:hidden flex"
        >
          <div
            className="fixed inset-0 bg-[#171717]/40"
            onClick={() => setMobileMenuOpen(false)}
            aria-hidden="true"
          />
          <aside className="relative z-10 w-80 max-w-[85vw] h-full bg-[#F1EEE8] text-[#171717] flex flex-col justify-between p-6 border-r border-[#171717]/15">
            <div>
              <div className="flex items-center justify-between pb-6 border-b border-[#171717]/12">
                <span className="font-display text-lg font-extrabold tracking-[-0.04em]">
                  COMPLEX
                </span>
                <button
                  type="button"
                  onClick={() => setMobileMenuOpen(false)}
                  aria-label="Fechar menu"
                  className="w-10 h-10 inline-flex items-center justify-center -mr-2 cursor-pointer"
                >
                  <X className="w-5 h-5" strokeWidth={1.5} />
                </button>
              </div>

              <nav className="mt-6 flex flex-col gap-1">
                {navLinks.map((item) => (
                  <button
                    key={item.label}
                    type="button"
                    onClick={() => handleNav(item.path)}
                    className="text-left py-3 text-base font-display font-semibold tracking-tight uppercase border-b border-[#171717]/10 hover:pl-2 transition-all cursor-pointer"
                  >
                    {item.label}
                  </button>
                ))}
                <button
                  type="button"
                  onClick={() => handleNav('/bag')}
                  className="text-left py-3 text-base font-display font-semibold tracking-tight uppercase border-b border-[#171717]/10 cursor-pointer"
                >
                  Sacola ({cartCount})
                </button>
                <button
                  type="button"
                  onClick={() => handleNav('/account')}
                  className="text-left py-3 text-base font-display font-semibold tracking-tight uppercase border-b border-[#171717]/10 cursor-pointer"
                >
                  {user ? 'Minha Conta' : 'Entrar / Cadastro'}
                </button>
                <button
                  type="button"
                  onClick={() => handleNav('/admin')}
                  className="text-left py-3 text-sm font-mono-tabular tracking-[0.08em] uppercase text-[#6A705C] cursor-pointer"
                >
                  Painel Administrativo
                </button>
              </nav>
            </div>

            <div className="pt-6 border-t border-[#171717]/12 text-xs text-[#99968F] space-y-1">
              <p className="font-mono-tabular uppercase tracking-[0.1em]">Coleção 001 / 2026</p>
              <p>Streetwear Contemporâneo</p>
            </div>
          </aside>
        </div>
      )}
    </>
  );
};
