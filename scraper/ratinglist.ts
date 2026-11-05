/**
 * The official rating list (Bordtennis Danmark): its latest version, and which games it includes.
 *
 * A new version comes out about every two weeks, but each one only includes games up to an
 * earlier cutoff, which the portal does not show. The cutoff is found from a few players'
 * "Opnåede point" pages. These list every rated game with its team-match id, so a match day is
 * rated when a player's game that day is listed, and not yet rated when it is missing. A binary
 * search over the season's match days needs about half a dozen pages.
 */
import type { PoolData } from '../src/data/model.ts';
import { parseRatingListPage, parseRatingPoints, parseRatingVersions, type RatingPoints } from './parse.ts';
import type { PortalClient } from './portal.ts';

const RATING_PAGE = '/DBTU/Ranglister/';
const PLAYER_PAGE = '/DBTU/Spiller/VisSpiller/';

/** Where a player's rating points are: from the rating link in a pool's player stats. */
export interface RatingLink {
  listId: string;
  listPlayerId: string;
  seasonId: string;
}

/** Id of the rating list the portal shows by default (the overall list, 59). */
export async function defaultRatingList(client: PortalClient): Promise<string> {
  const { html } = await client.pageContext(RATING_PAGE);
  const listId = /DefaultRankingListID\s*=\s*(\d+)/.exec(html)?.[1];
  if (!listId) throw new Error('no DefaultRankingListID on the rating page');
  return listId;
}

/** Every version of a rating list in a season, newest first (YYYY-MM-DD). */
export async function ratingListVersions(client: PortalClient, listId: string, seasonId: string): Promise<string[]> {
  const result = await client.service('GetRankingListVersions', { rankinglistagegroupid: '', rankinglistid: listId, seasonid: seasonId }, RATING_PAGE);
  return parseRatingVersions(result);
}

/** The default rating list, and the date of its latest version (YYYY-MM-DD). */
export async function latestRatingList(client: PortalClient, seasonId: string): Promise<{ listId: string; seasonId: string; listDate: string }> {
  const listId = await defaultRatingList(client);
  const listDate = (await ratingListVersions(client, listId, seasonId))[0];
  if (!listDate) throw new Error('the rating list has no versions');
  return { listId, seasonId, listDate };
}

const LIST_PAGE_SIZE = 100;

/**
 * Every player's rating in one version of a rating list: about 50 pages of 100 players.
 * Only the player ids and ratings are read (see parseRatingListPage).
 */
export async function ratingListAt(client: PortalClient, listId: string, seasonId: string, date: string): Promise<Map<string, number>> {
  const [year, month, day] = date.split('-');
  const ratings = new Map<string, number>();
  for (let pageindex = 0; pageindex < 500; pageindex++) {
    const result = await client.service(
      'GetRankingListPlayers',
      {
        rankinglistagegroupid: '',
        rankinglistid: listId,
        seasonid: seasonId,
        rankinglistversiondate: `${month}/${day}/${year}`,
        agegroupid: '',
        classid: '',
        gender: '',
        clubid: '',
        // All players, not only recently active ones: about 4,600 instead of 2,500 in 2026, covering 96% of rated players.
        searchall: true,
        regionid: '',
        pointsfrom: '',
        pointsto: '',
        rankingfrom: '',
        rankingto: '',
        birthdatefromstring: '',
        birthdatetostring: '',
        agefrom: '',
        ageto: '',
        playerid: '',
        param: '',
        pageindex,
        sortfield: 0,
        getversions: false,
        getplayer: false,
      },
      RATING_PAGE,
    );
    const html = (result as { Html?: unknown } | null)?.Html;
    if (typeof html !== 'string') throw new Error(`no rating list for ${date}, page ${pageindex}`);
    const page = parseRatingListPage(html);
    for (const [id, rating] of page) ratings.set(id, rating);
    if (page.size < LIST_PAGE_SIZE) break;
  }
  return ratings;
}

/** One player's rating this season. Only the points table is read: the response's player details are ignored. */
export async function ratingPointsOf(client: PortalClient, playerId: string, link: RatingLink): Promise<RatingPoints> {
  const result = await client.service(
    'GetPlayerRankingListPoints',
    { seasonid: link.seasonId, playerid: playerId, rankinglistid: link.listId, rankinglistplayerid: link.listPlayerId, getplayerdata: false },
    PLAYER_PAGE,
  );
  const html = (result as { Html?: unknown } | null)?.Html;
  if (typeof html !== 'string') throw new Error(`no rating points for player ${playerId}`);
  return parseRatingPoints(html);
}

export interface CutoffSearch {
  /** Games up to this day (YYYY-MM-DD) are in the official list. */
  ratedThrough: string;
  /** The players looked up, with their rating pages. */
  probes: { playerId: string; points: RatingPoints }[];
}

/**
 * Finds the last match day the list of `listDate` includes. `probe` returns a player's rating
 * points, or null when the player cannot be looked up. Returns null when nothing could be learnt.
 */
