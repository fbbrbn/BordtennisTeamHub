import { describe, expect, it } from 'vitest';
import type { PoolData } from '../src/data/model.ts';
import { playersOf } from './pool.ts';

// Made-up pools.
const pool = (id: string, players: PoolData['players']): PoolData => ({
  version: 1,
  pool: { id, seasonId: '42026', season: '2026/2027', regionId: 'r', ageGroupId: 'g', league: 'L', name: `Pool ${id}`, updatedAt: '' },
  teams: [],
  standings: [],
  matches: [],
  players,
});

describe('playersOf', () => {
  it('lists every player once with all their teams, A to Z, leaving out players without a team', () => {
    const index = playersOf([
      pool('2', [{ id: 'a', name: 'Åse Ås', teamId: 't3', rating: 1500 }]),
      pool('1', [
        { id: 'a', name: 'Åse Ås', teamId: 't1', rating: null },
        { id: 'b', name: 'Bo Berg', teamId: 't2', rating: null },
        { id: 'c', name: 'Cy Carl', teamId: null, rating: 1200 },
      ]),
    ]);
    expect(index.players).toEqual([
      { id: 'b', name: 'Bo Berg', rating: null, teams: [['1', 't2']] },
      { id: 'a', name: 'Åse Ås', rating: 1500, teams: [['1', 't1'], ['2', 't3']] },
    ]);
  });
});
