import { useEffect, useState } from 'react';

/**
 * Coordinates smooth mount -> enter -> exit -> unmount transitions,
 * Escape-to-close keyboard handling, and body scroll lock for drawers/modals.
 */
export function useAnimatedDisclosure(
  open: boolean,
  onClose: () => void,
  exitDurationMs = 260
): { mounted: boolean; visible: boolean } {
  const [mounted, setMounted] = useState(open);
  const [visible, setVisible] = useState(open);

  useEffect(() => {
    const reduced =
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    if (open) {
      setMounted(true);
      if (reduced) {
        setVisible(true);
        return;
      }
      let raf2 = 0;
      const raf1 = window.requestAnimationFrame(() => {
        raf2 = window.requestAnimationFrame(() => {
          setVisible(true);
        });
      });
      return () => {
        window.cancelAnimationFrame(raf1);
        window.cancelAnimationFrame(raf2);
      };
    }

    setVisible(false);
    if (reduced) {
      setMounted(false);
      return;
    }

    const timer = window.setTimeout(() => {
      setMounted(false);
    }, exitDurationMs);
    return () => window.clearTimeout(timer);
  }, [open, exitDurationMs]);

  useEffect(() => {
    if (!mounted) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [mounted, onClose]);

  useEffect(() => {
    if (!mounted) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prevOverflow;
    };
  }, [mounted]);

  return { mounted, visible };
}
