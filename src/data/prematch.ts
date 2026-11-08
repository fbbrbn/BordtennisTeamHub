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
 * - Form (src/data/form.ts): each player's singles on earlier days, in every pool of the season,
 *   so the season is replayed day by day with all its pools together (`replaySeason`).
 */
import { BORROWED_SHRINK, fieldedLineups, fitScale, forecastMatch, ratingsOf, shareFormat, winChance, type Borrowed, type WeightedLineup } from './forecast.ts';
import { formOf, YOUTH_AGE_GROUPS, type FormTally } from './form.ts';
import type { MatchPrediction, PlayerForm, PoolData } from './model.ts';

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

/**
 * The pool as it was before `day`: matches from that day on have no result yet, ratings are those in
 * force then, and players' form is what `form` says about earlier days (none when not given).
 */
export function poolBefore(
  pool: PoolData,
  day: string,
  timeline: RatingTimeline | null,
  form?: (playerId: string) => PlayerForm | undefined,
): PoolData {
  const view: PoolData = {
    ...pool,
    matches: pool.matches.map((m) => (m.date.slice(0, 10) < day ? m : { ...m, score: null, points: null, walkover: false, games: null })),
    players: pool.players.map((p) => {
      const rating = timeline ? ratingOn(timeline, p.id, day) : undefined;
      const player = { ...p, rating: rating === undefined ? p.rating : rating };
      const f = form?.(p.id);
      if (f) player.form = f;
      else delete player.form;
      return player;
    }),
  };
  shareFormat(view, pool);
  return view;
}

/** What the next season needs from a finished one (scraper/seasonform.ts writes and reads it). */
export interface LastSeason {
  /** Tallies by player id, with whether they played in a youth pool. */
  players: Map<string, FormTally & { youth?: boolean }>;
  /** Every team's lineups, by `teamKey`. */
  teams: Map<string, WeightedLineup[]>;
}

/** A team across pools and seasons: its age group and name ("4006|vallensbæk btk 3"). */
export function teamKey(ageGroupId: string, name: string): string {
  return `${ageGroupId}|${name.toLocaleLowerCase('da').replace(/\s+/g, ' ').trim()}`;
}

/** Every team's lineups across the season's pools, by `teamKey`, weighted by how often each was fielded. */
export function seasonLineups(pools: PoolData[]): Map<string, WeightedLineup[]> {
  const teams = new Map<string, Map<string, WeightedLineup>>();
  for (const pool of pools) {
    for (const team of pool.teams) {
      const key = teamKey(pool.pool.ageGroupId, team.name);
      const lineups = teams.get(key) ?? new Map<string, WeightedLineup>();
      for (const l of fieldedLineups(pool, team.id)) addLineup(lineups, l.ids, l.weight);
      if (lineups.size > 0) teams.set(key, lineups);
    }
  }
  return new Map([...teams].map(([key, lineups]) => [key, [...lineups.values()]]));
}

function addLineup(lineups: Map<string, WeightedLineup>, ids: string[], weight: number): void {
  const key = [...ids].sort().join('+');
  const entry = lineups.get(key) ?? { ids, weight: 0 };
  entry.weight += weight;
  lineups.set(key, entry);
}

export interface SeasonReplay {
  /** By pool id and match id: the prediction made before the match day, from the home side. */
  predictions: Map<string, Map<string, MatchPrediction>>;
  /** Every player's form after the last day played, for the forecasts of the matches to come. */
  form: Map<string, PlayerForm>;
  /** This season's tallies, and the players seen in a youth pool. */
  tallies: Map<string, FormTally>;
  youth: Set<string>;
}

/**
 * Replays a season day by day, all its pools together, since players' form counts their singles in
 * every pool. Each match is predicted from its pool as it was before the match day, with the form
 * from earlier days. Then the day's singles count: wins above what the plain rating curve expected,
 * with the ratings in force and the pool's scale on that day.
 *
 * A team that has not played in its pool yet borrows its lineups: from the same team (same age group
 * and name) in pools of this season, on earlier days; otherwise from last season.
 */
