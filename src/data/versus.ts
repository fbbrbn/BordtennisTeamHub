/**
 * Player against player: one singles game, the first player's chance to win it, and how that chance
 * comes about, step by step. In one pool it is exactly the chance in the match preview's matchup table
 * (`ratingForecast` in forecast.ts):
 *
 *  1. the rating gap, on the pool's curve (an unrated player counts as the pool's median rating);
 *  2. what the ratings miss (form.ts): form this season and last, youth players, unrated players;
 *  3. the home table, when the game belongs to a team match between the two players' teams.
 *
 * Every step is an edge in log-odds; the page shows each one as rating points, with the chance once it
 * is counted.
 */
import { CALIBRATION, edgePoints, fitScale, fitScaleTo, ratingsOf, scaleGames, teamRoster } from './forecast.ts';
import { edgeParts, homeEdge } from './form.ts';
import type { Player, PoolData, TeamMatch } from './model.ts';

/** A player, and the pool the comparison takes their rating, form and pool median from. */
export interface VersusPlayer {
  pool: PoolData;
  player: Player;
}

/** The reasons, in the order they are counted: the ratings, then what the ratings miss. */
export type VersusReason = 'rating' | 'form' | 'last' | 'youth' | 'unrated' | 'home';

export interface VersusStep {
  reason: VersusReason;
  /**
   * Each player's part, the first player first. For 'rating': the ratings the curve uses. Otherwise
   * the player's own edge in rating points, positive when it helps that player.
   */
  points: [number, number];
  /** The first player's chance with this step and every step before it. */
  chance: number;
}

export interface Versus {
  /** The first player's chance to win the single. */
  chance: number;
  steps: VersusStep[];
  /** Every step together as one rating gap, in the first player's favour. */
  gap: number;
  /** The curve's scale: the pool's, or for players of two pools, one fitted on the singles of both. */
  scale: number;
  /** The team match the game belongs to, when the players' teams meet, and which player is at home. */
  match: TeamMatch | null;
  home: 0 | 1 | null;
}

const EDGES = ['form', 'last', 'youth', 'unrated'] as const;
const sigmoid = (x: number) => 1 / (1 + Math.exp(-x));

/** The curve for two players: their pool's, or one fitted on the singles of both pools. */
export function versusScale(a: PoolData, b: PoolData): number {
  return a.pool.id === b.pool.id ? fitScale(a) : fitScaleTo([...scaleGames(a), ...scaleGames(b)]);
}

/** Every team a player is on in the pool: the one the portal lists, and every one they played for. */
function teamsOf(pool: PoolData, playerId: string): Set<string> {
  return new Set(pool.teams.map((team) => team.id).filter((teamId) => teamRoster(pool, teamId).includes(playerId)));
}

/** The team a player plays for in the pool: the one the portal lists, or else the first they played for. */
export function playerTeam(pool: PoolData, playerId: string): string | null {
  return pool.players.find((p) => p.id === playerId)?.teamId ?? [...teamsOf(pool, playerId)][0] ?? null;
}

/**
 * The team match a single between `a` and `b` belongs to: `matchId` when the two players are on its
 * two teams, otherwise the next match to come between their teams. `home`: 0 when `a` is at home.
 */
export function versusMatch(pool: PoolData, a: string, b: string, matchId?: string | null): { match: TeamMatch; home: 0 | 1 } | null {
  const ours = teamsOf(pool, a);
  const theirs = teamsOf(pool, b);
  const side = (m: TeamMatch): 0 | 1 | null => {
    const aHome = ours.has(m.homeTeamId) && theirs.has(m.awayTeamId);
    const bHome = ours.has(m.awayTeamId) && theirs.has(m.homeTeamId);
    return aHome === bHome ? null : aHome ? 0 : 1;
  };
  const given = matchId ? pool.matches.find((m) => m.id === matchId) : undefined;
  if (given && side(given) !== null) return { match: given, home: side(given)! };
  const next = pool.matches.filter((m) => !m.score && side(m) !== null).sort((x, y) => x.date.localeCompare(y.date))[0];
  return next ? { match: next, home: side(next)! } : null;
}

/**
 * The first player's chance to beat the second in a single, step by step. The home table counts only
 * for players of one pool whose teams meet (`versusMatch`).
 */
export function versus(a: VersusPlayer, b: VersusPlayer, options: { matchId?: string | null; scale?: number } = {}): Versus {
  const scale = options.scale ?? versusScale(a.pool, b.pool);
  const points = (logOdds: number) => edgePoints(logOdds, scale);
  const ratings: [number, number] = [ratingsOf(a.pool)(a.player.id), ratingsOf(b.pool)(b.player.id)];

  let logOdds = (CALIBRATION * Math.LN10 * (ratings[0] - ratings[1])) / scale;
  const steps: VersusStep[] = [{ reason: 'rating', points: ratings, chance: sigmoid(logOdds) }];
  const ours = edgeParts(a.player);
  const theirs = edgeParts(b.player);
  for (const reason of EDGES) {
    if (ours[reason] === 0 && theirs[reason] === 0) continue;
    logOdds += ours[reason] - theirs[reason];
    steps.push({ reason, points: [points(ours[reason]), points(theirs[reason])], chance: sigmoid(logOdds) });
  }

  const context = a.pool.pool.id === b.pool.pool.id ? versusMatch(a.pool, a.player.id, b.player.id, options.matchId) : null;
  if (context) {
    const edge = homeEdge(a.pool.pool);
    logOdds += context.home === 0 ? edge : -edge;
    steps.push({ reason: 'home', points: context.home === 0 ? [points(edge), 0] : [0, points(edge)], chance: sigmoid(logOdds) });
  }

  return { chance: sigmoid(logOdds), steps, gap: points(logOdds), scale, match: context?.match ?? null, home: context?.home ?? null };
}
