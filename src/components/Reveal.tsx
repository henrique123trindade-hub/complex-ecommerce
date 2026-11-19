import React, { useEffect, useRef, useState } from 'react';

interface RevealProps {
  children: React.ReactNode;
  className?: string;
  delayMs?: number;
  as?: 'div' | 'section' | 'article';
}

/**
 * Lightweight IntersectionObserver scroll reveal that uses only GPU-composited
 * transform + opacity transitions, reveals immediately when already in view or
 * when prefers-reduced-motion is enabled, and never blocks interactivity.
 */
export const Reveal: React.FC<RevealProps> = ({
  children,
  className = '',
  delayMs = 0,
  as = 'div',
}) => {
  const ref = useRef<HTMLDivElement>(null);
  const [revealed, setRevealed] = useState<boolean>(() => {
    if (typeof window === 'undefined') return true;
    return (
      typeof window.IntersectionObserver !== 'function' ||
      window.matchMedia('(prefers-reduced-motion: reduce)').matches
    );
  });

  useEffect(() => {
    if (revealed) return;
    const node = ref.current;
    if (!node) {
      setRevealed(true);
      return;
    }

    const rect = node.getBoundingClientRect();
    if (rect.top < window.innerHeight * 0.96) {
      setRevealed(true);
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setRevealed(true);
            observer.disconnect();
            break;
          }
        }
      },
      { rootMargin: '0px 0px -6% 0px', threshold: 0.04 }
    );

    observer.observe(node);
    return () => observer.disconnect();
  }, [revealed]);

  const Component = as;
  const style = delayMs > 0 ? { transitionDelay: `${delayMs}ms` } : undefined;

  return (
    <Component
      ref={ref as React.RefObject<HTMLDivElement>}
      data-revealed={revealed ? 'true' : 'false'}
      style={style}
      className={`reveal-section ${className}`}
    >
      {children}
    </Component>
  );
};
