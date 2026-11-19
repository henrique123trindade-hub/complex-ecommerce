/**
 * Registers the static-asset Service Worker cleanly in idle time so it never
 * competes with initial LCP or first user interactions.
 */
export function registerServiceWorker(): void {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator)) {
    return;
  }

  // Only register in production builds so Vite dev server HMR/ESM updates stay untouched
  if (!import.meta.env.PROD) {
    return;
  }

  const doRegister = () => {
    const winWithIdle = window as Window & {
      requestIdleCallback?: (cb: () => void, opts?: { timeout: number }) => number;
    };

    const warmFromLoadedResources = (reg: ServiceWorkerRegistration) => {
      const target = reg.active || navigator.serviceWorker.controller;
      if (!target || typeof performance === 'undefined') return;
      const urls = performance
        .getEntriesByType('resource')
        .map((entry) => entry.name)
        .filter(
          (url) =>
            url.includes('/assets/') ||
            url.startsWith('https://fonts.googleapis.com/') ||
            url.startsWith('https://fonts.gstatic.com/')
        );
      if (urls.length > 0) {
        target.postMessage({ type: 'WARM_CRITICAL_ASSETS', urls });
      }
    };

    const run = () => {
      navigator.serviceWorker
        .register('/sw.js', { scope: '/' })
        .then((registration) => {
          void navigator.serviceWorker.ready.then((readyReg) => {
            warmFromLoadedResources(readyReg || registration);
          });
        })
        .catch(() => {
          // Non-fatal: site works identically without SW if blocked by browser privacy settings
        });
    };

    if (typeof winWithIdle.requestIdleCallback === 'function') {
      winWithIdle.requestIdleCallback(run, { timeout: 3000 });
    } else {
      window.setTimeout(run, 1200);
    }
  };

  if (document.readyState === 'complete') {
    doRegister();
  } else {
    window.addEventListener('load', doRegister, { once: true });
  }
}