export function replaySeason(
  pools: PoolData[],
  timeline: RatingTimeline | null,
  last: LastSeason | null = null,
  options: { shrink?: Partial<typeof BORROWED_SHRINK> } = {},
): SeasonReplay {
  const shrink = { ...BORROWED_SHRINK, ...options.shrink };
  const tallies = new Map<string, FormTally>();
  const youth = new Set<string>();
  const formFor = (id: string) => formOf(tallies.get(id), last?.players.get(id), youth.has(id));
  /** This season's lineups by team key, from the days replayed so far. */
  const earlier = new Map<string, Map<string, WeightedLineup>>();
  const predictions = new Map<string, Map<string, MatchPrediction>>();
  const byDay = new Map<string, PoolData[]>();
  for (const pool of pools) {
    predictions.set(pool.pool.id, new Map());
    for (const day of new Set(pool.matches.map((m) => m.date.slice(0, 10)))) byDay.set(day, [...(byDay.get(day) ?? []), pool]);
  }
  for (const day of [...byDay.keys()].sort()) {
    const results: { home: string; away: string; above: number }[] = [];
    const youthToday: string[] = [];
    const fieldedToday: { key: string; ids: string[] }[] = [];
    for (const pool of byDay.get(day)!) {
      const view = poolBefore(pool, day, timeline, formFor);
      const scale = fitScale(view);
      const rating = ratingsOf(view);
      const known = new Set(view.players.map((p) => p.id));
      const names = new Map(pool.teams.map((x) => [x.id, x.name]));
      for (const match of pool.matches) {
        if (match.date.slice(0, 10) !== day) continue;
        const sources = new Set<'season' | 'last-season'>();
        const fallback = (teamId: string): Borrowed | null => {
          const key = teamKey(pool.pool.ageGroupId, names.get(teamId) ?? '');
          const thisSeason = [...(earlier.get(key)?.values() ?? [])];
          const lineups = thisSeason.length > 0 ? thisSeason : (last?.teams.get(key) ?? []);
          if (lineups.length === 0) return null;
          sources.add(thisSeason.length > 0 ? 'season' : 'last-season');
          // The borrowed players join the view, rated as on that day's list.
          for (const id of new Set(lineups.flatMap((l) => l.ids))) {
            if (known.has(id)) continue;
            known.add(id);
            const r = timeline ? ratingOn(timeline, id, day) : undefined;
            const player = { id, name: '', teamId: null, rating: r ?? null, form: formFor(id) };
            if (!player.form) delete player.form;
            view.players.push(player);
          }
          return { lineups, shrink: thisSeason.length > 0 ? shrink.season : shrink.lastSeason };
        };
        const odds = forecastMatch(view, match, match.homeTeamId, scale, { fallback }).odds;
        if (odds) {
          predictions.get(pool.pool.id)!.set(match.id, {
            win: round(odds.win, 3),
            draw: round(odds.draw, 3),
            loss: round(odds.loss, 3),
            homeGames: round(odds.expectedGames, 2),
            totalGames: round(odds.totalGames, 2),
            ...(sources.size > 0 ? { lineups: sources.has('last-season') ? 'last-season' : 'season' } : {}),
          });
        }
        if (!match.score || match.walkover) continue;
        for (const teamId of [match.homeTeamId, match.awayTeamId]) {
          const side = teamId === match.homeTeamId ? 'home' : 'away';
          const ids = [...new Set((match.games ?? []).filter((g) => g.kind === 'single').flatMap((g) => g[side]))];
          if (ids.length > 0) fieldedToday.push({ key: teamKey(pool.pool.ageGroupId, names.get(teamId) ?? ''), ids });
        }
        for (const g of match.games ?? []) {
          if (YOUTH_AGE_GROUPS.has(pool.pool.ageGroupId)) youthToday.push(...g.home, ...g.away);
          if (g.kind !== 'single' || g.walkover || !g.winner || g.home.length !== 1 || g.away.length !== 1) continue;
          const expected = winChance(rating(g.home[0]), rating(g.away[0]), scale);
          results.push({ home: g.home[0], away: g.away[0], above: (g.winner === 'home' ? 1 : 0) - expected });
        }
      }
    }
    // Only now: a day's results count from the next day on.
    for (const { home, away, above } of results) {
      for (const [id, sign] of [[home, 1], [away, -1]] as const) {
        const t = tallies.get(id) ?? { games: 0, above: 0 };
        tallies.set(id, { games: t.games + 1, above: t.above + sign * above });
      }
    }
    for (const id of youthToday) youth.add(id);
    for (const { key, ids } of fieldedToday) {
      const lineups = earlier.get(key) ?? new Map<string, WeightedLineup>();
      addLineup(lineups, ids, 1);
      earlier.set(key, lineups);
    }
  }
  const form = new Map<string, PlayerForm>();
  for (const id of new Set([...pools.flatMap((p) => p.players.map((x) => x.id)), ...tallies.keys()])) {
    const f = formFor(id);
    if (f) form.set(id, f);
  }
  return { predictions, form, tallies, youth };
}

export { predictionOdds } from './forecast.ts';

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
