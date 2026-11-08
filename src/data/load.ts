import { useEffect, useState } from 'react';
import { headToHeadShard, playerHeadToHead, type HeadToHeadIndex } from './headtohead';
import type { CareerEntry, CareerShard, DataIndex, HeadToHeadShard, PlayerIndex, PoolData } from './model';

const cache = new Map<string, Promise<unknown>>();

/** Relative URLs: the site may live under /<repo>/ on GitHub Pages. */
function getJson<T>(path: string): Promise<T> {
  let request = cache.get(path) as Promise<T> | undefined;
  if (!request) {
    request = fetch(path).then((response) => {
      if (!response.ok) throw new Error(response.status === 404 ? 'not-found' : `HTTP ${response.status}`);
      // Dev servers answer a missing file with the app's own page.
      if (!(response.headers.get('content-type') ?? '').includes('json')) throw new Error('not-found');
      return response.json() as Promise<T>;
    });
    request.catch(() => cache.delete(path));
    cache.set(path, request);
  }
  return request;
}

export const loadIndex = () => getJson<DataIndex>('data/index.json');
export const loadPlayers = () => getJson<PlayerIndex>('data/players.json');
/** A pool of the current season, or else of a past season (then marked `past`). */
export function loadPool(poolId: string): Promise<PoolData> {
  const id = encodeURIComponent(poolId);
  return getJson<PoolData>(`data/pools/${id}.json`).catch((error: unknown) => {
    if (!(error instanceof Error) || error.message !== 'not-found') throw error;
    return getJson<PoolData>(`history/pools/${id}.json`).then((data) => {
      data.pool.past = true;
      return data;
    });
  });
}

/** Every season a player played, this one included: one entry per team, newest first. */
export function loadHistory(playerId: string): Promise<CareerEntry[]> {
  // The same file name as scraper/careers.ts: the id's last three digits.
  const shard = playerId.slice(-3).padStart(3, '0');
  const entries = (path: string) =>
    getJson<CareerShard>(path).then(
      (data) => data.players[playerId] ?? [],
      () => [],
    );
  return Promise.all([entries(`data/careers/${shard}.json`), entries(`history/players/${shard}.json`)]).then(([current, past]) =>
    [...current, ...past].sort((a, b) => b.seasonId.localeCompare(a.seasonId) || b.from.localeCompare(a.from)),
  );
}

/**
 * The head-to-head records of these players, this season's and past seasons' added up, and the
 * earliest season counted ("2019/2020"; empty when there are no files).
 */
export function loadHeadToHead(playerIds: readonly string[]): Promise<{ records: HeadToHeadIndex; from: string }> {
  const shards = [...new Set(playerIds.map(headToHeadShard))];
  const file = (path: string) => getJson<HeadToHeadShard>(path).catch(() => null);
  return Promise.all(shards.map((s) => Promise.all([file(`data/h2h/${s}.json`), file(`history/h2h/${s}.json`)]))).then((pairs) => {
    const files = new Map(shards.map((s, i) => [s, pairs[i]]));
    const records: HeadToHeadIndex = new Map(playerIds.map((id) => [id, playerHeadToHead(files.get(headToHeadShard(id))!, id)]));
    const from = pairs.flat().reduce((first, f) => (f?.from && (!first || f.from < first) ? f.from : first), '');
    return { records, from };
  });
}

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