export async function findRatedThrough(
  pools: readonly PoolData[],
  listDate: string,
  probe: (playerId: string) => Promise<RatingPoints | null>,
  maxProbes = 12,
): Promise<CutoffSearch | null> {
  // Singles between two rated players before the list date: only those are rated.
  const rated = new Set<string>();
  for (const pool of pools) for (const p of pool.players) if (p.rating !== null) rated.add(p.id);
  const gamesOf = new Map<string, { matchId: string; day: string }[]>();
  const playersOn = new Map<string, Set<string>>();
  const seen = new Set<string>();
  for (const pool of pools) {
    for (const match of pool.matches) {
      const day = match.date.slice(0, 10);
      if (!match.games || day >= listDate || seen.has(match.id)) continue;
      seen.add(match.id);
      for (const game of match.games) {
        if (game.kind !== 'single' || game.walkover || game.winner === null) continue;
        const [home] = game.home;
        const [away] = game.away;
        if (!home || !away || !rated.has(home) || !rated.has(away)) continue;
        for (const id of [home, away]) {
          const games = gamesOf.get(id) ?? [];
          games.push({ matchId: match.id, day });
          gamesOf.set(id, games);
          playersOn.set(day, (playersOn.get(day) ?? new Set()).add(id));
        }
      }
    }
  }
  const days = [...playersOn.keys()].sort();
  // No games before the list came out: whatever its cutoff, every game we have is still to be rated.
  if (days.length === 0) return { ratedThrough: dayBefore(listDate), probes: [] };

  const ratedDays = new Set<string>();
  /** Days on which a looked-up player's game is missing from their rated games, with those players. */
  const unrated = new Map<string, Set<string>>();
  const tried = new Set<string>();
  const probes: CutoffSearch['probes'] = [];
  const untried = (day: string) => [...(playersOn.get(day) ?? [])].filter((id) => !tried.has(id));

  while (probes.length < maxProbes) {
    const lower = latest(ratedDays);
    const upperDay = [...unrated.keys()].filter((d) => !lower || d > lower).sort()[0];
    const upper = upperDay ?? listDate;
    const open = days.filter((d) => (!lower || d > lower) && d < upper && untried(d).length > 0);
    let day: string | undefined;
    if (open.length > 0) day = open[Math.floor(open.length / 2)];
    // Nothing left in between: ask a second player about the first unrated day before trusting it.
    else if (upperDay && unrated.get(upperDay)!.size < 2 && untried(upperDay).length > 0) day = upperDay;
    if (!day) break;

    // The player with the most games in the open range tells the most.
    const inRange = (id: string) => (gamesOf.get(id) ?? []).filter((g) => (!lower || g.day > lower) && g.day < upper).length;
    const playerId = untried(day).sort((a, b) => inRange(b) - inRange(a) || a.localeCompare(b))[0];
    tried.add(playerId);
    const points = await probe(playerId);
    if (!points) continue;
    probes.push({ playerId, points });

    const ratedMatches = new Set<string>();
    for (const g of points.games) {
      if (!g.matchId) continue; // tournaments may follow another cutoff
      ratedMatches.add(g.matchId);
      ratedDays.add(g.date);
    }
    for (const g of gamesOf.get(playerId) ?? []) {
      if (ratedMatches.has(g.matchId)) ratedDays.add(g.day);
      else unrated.set(g.day, (unrated.get(g.day) ?? new Set()).add(playerId));
    }
  }

  if (probes.length === 0) return null;
  // No team game rated yet this season: every game we have is still to be rated.
  return { ratedThrough: latest(ratedDays) ?? dayBefore(days[0]), probes };
}

function latest(days: Set<string>): string | undefined {
  return [...days].sort().at(-1);
}

function dayBefore(day: string): string {
  return new Date(Date.parse(`${day}T00:00:00Z`) - 86_400_000).toISOString().slice(0, 10);
}

/** Ratings by version date; `players[id][i]` belongs to `versions[i]` (null: not on that list). */
export interface SeasonRatings {
  version: 1;
  listId: string;
  /** Every version the list has in this season, newest first. */
  available: string[];
  /** The versions read, oldest first. */
  versions: string[];
  players: Record<string, (number | null)[]>;
}

/**
 * The versions worth reading for a season whose matches ran from `first` to `last` (YYYY-MM-DD):
 * the one in force on the first match day, then others spread evenly up to the last match day,
 * at most `max`. A season whose list has no version that early gets its earliest one.
 */
export function chooseVersions(available: string[], first: string, last: string, max: number): string[] {
  const sorted = [...new Set(available)].sort();
  const before = sorted.filter((d) => d <= first).at(-1);
  const candidates = [...(before ? [before] : []), ...sorted.filter((d) => d > first && d <= last)];
  if (candidates.length === 0) return sorted.slice(0, 1);
  if (candidates.length <= max) return candidates;
  if (max <= 1) return candidates.slice(0, 1);
  const picked = new Set<string>();
  for (let i = 0; i < max; i++) picked.add(candidates[Math.round((i * (candidates.length - 1)) / (max - 1))]);
  return [...picked];
}

/** Adds one version's ratings, keeping `versions` oldest first and every player's list aligned with it. */
export function addVersion(ratings: SeasonRatings, date: string, list: Map<string, number>): void {
  const versions = [...ratings.versions, date].sort();
  const at = versions.indexOf(date);
  for (const values of Object.values(ratings.players)) values.splice(at, 0, null);
  for (const [id, rating] of list) {
    const values = ratings.players[id] ?? new Array<number | null>(versions.length).fill(null);
    values[at] = rating;
    ratings.players[id] = values;
  }
  ratings.versions = versions;
}
