import { describe, expect, it } from 'vitest';
import { DEFAULT_SCALE, edgePoints, fitScale, fitScaleTo, ratingForecast, scaleGames } from './forecast';
import type { Game, Player, PoolData, TeamMatch } from './model';
import { versus, versusMatch, versusScale } from './versus';

// Made-up pools: no real players or results.
const single = (label: string, home: string, away: string, homeWins: boolean): Game => ({
  label, kind: 'single', home: [home], away: [away], sets: homeWins ? [3, 1] : [1, 3], winner: homeWins ? 'home' : 'away', walkover: false,
});

const match = (id: string, date: string, home: string, away: string, games: Game[] | null): TeamMatch => ({
  id, date: `${date}T19:00`, homeTeamId: home, awayTeamId: away, venue: 'Hall',
  score: games ? [games.filter((g) => g.winner === 'home').length, games.filter((g) => g.winner === 'away').length] : null,
  points: games ? [1, 1] : null, walkover: false, games,
});

function pool(id: string, players: Player[], matches: TeamMatch[], ageGroupId = '4006'): PoolData {
  return {
    version: 1,
    pool: { id, seasonId: '42026', season: '2026/2027', regionId: 'r', ageGroupId, league: 'Test', name: `Pool ${id}`, updatedAt: '' },
    teams: [{ id: 'H', name: 'Home 1' }, { id: 'A', name: 'Away 2' }, { id: 'C', name: 'Other 3' }],
    standings: [],
    matches,
    players,
  };
}

const players: Player[] = [
  { id: 'h1', name: 'H One', teamId: 'H', rating: 1250, form: { games: 10, above: 2, last: { games: 20, above: -1 } } },
  { id: 'h2', name: 'H Two', teamId: 'H', rating: null },
  { id: 'a1', name: 'A One', teamId: 'A', rating: 1100, form: { games: 0, above: 0, youth: true } },
  { id: 'a2', name: 'A Two', teamId: 'A', rating: null, form: { games: 4, above: 1, youth: true } },
  { id: 'c1', name: 'C One', teamId: 'C', rating: 1000 },
];
const matches = [
  match('m1', '2026-10-01', 'H', 'C', [single('A1/B1', 'h1', 'c1', true), single('A2/B1', 'h2', 'c1', false)]),
  match('m2', '2026-10-08', 'A', 'C', [single('A1/B1', 'a1', 'c1', true), single('A2/B1', 'a2', 'c1', true)]),
  match('m3', '2026-11-01', 'H', 'A', null),
  match('m4', '2026-12-01', 'A', 'H', null),
];
const test = pool('p', players, matches);
const player = (p: PoolData, id: string) => ({ pool: p, player: p.players.find((x) => x.id === id)! });

describe('versus', () => {
  it("gives the matchup table's chance for every pair, home and away", () => {
    const scale = fitScale(test);
    const atHome = ratingForecast(test, ['h1', 'h2'], ['a1', 'a2'], scale, true)!;
    const away = ratingForecast(test, ['h1', 'h2'], ['a1', 'a2'], scale, false)!;
    ['h1', 'h2'].forEach((h, i) =>
      ['a1', 'a2'].forEach((a, j) => {
        expect(versus(player(test, h), player(test, a), { matchId: 'm3' }).chance).toBeCloseTo(atHome.singles[i][j], 12);
        expect(versus(player(test, h), player(test, a), { matchId: 'm4' }).chance).toBeCloseTo(away.singles[i][j], 12);
      }),
    );
  });

  it('adds the reasons one by one, and they add up to the chance and the gap', () => {
    const result = versus(player(test, 'h1'), player(test, 'a2'), { matchId: 'm3' });
    expect(result.steps.map((s) => s.reason)).toEqual(['rating', 'form', 'last', 'youth', 'home']);
    // An unrated player counts as the pool's median rating; a youth player gets no unrated edge.
    expect(result.steps[0].points).toEqual([1250, 1100]);
    expect(result.steps.at(-1)!.chance).toBe(result.chance);
    expect(result.steps[1].chance).toBeGreaterThan(result.steps[0].chance);
    expect(result.steps[2].chance).toBeLessThan(result.steps[1].chance);
    expect(result.steps[3].points[1]).toBeCloseTo(edgePoints(0.75, result.scale));
    const edges = result.steps.slice(1).reduce((sum, s) => sum + s.points[0] - s.points[1], 0);
    expect(result.gap).toBeCloseTo(1250 - 1100 + edges, 9);
    expect(result.match?.id).toBe('m3');
    expect(result.home).toBe(0);
  });

  it('counts an unrated player as weaker than the median, and leaves out reasons nobody has', () => {
    const result = versus(player(test, 'h2'), player(test, 'c1'));
    expect(result.steps.map((s) => s.reason)).toEqual(['rating', 'unrated']);
    expect(result.steps[1].points[0]).toBeLessThan(0);
    expect(result.steps[1].points[1]).toBe(0);
  });

  it('finds the next match between the two teams, or none', () => {
    expect(versusMatch(test, 'a1', 'h1')).toEqual({ match: matches[2], home: 1 });
    expect(versusMatch(test, 'a1', 'h1', 'm4')).toEqual({ match: matches[3], home: 0 });
    // A match the two do not play in, teammates, and teams with nothing left to play.
    expect(versusMatch(test, 'a1', 'h1', 'm1')?.match.id).toBe('m3');
    expect(versusMatch(test, 'h1', 'h2')).toBeNull();
    expect(versusMatch(test, 'h1', 'c1')).toBeNull();
    expect(versus(player(test, 'h1'), player(test, 'c1')).steps.map((s) => s.reason)).toEqual(['rating', 'form', 'last']);
  });

  it('has no home table in veteran pools', () => {
    const veterans = pool('v', players, matches, '4010');
    const result = versus(player(veterans, 'h1'), player(veterans, 'a1'));
    expect(result.steps.at(-1)).toMatchObject({ reason: 'home', points: [0, 0] });
    expect(result.steps.at(-1)!.chance).toBe(result.steps.at(-2)!.chance);
  });

  it('fits one curve on both pools for players of two pools, the same from either side', () => {
    // Pool 1: the higher rated always wins (a steep curve). Pool 2: half the time (a flat one).
    const games = (decided: boolean) =>
      Array.from({ length: 30 }, (_, k) => single('A1/B1', 'h1', 'c1', decided || k % 2 === 0));
    const steep = pool('s', players, [match('x', '2026-10-01', 'H', 'C', games(true))]);
    const flat = pool('f', players.map((p) => (p.id === 'c1' ? { ...p, rating: 1240 } : p)), [match('y', '2026-10-01', 'H', 'C', games(false))]);
    expect(fitScale(steep)).toBeLessThan(fitScale(flat));
    const scale = versusScale(steep, flat);
    expect(scale).toBe(fitScaleTo([...scaleGames(steep), ...scaleGames(flat)]));
    const one = versus(player(steep, 'h1'), player(flat, 'a1'));
    const other = versus(player(flat, 'a1'), player(steep, 'h1'));
    expect(one.scale).toBe(scale);
    expect(one.chance + other.chance).toBeCloseTo(1, 12);
    expect(one.match).toBeNull();
    expect(versusScale(test, test)).toBe(DEFAULT_SCALE);
  });
});
