import { describe, expect, it } from 'vitest';
import type { PoolData } from '../data/model';
import { emptyState } from './storage';
import { syncWithPool } from './sync';

// Made-up pool: team T plays U twice; the first match is played.
const pool: PoolData = {
  version: 1,
  pool: { id: 'p', seasonId: '42026', season: '2026/2027', regionId: 'r', ageGroupId: 'g', league: 'Test', name: 'Pool', updatedAt: '' },
  teams: [{ id: 'T', name: 'Team T' }, { id: 'U', name: 'Team U' }],
  standings: [],
  players: [
    { id: '1', name: 'One', teamId: 'T', rating: 1500 },
    { id: '2', name: 'Two', teamId: 'T', rating: 1400 },
    { id: '3', name: 'Three', teamId: 'T', rating: null },
    { id: '9', name: 'Nine', teamId: 'U', rating: 1300 },
  ],
  matches: [
    {
      id: 'm1', date: '2026-10-01T19:00', homeTeamId: 'T', awayTeamId: 'U', venue: 'Hall', score: [2, 0], points: [2, 0], walkover: false,
      games: [
        { label: 'A1/B1', kind: 'single', home: ['1'], away: ['9'], sets: [3, 0], winner: 'home', walkover: false },
        { label: 'A2/B1', kind: 'single', home: ['2'], away: ['9'], sets: [3, 1], winner: 'home', walkover: false },
      ],
    },
    { id: 'm2', date: '2026-11-01T19:00', homeTeamId: 'U', awayTeamId: 'T', venue: 'Other hall', score: null, points: null, walkover: false, games: null },
  ],
};

describe('syncWithPool', () => {
  it('fills an empty plan with the team, its players and its fixtures', () => {
    const state = syncWithPool(emptyState(), pool, 'T');
    expect(state.teamName).toBe('Team T');
    expect(state.players.map((p) => [p.name, p.portalId, p.rating ?? null, p.active])).toEqual([
      ['One', '1', 1500, true],
      ['Two', '2', 1400, true],
      ['Three', '3', null, true],
    ]);
    expect(state.fixtures.map((f) => [f.portalId, f.opponent, f.home, f.date])).toEqual([
      ['m1', 'Team U', true, '2026-10-01T19:00'],
      ['m2', 'Team U', false, '2026-11-01T19:00'],
    ]);
    const byPortal = new Map(state.players.map((p) => [p.portalId, p.id]));
    expect(state.fixtures[0].playedBy).toEqual([byPortal.get('1'), byPortal.get('2')]);
    expect(state.fixtures[1].playedBy).toBeUndefined();
  });

  it('keeps captain changes and returns the same object when nothing changed', () => {
    const first = syncWithPool(emptyState(), pool, 'T');
    const edited = structuredClone(first);
    edited.players[2].active = false;
    edited.players[0].name = 'Captain renamed';
    edited.availability = { [edited.fixtures[1].id]: { [edited.players[0].id]: 'yes' } };
    const again = syncWithPool(edited, pool, 'T');
    expect(again).toBe(edited);
  });

  it('records new results and schedule changes on the next sync', () => {
    const first = syncWithPool(emptyState(), pool, 'T');
    const later = structuredClone(pool);
    later.matches[1] = {
      ...later.matches[1], date: '2026-11-03T18:30', score: [1, 1], points: [1, 1],
      games: [{ label: 'A1/B1', kind: 'single', home: ['9'], away: ['3'], sets: [3, 2], winner: 'home', walkover: false }],
    };
    const next = syncWithPool(first, later, 'T');
    const three = next.players.find((p) => p.portalId === '3')!;
    expect(next.fixtures[1].date).toBe('2026-11-03T18:30');
    expect(next.fixtures[1].playedBy).toEqual([three.id]);
  });
});
