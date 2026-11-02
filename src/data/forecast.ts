/**
 * Match forecasts. Two independent estimates, combined into one set of odds:
 *
 *  1. Player ratings. Every game of a team match (all singles pairings plus one
 *     doubles) gets a win chance from the rating difference, using a logistic curve
 *     calibrated on the pool's own singles results. The exact distribution of games
 *     won then gives the chances of a win, a draw and a loss.
 *  2. Common opponents. Compare how both teams did against the same teams (and
 *     against each other, if they already met). If we beat C 6-4 and they lost to
 *     C 3-7, we were 6 games better against C.
 *
 * These are estimates, not data: the UI always says so and shows the reasons.
 */
import type { PoolData, TeamMatch } from './model';
import { isHome, scoreFor, teamMatches } from './stats';

export interface Odds {
  win: number;
  draw: number;
  loss: number;
  /** Expected games won. */
  expectedGames: number;
  totalGames: number;
}

export interface RatingForecast {
  odds: Odds;
  /** singles[i][j]: chance that our player i beats their player j. */
  singles: number[][];
  doubles: number;
  team: string[];
  opponent: string[];
  teamAverage: number;
  opponentAverage: number;
}

export interface CommonRow {
  opponentId: string;
  /** Our results against this opponent, games for and against. */
  ours: [number, number][];
  /** Their results against this opponent. */
  theirs: [number, number][];
  /** Average margin difference: positive means we did better. */
  difference: number;
}

export interface CommonForecast {
  rows: CommonRow[];
  /** Earlier results between the two teams, from our side. */
  direct: [number, number][];
  /** Expected game margin for us (games won minus lost); null without any comparison. */
  margin: number | null;
  odds: Odds | null;
}

/** Rating-based odds, averaged over one or more possible lineups per side. */
export interface RatingSummary {
  odds: Odds;
  teamAverage: number;
  opponentAverage: number;
  /** Lineups averaged on each side: 1 means a specific lineup. */
  teamLineups: number;
  opponentLineups: number;
  /** The lineup used for our side when it is a specific one. */
  team: string[] | null;
}

export interface MatchForecast {
  teamId: string;
  opponentId: string;
  rating: RatingSummary | null;
  common: CommonForecast;
  /** Combined odds from both estimates. */
  odds: Odds | null;
}

export const DEFAULT_SCALE = 300;

/** Chance that a player rated `a` beats one rated `b`. */
export function winChance(a: number, b: number, scale: number): number {
  return 1 / (1 + 10 ** (-(a - b) / scale));
}

/** Probability of winning exactly k of the games, for k = 0..n (games independent). */
export function winDistribution(chances: number[]): number[] {
  let dist = [1];
  for (const p of chances) {
    const next = new Array<number>(dist.length + 1).fill(0);
    dist.forEach((q, k) => {
      next[k] += q * (1 - p);
      next[k + 1] += q * p;
    });
    dist = next;
  }
  return dist;
}

export function oddsFromGames(chances: number[]): Odds {
  const dist = winDistribution(chances);
  const n = chances.length;
  let win = 0;
  let draw = 0;
  dist.forEach((q, k) => {
    if (2 * k > n) win += q;
    else if (2 * k === n) draw += q;
  });
  return { win, draw, loss: Math.max(0, 1 - win - draw), expectedGames: chances.reduce((a, b) => a + b, 0), totalGames: n };
}

/** Logistic scale that best explains the pool's singles results (max likelihood, weak prior around 300). */
export function fitScale(pool: PoolData): number {
  const rating = new Map(pool.players.map((p) => [p.id, p.rating]));
  const games: { diff: number; won: boolean }[] = [];
  for (const match of pool.matches) {
    for (const g of match.games ?? []) {
      if (g.kind !== 'single' || g.walkover || !g.winner) continue;
      const a = rating.get(g.home[0]);
      const b = rating.get(g.away[0]);
      if (a == null || b == null) continue;
      games.push({ diff: a - b, won: g.winner === 'home' });
    }
  }
  if (games.length < 20) return DEFAULT_SCALE;
  let best = DEFAULT_SCALE;
  let bestScore = -Infinity;
  for (let s = 100; s <= 1000; s += 5) {
    let ll = -((Math.log(s / DEFAULT_SCALE) ** 2) / (2 * 0.6 ** 2));
    for (const g of games) {
      const p = winChance(g.diff, 0, s);
      ll += Math.log(g.won ? p : 1 - p);
    }
    if (ll > bestScore) {
      bestScore = ll;
      best = s;
    }
  }
  return best;
}

/** Ratings by player id, with the pool median standing in for unrated players. */
export function ratingsOf(pool: PoolData): (playerId: string) => number {
  const known = pool.players.map((p) => p.rating).filter((r): r is number => r !== null).sort((a, b) => a - b);
  const median = known.length > 0 ? known[Math.floor(known.length / 2)] : 1000;
  const map = new Map(pool.players.map((p) => [p.id, p.rating ?? median]));
  return (id) => map.get(id) ?? median;
}

