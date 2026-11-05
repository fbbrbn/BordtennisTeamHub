import { describe, expect, it } from 'vitest';
import type { PlayerEntry, PoolRef } from '../data/model';
import { matchPlayers } from './StartPage';

// Made-up players and pools.
const pool = (id: string, teams: [string, string][]): PoolRef => ({
  id,
  seasonId: '42026',
  season: '2026/2027',
  regionId: 'r',
  ageGroupId: 'g',
  league: 'L',
  name: `Pool ${id}`,
  updatedAt: '',
  teams: teams.map(([teamId, name]) => ({ id: teamId, name, club: name.replace(/ \d+$/, ''), position: null, points: null, played: null })),
});
const players: PlayerEntry[] = [
  { id: '1', name: 'Søren Ærø Nielsen', rating: 1500, teams: [['p1', 't1'], ['p2', 't3']] },
  { id: '2', name: 'Anna Nielsen', rating: null, teams: [['p2', 't2']] },
];
const pools = [pool('p1', [['t1', 'Alpha BTK 1']]), pool('p2', [['t2', 'Beta 2'], ['t3', 'Alpha BTK 4']])];

describe('matchPlayers', () => {
  it('matches every word in any order, ignoring case and accents', () => {
    expect(matchPlayers(players, 'nielsen søren', pools).map((m) => m.player.id)).toEqual(['1']);
    expect(matchPlayers(players, 'NIELSEN', pools).map((m) => m.player.id)).toEqual(['1', '2']);
    expect(matchPlayers(players, '  ', pools)).toEqual([]);
  });

  it("lists the player's teams in the given pools, and leaves out players with none", () => {
    const [match] = matchPlayers(players, 'søren', pools);
    expect(match.teams.map(({ team, pool }) => `${pool.id}/${team.name}`)).toEqual(['p1/Alpha BTK 1', 'p2/Alpha BTK 4']);
    expect(matchPlayers(players, 'anna', [pools[0]])).toEqual([]);
  });
});
