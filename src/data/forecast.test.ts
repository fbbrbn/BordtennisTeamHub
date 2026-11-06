import { describe, expect, it } from 'vitest';
import {
  CALIBRATION,
  combineOdds,
  commonOpponentForecast,
  DEFAULT_SCALE,
  edgePoints,
  fieldedLineups,
  fitScale,
  FORM_SPREAD,
  gameChance,
  lineupSize,
  matchFormat,
  matchOdds,
  oddsForFormat,
  oddsFromGames,
  projectTable,
  ratingForecast,
  ratingSummary,
  usualLineup,
  winChance,
  winDistribution,
} from './forecast';
import { HOME_EDGE } from './form';
import type { Game, PoolData, TeamMatch } from './model';

const single = (home: string, away: string, homeWins: boolean): Game => ({
  label: 'A1/B1', kind: 'single', home: [home], away: [away], sets: homeWins ? [3, 1] : [1, 3], winner: homeWins ? 'home' : 'away', walkover: false,
});

function emptyPool(): PoolData {
  return {
    version: 1,
    pool: { id: 'p', seasonId: '42026', season: '2026/2027', regionId: 'r', ageGroupId: 'g', league: 'Test', name: 'Pool', updatedAt: '' },
    teams: [],
    standings: [],
    matches: [],
    players: [],
  };
}

const match = (id: string, home: string, away: string, score: [number, number] | null, games: Game[] | null = null): TeamMatch => ({
  id, date: `2026-10-${id.padStart(2, '0')}T19:00`, homeTeamId: home, awayTeamId: away, venue: 'Hall',
  score, points: score ? (score[0] > score[1] ? [2, 0] : score[0] < score[1] ? [0, 2] : [1, 1]) : null, walkover: false, games,
});

describe('game odds', () => {
  it('gives even chances for equal ratings and is symmetric', () => {
    expect(winChance(1200, 1200, 265)).toBe(0.5);
    expect(winChance(1300, 1200, 265) + winChance(1200, 1300, 265)).toBeCloseTo(1);
    expect(winChance(1300, 1200, 265)).toBeCloseTo(0.705, 2);
  });

  it('builds the exact distribution of games won', () => {
    expect(winDistribution([0.5, 0.5])).toEqual([0.25, 0.5, 0.25]);
    expect(winDistribution([0.2, 0.7, 0.9]).reduce((a, b) => a + b, 0)).toBeCloseTo(1);
  });

  it('turns 10 coin-flip games into win, draw and loss chances', () => {
    const odds = oddsFromGames(new Array(10).fill(0.5));
    expect(odds.win).toBeCloseTo(0.377, 3);
    expect(odds.draw).toBeCloseTo(0.246, 3);
    expect(odds.loss).toBeCloseTo(0.377, 3);
    expect(odds.expectedGames).toBe(5);
  });

  it('averages odds from several estimates', () => {
    const a = oddsFromGames(new Array(10).fill(0.7));
    const b = oddsFromGames(new Array(10).fill(0.3));
    const combined = combineOdds([a, null, b])!;
    expect(combined.win).toBeCloseTo((a.win + b.win) / 2);
    expect(combined.expectedGames).toBeCloseTo(5);
    expect(combineOdds([null])).toBeNull();
  });
});

describe('calibration', () => {
  it('recovers the scale behind the results', () => {
    // Results generated at scale 250: 100 points -> 71.5% wins, 200 points -> 86.3% wins.
    const pool = emptyPool();
    pool.players = [
      { id: 'a', name: 'A', teamId: null, rating: 1300 },
      { id: 'b', name: 'B', teamId: null, rating: 1200 },
      { id: 'c', name: 'C', teamId: null, rating: 1100 },
    ];
    const games: Game[] = [];
    for (let i = 0; i < 100; i++) games.push(single('a', 'b', i < 72));
    for (let i = 0; i < 100; i++) games.push(single('a', 'c', i < 86));
    pool.matches = [match('1', 'x', 'y', [0, 0], games)];
    const scale = fitScale(pool);
    expect(scale).toBeGreaterThan(220);
    expect(scale).toBeLessThan(285);
  });

  it('falls back to the default without enough rated games', () => {
    expect(fitScale(emptyPool())).toBe(DEFAULT_SCALE);
  });
});

