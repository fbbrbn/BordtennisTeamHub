import { describe, expect, it } from 'vitest';
import { buildPlan } from './planner';
import type { Availability, PlannerState } from './types';

const IDS = ['a', 'b', 'c', 'd', 'e'];

function season(fixtureCount: number): PlannerState {
  const fixtures = Array.from({ length: fixtureCount }, (_, i) => {
    const day = new Date(Date.UTC(2026, 8, 1 + i * 7)).toISOString().slice(0, 10);
    return { id: `f${String(i + 1).padStart(2, '0')}`, date: `${day}T19:00`, opponent: `Team ${i + 1}`, home: i % 2 === 0 };
  });
  return {
    version: 1,
    teamName: 'Test team',
    settings: { playersPerMatch: 3 },
    players: IDS.map((id) => ({ id, name: id.toUpperCase(), active: true })),
    fixtures,
    availability: {},
    overrides: {},
  };
}

function answer(state: PlannerState, fixtureId: string, playerId: string, value: Availability) {
  (state.availability[fixtureId] ??= {})[playerId] = value;
}

/** Everyone answers "I can" for every match. */
function everyoneCan(state: PlannerState): PlannerState {
  for (const f of state.fixtures) for (const id of IDS) answer(state, f.id, id, 'yes');
  return state;
}

const totals = (state: PlannerState) => Object.fromEntries(buildPlan(state).tallies.map((t) => [t.playerId, t.total]));

describe('buildPlan', () => {
  it('plans nobody for a match until players answer', () => {
    const plan = buildPlan(season(4));
    for (const f of plan.fixtures) {
      expect(f.lineup).toEqual([]);
      expect(f.missing).toBe(3);
      expect(f.unanswered).toEqual(IDS);
    }
    expect(plan.tallies.every((t) => t.planned === 0)).toBe(true);
  });

  it('picks only players who said I can or Maybe', () => {
    const state = season(1);
    answer(state, 'f01', 'a', 'yes');
    answer(state, 'f01', 'b', 'maybe');
    answer(state, 'f01', 'c', 'no');
    const [only] = buildPlan(state).fixtures;
    expect(only.lineup).toEqual(['a', 'b']);
    expect(only.missing).toBe(1);
    expect(only.unanswered).toEqual(['d', 'e']);
    expect(only.reserves).toEqual([]);
  });

  it('gives the place to whoever has played least so far', () => {
    const state = season(3);
    state.fixtures[0].playedBy = ['a', 'b', 'c'];
    for (const id of IDS) answer(state, 'f02', id, 'yes');
    const next = buildPlan(state).fixtures[1].lineup;
    expect(next).toContain('d');
    expect(next).toContain('e');
  });

  it('bases the even share on matches played so far only', () => {
    const state = season(4);
    state.fixtures[0].playedBy = ['a', 'b', 'c'];
    state.fixtures[1].playedBy = ['a', 'b', 'd'];
    const plan = buildPlan(state);
    expect(plan.tallies[0].fairShare).toBeCloseTo(6 / 5);
    expect(plan.tallies.map((t) => t.total)).toEqual([2, 2, 1, 1, 0]);
  });

  it('splits matches evenly when everyone can play every match: 5 players, 3 per match, 10 matches = 6 each', () => {
    const plan = buildPlan(everyoneCan(season(10)));
    expect(plan.fixtures.every((f) => f.lineup.length === 3 && f.missing === 0)).toBe(true);
    expect(plan.tallies.map((t) => t.total)).toEqual([6, 6, 6, 6, 6]);
  });

  it('rotates rests so nobody sits out two matches in a row when everyone can play', () => {
    const plan = buildPlan(everyoneCan(season(10)));
    for (const id of IDS) {
      const rests = plan.fixtures.map((f) => !f.lineup.includes(id));
      for (let i = 1; i < rests.length; i++) expect(rests[i] && rests[i - 1]).toBe(false);
    }
  });

  it("never picks a player who said I can't, and gives them more of the matches they can make", () => {
    const state = everyoneCan(season(10));
    for (const f of ['f08', 'f09', 'f10']) answer(state, f, 'e', 'no');
    const plan = buildPlan(state);
    for (const f of plan.fixtures.slice(7)) expect(f.lineup).not.toContain('e');
    expect(totals(state)).toEqual({ a: 6, b: 6, c: 6, d: 6, e: 6 });
  });

  it('puts I can before Maybe, even for players who have played more', () => {
    const state = season(6);
    for (const f of state.fixtures.slice(0, 5)) f.playedBy = ['a', 'b', 'c'];
    for (const id of ['a', 'b', 'c']) answer(state, 'f06', id, 'yes');
    for (const id of ['d', 'e']) answer(state, 'f06', id, 'maybe');
    const last = buildPlan(state).fixtures[5];
    expect(last.lineup).toEqual(['a', 'b', 'c']);
    expect(last.reserves).toEqual(['d', 'e']);
  });

  it('fills the last places with Maybe when not enough players said I can', () => {
    const state = season(1);
    answer(state, 'f01', 'a', 'yes');
    answer(state, 'f01', 'b', 'yes');
    answer(state, 'f01', 'c', 'maybe');
    answer(state, 'f01', 'd', 'maybe');
    const [only] = buildPlan(state).fixtures;
    expect(only.lineup).toHaveLength(3);
    expect(only.lineup).toEqual(expect.arrayContaining(['a', 'b']));
    expect(only.reserves).toHaveLength(1);
    expect(only.unanswered).toEqual(['e']);
  });

  it('applies captain overrides: Must play without an answer, Rest despite I can', () => {
    const state = everyoneCan(season(1));
    delete state.availability.f01.e;
    state.overrides.f01 = { a: 'out', e: 'in' };
    const [only] = buildPlan(state).fixtures;
    expect(only.lineup).toContain('e');
    expect(only.lineup).not.toContain('a');
    expect(only.unanswered).toEqual([]);
  });

  it("flags Must play players who said I can't, and more Must plays than places", () => {
    const state = season(1);
    answer(state, 'f01', 'a', 'no');
    state.overrides.f01 = { a: 'in', b: 'in', c: 'in', d: 'in' };
    const [only] = buildPlan(state).fixtures;
    expect(only.conflicts).toEqual(['a']);
    expect(only.surplus).toBe(1);
  });

  it('orders a lineup strongest first when ratings are known', () => {
    const state = everyoneCan(season(1));
    state.players = state.players.map((p, i) => ({ ...p, rating: 1000 + i * 100 }));
    state.players[4].active = false;
    state.players[3].active = false;
    expect(buildPlan(state).fixtures[0].lineup).toEqual(['c', 'b', 'a']);
  });

  it('does not plan inactive players but keeps their played history', () => {
    const state = everyoneCan(season(4));
    state.fixtures[0].playedBy = ['a', 'b', 'e'];
    state.players[4].active = false;
    const plan = buildPlan(state);
    for (const f of plan.fixtures.slice(1)) expect(f.lineup).not.toContain('e');
    expect(plan.tallies.find((t) => t.playerId === 'e')).toMatchObject({ played: 1, planned: 0, fairShare: null });
  });

  it('is deterministic', () => {
    const state = everyoneCan(season(8));
    answer(state, 'f03', 'b', 'maybe');
    answer(state, 'f05', 'c', 'no');
    expect(buildPlan(state)).toEqual(buildPlan(structuredClone(state)));
  });
});
