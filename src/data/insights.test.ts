import { afterEach, describe, expect, it } from 'vitest';
import { setLang } from '../i18n';
import { playerInsights, teamInsights } from './insights';
import type { Game, PoolData } from './model';

const g = (label: string, kind: Game['kind'], home: string[], away: string[], sets: [number, number]): Game => ({
  label, kind, home, away, sets, winner: sets[0] > sets[1] ? 'home' : 'away', walkover: false,
});

// Made-up pool: Alpha beat Beta 3-1 at home; Gamma has not played. Ann (1200) beat Bo (1300) in five sets.
const pool: PoolData = {
  version: 1,
  pool: { id: 'p', seasonId: '42026', season: '2026/2027', regionId: 'r', ageGroupId: 'g', league: 'Test', name: 'Pool', updatedAt: '' },
  teams: [{ id: 'A', name: 'Alpha' }, { id: 'B', name: 'Beta' }, { id: 'C', name: 'Gamma' }],
  standings: [
    { position: 1, teamId: 'A', played: 1, won: 1, drawn: 0, lost: 0, gamesFor: 3, gamesAgainst: 1, points: 2 },
    { position: 2, teamId: 'B', played: 1, won: 0, drawn: 0, lost: 1, gamesFor: 1, gamesAgainst: 3, points: 0 },
    { position: 2, teamId: 'C', played: 0, won: 0, drawn: 0, lost: 0, gamesFor: 0, gamesAgainst: 0, points: 0 },
  ],
  players: [
    { id: 'ann', name: 'Ann', teamId: 'A', rating: 1200 },
    { id: 'al', name: 'Al', teamId: 'A', rating: 1150 },
    { id: 'bo', name: 'Bo', teamId: 'B', rating: 1300 },
    { id: 'bea', name: 'Bea', teamId: 'B', rating: 1100 },
  ],
  matches: [
    {
      id: '1', date: '2026-10-01T19:00', homeTeamId: 'A', awayTeamId: 'B', venue: 'Hall', score: [3, 1], points: [2, 0], walkover: false,
      games: [
        g('1. HD', 'double', ['ann', 'al'], ['bo', 'bea'], [3, 1]),
        g('A1/B1', 'single', ['ann'], ['bo'], [3, 2]),
        g('A2/B2', 'single', ['al'], ['bea'], [1, 3]),
        g('A1/B2', 'single', ['ann'], ['bea'], [3, 0]),
      ],
    },
    { id: '2', date: '2026-11-01T19:00', homeTeamId: 'C', awayTeamId: 'A', venue: 'Hall', score: null, points: null, walkover: false, games: null },
  ],
};

describe('insights', () => {
  it('describes a team: table, form, close games, doubles and outlook', () => {
    const insights = teamInsights(pool, 'A', 265);
    const byTopic = Object.fromEntries(insights.map((i) => [i.topic, i.text]));
    expect(byTopic.Table).toBe('1st of 3 with 2 points. Top of the table. 2 points ahead of Beta.');
    expect(byTopic.Form).toMatch(/^In 1 match the team won 3 games; the players' ratings predicted \d/);
    expect(byTopic['Close games']).toBe('Singles that went to a fifth set: won 1, lost 0.');
    expect(byTopic.Doubles).toBe('Doubles won: 1 of 1. Best pair: Al and Ann (1–0).');
    expect(byTopic.Outlook).toMatch(/of the 1 remaining match\. Projected finish: about \d+ points/);
  });

  it('describes a player: form, fifth sets, best win and doubles partner', () => {
    const byTopic = Object.fromEntries(playerInsights(pool, 'ann', 265).map((i) => [i.topic, i.text]));
    // Opponents rated 100 above and 100 below: exactly one win expected.
    expect(byTopic.Form).toBe('Won 2 of 2 singles; the ratings predicted 1. That is 1 more win than expected: playing above the ratings.');
    expect(byTopic['Close games']).toBe('Fifth sets: won 1 of 1.');
    expect(byTopic['Best win']).toBe('Bo (1300), 3–2. An upset: rated 100 higher.');
    expect(byTopic.Doubles).toBe('1–0 with Al.');
  });

  it('points out an upset loss', () => {
    const byTopic = Object.fromEntries(playerInsights(pool, 'al', 265).map((i) => [i.topic, i.text]));
    expect(byTopic['Upset loss']).toBe('Bea (1100), 1–3: rated 50 lower.');
  });
});

describe('insights in Danish', () => {
  afterEach(() => setLang('en', false));

  it('builds the same insights, with Danish words and numbers', () => {
    setLang('da', false);
    const team = Object.fromEntries(teamInsights(pool, 'A', 265).map((i) => [i.id, i]));
    expect(team.table.topic).toBe('Stilling');
    expect(team.table.text).toBe('Nr. 1 af 3 med 2 point. Fører puljen. 2 point foran Beta.');
    expect(team.form.text).toMatch(/^I 1 holdkamp vandt holdet 3 kampe; spillernes rating forudsagde \d/);
    expect(team.doubles.text).toBe('Doubler vundet: 1 af 1. Bedste par: Al og Ann (1–0).');
    const player = Object.fromEntries(playerInsights(pool, 'ann', 265).map((i) => [i.id, i.text]));
    expect(player.form).toBe('Vandt 2 af 2 singler; ratingen forudsagde 1. Det er 1 sejr mere end ventet: spiller over sin rating.');
    expect(player.bestWin).toBe('Bo (1300), 3–2. En overraskelse: 100 ratingpoint højere.');
  });
});

describe('insights with unrated players', () => {
  it('never shows the stand-in rating of an unrated player', () => {
    const withUnrated: PoolData = structuredClone(pool);
    withUnrated.players.push({ id: 'cal', name: 'Cal', teamId: 'A', rating: null });
    withUnrated.matches[0].games![2] = g('A2/B2', 'single', ['cal'], ['bea'], [1, 3]);
    const text = teamInsights(withUnrated, 'A', 265).map((i) => i.text).join(' ');
    expect(text).not.toMatch(/Cal \d/);
  });
});
