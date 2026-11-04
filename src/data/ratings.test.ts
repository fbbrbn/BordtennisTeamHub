import { describe, expect, it } from 'vitest';
import type { Game, PoolData, TeamMatch } from './model';
import { forecastRatings, matchRatingPoints, ratingPoints, ratingTable } from './ratings';

describe('ratingPoints', () => {
  it('matches games rated by the portal', () => {
    // From the portal's "Opnåede point" pages: [own, opponent, won, points].
    const rated: [number, number, boolean, number][] = [
      [1150, 1183, true, 12],
      [1150, 1228, true, 19],
      [1150, 1115, true, 6],
      [1457, 1200, true, 2],
      [1457, 983, true, 1],
      [1243, 1503, false, -2],
      [1000, 1060, false, -3],
      [1035, 964, false, -14],
      [2923, 2661, false, -18],
      [2500, 2200, false, -15],
      [2175, 1980, false, -20],
      [1174, 1627, true, 22],
    ];
    for (const [own, opp, won, points] of rated) expect(ratingPoints(own, opp, won)).toBe(points);
  });

  it('uses the same points for both players within 24 points of each other', () => {
    expect(ratingPoints(1200, 1200, true)).toBe(7);
    expect(ratingPoints(1200, 1224, true)).toBe(7);
    expect(ratingPoints(1224, 1200, false)).toBe(-5);
    expect(ratingPoints(1200, 1225, true)).toBe(12);
  });

  it('is not zero-sum: wins are worth more than losses cost', () => {
    expect(ratingPoints(1300, 1200, true) + ratingPoints(1200, 1300, false)).toBe(0);
    expect(ratingPoints(1200, 1300, true) + ratingPoints(1300, 1200, false)).toBe(2);
    expect(ratingPoints(1210, 1200, true) + ratingPoints(1200, 1210, false)).toBe(2);
  });
});

const single = (home: string, away: string, homeWins: boolean, walkover = false): Game => ({
  label: 'A1/B1', kind: 'single', home: [home], away: [away], sets: homeWins ? [3, 1] : [1, 3], winner: homeWins ? 'home' : 'away', walkover,
});
const match = (id: string, date: string, games: Game[]): TeamMatch => ({
  id, date: `${date}T19:00`, homeTeamId: 'H', awayTeamId: 'A', venue: 'Hall', score: [1, 1], points: [1, 1], walkover: false, games,
});
const pool = (matches: TeamMatch[], ratings: Record<string, number | null>): PoolData => ({
  version: 1,
  pool: { id: 'p', seasonId: '42026', season: '2026/2027', regionId: 'r', ageGroupId: 'g', league: 'L', name: 'P', updatedAt: '' },
  teams: [],
  standings: [],
  matches,
  players: Object.entries(ratings).map(([id, rating]) => ({ id, name: id, teamId: null, rating })),
});

describe('forecastRatings', () => {
  it('rates only games after the cutoff, updating ratings after each match day', () => {
    const p = pool(
      [
        match('m0', '2026-10-01', [single('a', 'b', true)]), // already in the official list
        match('m1', '2026-10-10', [single('a', 'b', true), single('a', 'c', true)]),
        match('m2', '2026-10-20', [single('a', 'b', false)]),
      ],
      { a: 1150, b: 1183, c: 1228 },
    );
    const f = forecastRatings([p], '2026-10-08');
    // 10 Oct: a beats b (+12, b -10) and c (+19, c -17), both at a's rating 1150.
    // 20 Oct: a is 1181, b is 1173: a loses as favourite in the first band (-5), b +7.
    expect(f.get('a')!.games.map((g) => [g.date, g.own, g.opp, g.points])).toEqual([
      ['2026-10-10', 1150, 1183, 12],
      ['2026-10-10', 1150, 1228, 19],
      ['2026-10-20', 1181, 1173, -5],
    ]);
    expect(f.get('a')!.rating).toBe(1176);
    expect(f.get('b')!.rating).toBe(1183 - 10 + 7);
    expect(f.get('c')!.rating).toBe(1228 - 17);
  });

  it('skips doubles, walkovers and unrated players, and counts a match once across pools', () => {
    const doubles: Game = { label: '1. HD', kind: 'double', home: ['a', 'x'], away: ['b', 'y'], sets: [3, 0], winner: 'home', walkover: false };
    const m = match('m1', '2026-10-10', [doubles, single('a', 'b', true, true), single('a', 'u', true)]);
    const f = forecastRatings([pool([m], { a: 1200, b: 1200, u: null }), pool([m], { a: 1200 })], '2026-10-08');
    expect(f.size).toBe(0);
  });
});

describe('ratingTable', () => {
  it('lists every band with the points ratingPoints uses', () => {
    const table = ratingTable();
    expect(table.map((r) => [r.from, r.to])).toEqual([[0, 25], [25, 50], [50, 75], [75, 100], [100, 200], [200, 300], [300, null]]);
    for (const row of table) {
      const gap = row.from + 1;
      expect(ratingPoints(1000 + gap, 1000, true)).toBe(row.favouriteWins);
      expect(ratingPoints(1000 + gap, 1000, false)).toBe(row.favouriteLoses);
      expect(ratingPoints(1000, 1000 + gap, true)).toBe(row.underdogWins);
      expect(ratingPoints(1000, 1000 + gap, false)).toBe(row.underdogLoses);
    }
  });
});

describe('matchRatingPoints', () => {
  it("sums each player's points from one match, home players first", () => {
    const m1 = match('m1', '2026-10-10', [single('a', 'b', true), single('c', 'b', false), single('a', 'd', true)]);
    const p = pool([m1, match('m2', '2026-10-20', [single('a', 'b', false)])], { a: 1150, b: 1183, c: 1228, d: 1100 });
    for (const [id, forecast] of forecastRatings([p], '2026-10-08')) p.players.find((x) => x.id === id)!.forecast = forecast;
    const lines = matchRatingPoints(p, m1);
    // a beats b (33 higher: +12) and d (50 lower: +5); b beats c (45 higher: +12) and loses to a (-10).
    expect(lines.map((l) => [l.playerId, l.side, l.before, l.points, l.games])).toEqual([
      ['a', 'home', 1150, 12 + 5, 2],
      ['c', 'home', 1228, -10, 1],
      ['b', 'away', 1183, -10 + 12, 2],
      ['d', 'away', 1100, -3, 1],
    ]);
    expect(matchRatingPoints(p, match('m0', '2026-10-01', [single('a', 'b', true)]))).toEqual([]);
  });
});
