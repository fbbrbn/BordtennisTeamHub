/**
 * What the forecasts know beyond the official ratings. Ratings move slowly (at most about 22 points a
 * game), so they lag behind players who improve or decline. Checked over every singles game of 2024/25
 * to 2026/27, each predicted from what was known before its match day (see docs/predictions.md):
 *
 * - Form: players who won more singles than their ratings expected keep doing so. This season counts
 *   most, last season about a third as much. Few games are pulled towards zero.
 * - Youth players (they also play in a youth pool) beat their rating by about 115 points, because they
 *   improve faster than the list. Only the pools they play in are used: no ages.
 * - Unrated players are weaker than the pool median they stand in for, youth players excepted.
 * - The home side wins more than the ratings say, about 22 points a game, except in veteran pools.
 *
 * Each is an edge in log-odds, added to a game's chance in `gameChance` (forecast.ts).
 */
import type { Player, PlayerForm, PoolInfo } from './model.ts';

/** Games at which form counts half: a player's first games are pulled towards zero. */
export const FORM_PRIOR_GAMES = 15;
/** Log-odds per win above expectation, per game counted (plus the prior). */
export const FORM_WEIGHT = 3.75;
export const LAST_SEASON_WEIGHT = 1.25;
export const YOUTH_EDGE = 0.75;
export const UNRATED_EDGE = -0.3;
export const HOME_EDGE = 0.14;

/** Youth pools: Dr/Pg (boys and girls), Junior and Ungdom. */
export const YOUTH_AGE_GROUPS: ReadonlySet<string> = new Set(['4003', '4004', '4016']);
/** Veteran pools, where the home side has no edge: Old Girls and Veteran 40 to 75. */
const VETERAN_AGE_GROUPS: ReadonlySet<string> = new Set(['4007', '4008', '4009', '4010', '4011', '4012', '4013', '4014', '4019']);

export interface EdgeParts {
  form: number;
  last: number;
  youth: number;
  unrated: number;
}

/** A player's edges in log-odds, by reason. A player the pool does not list has none. */
export function edgeParts(player: Pick<Player, 'rating' | 'form'> | undefined): EdgeParts {
  const parts: EdgeParts = { form: 0, last: 0, youth: 0, unrated: 0 };
  if (!player) return parts;
  const f = player.form;
  if (f) {
    parts.form = (FORM_WEIGHT * f.above) / (f.games + FORM_PRIOR_GAMES);
    if (f.last) parts.last = (LAST_SEASON_WEIGHT * f.last.above) / (f.last.games + FORM_PRIOR_GAMES);
    if (f.youth) parts.youth = YOUTH_EDGE;
  }
  if (player.rating === null && !f?.youth) parts.unrated = UNRATED_EDGE;
  return parts;
}

export function playerEdge(player: Pick<Player, 'rating' | 'form'> | undefined): number {
  const p = edgeParts(player);
  return p.form + p.last + p.youth + p.unrated;
}

/** The home side's edge in each game of a match in this pool. */
export function homeEdge(pool: Pick<PoolInfo, 'ageGroupId'>): number {
  return VETERAN_AGE_GROUPS.has(pool.ageGroupId) ? 0 : HOME_EDGE;
}

/** Wins above expectation so far: one player's running total. */
export interface FormTally {
  games: number;
  above: number;
}

/** A player's form for the pool data, rounded, from this season's and last season's tallies. */
export function formOf(now: FormTally | undefined, last: (FormTally & { youth?: boolean }) | undefined, youth: boolean): PlayerForm | undefined {
  const round = (v: number) => Math.round(v * 100) / 100;
  const form: PlayerForm = { games: now?.games ?? 0, above: round(now?.above ?? 0) };
  if (last && last.games > 0) form.last = { games: last.games, above: round(last.above) };
  if (youth || last?.youth) form.youth = true;
  return form.games > 0 || form.last || form.youth ? form : undefined;
}
