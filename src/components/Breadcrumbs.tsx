import React, { useMemo } from 'react';
import { buildBreadcrumbJsonLd, type BreadcrumbEntry } from '../utils/seo';

interface BreadcrumbsProps {
  items: BreadcrumbEntry[];
  onNavigate: (path: string) => void;
  rightMeta?: string;
  className?: string;
}

export const Breadcrumbs: React.FC<BreadcrumbsProps> = ({
  items,
  onNavigate,
  rightMeta,
  className = '',
}) => {
  const jsonLd = useMemo(() => {
    const origin =
      typeof window !== 'undefined' && window.location?.origin
        ? window.location.origin
        : 'https://complex-ecommerce.vercel.app';
    return buildBreadcrumbJsonLd(items, origin);
  }, [items]);

  if (items.length === 0) return null;

  const handleLinkClick = (e: React.MouseEvent<HTMLAnchorElement>, path: string) => {
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) {
      return;
    }
    e.preventDefault();
    onNavigate(path);
  };

  return (
    <div
      className={`border-b border-[#171717]/10 bg-[#F1EEE8] text-[#99968F] ${className}`}
    >
      <div className="max-w-[1440px] mx-auto px-4 md:px-8 py-3.5 flex items-center justify-between gap-4 font-mono-tabular text-[11px] uppercase tracking-[0.12em]">
        <nav aria-label="Breadcrumb" className="min-w-0 flex-1">
          <ol className="flex items-center gap-2 min-w-0 whitespace-nowrap">
            {items.map((item, idx) => {
              const isLast = idx === items.length - 1;
              return (
                <li
                  key={`${item.path}-${idx}`}
                  className={`inline-flex items-center gap-2 ${
                    isLast ? 'min-w-0' : 'shrink-0'
                  }`}
                >
                  {idx > 0 && (
                    <span aria-hidden="true" className="text-[#99968F]/60 select-none shrink-0">
                      /
                    </span>
                  )}
                  {isLast ? (
                    <span
                      aria-current="page"
                      className="text-[#171717] font-medium truncate"
                    >
                      {item.label}
                    </span>
                  ) : (
                    <a
                      href={item.path}
                      onClick={(e) => handleLinkClick(e, item.path)}
                      className="text-[#99968F] hover:text-[#171717] transition-colors duration-200 underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#171717] shrink-0"
                    >
                      {item.label}
                    </a>
                  )}
                </li>
              );
            })}
          </ol>
        </nav>

        {rightMeta && (
          <span className="hidden sm:inline shrink-0 text-[#99968F]">
            {rightMeta}
          </span>
        )}
      </div>

      <script
        type="application/ld+json"
        data-complex-jsonld="breadcrumb"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
    </div>
  );
};
