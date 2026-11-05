import { describe, expect, it } from 'vitest';
import type { Game, PoolData } from '../src/data/model.ts';
import { careerShards, shardOf } from './careers.ts';

// Made-up pools from two seasons.
const single = (home: string, away: string, homeWins: boolean): Game => ({
  label: 'A1/B1', kind: 'single', home: [home], away: [away], sets: homeWins ? [3, 0] : [0, 3], winner: homeWins ? 'home' : 'away', walkover: false,
});
const pool = (seasonId: string, id: string, games: Game[]): PoolData => ({
  version: 1,
  pool: { id, seasonId, season: `${seasonId.slice(1)}/${Number(seasonId.slice(1)) + 1}`, regionId: 'r', ageGroupId: 'g', league: 'L', name: `Pool ${id}`, updatedAt: '' },
  teams: [{ id: 'H', name: 'Alpha 1', club: 'Alpha' }, { id: 'A', name: 'Beta 2', club: 'Beta' }],
  standings: [],
  matches: [{ id: `m${id}`, date: '2024-10-01T19:00', homeTeamId: 'H', awayTeamId: 'A', venue: '', score: [1, 1], points: null, walkover: false, games }],
  players: [
    { id: '1001', name: 'A', teamId: 'H', rating: 1500 },
    { id: '2001', name: 'B', teamId: 'A', rating: null },
  ],
});

describe('careerShards', () => {
  it("keeps every player's teams by season, newest first, in the shard of their id", () => {
    const shards = careerShards([
      pool('42023', 'p1', [single('1001', '2001', true)]),
      pool('42024', 'p2', [single('1001', '2001', false), single('1001', '2001', true)]),
    ]);
    expect(shardOf('1001')).toBe('001');
    expect(shardOf('7')).toBe('007');
    expect([...shards.keys()]).toEqual(['001']);
    const a = shards.get('001')!.players['1001'];
    expect(a.map((e) => [e.season, e.team, e.club, e.matches, e.singles, e.rating, e.from])).toEqual([
      ['2024/2025', 'Alpha 1', 'Alpha', 1, [1, 1], 1500, '2024-10-01'],
      ['2023/2024', 'Alpha 1', 'Alpha', 1, [1, 0], 1500, '2024-10-01'],
    ]);
    expect(shards.get('001')!.players['2001'][0].rating).toBeNull();
  });
});
