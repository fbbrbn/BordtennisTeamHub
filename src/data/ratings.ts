/**
 * Rating forecast: what a player's official rating will become once the games played since
 * the last official list are rated.
 *
 * The official rating list (Bordtennis Danmark) is published about every two weeks and only
 * includes games up to an earlier cutoff, so new results take 2 to 4 weeks to show. Every
 * singles game moves both players by a fixed number of points from this table. Both the
 * table and the order of updates below were derived from the portal's own
 * "Opnåede point" pages and checked against hundreds of rated games:
 * - Every game of a match day uses the ratings from before that day.
 * - Doubles are not rated, and walkovers are not played.
 */
import type { PendingRatingGame, PoolData, TeamMatch } from './model.ts';

/** Upper bounds (exclusive) of the rating-gap bands; the last band is 300 and more. */
const BANDS = [25, 50, 75, 100, 200, 300];
const FAVOURITE_WINS = [7, 6, 5, 4, 3, 2, 1];
const FAVOURITE_LOSES = [-5, -10, -14, -17, -20, -18, -15];
const UNDERDOG_WINS = [7, 12, 16, 19, 22, 22, 22];
const UNDERDOG_LOSES = [-5, -4, -3, -3, -3, -2, -1];

export function ratingBand(gap: number): number {
  const i = BANDS.findIndex((upper) => Math.abs(gap) < upper);
  return i === -1 ? BANDS.length : i;
}

/** Rating points for a player rated `own` who won or lost a singles game against `opp`. */
export function ratingPoints(own: number, opp: number, won: boolean): number {
  const band = ratingBand(own - opp);
  const favourite = own >= opp; // equal ratings fall in the first band, where both rows agree
  if (won) return favourite ? FAVOURITE_WINS[band] : UNDERDOG_WINS[band];
  return favourite ? FAVOURITE_LOSES[band] : UNDERDOG_LOSES[band];
}

export interface RatingForecast {
  /** Forecast rating once every listed game is rated. */
  rating: number;
  games: PendingRatingGame[];
}

/**
 * Replays every singles game played after `ratedThrough` (YYYY-MM-DD), day by day, starting
 * from the official ratings. Pass all pools at once: players can appear in several.
 * Games against unrated players are skipped, because their rating is not known.
 */
export function forecastRatings(pools: readonly PoolData[], ratedThrough: string): Map<string, RatingForecast> {
  const official = new Map<string, number>();
  const names = new Map<string, string>();
  for (const pool of pools) {
    for (const p of pool.players) {
      if (p.rating !== null) official.set(p.id, p.rating);
      names.set(p.id, p.name);
    }
  }

  type Pending = { poolId: string; matchId: string; day: string; home: string; away: string; homeWon: boolean };
  const pending: Pending[] = [];
  const seen = new Set<string>();
  for (const pool of pools) {
    for (const match of pool.matches) {
      const day = match.date.slice(0, 10);
      if (!match.games || day <= ratedThrough || seen.has(match.id)) continue;
      seen.add(match.id);
      for (const game of match.games) {
        if (game.kind !== 'single' || game.walkover || game.winner === null) continue;
        const home = game.home[0];
        const away = game.away[0];
        if (!home || !away || !official.has(home) || !official.has(away)) continue;
        pending.push({ poolId: pool.pool.id, matchId: match.id, day, home, away, homeWon: game.winner === 'home' });
      }
    }
  }
  pending.sort((a, b) => a.day.localeCompare(b.day) || a.matchId.localeCompare(b.matchId));

  const current = new Map(official);
  const result = new Map<string, RatingForecast>();
  const record = (playerId: string, game: PendingRatingGame) => {
    const entry = result.get(playerId) ?? { rating: official.get(playerId)!, games: [] };
    entry.games.push(game);
    result.set(playerId, entry);
  };

  for (let i = 0; i < pending.length; ) {
    const day = pending[i].day;
    const deltas = new Map<string, number>();
    for (; i < pending.length && pending[i].day === day; i++) {
      const g = pending[i];
      const rh = current.get(g.home)!;
      const ra = current.get(g.away)!;
      const ph = ratingPoints(rh, ra, g.homeWon);
      const pa = ratingPoints(ra, rh, !g.homeWon);
      deltas.set(g.home, (deltas.get(g.home) ?? 0) + ph);
      deltas.set(g.away, (deltas.get(g.away) ?? 0) + pa);
      const base = { poolId: g.poolId, matchId: g.matchId, date: day };
      record(g.home, { ...base, opponentId: g.away, opponentName: names.get(g.away) ?? '', own: rh, opp: ra, won: g.homeWon, points: ph });
      record(g.away, { ...base, opponentId: g.home, opponentName: names.get(g.home) ?? '', own: ra, opp: rh, won: !g.homeWon, points: pa });
    }
    for (const [id, delta] of deltas) current.set(id, current.get(id)! + delta);
  }
  for (const [id, entry] of result) entry.rating = current.get(id)!;
  return result;
}

/** The points table, one row per rating-gap band (`to` is exclusive; null for the last band). */
export function ratingTable(): { from: number; to: number | null; favouriteWins: number; favouriteLoses: number; underdogWins: number; underdogLoses: number }[] {
  return [0, ...BANDS].map((from, i) => ({
    from,
    to: BANDS[i] ?? null,
    favouriteWins: FAVOURITE_WINS[i],
    favouriteLoses: FAVOURITE_LOSES[i],
    underdogWins: UNDERDOG_WINS[i],
    underdogLoses: UNDERDOG_LOSES[i],
  }));
}

export interface MatchRatingLine {
  playerId: string;
  side: 'home' | 'away';
  /** Rating the match was played at: the official one, or the forecast after earlier unrated match days. */
  before: number;
  points: number;
  games: number;
}

/** Estimated rating points each player gets from one match not yet in the official ratings. */
export function matchRatingPoints(pool: PoolData, match: TeamMatch): MatchRatingLine[] {
  const players = new Map(pool.players.map((p) => [p.id, p]));
  const lines: MatchRatingLine[] = [];
  for (const side of ['home', 'away'] as const) {
    const ids = [...new Set((match.games ?? []).filter((g) => g.kind === 'single').flatMap((g) => g[side]))];
    for (const id of ids) {
      const games = (players.get(id)?.forecast?.games ?? []).filter((g) => g.matchId === match.id && g.poolId === pool.pool.id);
      if (games.length === 0) continue;
      lines.push({ playerId: id, side, before: games[0].own, points: games.reduce((sum, g) => sum + g.points, 0), games: games.length });
    }
  }
  return lines;
}
