import { describe, expect, it } from 'vitest';
import { earliestSeason, headToHeadOf, headToHeadShard, headToHeadShards, mergeHeadToHead, playerHeadToHead } from './headtohead';
import type { Game, PoolData, TeamMatch } from './model';

// Made-up games between players 1001, 2001 and 3001.
const single = (home: string, away: string, homeWins: boolean, walkover = false): Game => ({
  label: 'A1/B1', kind: 'single', home: [home], away: [away], sets: homeWins ? [3, 1] : [1, 3], winner: homeWins ? 'home' : 'away', walkover,
});
const match = (id: string, date: string, games: Game[]): TeamMatch => ({
  id, date: `${date}T19:00`, homeTeamId: 'H', awayTeamId: 'A', venue: '', score: [1, 1], points: null, walkover: false, games,
});
const pool = (seasonId: string, season: string, matches: TeamMatch[]): PoolData => ({
  version: 1,
  pool: { id: `p${seasonId}`, seasonId, season, regionId: 'r', ageGroupId: 'g', league: 'L', name: 'P', updatedAt: '' },
  teams: [{ id: 'H', name: 'H' }, { id: 'A', name: 'A' }],
  standings: [],
  matches,
  players: [],
});

describe('head-to-head records', () => {
  const past = pool('42024', '2024/2025', [
    match('m1', '2024-10-01', [single('1001', '2001', true), single('1001', '3001', false, true)]),
    match('m2', '2025-03-01', [single('2001', '1001', true)]),
  ]);
  const current = pool('42026', '2026/2027', [
    match('m3', '2026-10-05', [
      single('1001', '2001', true),
      { label: 'D1', kind: 'double', home: ['1001', '1002'], away: ['2001', '2002'], sets: [3, 0], winner: 'home', walkover: false },
    ]),
  ]);

  it('count singles from both sides, without walkovers or doubles', () => {
    const index = headToHeadOf([past]);
    expect(index.get('1001')!.get('2001')).toEqual([1, 1, '2025-03-01', 0]);
    expect(index.get('2001')!.get('1001')).toEqual([1, 1, '2025-03-01', 1]);
    expect(index.get('1001')!.has('3001')).toBe(false);
    expect(headToHeadOf([current]).get('1002')).toBeUndefined();
  });

  it('add this season to past seasons, keeping the latest meeting', () => {
    expect(mergeHeadToHead([1, 1, '2025-03-01', 0], [1, 0, '2026-10-05', 1])).toEqual([2, 1, '2026-10-05', 1]);
    expect(mergeHeadToHead(undefined, [1, 0, '2026-10-05', 1])).toEqual([1, 0, '2026-10-05', 1]);
    const files = [...headToHeadShards(headToHeadOf([current]), '2026/2027').values(), ...headToHeadShards(headToHeadOf([past]), '2024/2025').values()];
    expect(playerHeadToHead(files, '1001').get('2001')).toEqual([2, 1, '2026-10-05', 1]);
    expect(playerHeadToHead([null], '1001').size).toBe(0);
  });

  it('go in files by the last three digits of the player id', () => {
    const shards = headToHeadShards(headToHeadOf([past]), earliestSeason([current, past]));
    expect([...shards.keys()].sort()).toEqual(['001']);
    expect(shards.get('001')!.from).toBe('2024/2025');
    expect(Object.keys(shards.get('001')!.players).sort()).toEqual(['1001', '2001']);
    expect(headToHeadShard('42')).toBe('042');
    expect(earliestSeason([])).toBe('');
  });
});
