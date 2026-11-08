/**
 * Head-to-head records: every singles game between two players, across pools and seasons. The
 * importer writes the current season's (data/h2h/), the history job the past seasons'
 * (history/h2h/), in files named by the last three digits of the player id. The match preview loads
 * the files of its players and adds the two up.
 */
import type { HeadToHead, HeadToHeadShard, PoolData } from './model.ts';

/** By player id, then by opponent id. */
export type HeadToHeadIndex = Map<string, Map<string, HeadToHead>>;

/** The file a player's records are in: the last three digits of the id, as for the careers. */
export function headToHeadShard(playerId: string): string {
  return playerId.slice(-3).padStart(3, '0');
}

/** Every singles game between two players in the pools, from both sides. Walkovers do not count. */
export function headToHeadOf(pools: Iterable<PoolData>): HeadToHeadIndex {
  const index: HeadToHeadIndex = new Map();
  const add = (player: string, opponent: string, won: boolean, day: string) => {
    const records = index.get(player) ?? new Map<string, HeadToHead>();
    records.set(opponent, mergeHeadToHead(records.get(opponent), [won ? 1 : 0, won ? 0 : 1, day, won ? 1 : 0]));
    index.set(player, records);
  };
  for (const pool of pools) {
    for (const match of pool.matches) {
      const day = match.date.slice(0, 10);
      for (const g of match.games ?? []) {
        if (g.kind !== 'single' || g.walkover || !g.winner || g.home.length !== 1 || g.away.length !== 1) continue;
        add(g.home[0], g.away[0], g.winner === 'home', day);
        add(g.away[0], g.home[0], g.winner === 'away', day);
      }
    }
  }
  return index;
}

/** Two records of the same pair as one: the games added up, and the later of the last meetings. */
export function mergeHeadToHead(a: HeadToHead | undefined, b: HeadToHead): HeadToHead {
  if (!a) return [...b];
  const last = b[2] >= a[2] ? b : a;
  return [a[0] + b[0], a[1] + b[1], last[2], last[3]];
}

/** The records grouped into files (`headToHeadShard`); `from` is the earliest season counted. */
export function headToHeadShards(index: HeadToHeadIndex, from: string): Map<string, HeadToHeadShard> {
  const shards = new Map<string, HeadToHeadShard>();
  for (const id of [...index.keys()].sort()) {
    const key = headToHeadShard(id);
    const shard = shards.get(key) ?? { version: 1, from, players: {} };
    shard.players[id] = Object.fromEntries([...index.get(id)!].sort(([a], [b]) => a.localeCompare(b)));
    shards.set(key, shard);
  }
  return shards;
}

/** The earliest season of the pools, e.g. "2019/2020"; empty without pools. */
export function earliestSeason(pools: Iterable<PoolData>): string {
  let first: PoolData['pool'] | null = null;
  for (const { pool } of pools) if (!first || pool.seasonId < first.seasonId) first = pool;
  return first?.season ?? '';
}

/** A player's records in several files (this season's and past seasons'), added up. */
export function playerHeadToHead(shards: readonly (HeadToHeadShard | null)[], playerId: string): Map<string, HeadToHead> {
  const records = new Map<string, HeadToHead>();
  for (const shard of shards) {
    for (const [opponent, record] of Object.entries(shard?.players[playerId] ?? {})) {
      records.set(opponent, mergeHeadToHead(records.get(opponent), record));
    }
  }
  return records;
}