describe('team forecasts', () => {
  // T beat C 7-3; O lost to C 4-6; T and O have not met yet.
  const pool = emptyPool();
  pool.teams = [{ id: 'T', name: 'T' }, { id: 'O', name: 'O' }, { id: 'C', name: 'C' }];
  pool.players = [
    { id: 't1', name: 't1', teamId: 'T', rating: 1300 },
    { id: 't2', name: 't2', teamId: 'T', rating: 1250 },
    { id: 't3', name: 't3', teamId: 'T', rating: 1200 },
    { id: 't4', name: 't4', teamId: 'T', rating: 900 },
    { id: 'o1', name: 'o1', teamId: 'O', rating: 1100 },
    { id: 'c1', name: 'c1', teamId: 'C', rating: 1150 },
  ];
  pool.matches = [
    match('1', 'T', 'C', [7, 3], [single('t1', 'c1', true), single('t2', 'c1', true), single('t3', 'c1', false)]),
    match('2', 'C', 'T', [5, 5], [single('c1', 't1', false), single('c1', 't4', true), single('c1', 't2', false)]),
    match('3', 'O', 'C', [4, 6], [single('o1', 'c1', false)]),
    match('4', 'T', 'O', null),
  ];
  pool.standings = [
    { position: 1, teamId: 'T', played: 2, won: 1, drawn: 1, lost: 0, gamesFor: 12, gamesAgainst: 8, points: 3 },
    { position: 2, teamId: 'C', played: 3, won: 1, drawn: 1, lost: 1, gamesFor: 14, gamesAgainst: 16, points: 3 },
    { position: 3, teamId: 'O', played: 1, won: 0, drawn: 0, lost: 1, gamesFor: 4, gamesAgainst: 6, points: 0 },
  ];

  it('reads the lineup size from the players on each side', () => {
    expect(lineupSize(pool)).toBe(3);
    expect(lineupSize(emptyPool())).toBe(3);
  });

  it('picks the most-used players as the usual lineup', () => {
    expect(usualLineup(pool, 'T', 3)).toEqual(['t1', 't2', 't4']);
  });

  it('lists the lineups a team fielded, with how often each was used', () => {
    expect(fieldedLineups(pool, 'T')).toEqual([
      { ids: ['t1', 't2', 't3'], weight: 1 },
      { ids: ['t1', 't4', 't2'], weight: 1 },
    ]);
  });

  it('averages rating odds over fielded lineups unless a lineup is given', () => {
    const a = ratingForecast(pool, ['t1', 't2', 't3'], ['o1'], 265)!.odds.win;
    const b = ratingForecast(pool, ['t1', 't4', 't2'], ['o1'], 265)!.odds.win;
    const averaged = ratingSummary(pool, 'T', 'O', 265)!;
    expect(averaged.teamLineups).toBe(2);
    expect(averaged.team).toBeNull();
    expect(averaged.odds.win).toBeCloseTo((a + b) / 2);
    const given = ratingSummary(pool, 'T', 'O', 265, { team: ['t1', 't2', 't3'] })!;
    expect(given.teamLineups).toBe(1);
    expect(given.team).toEqual(['t1', 't2', 't3']);
    expect(given.odds.win).toBeCloseTo(a);
  });

  it('favours the stronger lineup in the rating forecast', () => {
    const forecast = ratingForecast(pool, ['t1', 't2', 't3'], ['o1'], 265)!;
    expect(forecast.singles).toHaveLength(3);
    expect(forecast.singles[0]).toHaveLength(1);
    expect(forecast.odds.win).toBeGreaterThan(forecast.odds.loss);
    expect(ratingForecast(pool, [], ['o1'], 265)).toBeNull();
  });

  it('compares results against common opponents', () => {
    const common = commonOpponentForecast(pool, 'T', 'O');
    // T vs C: +4 and 0 -> average +2. O vs C: -2. Difference: +4.
    expect(common.rows).toEqual([{ opponentId: 'C', ours: [[7, 3], [5, 5]], theirs: [[4, 6]], difference: 4 }]);
    expect(common.margin).toBe(4);
    expect(common.odds!.win).toBeGreaterThan(common.odds!.loss);
    const mirrored = commonOpponentForecast(pool, 'O', 'T');
    expect(mirrored.margin).toBe(-4);
    expect(mirrored.odds!.win).toBeCloseTo(common.odds!.loss);
  });

  it('projects final points from the remaining matches', () => {
    const table = projectTable(pool, 265);
    const t = table.find((r) => r.teamId === 'T')!;
    const o = table.find((r) => r.teamId === 'O')!;
    expect(t.remaining).toBe(1);
    expect(t.projected).toBeGreaterThan(t.points + 1);
    expect(t.projected + o.projected).toBeCloseTo(t.points + o.points + 2);
    expect(t.rank).toBe(1);
  });
});

