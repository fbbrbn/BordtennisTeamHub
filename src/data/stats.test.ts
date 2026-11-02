import { describe, expect, it } from 'vitest';
import type { Game, PoolData, TeamMatch } from './model';
import { outcomeFor, playerGames, pointsRace, scoreFor, summarize, teamPlayerLines, winRate } from './stats';

const single = (home: string, away: string, sets: [number, number]): Game => ({
  label: 'A1/B1', kind: 'single', home: [home], away: [away], sets, winner: sets[0] > sets[1] ? 'home' : 'away', walkover: false,
});
const double = (home: string[], away: string[], sets: [number, number]): Game => ({
  label: '1. HD', kind: 'double', home, away, sets, winner: sets[0] > sets[1] ? 'home' : 'away', walkover: false,
});
const match = (id: string, date: string, home: string, away: string, games: Game[] | null, points: [number, number] | null): TeamMatch => {
  const won = games ? games.filter((g) => g.winner === 'home').length : 0;
  return {
    id, date, homeTeamId: home, awayTeamId: away, venue: 'Hall',
    score: games ? [won, games.length - won] : null, points, walkover: false, games,
  };
};

// Made-up pool: A beats B 2-1, then C and A draw 1-1; B v C is not played yet.
const pool: PoolData = {
  version: 1,
  pool: { id: 'p', seasonId: '42026', season: '2026/2027', regionId: 'r', ageGroupId: 'g', league: 'Test', name: 'Pool', updatedAt: '' },
  teams: [{ id: 'A', name: 'Alpha' }, { id: 'B', name: 'Beta' }, { id: 'C', name: 'Gamma' }],
  standings: [],
  players: [
    { id: 'a1', name: 'Ann', teamId: 'A', rating: 1400 },
    { id: 'a2', name: 'Al', teamId: 'A', rating: 1200 },
    { id: 'b1', name: 'Bea', teamId: 'B', rating: 1300 },
    { id: 'b2', name: 'Bo', teamId: 'B', rating: 1250 },
    { id: 'c1', name: 'Cy', teamId: 'C', rating: null },
  ],
  matches: [
    match('m1', '2026-09-01T19:00', 'A', 'B', [double(['a1', 'a2'], ['b1', 'b2'], [3, 2]), single('a1', 'b1', [3, 1]), single('a2', 'b1', [0, 3])], [2, 0]),
    match('m2', '2026-09-08T19:00', 'C', 'A', [single('c1', 'a1', [3, 2]), single('c1', 'a2', [1, 3])], [1, 1]),
    match('m3', '2026-09-15T19:00', 'B', 'C', null, null),
  ],
};

describe('stats', () => {
  it('scores and outcomes from either side', () => {
    const [m1, m2] = pool.matches;
    expect(scoreFor(m1, 'A')).toEqual([2, 1]);
    expect(scoreFor(m1, 'B')).toEqual([1, 2]);
    expect(outcomeFor(m1, 'A')).toBe('won');
    expect(outcomeFor(m2, 'A')).toBe('drawn');
    expect(outcomeFor(pool.matches[2], 'B')).toBeNull();
  });

  it('builds cumulative points per team, skipping unplayed matches', () => {
    expect(pointsRace(pool)).toEqual([
      { teamId: 'A', points: [0, 2, 3] },
      { teamId: 'B', points: [0, 0] },
      { teamId: 'C', points: [0, 1] },
    ]);
  });

  it("collects a player's games with partners, opponents and sets", () => {
    const games = playerGames(pool, 'a1');
    expect(games.map((g) => [g.match.id, g.game.kind, g.won, g.setsFor, g.setsAgainst])).toEqual([
      ['m1', 'double', true, 3, 2],
      ['m1', 'single', true, 3, 1],
      ['m2', 'single', false, 2, 3],
    ]);
    expect(games[0].partners).toEqual(['a2']);
    expect(games[2].opponents).toEqual(['c1']);
    expect(summarize(games)).toEqual({ matches: 2, singles: { won: 1, lost: 1 }, doubles: { won: 1, lost: 0 }, sets: { won: 8, lost: 6 } });
  });

  it("lists a team's players, most matches first", () => {
    const lines = teamPlayerLines(pool, 'A');
    expect(lines.map((l) => [l.playerId, l.matches, l.singles.won, l.singles.lost])).toEqual([
      ['a1', 2, 1, 1],
      ['a2', 2, 1, 1],
    ]);
  });

  it('computes win rates and handles no games', () => {
    expect(winRate({ won: 3, lost: 1 })).toBe(0.75);
    expect(winRate({ won: 0, lost: 0 })).toBeNull();
  });
});
