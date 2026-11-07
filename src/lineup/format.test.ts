import { afterEach, describe, expect, it } from 'vitest';
import { setLang } from '../i18n';
import { lineupMessage } from './format';
import { buildPlan } from './planner';
import type { PlannerState } from './types';

const state: PlannerState = {
  version: 1,
  teamName: 'Example 3',
  settings: { playersPerMatch: 3 },
  players: ['Ann', 'Bo', 'Cy', 'Di'].map((name, i) => ({ id: `p${i}`, name, active: true })),
  fixtures: [
    { id: 'f1', date: '2026-11-04T19:30', opponent: 'Rivals 1', home: true },
    { id: 'f2', date: '2026-11-11T19:00', opponent: 'Rivals 2', home: false },
  ],
  availability: { f1: { p0: 'yes', p1: 'yes', p2: 'no' } },
  overrides: {},
};

describe('lineupMessage', () => {
  afterEach(() => setLang('da', false));

  it('writes the message in Danish, the site\'s first language', () => {
    const lines = lineupMessage(state, buildPlan(state)).split('\n');
    expect(lines[0]).toBe('Example 3: opstillingsplan');
    expect(lines[1]).toBe('• ons. 4. nov. 19:30 mod Rivals 1 (hjemme): Ann, Bo (mangler 1, venter på Di)');
    expect(lines[2]).toBe('• ons. 11. nov. 19:00 mod Rivals 2 (ude): ingen svar endnu');
    expect(lines.at(-1)).toBe('Giv kaptajnen besked om hver kamp: Jeg kan, Måske eller Jeg kan ikke.');
  });

  it('lists lineups, who still has to answer, and matches nobody answered for', () => {
    setLang('en', false);
    const lines = lineupMessage(state, buildPlan(state)).split('\n');
    expect(lines[0]).toBe('Example 3: lineup plan');
    expect(lines[1]).toBe('• Wed 4 Nov 19:30 vs Rivals 1 (home): Ann, Bo (1 more needed, waiting for Di)');
    expect(lines[2]).toBe('• Wed 11 Nov 19:00 vs Rivals 2 (away): no answers yet');
    expect(lines.at(-1)).toBe("For every match, tell the captain: I can, Maybe or I can't.");
  });
});