describe('match formats', () => {
  const labelled = (label: string, kind: Game['kind'], home: string[], away: string[]): Game => ({
    label, kind, home, away, sets: [3, 0], winner: 'home', walkover: false,
  });
  // A Jyllandsserie-style match: 4 v 4, two doubles and twelve singles pairings.
  const pairs = ['A1-B2', 'A2-B1', 'A3-B4', 'A4-B3', 'A1-B1', 'A2-B2', 'A3-B3', 'A4-B4', 'A1-B3', 'A3-B1', 'A2-B4', 'A4-B2'];
  const pool = emptyPool();
  pool.players = ['h1', 'h2', 'h3', 'h4', 'a1', 'a2', 'a3', 'a4'].map((id, i) => ({ id, name: id, teamId: null, rating: 1400 - (i % 4) * 100 }));
  pool.matches = [
    match('1', 'H', 'A', [14, 0], [
      labelled('Dbl.1', 'double', ['h1', 'h2'], ['a1', 'a2']),
      labelled('Dbl.2', 'double', ['h3', 'h4'], ['a3', 'a4']),
      ...pairs.map((label) => {
        const [i, j] = label.match(/\d/g)!.map(Number);
        return labelled(label, 'single', [`h${i}`], [`a${j}`]);
      }),
    ]),
  ];

  it('reads positions and doubles from the game labels', () => {
    const format = matchFormat(pool);
    expect(format.size).toBe(4);
    expect(format.doubles).toBe(2);
    expect(format.singles).toHaveLength(12);
    expect(format.singles[0]).toEqual([0, 1]);
  });

  it('forecasts the real number of games', () => {
    const forecast = ratingForecast(pool, ['h1', 'h2', 'h3', 'h4'], ['a1', 'a2', 'a3', 'a4'], 265, true, FORM_SPREAD, false)!;
    expect(forecast.odds.totalGames).toBe(14);
    // Equal lineups on positions, without the home table: an even match.
    expect(forecast.odds.expectedGames).toBeCloseTo(7, 5);
  });

  it('gives the home side the edge of its own table, except in veteran pools', () => {
    const lineups = [['h1', 'h2', 'h3', 'h4'], ['a1', 'a2', 'a3', 'a4']];
    const home = ratingForecast(pool, lineups[0], lineups[1], 265, true)!;
    const away = ratingForecast(pool, lineups[0], lineups[1], 265, false)!;
    expect(home.odds.expectedGames).toBeGreaterThan(7.2);
    expect(home.odds.expectedGames + away.odds.expectedGames).toBeCloseTo(14, 5);
    expect(home.singles[0][0]).toBeCloseTo(gameChance(1400, 1400, 265, HOME_EDGE), 9);
    const veteran = { ...pool, pool: { ...pool.pool, ageGroupId: '4010' } };
    expect(ratingForecast(veteran, lineups[0], lineups[1], 265, true)!.odds.expectedGames).toBeCloseTo(7, 5);
  });
});

