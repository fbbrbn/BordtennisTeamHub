import { describe, expect, it } from 'vitest';
import { fitScale } from './forecast';
import type { Game, PoolData, TeamMatch } from './model';
import { homeOutcome, likeliest, poolBefore, preMatchPredictions, predictionRecord, ratingOn, type RatingTimeline } from './prematch';

// A made-up pool: teams H, A and B, three players each, a match every week.
const single = (label: string, home: string, away: string, homeWins: boolean): Game => ({
  label, kind: 'single', home: [home], away: [away], sets: homeWins ? [3, 1] : [1, 3], winner: homeWins ? 'home' : 'away', walkover: false,
});
const lineup = (team: string) => [1, 2, 3].map((i) => `${team.toLowerCase()}${i}`);
const play = (id: string, date: string, home: string, away: string, homeWins: number): TeamMatch => {
  const [h, a] = [lineup(home), lineup(away)];
  const pairs: [number, number][] = [[0, 1], [1, 0], [2, 2], [0, 0], [2, 1], [1, 2], [0, 2], [2, 0], [1, 1]];
  const games = pairs.map(([i, j], k) => single(`A${i + 1}/B${j + 1}`, h[i], a[j], k < homeWins));
  return { id, date: `${date}T19:00`, homeTeamId: home, awayTeamId: away, venue: '', score: [homeWins, 9 - homeWins], points: null, walkover: false, games };
};
const pool = (matches: TeamMatch[]): PoolData => ({
  version: 1,
  pool: { id: 'p', seasonId: '42026', season: '2026/2027', regionId: 'r', ageGroupId: 'g', league: 'L', name: 'P', updatedAt: '' },
  teams: [{ id: 'H', name: 'H' }, { id: 'A', name: 'A' }, { id: 'B', name: 'B' }],
  standings: [],
  matches,
  players: ['H', 'A', 'B'].flatMap((t, ti) => lineup(t).map((id) => ({ id, name: id, teamId: t, rating: 1500 - ti * 100 }))),
});
const timeline: RatingTimeline = {
  versions: ['2026-09-01', '2026-10-01'],
  players: { h1: [1400, 1450], a1: [null, 1300] },
};

describe('ratingOn', () => {
  it('takes the latest list on or before the day, and tells unknown from not yet rated', () => {
    expect(ratingOn(timeline, 'h1', '2026-09-30')).toBe(1400);
    expect(ratingOn(timeline, 'h1', '2026-10-01')).toBe(1450);
    expect(ratingOn(timeline, 'a1', '2026-09-15')).toBeNull();
    expect(ratingOn(timeline, 'h1', '2026-08-01')).toBeNull();
    expect(ratingOn(timeline, 'zz', '2026-10-15')).toBeUndefined();
  });
});

describe('poolBefore', () => {
  it('hides results from that day on, and rates players as on the list then', () => {
    const p = pool([play('m1', '2026-09-10', 'H', 'A', 6), play('m2', '2026-09-17', 'H', 'B', 4)]);
    const view = poolBefore(p, '2026-09-17', timeline);
    expect(view.matches.map((m) => m.score)).toEqual([[6, 3], null]);
    expect(view.matches[1].games).toBeNull();
    const rating = new Map(view.players.map((x) => [x.id, x.rating]));
    expect(rating.get('h1')).toBe(1400);
    expect(rating.get('a1')).toBeNull();
    expect(rating.get('h2')).toBe(1500); // never on a list: keeps the current rating
    expect(p.players.find((x) => x.id === 'h1')!.rating).toBe(1500); // the pool itself is unchanged
  });
});

describe('preMatchPredictions', () => {
  const matches = [
    play('m1', '2026-09-10', 'H', 'A', 6),
    play('m2', '2026-09-17', 'B', 'A', 4),
    play('m3', '2026-09-24', 'H', 'B', 5),
  ];

  it('predicts only once both teams have played, from earlier results only', () => {
    const predictions = preMatchPredictions(pool(matches), timeline, (view) => fitScale(view));
    expect(predictions.has('m1')).toBe(false); // nobody had played yet
    expect(predictions.has('m2')).toBe(false); // B's first match
    const m3 = predictions.get('m3')!;
    expect(m3.win + m3.draw + m3.loss).toBeCloseTo(1, 2);
    expect(m3.win).toBeGreaterThan(m3.loss); // H rated higher
    // Changing the result of m3 itself, or adding a later match, does not change its prediction.
    const changed = [...matches.slice(0, 2), play('m3', '2026-09-24', 'H', 'B', 0), play('m4', '2026-10-01', 'A', 'H', 9)];
    expect(preMatchPredictions(pool(changed), timeline, (view) => fitScale(view)).get('m3')).toEqual(m3);
  });
});

describe('predictionRecord', () => {
  it('counts the likeliest outcome and scores the probabilities', () => {
    const p = { win: 0.6, draw: 0.1, loss: 0.3, homeGames: 5.5, totalGames: 10 };
    expect(likeliest(p)).toBe('win');
    expect(homeOutcome([5, 5], false)).toBe('draw');
    expect(homeOutcome([7, 3], true)).toBeNull();
    const record = predictionRecord([
      { score: [6, 4], walkover: false, prediction: p },
      { score: [3, 7], walkover: false, prediction: p },
      { score: [10, 0], walkover: true, prediction: p },
      { score: [6, 4], walkover: false },
    ])!;
    expect(record.matches).toBe(2);
    expect(record.right).toBe(1);
    expect(record.brier).toBeCloseTo((0.16 + 0.01 + 0.09 + (0.36 + 0.01 + 0.49)) / 2);
    expect(record.gamesError).toBeCloseTo((0.05 + 0.25) / 2);
  });
});
