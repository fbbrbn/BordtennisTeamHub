import { describe, expect, it } from 'vitest';
import type { Game, TeamMatch } from '../src/data/model.ts';
import { recordDifferences } from './verify.ts';

// Made-up games: no real players.
const game = (label: string, home: string[], away: string[], winner: 'home' | 'away', walkover = false): Game => ({
  label, kind: 'single', home, away, sets: winner === 'home' ? [3, 0] : [0, 3], winner, walkover,
});
const match: TeamMatch = {
  id: 'm1', date: '2026-10-01T19:00', homeTeamId: 'A', awayTeamId: 'B', venue: 'Hall', score: [3, 1], points: [2, 0], walkover: false,
  games: [
    game('A1/B1', ['a1'], ['b1'], 'home'),
    game('A2/B2', ['a2'], [], 'home', true),
    game('A1/B2', ['a1'], ['b2'], 'away'),
    game('Golden Set (påfør ukendt spiller som makker)', ['a2'], ['b1'], 'home'),
  ],
};

describe('recordDifferences', () => {
  it("finds the players whose singles record differs from the portal's, counting walkovers and not golden sets", () => {
    const portal = new Map([
      ['a1', { won: 1, games: 2 }],
      ['a2', { won: 1, games: 1 }],
      ['b1', { won: 1, games: 1 }],
    ]);
    // a2: the walkover counts and the golden set does not, as on the portal. b1 differs: a corrected card, say.
    expect(recordDifferences({ matches: [match] }, portal)).toEqual([{ playerId: 'b1', portal: [1, 1], here: [0, 1] }]);
  });

  it('leaves out players we have but the portal does not list', () => {
    expect(recordDifferences({ matches: [match] }, new Map())).toEqual([]);
  });
});