/** The players a team has used most: most matches first, then most recent, then highest rated. */
export function usualLineup(pool: PoolData, teamId: string, size = lineupSize(pool)): string[] {
  const count = new Map<string, number>();
  const last = new Map<string, string>();
  for (const match of teamMatches(pool, teamId)) {
    const ids = new Set<string>();
    for (const g of match.games ?? []) for (const id of isHome(match, teamId) ? g.home : g.away) ids.add(id);
    for (const id of ids) {
      count.set(id, (count.get(id) ?? 0) + 1);
      last.set(id, match.date);
    }
  }
  const rating = ratingsOf(pool);
  return [...count.keys()]
    .sort(
      (a, b) =>
        (count.get(b) ?? 0) - (count.get(a) ?? 0) ||
        (last.get(b) ?? '').localeCompare(last.get(a) ?? '') ||
        rating(b) - rating(a),
    )
    .slice(0, size);
}

/** Everyone who played for a team in this pool (most matches first), plus players the portal lists on it. */
export function teamRoster(pool: PoolData, teamId: string): string[] {
  const appearances = new Map<string, number>();
  for (const match of teamMatches(pool, teamId)) {
    const ids = new Set<string>();
    for (const g of match.games ?? []) for (const id of isHome(match, teamId) ? g.home : g.away) ids.add(id);
    for (const id of ids) appearances.set(id, (appearances.get(id) ?? 0) + 1);
  }
  for (const p of pool.players) if (p.teamId === teamId && !appearances.has(p.id)) appearances.set(p.id, 0);
  return [...appearances].sort((a, b) => b[1] - a[1]).map(([id]) => id);
}

/** Players per side in this pool's matches (3 in most series). */
export function lineupSize(pool: PoolData): number {
  for (const match of pool.matches) {
    const singles = match.games?.filter((g) => g.kind === 'single') ?? [];
    if (singles.length > 0) return Math.max(1, Math.round(Math.sqrt(singles.length)));
  }
  return 3;
}

/** Games per team match in this pool (10 in most series: 9 singles and 1 doubles). */
export function gamesPerMatch(pool: PoolData): number {
  const counts = pool.matches.filter((m) => m.score).map((m) => m.score![0] + m.score![1]);
  if (counts.length === 0) return 10;
  const freq = new Map<number, number>();
  for (const c of counts) freq.set(c, (freq.get(c) ?? 0) + 1);
  return [...freq].sort((a, b) => b[1] - a[1])[0][0];
}

/** Every lineup a team fielded this season (one per played match), with how often each was used. */
export function fieldedLineups(pool: PoolData, teamId: string): { ids: string[]; weight: number }[] {
  const byKey = new Map<string, { ids: string[]; weight: number }>();
  for (const match of teamMatches(pool, teamId)) {
    const singles = match.games?.filter((g) => g.kind === 'single') ?? [];
    const ids = [...new Set(singles.flatMap((g) => (isHome(match, teamId) ? g.home : g.away)))];
    if (ids.length === 0) continue;
    const key = [...ids].sort().join('+');
    const entry = byKey.get(key) ?? { ids, weight: 0 };
    entry.weight++;
    byKey.set(key, entry);
  }
  return [...byKey.values()];
}

/**
 * Rating odds averaged over possible lineups. A side given as one specific lineup uses
 * just that; otherwise every lineup the team fielded this season counts, weighted by use.
 */
export function ratingSummary(
  pool: PoolData,
  teamId: string,
  opponentId: string,
  scale: number,
  lineups: { team?: string[]; opponent?: string[] } = {},
): RatingSummary | null {
  const options = (id: string, given?: string[]) => {
    if (given) return [{ ids: given, weight: 1 }];
    const fielded = fieldedLineups(pool, id);
    if (fielded.length > 0) return fielded;
    const usual = usualLineup(pool, id);
    return usual.length > 0 ? [{ ids: usual, weight: 1 }] : [];
  };
  const ours = options(teamId, lineups.team);
  const theirs = options(opponentId, lineups.opponent);
  const rating = ratingsOf(pool);
  let total = 0;
  const sum = { win: 0, draw: 0, loss: 0, expectedGames: 0 };
  let totalGames = 0;
  for (const a of ours) {
    for (const b of theirs) {
      const f = ratingForecast(pool, a.ids, b.ids, scale);
      if (!f) continue;
      const w = a.weight * b.weight;
      total += w;
      sum.win += w * f.odds.win;
      sum.draw += w * f.odds.draw;
      sum.loss += w * f.odds.loss;
      sum.expectedGames += w * f.odds.expectedGames;
      totalGames = f.odds.totalGames;
    }
  }
  if (total === 0) return null;
  const weightedAverage = (list: { ids: string[]; weight: number }[]) =>
    list.reduce((acc, l) => acc + l.weight * average(l.ids.map(rating)), 0) / list.reduce((acc, l) => acc + l.weight, 0);
  return {
    odds: { win: sum.win / total, draw: sum.draw / total, loss: sum.loss / total, expectedGames: sum.expectedGames / total, totalGames },
    teamAverage: weightedAverage(ours),
    opponentAverage: weightedAverage(theirs),
    teamLineups: ours.length,
    opponentLineups: theirs.length,
    team: ours.length === 1 ? ours[0].ids : null,
  };
}

