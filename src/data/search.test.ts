import { describe, expect, it } from 'vitest';
import type { IndexTeam, NamedId, PlayerEntry, PoolRef } from './model';
import { ageGroupsIn, leaguesIn, matchesWords, NO_FILTERS, search } from './search';

// Made-up pools, teams and players.
const team = (id: string, name: string, position: number | null, club = name.replace(/ \d+$/, '')): IndexTeam => ({
  id, name, club, position, points: null, played: null,
});
const pool = (id: string, region: string, age: string, division: string | undefined, name: string, teams: IndexTeam[], order?: number): PoolRef => ({
  id, seasonId: '42026', season: '2026/2027', regionId: region, ageGroupId: age, league: `${region} ${age} 2026/2027`, name,
  updatedAt: '', teams, ...(division ? { division } : {}), ...(order !== undefined ? { order } : {}),
});

const pools: PoolRef[] = [
  pool('1', 'east', 'senior', 'Østserien', 'Østserien Pulje 1', [team('a', 'Alpha BTK 1', 2), team('b', 'Beta IF 1', 1)], 0),
  pool('2', 'east', 'senior', 'Serie 1', 'Serie 1 Pulje 1', [team('c', 'Alpha BTK 2', 1), team('d', 'Gamma 1', 2)], 1),
  pool('3', 'east', 'senior', 'Serie 1', 'Serie 1 Pulje 2', [team('e', 'Delta 1', null)], 2),
  pool('4', 'east', 'veteran', 'Masters 60', 'Masters 60 A, Pulje', [team('f', 'Alpha BTK 5', 1)], 0),
  pool('5', 'west', 'senior', 'Serie 1', 'DGI Serie 1 Pulje 1', [team('g', 'Epsilon 1', 1)], 0),
];
const ageGroups: NamedId[] = [{ id: 'senior', name: 'Senior' }, { id: 'veteran', name: 'Veteran' }, { id: 'youth', name: 'Youth' }];
const players: PlayerEntry[] = [
  { id: 'p1', name: 'Søren Ærø', rating: 1500, teams: [['1', 'a']] },
  { id: 'p2', name: 'Anna Berg', rating: 1300, teams: [['1', 'b'], ['4', 'f']] },
  { id: 'p3', name: 'Bo Holm', rating: null, teams: [['2', 'c']] },
  { id: 'p4', name: 'Carl Nyborg', rating: 1100, teams: [['2', 'd']] },
];

describe('advanced search', () => {
  it('matches every word in any order, ignoring case and accents', () => {
    expect(matchesWords('Søren Ærø, Alpha BTK 1', 'alpha SØREN')).toBe(true);
    expect(matchesWords('Søren Ærø', 'soren')).toBe(false);
    expect(matchesWords('Anything', '  ')).toBe(true);
  });

  it('offers the age groups of a union and the leagues in the portal order', () => {
    expect(ageGroupsIn(pools, ageGroups, 'east').map((a) => a.id)).toEqual(['senior', 'veteran']);
    expect(ageGroupsIn(pools, ageGroups, 'west').map((a) => a.id)).toEqual(['senior']);
    expect(leaguesIn(pools, 'east', 'senior')).toEqual(['Østserien', 'Serie 1']);
    // Without a union, a league of the same name in two unions is offered once.
    expect(leaguesIn(pools, '', 'senior')).toEqual(['Østserien', 'Serie 1']);
    expect(leaguesIn([pool('9', 'x', 'y', undefined, 'No league', [])], '', '')).toEqual([]);
  });

  it('narrows pools, teams and players by union, age group and league', () => {
    const result = search(pools, players, { ...NO_FILTERS, union: 'east', age: 'senior', league: 'Serie 1' });
    expect(result.pools.map((h) => h.pool.id)).toEqual(['2', '3']);
    // Teams follow their pool, then their place; players come by rating, unrated last.
    expect(result.teams.map((h) => h.team.id)).toEqual(['c', 'd', 'e']);
    expect(result.players?.map((h) => h.player.id)).toEqual(['p4', 'p3']);
    expect(result.manyUnions).toBe(false);
    expect(result.manyAgeGroups).toBe(false);
    expect(search(pools, players, { ...NO_FILTERS, league: 'Serie 1' }).manyUnions).toBe(true);
  });

  it("gives each pool its rated players' average rating", () => {
    const result = search(pools, players, NO_FILTERS);
    expect(result.pools.find((h) => h.pool.id === '1')?.average).toBe(1400);
    expect(result.pools.find((h) => h.pool.id === '2')?.average).toBe(1100);
    expect(result.pools.find((h) => h.pool.id === '3')?.average).toBeNull();
    expect(search(pools, null, NO_FILTERS).pools[0].average).toBeNull();
  });

  it('finds pools by a team, teams by club or pool, and players by name or team', () => {
    const club = search(pools, players, { ...NO_FILTERS, query: 'alpha' });
    expect(club.pools.map((h) => h.pool.id)).toEqual(['1', '2', '4']);
    expect(club.teams.map((h) => h.team.id)).toEqual(['a', 'c', 'f']);
    expect(club.players?.map((h) => `${h.player.id}@${h.team.id}`)).toEqual(['p1@a', 'p2@f', 'p3@c']);
    const byPool = search(pools, players, { ...NO_FILTERS, query: 'masters' });
    expect(byPool.teams.map((h) => h.team.id)).toEqual(['f']);
    expect(search(pools, players, { ...NO_FILTERS, query: 'nyborg' }).players?.map((h) => h.player.id)).toEqual(['p4']);
    expect(search(pools, null, NO_FILTERS).players).toBeNull();
  });
});
