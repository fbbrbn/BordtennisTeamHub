import { describe, expect, it } from 'vitest';
import { buildPlan } from './planner';
import type { Availability, PlannerState } from './types';

const IDS = ['a', 'b', 'c', 'd', 'e'];

function season(fixtureCount: number, overrides: Partial<PlannerState> = {}): PlannerState {
  const fixtures = Array.from({ length: fixtureCount }, (_, i) => {
    const day = new Date(Date.UTC(2026, 8, 1 + i * 7)).toISOString().slice(0, 10);
    return { id: `f${String(i + 1).padStart(2, '0')}`, date: `${day}T19:00`, opponent: `Team ${i + 1}`, home: i % 2 === 0 };
  });
  return {
    version: 1,
    teamName: 'Test team',
    settings: { playersPerMatch: 3, preferConfirmed: true },
    players: IDS.map((id) => ({ id, name: id.toUpperCase(), active: true })),
    fixtures,
    availability: {},
    overrides: {},
    ...overrides,
  };
}

function answer(state: PlannerState, fixtureId: string, playerId: string, value: Availability) {
  (state.availability[fixtureId] ??= {})[playerId] = value;
}

const totals = (state: PlannerState) =>
  Object.fromEntries(buildPlan(state).tallies.map((t) => [t.playerId, t.total]));

describe('buildPlan', () => {
  it('splits an unanswered season evenly: 5 players, 3 per match, 10 matches = 6 each', () => {
    const plan = buildPlan(season(10));
    expect(plan.fixtures.every((f) => f.lineup.length === 3 && f.missing === 0)).toBe(true);
    expect(plan.tallies.map((t) => t.total)).toEqual([6, 6, 6, 6, 6]);
    expect(plan.tallies[0].fairShare).toBe(6);
  });

  it('rotates rests so nobody sits out two matches in a row when everyone can play', () => {
    const plan = buildPlan(season(10));
    for (const id of IDS) {
      const rests = plan.fixtures.map((f) => !f.lineup.includes(id));
      for (let i = 1; i < rests.length; i++) expect(rests[i] && rests[i - 1]).toBe(false);
    }
  });

  it('never picks a player who said no, and lets them play earlier to keep the season balanced', () => {
    const state = season(10);
    for (const f of ['f08', 'f09', 'f10']) answer(state, f, 'e', 'no');
    const plan = buildPlan(state);
    for (const f of plan.fixtures.slice(7)) expect(f.lineup).not.toContain('e');
    expect(totals(state)).toEqual({ a: 6, b: 6, c: 6, d: 6, e: 6 });
  });

  it('applies captain overrides before anything else', () => {
    const state = season(4);
    state.overrides.f01 = { a: 'out', e: 'in' };
    const first = buildPlan(state).fixtures[0];
    expect(first.lineup).toContain('e');
    expect(first.lineup).not.toContain('a');
  });

  it('counts matches already played when planning the rest of the season', () => {
    const state = season(10);
    state.fixtures[0].playedBy = ['a', 'b', 'c'];
    state.fixtures[1].playedBy = ['a', 'b', 'c'];
    const plan = buildPlan(state);
    expect(plan.fixtures[0].status).toBe('played');
    expect(totals(state)).toEqual({ a: 6, b: 6, c: 6, d: 6, e: 6 });
    const nextTwo = plan.fixtures.slice(2, 4).flatMap((f) => f.lineup);
    expect(nextTwo.filter((id) => id === 'd' || id === 'e')).toHaveLength(4);
  });

  it('picks confirmed players first when preferConfirmed is on, balance first when off', () => {
    const state = season(6);
    for (const f of state.fixtures.slice(0, 5)) f.playedBy = ['a', 'b', 'c'];
    for (const id of ['a', 'b', 'c']) answer(state, 'f06', id, 'yes');
    for (const id of ['d', 'e']) answer(state, 'f06', id, 'maybe');

    expect(buildPlan(state).fixtures[5].lineup).toEqual(['a', 'b', 'c']);

    state.settings.preferConfirmed = false;
    const relaxed = buildPlan(state).fixtures[5].lineup;
    expect(relaxed).toContain('d');
    expect(relaxed).toContain('e');
  });

  it('reports open slots when too few players can make it', () => {
    const state = season(1);
    for (const id of ['c', 'd', 'e']) answer(state, 'f01', id, 'no');
    const [only] = buildPlan(state).fixtures;
    expect(only.lineup).toEqual(['a', 'b']);
    expect(only.missing).toBe(1);
    expect(only.reserves).toEqual([]);
  });

  it('flags players forced in although they said no, and forced-in players beyond the slots', () => {
    const state = season(1);
    answer(state, 'f01', 'a', 'no');
    state.overrides.f01 = { a: 'in', b: 'in', c: 'in', d: 'in' };
    const [only] = buildPlan(state).fixtures;
    expect(only.conflicts).toEqual(['a']);
    expect(only.surplus).toBe(1);
  });

  it('orders a lineup strongest first when ratings are known', () => {
    const state = season(1);
    state.players = state.players.map((p, i) => ({ ...p, rating: 1000 + i * 100 }));
    state.players[4].active = false;
    state.players[3].active = false;
    expect(buildPlan(state).fixtures[0].lineup).toEqual(['c', 'b', 'a']);
  });

  it('does not plan inactive players but keeps their played history', () => {
    const state = season(4);
    state.fixtures[0].playedBy = ['a', 'b', 'e'];
    state.players[4].active = false;
    const plan = buildPlan(state);
    for (const f of plan.fixtures.slice(1)) expect(f.lineup).not.toContain('e');
    const e = plan.tallies.find((t) => t.playerId === 'e');
    expect(e).toMatchObject({ played: 1, planned: 0, fairShare: null });
  });

  it('is deterministic', () => {
    const state = season(8);
    answer(state, 'f03', 'b', 'maybe');
    answer(state, 'f05', 'c', 'no');
    expect(buildPlan(state)).toEqual(buildPlan(structuredClone(state)));
  });
});
