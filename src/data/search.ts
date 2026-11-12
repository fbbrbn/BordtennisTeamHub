/**
 * The advanced search (pages/SearchPage.tsx): every pool, team and player of the season, narrowed by
 * union, age group and league ("række", the portal's three levels) and by words.
 */
import type { IndexTeam, NamedId, PlayerEntry, PoolRef } from './model.ts';

/** Lower case without accents, for matching: "Søren Ærø" -> "søren ærø" (ø and æ stay, é becomes e). */
export const fold = (s: string) => s.toLocaleLowerCase('da').normalize('NFKD').replace(/[̀-ͯ]/g, '');

/** Every word of the query is somewhere in the text, in any order. An empty query matches everything. */
export function matchesWords(text: string, query: string): boolean {
  const words = fold(query).split(/\s+/).filter(Boolean);
  const haystack = fold(text);
  return words.every((w) => haystack.includes(w));
}

export interface SearchFilters {
  /** Union (region) id, or '' for all. */
  union: string;
  /** Age group id, or ''. */
  age: string;
  /** League name ("Serie 4"), or ''. */
  league: string;
  query: string;
}

export const NO_FILTERS: SearchFilters = { union: '', age: '', league: '', query: '' };

const inUnionAndAge = (pool: PoolRef, union: string, age: string) => (!union || pool.regionId === union) && (!age || pool.ageGroupId === age);

/** The age groups with pools in the union (all unions when none is chosen), in the index's order. */
export function ageGroupsIn(pools: readonly PoolRef[], ageGroups: readonly NamedId[], union: string): NamedId[] {
  const used = new Set(pools.filter((p) => inUnionAndAge(p, union, '')).map((p) => p.ageGroupId));
  return ageGroups.filter((a) => used.has(a.id));
}

/** The leagues of the union and age group, each once, in the portal's order: from the top down. */
export function leaguesIn(pools: readonly PoolRef[], union: string, age: string): string[] {
  return [...new Set(pools.filter((p) => inUnionAndAge(p, union, age) && p.division).map((p) => p.division!))];
}

export interface PoolHit {
  pool: PoolRef;
  /** The average official rating of the pool's rated players, once the player list is loaded. */
  average: number | null;
}

export interface TeamHit {
  team: IndexTeam;
  pool: PoolRef;
}

export interface PlayerHit {
  player: PlayerEntry;
  team: IndexTeam;
  pool: PoolRef;
}

export interface SearchResults {
  pools: PoolHit[];
  teams: TeamHit[];
  /** Null until the player list is loaded. */
  players: PlayerHit[] | null;
  /** Whether the results span several unions or age groups, so rows need to say which. */
  manyUnions: boolean;
  manyAgeGroups: boolean;
}

/**
 * The pools, teams and players that match. Union, age group and league narrow the pools; the words
 * then match a pool by its name or any of its teams, a team by its name, club or pool, and a player
 * by their name, team or club. Pools keep the index's order, teams follow their pool and place, and
 * players come by rating, highest first.
 */
export function search(pools: readonly PoolRef[], players: readonly PlayerEntry[] | null, filters: SearchFilters): SearchResults {
  const chosen = pools.filter((p) => inUnionAndAge(p, filters.union, filters.age) && (!filters.league || p.division === filters.league));
  const byId = new Map(chosen.map((p) => [p.id, p]));
  const q = filters.query.trim();

  // Average rating per pool, from the player list: every rated player listed on one of its teams.
  const sums = new Map<string, { sum: number; count: number }>();
  for (const player of players ?? []) {
    if (player.rating === null) continue;
    for (const poolId of new Set(player.teams.map(([p]) => p))) {
      if (!byId.has(poolId)) continue;
      const s = sums.get(poolId) ?? { sum: 0, count: 0 };
      s.sum += player.rating;
      s.count++;
      sums.set(poolId, s);
    }
  }
  const average = (id: string) => {
    const s = sums.get(id);
    return s && s.count > 0 ? Math.round(s.sum / s.count) : null;
  };

  const teamText = (team: IndexTeam, pool: PoolRef) => `${team.name} ${team.club ?? ''} ${pool.name}`;
  const poolHits = chosen
    .filter((pool) => !q || matchesWords(`${pool.name} ${pool.division ?? ''} ${pool.league}`, q) || pool.teams.some((t) => matchesWords(`${t.name} ${t.club ?? ''}`, q)))
    .map((pool) => ({ pool, average: players ? average(pool.id) : null }));

  const order = new Map(chosen.map((p, i) => [p.id, i]));
  const teamHits = chosen
    .flatMap((pool) => pool.teams.map((team) => ({ team, pool })))
    .filter(({ team, pool }) => !q || matchesWords(teamText(team, pool), q))
    .sort(
      (a, b) =>
        order.get(a.pool.id)! - order.get(b.pool.id)! ||
        (a.team.position ?? Infinity) - (b.team.position ?? Infinity) ||
        a.team.name.localeCompare(b.team.name, 'da', { numeric: true }),
    );

  let playerHits: PlayerHit[] | null = null;
  if (players) {
    playerHits = [];
    for (const player of players) {
      for (const [poolId, teamId] of player.teams) {
        const pool = byId.get(poolId);
        const team = pool?.teams.find((t) => t.id === teamId);
        if (!pool || !team) continue;
        if (q && !matchesWords(`${player.name} ${team.name} ${team.club ?? ''}`, q)) continue;
        playerHits.push({ player, team, pool });
      }
    }
    playerHits.sort(
      (a, b) => (b.player.rating ?? -Infinity) - (a.player.rating ?? -Infinity) || a.player.name.localeCompare(b.player.name, 'da'),
    );
  }

  return {
    pools: poolHits,
    teams: teamHits,
    players: playerHits,
    manyUnions: new Set(chosen.map((p) => p.regionId)).size > 1,
    manyAgeGroups: new Set(chosen.map((p) => p.ageGroupId)).size > 1,
  };
}
