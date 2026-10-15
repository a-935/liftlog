import { Workbox } from 'workbox-window';

// Service worker registration with reliable updates on iOS.
// Home Screen apps are often resumed rather than relaunched, so we check for a new
// version whenever the app comes back to the foreground. The new service worker takes
// over immediately (skipWaiting), and the page reloads to use it as soon as that can't
// interrupt anything. All data is saved continuously, so a reload never loses work.

const isEditing = () => {
  const el = document.activeElement;
  return !!el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT');
};

const canReloadNow = () =>
  !isEditing() && !location.hash.startsWith('#/summary') && !document.documentElement.classList.contains('sheet-open');

function reloadWhenSafe() {
  if (canReloadNow()) {
    location.reload();
    return;
  }
  // Needs to stay safe for two checks in a row, so it never fires right after a tap.
  let safeChecks = 0;
  const id = window.setInterval(() => {
    safeChecks = canReloadNow() ? safeChecks + 1 : 0;
    if (safeChecks >= 2) {
      window.clearInterval(id);
      location.reload();
    }
  }, 1500);
}

export function registerServiceWorker() {
  if (!import.meta.env.PROD || !('serviceWorker' in navigator)) return;
  const base = import.meta.env.BASE_URL;
  const wb = new Workbox(`${base}sw.js`, { scope: base });

  wb.addEventListener('controlling', (event) => {
    if (event.isUpdate) reloadWhenSafe();
  });

  void wb.register().then((registration) => {
    if (!registration) return;
    const check = () => {
      if (navigator.onLine) registration.update().catch(() => {});
    };
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') check();
    });
    window.setInterval(check, 60 * 60 * 1000);
  });
}