export function ratingForecast(pool: PoolData, team: string[], opponent: string[], scale: number): RatingForecast | null {
  if (team.length === 0 || opponent.length === 0) return null;
  const rating = ratingsOf(pool);
  const singles = team.map((a) => opponent.map((b) => winChance(rating(a), rating(b), scale)));
  const teamAverage = average(team.map(rating));
  const opponentAverage = average(opponent.map(rating));
  const doubles = winChance(teamAverage, opponentAverage, scale);
  return { odds: oddsFromGames([...singles.flat(), doubles]), singles, doubles, team, opponent, teamAverage, opponentAverage };
}

export function commonOpponentForecast(pool: PoolData, teamId: string, opponentId: string): CommonForecast {
  const results = (id: string) => {
    const byOpponent = new Map<string, [number, number][]>();
    for (const match of teamMatches(pool, id)) {
      const score = scoreFor(match, id);
      if (!score) continue;
      const other = isHome(match, id) ? match.awayTeamId : match.homeTeamId;
      byOpponent.set(other, [...(byOpponent.get(other) ?? []), score]);
    }
    return byOpponent;
  };
  const ours = results(teamId);
  const theirs = results(opponentId);
  const margin = (list: [number, number][]) => average(list.map(([f, a]) => f - a));

  const rows: CommonRow[] = [];
  for (const [other, ourList] of ours) {
    const theirList = theirs.get(other);
    if (other === opponentId || !theirList) continue;
    rows.push({ opponentId: other, ours: ourList, theirs: theirList, difference: margin(ourList) - margin(theirList) });
  }
  const direct = ours.get(opponentId) ?? [];
  const estimates = [...rows.map((r) => r.difference), ...direct.map(([f, a]) => f - a)];
  if (estimates.length === 0) return { rows, direct, margin: null, odds: null };

  const expected = average(estimates);
  const games = gamesPerMatch(pool);
  // Margin m over n games means winning (n + m) / 2 of them; fewer comparisons pull it towards even.
  const share = clamp(0.5 + expected / (2 * games), 0.05, 0.95);
  const shrunk = 0.5 + (share - 0.5) * (estimates.length / (estimates.length + 1));
  return { rows, direct, margin: expected, odds: oddsFromGames(new Array(games).fill(shrunk)) };
}

export function combineOdds(list: (Odds | null)[]): Odds | null {
  const present = list.filter((o): o is Odds => o !== null);
  if (present.length === 0) return null;
  return {
    win: average(present.map((o) => o.win)),
    draw: average(present.map((o) => o.draw)),
    loss: average(present.map((o) => o.loss)),
    expectedGames: average(present.map((o) => o.expectedGames)),
    totalGames: present[0].totalGames,
  };
}

export function forecastMatch(
  pool: PoolData,
  match: TeamMatch,
  teamId: string,
  scale: number,
  lineups: { team?: string[]; opponent?: string[] } = {},
): MatchForecast {
  const opponentId = isHome(match, teamId) ? match.awayTeamId : match.homeTeamId;
  const rating = ratingSummary(pool, teamId, opponentId, scale, lineups);
  const common = commonOpponentForecast(pool, teamId, opponentId);
  return { teamId, opponentId, rating, common, odds: combineOdds([rating?.odds ?? null, common.odds]) };
}

export interface Projection {
  teamId: string;
  points: number;
  /** Current points plus expected points from the remaining matches. */
  projected: number;
  remaining: number;
  /** Remaining matches where a win is more likely than a loss. */
  favourite: number;
  rank: number;
}

/** Expected final points for every team: 2 per win and 1 per draw, weighted by the odds. */
export function projectTable(pool: PoolData, scale: number): Projection[] {
  const rows = pool.teams.map((team) => {
    const points = pool.standings.find((s) => s.teamId === team.id)?.points ?? 0;
    let projected = points;
    let remaining = 0;
    let favourite = 0;
    for (const match of teamMatches(pool, team.id)) {
      if (match.score) continue;
      remaining++;
      const odds = forecastMatch(pool, match, team.id, scale).odds;
      if (!odds) {
        projected += 1;
        continue;
      }
      projected += 2 * odds.win + odds.draw;
      if (odds.win > odds.loss) favourite++;
    }
    return { teamId: team.id, points, projected, remaining, favourite, rank: 0 };
  });
  const sorted = [...rows].sort((a, b) => b.projected - a.projected);
  sorted.forEach((row, i) => (row.rank = i + 1));
  return rows;
}

function average(values: number[]): number {
  return values.length === 0 ? 0 : values.reduce((a, b) => a + b, 0) / values.length;
}

function clamp(v: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, v));
}
