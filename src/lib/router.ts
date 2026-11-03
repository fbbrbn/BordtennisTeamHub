import { useEffect, useState } from 'react';

/** Hash routes (`#/lineup/my-team?plan=...`) work on GitHub Pages without any server setup. */
export interface Route {
  path: string[];
  query: URLSearchParams;
}

export function parseHash(hash: string): Route {
  const raw = hash.replace(/^#\/?/, '');
  const [pathPart, queryPart = ''] = raw.split('?');
  const path = pathPart
    .split('/')
    .filter(Boolean)
    .map((segment) => {
      try {
        return decodeURIComponent(segment);
      } catch {
        return segment;
      }
    });
  return { path, query: new URLSearchParams(queryPart) };
}

export function useRoute(): Route {
  const [route, setRoute] = useState(() => parseHash(window.location.hash));
  useEffect(() => {
    let lastPath = parseHash(window.location.hash).path.join('/');
    const onChange = () => {
      const next = parseHash(window.location.hash);
      setRoute(next);
      // A new page starts at the top; switching a tab on the same page keeps the position.
      const path = next.path.join('/');
      if (path !== lastPath) window.scrollTo(0, 0);
      lastPath = path;
    };
    window.addEventListener('hashchange', onChange);
    return () => window.removeEventListener('hashchange', onChange);
  }, []);
  return route;
}

/** Back to the previous page, or home when this page was opened directly. */
export function goBack(): void {
  if (window.history.length > 1) window.history.back();
  else window.location.hash = '#/';
}

export function href(...segments: string[]): string {
  return '#/' + segments.map(encodeURIComponent).join('/');
}

/** Changes the address bar without adding a history entry or firing `hashchange`. */
export function replaceHash(hash: string): void {
  window.history.replaceState(null, '', hash);
}