describe('edges beyond the ratings', () => {
  const pool = emptyPool();
  pool.players = [
    { id: 'h1', name: 'h1', teamId: 'H', rating: 1500 },
    { id: 'a1', name: 'a1', teamId: 'A', rating: 1500 },
  ];
  const chance = (p: PoolData) => ratingForecast(p, ['h1'], ['a1'], 300, true)!.singles[0][0];
  const withPlayer = (id: string, change: Partial<PoolData['players'][number]>): PoolData => ({
    ...pool,
    players: pool.players.map((p) => (p.id === id ? { ...p, ...change } : p)),
  });

  it('uses 84% of the rating gap, and converts edges to rating points', () => {
    expect(gameChance(1600, 1500, 300)).toBeCloseTo(winChance(1600, 1500, 300 / CALIBRATION), 12);
    expect(gameChance(1500, 1500, 300)).toBe(0.5);
    expect(edgePoints(HOME_EDGE, 300)).toBeCloseTo(22, 0);
  });

  it('counts a player in form, a youth player and an unrated player', () => {
    const base = chance(pool);
    expect(chance(withPlayer('h1', { form: { games: 15, above: 3 } }))).toBeGreaterThan(base);
    expect(chance(withPlayer('a1', { form: { games: 15, above: 3 } }))).toBeLessThan(base);
    expect(chance(withPlayer('a1', { form: { games: 0, above: 0, youth: true } }))).toBeLessThan(base);
    expect(chance(withPlayer('a1', { rating: null }))).toBeGreaterThan(base);
  });

  it('weighs the ratings three times as much as the common opponents', () => {
    const odds = (win: number) => ({ win, draw: 0, loss: 1 - win, expectedGames: 10 * win, totalGames: 10, drawPossible: false });
    expect(matchOdds(odds(0.8), odds(0.4))!.win).toBeCloseTo(0.7, 9);
    expect(matchOdds(null, odds(0.4))!.win).toBeCloseTo(0.4, 9);
  });
});

describe('formats without draws', () => {
  const format = (raceTo: number | null, decider: boolean) => ({ size: 3, sequence: [], singles: [], doubles: 0, raceTo, decider });

  it('plays first to N: an even match is 50-50 and never level', () => {
    const odds = oddsForFormat(format(8, false), new Array(15).fill(0.5));
    expect(odds.win).toBeCloseTo(0.5, 10);
    expect(odds.draw).toBe(0);
    expect(odds.drawPossible).toBe(false);
    expect(odds.totalGames).toBeGreaterThan(8);
    expect(odds.totalGames).toBeLessThan(15);
    expect(oddsForFormat(format(8, false), new Array(15).fill(0.6)).win).toBeGreaterThan(0.7);
  });

  it('settles a level score with a deciding game', () => {
    const odds = oddsForFormat(format(null, true), new Array(10).fill(0.5), 0.5);
    expect(odds.win).toBeCloseTo(0.5, 10);
    expect(odds.draw).toBe(0);
    expect(odds.drawPossible).toBe(false);
  });

  it('detects first-to-N and deciding-game pools from their results', () => {
    const single = (label: string, home: string, away: string, homeWins: boolean): Game => ({
      label, kind: 'single', home: [home], away: [away], sets: homeWins ? [3, 0] : [0, 3], winner: homeWins ? 'home' : 'away', walkover: false,
    });
    const labels = ['A1/B1', 'A2/B2', 'A3/B3', 'A1/B2', 'A2/B3', 'A3/B1', 'A1/B3', 'A2/B1', 'A3/B2'];
    const play = (id: string, homeWins: number, awayWins: number): TeamMatch => {
      const games = labels.slice(0, homeWins + awayWins).map((label, k) => {
        const [i, j] = label.match(/\d/g)!.map(Number);
        return single(label, `h${i}`, `a${j}`, k < homeWins);
      });
      return match(id, 'H', 'A', [homeWins, awayWins], games);
    };
    // First to 5: the winner always has 5, totals vary.
    const race = emptyPool();
    race.matches = [play('1', 5, 0), play('2', 5, 2), play('3', 3, 5), play('4', 5, 4)];
    expect(matchFormat(race).raceTo).toBe(5);
    // Every game played, sometimes one more at a level score.
    const decider = emptyPool();
    decider.matches = [play('1', 5, 3), play('2', 2, 6), play('3', 6, 2), play('4', 5, 4)];
    const f = matchFormat(decider);
    expect(f.raceTo).toBeNull();
    expect(f.sequence).toHaveLength(8);
    expect(f.decider).toBe(true);
  });
});
