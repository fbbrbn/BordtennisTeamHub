import { describe, expect, it } from 'vitest';
import type { Game, PoolData, TeamMatch } from '../src/data/model.ts';
import type { RatingPoints } from './parse.ts';
import { addVersion, chooseVersions, findRatedThrough, type SeasonRatings } from './ratinglist.ts';

// Made-up pools: player pN plays pN+1 in match mN on day N of October.
const single = (home: string, away: string): Game => ({
  label: 'A1/B1', kind: 'single', home: [home], away: [away], sets: [3, 1], winner: 'home', walkover: false,
});
const day = (n: number) => `2026-10-${String(n).padStart(2, '0')}`;
const pool = (days: number[]): PoolData => ({
  version: 1,
  pool: { id: 'p', seasonId: '42026', season: '2026/2027', regionId: 'r', ageGroupId: 'g', league: 'L', name: 'P', updatedAt: '' },
  teams: [],
  standings: [],
  matches: days.map(
    (n): TeamMatch => ({
      id: `m${n}`, date: `${day(n)}T19:00`, homeTeamId: 'H', awayTeamId: 'A', venue: '', score: [1, 0], points: [2, 0], walkover: false,
      games: [single(`p${n}`, `p${n + 1}`)],
    }),
  ),
  players: days.flatMap((n) => [n, n + 1]).map((n) => ({ id: `p${n}`, name: `P ${n}`, teamId: null, rating: 1200 })),
});

/** The portal as if every team match up to `cutoff` were rated, plus `extra` rows. */
function portal(data: PoolData, cutoff: string, extra: RatingPoints['games'] = []) {
  const asked: string[] = [];
  const probe = async (playerId: string): Promise<RatingPoints> => {
    asked.push(playerId);
    const games = data.matches
      .filter((m) => m.date.slice(0, 10) <= cutoff && m.games!.some((g) => g.home[0] === playerId || g.away[0] === playerId))
      .map((m) => ({ date: m.date.slice(0, 10), matchId: m.id, own: 1200, opp: 1200, points: 7 }));
    return { start: { date: '2026-07-01', rating: 1200 }, games: [...games, ...extra] };
  };
  return { probe, asked };
}

describe('findRatedThrough', () => {
  it('finds the last rated match day with a handful of lookups', async () => {
    const data = pool([1, 2, 3, 5, 6, 8, 9, 10, 12, 13, 14, 15, 16, 19, 20, 21, 22]);
    const { probe, asked } = portal(data, day(8));
    const found = await findRatedThrough([data], day(23), probe);
    expect(found?.ratedThrough).toBe(day(8));
    expect(asked.length).toBeLessThanOrEqual(7);
  });

  it('ignores tournament games, which may follow another cutoff', async () => {
    const data = pool([1, 3, 5, 7, 9]);
    const { probe } = portal(data, day(3), [{ date: day(8), matchId: null, own: 1200, opp: 1300, points: 12 }]);
    expect((await findRatedThrough([data], day(10), probe))?.ratedThrough).toBe(day(3));
  });

  it('asks a second player before trusting a missing game', async () => {
    // p5's game on day 5 is missing (registered late, say), but p6 shows that day is rated.
    const data = pool([1, 3, 5, 7, 9]);
    const { probe: honest } = portal(data, day(7));
    const probe = async (id: string) => {
      const points = await honest(id);
      return id === 'p5' ? { ...points, games: points.games.filter((g) => g.date !== day(5)) } : points;
    };
    expect((await findRatedThrough([data], day(10), probe))?.ratedThrough).toBe(day(7));
  });

  it('handles a list with no team games yet', async () => {
    const data = pool([12, 15]);
    expect((await findRatedThrough([data], day(10), portal(data, day(9)).probe))?.ratedThrough).toBe(day(9));
    const { probe } = portal(data, day(1));
    expect((await findRatedThrough([data], day(20), probe))?.ratedThrough).toBe(day(11));
  });

  it('gives up when no player can be looked up', async () => {
    expect(await findRatedThrough([pool([1, 2])], day(10), async () => null)).toBeNull();
  });
});

describe('chooseVersions', () => {
  const weekly = Array.from({ length: 52 }, (_, i) => new Date(Date.UTC(2015, 6, 2 + 7 * i)).toISOString().slice(0, 10)).reverse();

  it('starts with the list in force on the first match day and spreads the rest over the season', () => {
    const chosen = chooseVersions(weekly, '2015-09-20', '2016-04-10', 6);
    expect(chosen).toHaveLength(6);
    expect(chosen[0]).toBe('2015-09-17');
    expect(chosen.at(-1)).toBe('2016-04-07');
    expect([...chosen].sort()).toEqual(chosen);
  });

  it('takes every version when there are few, and the earliest when none is that early', () => {
    expect(chooseVersions(['2015-10-01', '2015-09-01'], '2015-09-20', '2016-04-10', 12)).toEqual(['2015-09-01', '2015-10-01']);
    expect(chooseVersions(['2012-07-05', '2012-06-28'], '2011-10-03', '2012-04-01', 12)).toEqual(['2012-06-28']);
  });
});

describe('addVersion', () => {
  it('keeps versions oldest first and every player aligned with them', () => {
    const ratings: SeasonRatings = { version: 1, listId: '59', available: [], versions: [], players: {} };
    addVersion(ratings, '2015-10-01', new Map([['a', 1200], ['b', 1100]]));
    addVersion(ratings, '2015-09-01', new Map([['a', 1180], ['c', 900]]));
    expect(ratings.versions).toEqual(['2015-09-01', '2015-10-01']);
    expect(ratings.players).toEqual({ a: [1180, 1200], b: [null, 1100], c: [900, null] });
  });
});
