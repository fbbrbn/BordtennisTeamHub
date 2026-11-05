/**
 * Predictions made before each match, to compare with the results: for every match, the
 * forecast uses only what was known before the match day.
 *
 * - Results: only matches played on earlier days count, for the lineups each team used and
 *   for common opponents.
 * - Ratings: each player's official rating from the rating-list version in force on that day.
 *   Players the lists never cover keep their current rating; players who were not rated yet
 *   count as unrated.
 * - The match format (players per side, order of games) is the league's rules, read from the
 *   whole season.
 */
import { forecastMatch, shareFormat, type Odds } from './forecast.ts';
import type { MatchPrediction, PoolData, TeamMatch } from './model.ts';

/** Official ratings by list version: `players[id][i]` belongs to `versions[i]` (oldest first). */
export interface RatingTimeline {
  versions: string[];
  players: Record<string, (number | null)[]>;
}

/**
 * A player's official rating on `day` (YYYY-MM-DD): the latest rating on a version published on
 * or before that day. Null when not rated yet then; undefined when no version lists the player.
 */
export function ratingOn(timeline: RatingTimeline, playerId: string, day: string): number | null | undefined {
  const values = timeline.players[playerId];
  if (!values) return undefined;
  for (let i = timeline.versions.length - 1; i >= 0; i--) {
    if (timeline.versions[i] <= day && values[i] != null) return values[i];
  }
  return null;
}

/** The pool as it was before `day`: matches from that day on have no result yet, and ratings are those in force then. */
export function poolBefore(pool: PoolData, day: string, timeline: RatingTimeline | null): PoolData {
  const view: PoolData = {
    ...pool,
    matches: pool.matches.map((m) => (m.date.slice(0, 10) < day ? m : { ...m, score: null, points: null, walkover: false, games: null })),
    players: pool.players.map((p) => {
      const rating = timeline ? ratingOn(timeline, p.id, day) : undefined;
      return { ...p, rating: rating === undefined ? p.rating : rating };
    }),
  };
  shareFormat(view, pool);
  return view;
}

/**
 * The prediction for every match of the pool, from the home side. `scaleFor` gives the rating
 * scale to use on a day, given the pool as it was then.
 */
export function preMatchPredictions(
  pool: PoolData,
  timeline: RatingTimeline | null,
  scaleFor: (view: PoolData, day: string) => number,
): Map<string, MatchPrediction> {
  const predictions = new Map<string, MatchPrediction>();
  const days = [...new Set(pool.matches.map((m) => m.date.slice(0, 10)))].sort();
  for (const day of days) {
    const view = poolBefore(pool, day, timeline);
    const scale = scaleFor(view, day);
    for (const match of view.matches) {
      if (match.date.slice(0, 10) !== day) continue;
      const odds = forecastMatch(view, match, match.homeTeamId, scale).odds;
      if (!odds) continue;
      predictions.set(match.id, {
        win: round(odds.win, 3),
        draw: round(odds.draw, 3),
        loss: round(odds.loss, 3),
        homeGames: round(odds.expectedGames, 2),
        totalGames: round(odds.totalGames, 2),
      });
    }
  }
  return predictions;
}

/** A match's stored prediction as odds for one of its teams. */
export function predictionOdds(match: TeamMatch, teamId: string): Odds | null {
  const p = match.prediction;
  if (!p) return null;
  const home = match.homeTeamId === teamId;
  return {
    win: home ? p.win : p.loss,
    draw: p.draw,
    loss: home ? p.loss : p.win,
    expectedGames: home ? p.homeGames : p.totalGames - p.homeGames,
    totalGames: p.totalGames,
    drawPossible: p.draw > 0,
  };
}

export type Outcome = 'win' | 'draw' | 'loss';

/** The home side's result of a played match, or null when it was not played (or a walkover). */
export function homeOutcome(score: [number, number] | null, walkover: boolean): Outcome | null {
  if (!score || walkover) return null;
  return score[0] > score[1] ? 'win' : score[0] < score[1] ? 'loss' : 'draw';
}

/** The outcome the prediction thought most likely. */
export function likeliest(p: MatchPrediction): Outcome {
  return p.win >= p.draw && p.win >= p.loss ? 'win' : p.loss >= p.draw ? 'loss' : 'draw';
}

export interface PredictionRecord {
  matches: number;
  /** The likeliest outcome happened. */
  right: number;
  /** Mean squared error over win, draw and loss: 0 is perfect, always 1/3 each scores 0.67. */
  brier: number;
  /** Mean difference between expected and actual games won, as a share of the games. */
  gamesError: number;
}

/** How well predictions did against results, over played matches (walkovers left out). */
export function predictionRecord(
  matches: readonly { score: [number, number] | null; walkover: boolean; prediction?: MatchPrediction }[],
): PredictionRecord | null {
  let n = 0;
  let right = 0;
  let brier = 0;
  let gamesError = 0;
  for (const m of matches) {
    const outcome = homeOutcome(m.score, m.walkover);
    const p = m.prediction;
    if (!outcome || !p || !m.score) continue;
    n++;
    if (likeliest(p) === outcome) right++;
    brier += (p.win - (outcome === 'win' ? 1 : 0)) ** 2 + (p.draw - (outcome === 'draw' ? 1 : 0)) ** 2 + (p.loss - (outcome === 'loss' ? 1 : 0)) ** 2;
    const played = m.score[0] + m.score[1];
    if (played > 0) gamesError += Math.abs(p.homeGames - m.score[0]) / played;
  }
  return n === 0 ? null : { matches: n, right, brier: brier / n, gamesError: gamesError / n };
}

function round(v: number, digits: number): number {
  const f = 10 ** digits;
  return Math.round(v * f) / f;
}
