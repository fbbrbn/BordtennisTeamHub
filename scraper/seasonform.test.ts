import { describe, expect, it } from 'vitest';
import { lastSeasonOf, SEASON_FORM_VERSION, seasonFormFile } from './seasonform.ts';

describe('season form files', () => {
  it('keep players and teams for the next season', () => {
    const replay = { tallies: new Map([['p1', { games: 10, above: 1.234 }]]), youth: new Set(['p2']) };
    const teams = new Map([['4006|btk 2', [{ ids: ['p1', 'p2', 'p3'], weight: 3 }]]]);
    const file = seasonFormFile('42025', replay, teams);
    expect(file.version).toBe(SEASON_FORM_VERSION);
    expect(file.players).toEqual({ p1: [10, 1.23, 0], p2: [0, 0, 1] });
    const last = lastSeasonOf(JSON.parse(JSON.stringify(file)));
    expect(last.players.get('p1')).toEqual({ games: 10, above: 1.23, youth: false });
    expect(last.players.get('p2')!.youth).toBe(true);
    expect(last.teams.get('4006|btk 2')).toEqual([{ ids: ['p1', 'p2', 'p3'], weight: 3 }]);
  });

  it('read a version 1 file without teams', () => {
    const last = lastSeasonOf({ version: 1, seasonId: '42024', players: { p1: [5, -1, 0] } });
    expect(last.players.get('p1')).toEqual({ games: 5, above: -1, youth: false });
    expect(last.teams.size).toBe(0);
  });
});
