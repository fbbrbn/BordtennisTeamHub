/**
 * Match forecasts. Two independent estimates, combined into one set of odds:
 *
 *  1. Player ratings. Every game of a team match (all singles pairings plus one
 *     doubles) gets a win chance from the rating difference, using a logistic curve
 *     calibrated on the pool's own singles results, plus the edges in form.ts: each
 *     player's form, youth players, unrated players and the home table. The exact
 *     distribution of games won then gives the chances of a win, a draw and a loss.
 *  2. Common opponents. Compare how both teams did against the same teams (and
 *     against each other, if they already met). If we beat C 6-4 and they lost to
 *     C 3-7, we were 6 games better against C.
 *
 * The ratings count three times as much as the common opponents. These are estimates,
 * not data: the UI always says so and shows the reasons.
 */
import { edgeParts, homeEdge, playerEdge } from './form.ts';
import type { PoolData, TeamMatch } from './model.ts';
import { isHome, scoreFor, teamMatches } from './stats.ts';

export interface Odds {
  win: number;
  draw: number;
  loss: number;
  /** Expected games won. */
  expectedGames: number;
  /** Expected games played (fixed, except in first-to-N formats). */
  totalGames: number;
  /** False when the format cannot end level (odd number of games, first to N, or a deciding game). */
  drawPossible: boolean;
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

export interface WeightedLineup {
  ids: string[];
  weight: number;
}

/** Which lineups to assume. Without them, every lineup the team fielded in the pool this season. */
export interface LineupHints {
  team?: string[];
  opponent?: string[];
  /**
   * Lineups for a side that has not played in this pool yet, borrowed from the same team in an earlier
   * pool or last season (see prematch.ts), and how uncertain they are. Without it, such a side has no
   * rating odds.
   */
  fallback?: (teamId: string) => Borrowed | null;
}

/** Lineups borrowed for a team, and how far to pull the odds towards even (BORROWED_SHRINK). */
export interface Borrowed {
  lineups: WeightedLineup[];
  shrink: number;
}

/**
 * A team whose lineups are borrowed may field other players: of the players in a team's first match,
 * only 53–61% had played for it last season. So the odds are pulled towards even, the win and the loss
 * towards each other, by this share, by where the lineups come from. Tuned on the first matches of
 * 2020/21 to 2024/25 and checked on 2025/26 and 2026/27 (docs/predictions.md).
 */
export const BORROWED_SHRINK = { season: 0.2, lastSeason: 0.5 };

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
  /** A side's lineups were borrowed (LineupHints.fallback). */
  borrowed: boolean;
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

/**
 * How much a team's form on the day varies, in rating points. The games of one match are not
 * independent: on a good evening the whole team plays better. Averaging the match odds over
 * this spread makes them less extreme without moving the expected score.
 */
export const FORM_SPREAD = 100;
/** Three-point Gauss-Hermite rule for a normal distribution: offsets in standard deviations, and weights. */
const FORM_POINTS: readonly [number, number][] = [
  [-Math.sqrt(3), 1 / 6],
  [0, 2 / 3],
  [Math.sqrt(3), 1 / 6],
];

/**
 * A pool's scale is fitted on its earlier games with today's ratings, which already include those
 * games, so it comes out a little too confident: the forecasts use 84% of the rating gap.
 */
export const CALIBRATION = 0.84;
/** How much the ratings count against the common opponents when both are known. */
export const RATING_WEIGHT = 0.75;

/** Chance that a player rated `a` beats one rated `b`: the plain rating curve, without edges. */
export function winChance(a: number, b: number, scale: number): number {
  return 1 / (1 + 10 ** (-(a - b) / scale));
}

/** A game's chance in the forecasts: the calibrated rating gap plus `edge` in log-odds (form.ts). */
export function gameChance(a: number, b: number, scale: number, edge = 0): number {
  return 1 / (1 + Math.exp(-((CALIBRATION * Math.LN10 * (a - b)) / scale + edge)));
}

/** An edge in log-odds as rating points, at this scale. */
export function edgePoints(edge: number, scale: number): number {
  return (edge * scale) / (CALIBRATION * Math.LN10);
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
  return {
    win,
    draw,
    loss: Math.max(0, 1 - win - draw),
    expectedGames: chances.reduce((a, b) => a + b, 0),
    totalGames: n,
    drawPossible: n % 2 === 0,
  };
}

/**
 * Odds for a team match played in the pool's format. `chances` are our win chances for
 * the games in playing order.
 * - First to N: the match stops when a side reaches N games.
 * - Deciding game: a level score is settled by one more game (chance `deciderChance`).
 * - Otherwise every game is played and a level score is a draw.
 */
export function oddsForFormat(format: MatchFormat, chances: number[], deciderChance = 0.5): Odds {
  if (format.raceTo) {
    const n = format.raceTo;
    const games = Array.from({ length: 2 * n - 1 }, (_, k) => chances[k] ?? deciderChance);
    // probability of each running score (wins, losses) that has not finished yet
    let live = new Map<string, number>([['0,0', 1]]);
    let win = 0;
    let expectedWon = 0;
    let expectedPlayed = 0;
    for (const p of games) {
      const next = new Map<string, number>();
      for (const [key, q] of live) {
        const [w, l] = key.split(',').map(Number);
        for (const [dw, dl, pq] of [[1, 0, p], [0, 1, 1 - p]] as const) {
          const nw = w + dw;
          const nl = l + dl;
          const mass = q * pq;
          if (nw === n || nl === n) {
            if (nw === n) win += mass;
            expectedWon += mass * nw;
            expectedPlayed += mass * (nw + nl);
          } else {
            const k = `${nw},${nl}`;
            next.set(k, (next.get(k) ?? 0) + mass);
          }
        }
      }
      live = next;
    }
    return { win, draw: 0, loss: 1 - win, expectedGames: expectedWon, totalGames: expectedPlayed, drawPossible: false };
  }
  const base = oddsFromGames(chances);
  if (!format.decider || base.draw === 0) return base;
  return {
    win: base.win + base.draw * deciderChance,
    draw: 0,
    loss: base.loss + base.draw * (1 - deciderChance),
    expectedGames: base.expectedGames + base.draw * deciderChance,
    totalGames: base.totalGames + base.draw,
    drawPossible: false,
  };
}

/** Logistic scale that best explains the pool's singles results (max likelihood, weak prior around 300). */
export function fitScale(pool: PoolData): number {
  return fitScaleTo(scaleGames(pool));
}

/** The pool's singles between two rated players: the rating gap (home minus away) and whether home won. */
export function scaleGames(pool: PoolData): { diff: number; won: boolean }[] {
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
  return games;
}

/** The logistic scale that best explains these singles (rating gap, and whether the first player won). */
export function fitScaleTo(games: readonly { diff: number; won: boolean }[]): number {
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

/**
 * How a team match is played in this pool, read from played matches:
 * - the games in playing order: singles between positions ("A2/B1" or "A2-B1"; position 1
 *   is the strongest player) and team games (doubles, golden sets), which use team averages;
 * - `raceTo`: first to N games wins and the match stops (e.g. 8 in the national divisions);
 * - `decider`: a level score is settled by one more game, so there are no draws.
 * Most series are 3 v 3 with 1 doubles and nine singles; the Jyllandsserie is 4 v 4 with two
 * doubles and twelve singles. Without readable labels: the usual numbers of singles and doubles.
 */
export type FormatGame = { kind: 'single'; pair: [number, number] } | { kind: 'team' };

export interface MatchFormat {
  size: number;
  sequence: FormatGame[];
  /** Singles position pairs (0-based), in playing order. */
  singles: [number, number][];
  /** Team games: doubles and golden sets. */
  doubles: number;
  raceTo: number | null;
  decider: boolean;
}

const SINGLE_LABEL = /A\s*(\d+)\s*[/-]\s*B\s*(\d+)/i;
const formats = new WeakMap<PoolData, MatchFormat>();

/**
 * Lets `view`, the pool as it was on some earlier day, play in the format read from the whole
 * season. The format is the league's rules, so knowing it early reveals no results.
 */
export function shareFormat(view: PoolData, pool: PoolData): void {
  formats.set(view, matchFormat(pool));
}

export function matchFormat(pool: PoolData): MatchFormat {
  const cached = formats.get(pool);
  if (cached) return cached;
  const players = playersPerSide(pool);
  const played = pool.matches.filter((m) => m.score && m.games && m.games.length > 0 && !m.walkover);
  const sums = played.map((m) => m.score![0] + m.score![1]);
  const winners = new Map<number, number>();
  for (const m of played) winners.set(Math.max(...m.score!), (winners.get(Math.max(...m.score!)) ?? 0) + 1);
  const topWinner = mostCommon(winners);
  const raceTo =
    played.length >= 4 && topWinner !== undefined && (winners.get(topWinner) ?? 0) >= 0.8 * played.length && new Set(sums).size > 1
      ? topWinner
      : null;

  const sequences = new Map<string, { sequence: FormatGame[]; count: number }>();
  for (const match of played) {
    const sequence: FormatGame[] = match.games!
      .filter((g) => g.winner !== null)
      .map((g) => {
        const m = g.kind === 'single' ? SINGLE_LABEL.exec(g.label) : null;
        return m ? { kind: 'single', pair: [Number(m[1]) - 1, Number(m[2]) - 1] } : { kind: 'team' };
      });
    const pairs = sequence.flatMap((g) => (g.kind === 'single' ? [g.pair] : []));
    if (pairs.length === 0) continue;
    const size = Math.max(...pairs.flat()) + 1;
    const unique = new Set(pairs.map(([a, b]) => `${a}-${b}`)).size === pairs.length;
    if (size !== players || !unique) continue;
    const key = JSON.stringify(sequence);
    sequences.set(key, { sequence, count: (sequences.get(key)?.count ?? 0) + 1 });
  }
  const options = [...sequences.values()];
  // First-to-N matches stop early, so take the longest; otherwise the most common one.
  const chosen = (
    raceTo
      ? options.sort((a, b) => b.sequence.length - a.sequence.length || b.count - a.count)[0]
      : options.sort((a, b) => b.count - a.count || a.sequence.length - b.sequence.length)[0]
  )?.sequence;
  const sequence = chosen ?? fallbackSequence(pool, players);
  const decider = !raceTo && sums.some((sum) => sum === sequence.length + 1);
  const format: MatchFormat = {
    size: players,
    sequence,
    singles: sequence.flatMap((g) => (g.kind === 'single' ? [g.pair] : [])),
    doubles: sequence.filter((g) => g.kind === 'team').length,
    raceTo,
    decider,
  };
  formats.set(pool, format);
  return format;
}

/** Without readable labels: the usual numbers of singles and team games, singles over all pairings. */
function fallbackSequence(pool: PoolData, size: number): FormatGame[] {
  const singlesCounts = new Map<number, number>();
  const teamCounts = new Map<number, number>();
  for (const match of pool.matches) {
    const games = match.games?.filter((g) => g.winner !== null) ?? [];
    if (games.length === 0) continue;
    const singles = games.filter((g) => g.kind === 'single').length;
    singlesCounts.set(singles, (singlesCounts.get(singles) ?? 0) + 1);
    teamCounts.set(games.length - singles, (teamCounts.get(games.length - singles) ?? 0) + 1);
  }
  const pairs: [number, number][] = [];
  for (let i = 0; i < size; i++) for (let j = 0; j < size; j++) pairs.push([i, j]);
  const singles = mostCommon(singlesCounts) ?? pairs.length;
  const team = mostCommon(teamCounts) ?? 1;
  return [
    ...Array.from({ length: team }, () => ({ kind: 'team' }) as FormatGame),
    ...Array.from({ length: singles }, (_, k) => ({ kind: 'single', pair: pairs[k % pairs.length] }) as FormatGame),
  ];
}

/** Players per side (3 in most series). */
export function lineupSize(pool: PoolData): number {
  return matchFormat(pool).size;
}

/** Games per team match (10 in most series: 9 singles and 1 doubles; the most a first-to-N match can take). */
export function gamesPerMatch(pool: PoolData): number {
  const format = matchFormat(pool);
  return format.raceTo ? 2 * format.raceTo - 1 : format.sequence.length;
}

/** The most common number of distinct players per side in played singles. */
function playersPerSide(pool: PoolData): number {
  const sizes = new Map<number, number>();
  for (const match of pool.matches) {
    // A "Golden Set" can be listed as a singles game without players: it says nothing about the lineups.
    const singles = match.games?.filter((g) => g.kind === 'single' && !g.walkover && g.home.length + g.away.length > 0) ?? [];
    if (singles.length === 0) continue;
    const size = Math.max(new Set(singles.flatMap((g) => g.home)).size, new Set(singles.flatMap((g) => g.away)).size);
    sizes.set(size, (sizes.get(size) ?? 0) + 1);
  }
  return mostCommon(sizes) ?? 3;
}

function mostCommon(counts: Map<number, number>): number | undefined {
  return [...counts].sort((a, b) => b[1] - a[1] || b[0] - a[0])[0]?.[0];
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
 * `adjust`: false leaves out the edges (form, youth, unrated, home table), for "ratings alone".
 */
export function ratingSummary(
  pool: PoolData,
  teamId: string,
  opponentId: string,
  scale: number,
  lineups: LineupHints = {},
  home = true,
  adjust = true,
): RatingSummary | null {
  let shrink = 0;
  let borrowed = false;
  const options = (id: string, given?: string[]): WeightedLineup[] => {
    if (given) return [{ ids: given, weight: 1 }];
    const fielded = fieldedLineups(pool, id);
    if (fielded.length > 0) return fielded;
    const usual = usualLineup(pool, id);
    if (usual.length > 0) return [{ ids: usual, weight: 1 }];
    const fallback = lineups.fallback?.(id);
    if (!fallback || fallback.lineups.length === 0) return [];
    borrowed = true;
    shrink = Math.max(shrink, fallback.shrink);
    return fallback.lineups;
  };
  const ours = options(teamId, lineups.team);
  const theirs = options(opponentId, lineups.opponent);
  const rating = ratingsOf(pool);
  let total = 0;
  const sum = { win: 0, draw: 0, loss: 0, expectedGames: 0, totalGames: 0 };
  let drawPossible = true;
  for (const a of ours) {
    for (const b of theirs) {
      const f = ratingForecast(pool, a.ids, b.ids, scale, home, FORM_SPREAD, adjust);
      if (!f) continue;
      const w = a.weight * b.weight;
      total += w;
      sum.win += w * f.odds.win;
      sum.draw += w * f.odds.draw;
      sum.loss += w * f.odds.loss;
      sum.expectedGames += w * f.odds.expectedGames;
      sum.totalGames += w * f.odds.totalGames;
      drawPossible = f.odds.drawPossible;
    }
  }
  if (total === 0) return null;
  const weightedAverage = (list: { ids: string[]; weight: number }[]) =>
    list.reduce((acc, l) => acc + l.weight * average(l.ids.map(rating)), 0) / list.reduce((acc, l) => acc + l.weight, 0);
  const odds = {
    win: sum.win / total,
    draw: sum.draw / total,
    loss: sum.loss / total,
    expectedGames: sum.expectedGames / total,
    totalGames: sum.totalGames / total,
    drawPossible,
  };
  return {
    odds: shrink > 0 ? towardsEven(odds, shrink) : odds,
    teamAverage: weightedAverage(ours),
    opponentAverage: weightedAverage(theirs),
    teamLineups: ours.length,
    opponentLineups: theirs.length,
    team: ours.length === 1 ? ours[0].ids : null,
    borrowed,
  };
}

/** Odds pulled towards even by a share: the win and the loss towards each other, the draw kept. */
export function towardsEven(odds: Odds, share: number): Odds {
  const even = (odds.win + odds.loss) / 2;
  return {
    ...odds,
    win: odds.win + share * (even - odds.win),
    loss: odds.loss + share * (even - odds.loss),
    expectedGames: odds.expectedGames + share * (odds.totalGames / 2 - odds.expectedGames),
  };
}

/**
 * `home`: whether our team is the home side. It gets the home table's edge, and it matters when a
 * format's pairings are not symmetric. `adjust`: false leaves out every edge (see ratingSummary).
 */
export function ratingForecast(
  pool: PoolData,
  team: string[],
  opponent: string[],
  scale: number,
  home = true,
  spread = FORM_SPREAD,
  adjust = true,
): RatingForecast | null {
  if (team.length === 0 || opponent.length === 0) return null;
  const rating = ratingsOf(pool);
  const players = new Map(pool.players.map((p) => [p.id, p]));
  const edge = (id: string) => (adjust ? playerEdge(players.get(id)) : 0);
  const homeSide = adjust ? (home ? 1 : -1) * homeEdge(pool.pool) : 0;
  const singles = team.map((a) => opponent.map((b) => gameChance(rating(a), rating(b), scale, homeSide + edge(a) - edge(b))));
  const teamAverage = average(team.map(rating));
  const opponentAverage = average(opponent.map(rating));
  const teamEdge = homeSide + average(team.map(edge)) - average(opponent.map(edge));
  const doubles = gameChance(teamAverage, opponentAverage, scale, teamEdge);

  // Play the pool's real format: players take positions by rating, strongest first. A missing
  // player (a side fielding fewer players than the format) loses their games by walkover.
  const format = matchFormat(pool);
  const byRating = (ids: string[]) => [...ids].sort((a, b) => rating(b) - rating(a)).slice(0, format.size);
  const ours = byRating(team);
  const theirs = byRating(opponent);
  // `form`: how much better than their ratings our team plays on the day, in rating points.
  const oddsWithForm = (form: number) => {
    const teamGame = gameChance(teamAverage + form, opponentAverage, scale, teamEdge);
    const chances = format.sequence.map((g) => {
      if (g.kind === 'team') return teamGame;
      // A label "A1/B2" means home position 1 against away position 2.
      const a = ours[home ? g.pair[0] : g.pair[1]];
      const b = theirs[home ? g.pair[1] : g.pair[0]];
      if (a === undefined && b === undefined) return 0.5;
      if (a === undefined) return 0;
      if (b === undefined) return 1;
      return gameChance(rating(a) + form, rating(b), scale, homeSide + edge(a) - edge(b));
    });
    return oddsForFormat(format, chances, teamGame);
  };
  const parts = spread > 0 ? FORM_POINTS.map(([z, w]) => [oddsWithForm(z * spread), w] as const) : [[oddsWithForm(0), 1] as const];
  const mix = (key: 'win' | 'draw' | 'loss' | 'expectedGames' | 'totalGames') => parts.reduce((sum, [o, w]) => sum + w * o[key], 0);
  const odds: Odds = {
    win: mix('win'),
    draw: mix('draw'),
    loss: mix('loss'),
    expectedGames: mix('expectedGames'),
    // Fixed formats play the same number of games whatever the form: keep it exact.
    totalGames: parts.every(([o]) => o.totalGames === parts[0][0].totalGames) ? parts[0][0].totalGames : mix('totalGames'),
    drawPossible: parts[0][0].drawPossible,
  };
  return { odds, singles, doubles, team, opponent, teamAverage, opponentAverage };
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
  const format = matchFormat(pool);
  const playedGames = pool.matches.filter((m) => m.score && !m.walkover).map((m) => m.score![0] + m.score![1]);
  const perMatch = playedGames.length > 0 ? average(playedGames) : gamesPerMatch(pool);
  // Margin m over n games means winning (n + m) / 2 of them; fewer comparisons pull it towards even.
  const share = clamp(0.5 + expected / (2 * perMatch), 0.05, 0.95);
  const shrunk = 0.5 + (share - 0.5) * (estimates.length / (estimates.length + 1));
  return { rows, direct, margin: expected, odds: oddsForFormat(format, new Array(gamesPerMatch(pool)).fill(shrunk), shrunk) };
}

/** The players a forecast counts for a team: the given lineup, or everyone in the lineups it fielded. */
export function forecastPlayers(pool: PoolData, teamId: string, lineup?: string[]): string[] {
  if (lineup && lineup.length > 0) return lineup;
  const fielded = fieldedLineups(pool, teamId);
  return fielded.length > 0 ? [...new Set(fielded.flatMap((l) => l.ids))] : usualLineup(pool, teamId);
}

export interface PlayerAdjustment {
  id: string;
  /** The player's edge as rating points: form this season and last, youth, unrated (form.ts). */
  points: number;
  youth: boolean;
  unrated: boolean;
}

/** The players among `ids` whose edge is worth at least `min` rating points, largest first. */
export function playerAdjustments(pool: PoolData, ids: string[], scale: number, min = 10): PlayerAdjustment[] {
  const players = new Map(pool.players.map((p) => [p.id, p]));
  return [...new Set(ids)]
    .map((id) => {
      const parts = edgeParts(players.get(id));
      const points = Math.round(edgePoints(parts.form + parts.last + parts.youth + parts.unrated, scale));
      return { id, points, youth: parts.youth !== 0, unrated: parts.unrated !== 0 };
    })
    .filter((a) => Math.abs(a.points) >= min)
    .sort((a, b) => Math.abs(b.points) - Math.abs(a.points));
}

/** The home side's edge in this pool, as rating points a game (0 in veteran pools). */
export function homePoints(pool: PoolData, scale: number): number {
  return Math.round(edgePoints(homeEdge(pool.pool), scale));
}

/** A weighted average of the estimates that are present (equal weights unless given). */
export function combineOdds(list: (Odds | null)[], weights: number[] = list.map(() => 1)): Odds | null {
  const present = list.flatMap((o, i) => (o ? [{ o, w: weights[i] }] : []));
  if (present.length === 0) return null;
  const total = present.reduce((s, p) => s + p.w, 0);
  const mean = (key: 'win' | 'draw' | 'loss' | 'expectedGames' | 'totalGames') => present.reduce((s, p) => s + p.w * p.o[key], 0) / total;
  return {
    win: mean('win'),
    draw: mean('draw'),
    loss: mean('loss'),
    expectedGames: mean('expectedGames'),
    totalGames: mean('totalGames'),
    drawPossible: present.every((p) => p.o.drawPossible),
  };
}

/** The match odds from both estimates: the ratings count three times as much as the common opponents. */
export function matchOdds(rating: Odds | null, common: Odds | null): Odds | null {
  return combineOdds([rating, common], [RATING_WEIGHT, 1 - RATING_WEIGHT]);
}

export function forecastMatch(
  pool: PoolData,
  match: TeamMatch,
  teamId: string,
  scale: number,
  lineups: LineupHints = {},
): MatchForecast {
  const opponentId = isHome(match, teamId) ? match.awayTeamId : match.homeTeamId;
  const rating = ratingSummary(pool, teamId, opponentId, scale, lineups, isHome(match, teamId));
  const common = commonOpponentForecast(pool, teamId, opponentId);
  return { teamId, opponentId, rating, common, odds: matchOdds(rating?.odds ?? null, common.odds) };
}

/** A match's stored prediction (made by the importer, see prematch.ts) as odds for one of its teams. */
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

/**
 * The chances to show for a match to come: the live forecast, or else the importer's stored prediction.
 * A team that has not played in the pool yet has no lineups here, but the importer borrowed them from
 * an earlier pool or last season (prematch.ts). `stored` says the chances are that prediction.
 */
export function shownOdds(forecast: MatchForecast, match: TeamMatch): { odds: Odds | null; stored: boolean } {
  if (forecast.odds || match.score) return { odds: forecast.odds, stored: false };
  const stored = predictionOdds(match, forecast.teamId);
  return { odds: stored, stored: stored !== null };
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
      const odds = shownOdds(forecastMatch(pool, match, team.id, scale), match).odds;
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
