import { useEffect, useState } from 'react';
import type { DataIndex, PlayerIndex, PoolData } from './model';

const cache = new Map<string, Promise<unknown>>();

/** Relative URLs: the site may live under /<repo>/ on GitHub Pages. */
function getJson<T>(path: string): Promise<T> {
  let request = cache.get(path) as Promise<T> | undefined;
  if (!request) {
    request = fetch(path).then((response) => {
      if (!response.ok) throw new Error(response.status === 404 ? 'not-found' : `HTTP ${response.status}`);
      return response.json() as Promise<T>;
    });
    request.catch(() => cache.delete(path));
    cache.set(path, request);
  }
  return request;
}

export const loadIndex = () => getJson<DataIndex>('data/index.json');
export const loadPlayers = () => getJson<PlayerIndex>('data/players.json');
export const loadPool = (poolId: string) => getJson<PoolData>(`data/pools/${encodeURIComponent(poolId)}.json`);

export type Loaded<T> = { status: 'loading' } | { status: 'error'; error: string } | { status: 'ready'; data: T };

export function useLoaded<T>(load: () => Promise<T>, key: string): Loaded<T> {
  const [state, setState] = useState<{ key: string; value: Loaded<T> }>({ key, value: { status: 'loading' } });
  useEffect(() => {
    let cancelled = false;
    load().then(
      (data) => !cancelled && setState({ key, value: { status: 'ready', data } }),
      (error: unknown) => !cancelled && setState({ key, value: { status: 'error', error: error instanceof Error ? error.message : String(error) } }),
    );
    return () => {
      cancelled = true;
    };
    // `key` identifies the request; `load` is recreated on every render, so it is not a dependency.
  }, [key]);
  return state.key === key ? state.value : { status: 'loading' };
}
