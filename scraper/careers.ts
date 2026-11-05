/**
 * Players' seasons, for the player page: one entry per team a player played for. The history job
 * keeps past seasons in `players/<shard>.json` on the history branch; the season import keeps the
 * current one in `data/careers/<shard>.json`. The shard is the last three digits of the player
 * id, so a player page loads one small file (about 30 KB with every season).
 */
import type { CareerEntry, CareerShard, PoolData } from '../src/data/model.ts';
import { teamPlayerLines } from '../src/data/stats.ts';

export function shardOf(playerId: string): string {
  return playerId.slice(-3).padStart(3, '0');
}

/** Every player who played in the pool, with their line for the team they played for. */
export function careerEntries(pool: PoolData): [string, CareerEntry][] {
  const rating = new Map(pool.players.map((p) => [p.id, p.rating]));
  const from = pool.matches.map((m) => m.date.slice(0, 10)).sort()[0] ?? '';
  return pool.teams.flatMap((team) =>
    teamPlayerLines(pool, team.id).map((line): [string, CareerEntry] => [
      line.playerId,
      {
        seasonId: pool.pool.seasonId,
        season: pool.pool.season,
        poolId: pool.pool.id,
        pool: pool.pool.name,
        from,
        league: pool.pool.league,
        teamId: team.id,
        team: team.name,
        club: team.club ?? null,
        matches: line.matches,
        singles: [line.singles.won, line.singles.lost],
        doubles: [line.doubles.won, line.doubles.lost],
        rating: rating.get(line.playerId) ?? null,
      },
    ]),
  );
}

/** All entries, grouped into shards; each player's entries newest season first. */
export function careerShards(pools: Iterable<PoolData>): Map<string, CareerShard> {
  const shards = new Map<string, CareerShard>();
  for (const pool of pools) {
    for (const [id, entry] of careerEntries(pool)) {
      const key = shardOf(id);
      const shard = shards.get(key) ?? { version: 1, players: {} };
      (shard.players[id] ??= []).push(entry);
      shards.set(key, shard);
    }
  }
  for (const shard of shards.values()) {
    for (const entries of Object.values(shard.players)) {
      entries.sort((a, b) => b.seasonId.localeCompare(a.seasonId) || b.from.localeCompare(a.from) || a.pool.localeCompare(b.pool, 'da', { numeric: true }));
    }
  }
  return shards;
}
