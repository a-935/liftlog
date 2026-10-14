import { useSyncExternalStore } from 'react';

// Tiny hash router: works on any static host (GitHub Pages) and inside the iOS standalone app.

export type Route =
  | { name: 'home' }
  | { name: 'new' }
  | { name: 'workout'; id: string }
  | { name: 'summary'; id: string }
  | { name: 'history' }
  | { name: 'progress'; tab: 'exercise' | 'compare'; id?: string }
  | { name: 'exercises' }
  | { name: 'settings' };

export const currentPath = () => location.hash.replace(/^#/, '') || '/';

export function parseRoute(path: string): Route {
  const [a, b, c] = path.split('/').filter(Boolean);
  switch (a) {
    case 'new':
      return { name: 'new' };
    case 'workout':
      return b ? { name: 'workout', id: b } : { name: 'home' };
    case 'summary':
      return b ? { name: 'summary', id: b } : { name: 'home' };
    case 'history':
      return { name: 'history' };
    case 'progress':
      return { name: 'progress', tab: b === 'compare' ? 'compare' : 'exercise', id: c };
    case 'exercises':
      return { name: 'exercises' };
    case 'settings':
      return { name: 'settings' };
    default:
      return { name: 'home' };
  }
}

function subscribe(cb: () => void) {
  window.addEventListener('hashchange', cb);
  return () => window.removeEventListener('hashchange', cb);
}

export function usePath(): string {
  return useSyncExternalStore(subscribe, currentPath);
}

export function navigate(path: string, opts: { replace?: boolean } = {}) {
  if (opts.replace) {
    history.replaceState(null, '', `#${path}`);
    window.dispatchEvent(new HashChangeEvent('hashchange'));
  } else {
    location.hash = path;
  }
}
