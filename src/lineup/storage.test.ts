import { describe, expect, it } from 'vitest';
import { decodeState, emptyState, encodeState, normalizeState } from './storage';
import type { PlannerState } from './types';

function sample(): PlannerState {
  const state = emptyState('Example BTK 3');
  state.players = [
    { id: 'p1', name: 'Player One', active: true, rating: 1450 },
    { id: 'p2', name: 'Player Two', active: false },
  ];
  state.fixtures = [
    { id: 'f1', date: '2026-11-14T19:00', opponent: 'Opponent 2', home: true },
    { id: 'f2', date: '2026-11-28', opponent: 'Opponent 4', home: false, playedBy: ['p1'] },
  ];
  state.availability = { f1: { p1: 'yes', p2: 'no' } };
  state.overrides = { f1: { p1: 'in' } };
  return state;
}

describe('share links', () => {
  it('round-trips a plan through a compressed token', async () => {
    const token = await encodeState(sample());
    expect(token.startsWith('z')).toBe(true);
    expect(token).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(await decodeState(token)).toEqual(sample());
  });

  it('returns null for damaged tokens instead of throwing', async () => {
    const token = await encodeState(sample());
    expect(await decodeState(token.slice(0, 20))).toBeNull();
    expect(await decodeState('x' + token.slice(1))).toBeNull();
    expect(await decodeState('')).toBeNull();
  });
});

describe('normalizeState', () => {
  it('rejects anything that is not a version 1 plan', () => {
    expect(normalizeState(null)).toBeNull();
    expect(normalizeState([])).toBeNull();
    expect(normalizeState({ version: 2 })).toBeNull();
  });

  it('drops malformed entries and references to unknown players or matches', () => {
    const raw = {
      ...sample(),
      players: [...sample().players, { id: 'bad id!', name: 'x' }, { id: 'p1', name: 'duplicate' }],
      fixtures: [...sample().fixtures, { id: 'f3', date: 'next tuesday', opponent: 'x' }],
      availability: { f1: { p1: 'yes', ghost: 'yes', p2: 'perhaps' }, nope: { p1: 'no' } },
      overrides: { f1: { p1: 'in', p2: 'always' } },
      settings: { playersPerMatch: 99, preferConfirmed: false },
    };
    const state = normalizeState(raw)!;
    expect(state.players.map((p) => p.id)).toEqual(['p1', 'p2']);
    expect(state.fixtures.map((f) => f.id)).toEqual(['f1', 'f2']);
    expect(state.availability).toEqual({ f1: { p1: 'yes' } });
    expect(state.overrides).toEqual({ f1: { p1: 'in' } });
    expect(state.settings).toEqual({ playersPerMatch: 3, preferConfirmed: false });
  });
});
