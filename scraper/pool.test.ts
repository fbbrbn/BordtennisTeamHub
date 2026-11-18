import { describe, expect, it } from 'vitest';
import type { PoolData } from '../src/data/model.ts';
import { parseMatchDetails, parseMatchList, parseStandings, type PoolLink } from './parse.ts';
import { importPool, playersOf, type Context } from './pool.ts';
import type { PortalClient, StandingQuery } from './portal.ts';

// Made-up pools.
const pool = (id: string, players: PoolData['players']): PoolData => ({
  version: 1,
  pool: { id, seasonId: '42026', season: '2026/2027', regionId: 'r', ageGroupId: 'g', league: 'L', name: `Pool ${id}`, updatedAt: '' },
  teams: [],
  standings: [],
  matches: [],
  players,
});

describe('playersOf', () => {
  it('lists every player once with all their teams, A to Z, leaving out players without a team', () => {
    const index = playersOf([
      pool('2', [{ id: 'a', name: 'Åse Ås', teamId: 't3', rating: 1500 }]),
      pool('1', [
        { id: 'a', name: 'Åse Ås', teamId: 't1', rating: null },
        { id: 'b', name: 'Bo Berg', teamId: 't2', rating: null },
        { id: 'c', name: 'Cy Carl', teamId: null, rating: 1200 },
      ]),
    ]);
    expect(index.players).toEqual([
      { id: 'b', name: 'Bo Berg', rating: null, teams: [['1', 't2']] },
      { id: 'a', name: 'Åse Ås', rating: 1500, teams: [['1', 't1'], ['2', 't3']] },
    ]);
  });
});

// A made-up pool on a fake portal, for the daily check: the portal's player stats against our records.
const show = (...args: string[]) => `onclick="return ShowStanding(${args.map((a) => `'${a}'`).join(', ')});"`;
const teamLink = (id: string) => `<a href="#" ${show('3', '42026', '900', '4006', '4004', id, '', '', '')}>${id === '11' ? 'Alpha 1' : 'Beta 2'}</a>`;
const playerLink = (id: string, name: string) => `<a href='http://www.bordtennisportalen.dk/DBTU/Spiller/VisSpiller/#${id}' title='Vis spiller' >${name}</a>`;
const matchRow = (id: string, day: string, score: string, points: string) =>
  `<tr><td class='time'>on ${day}&#8209;10&#8209;2026 19:30</td><td class='matchno'><a href="#" ${show('5', '42026', '900', '4006', '4004', '', id, '', '')}>${id}</a></td>` +
  `<td class='team'>${teamLink('11')}</td><td class='team'>${teamLink('22')}</td><td class='venue'>Hallen</td><td class='score'>${score}</td><td class='points'>${points}</td><td class='wo'></td></tr>`;
const matchList = (rows: string[]) => `<table class='matchlist'>\n${rows.join('\n')}\n</table>`;
const STANDINGS_PAGE = `<h2>Test Senior 2026/2027</h2><h3>Serie 9 Pulje 1</h3><table class='groupstandings'>
<tr class='headerrow'><td></td><td>Hold</td><td>Kampe</td><td>Vundne</td><td>Uafgjorte</td><td>Tabte</td><td>Score</td><td>Point</td></tr>
<tr><td class='standing'>1</td><td class='team'>${teamLink('11')}</td><td class='score'>1</td><td class='score'>1</td><td class='score'>0</td><td class='score'>0</td><td class='score'>1-0</td><td class='score'>2</td></tr>
<tr><td class='standing'>2</td><td class='team'>${teamLink('22')}</td><td class='score'>1</td><td class='score'>0</td><td class='score'>0</td><td class='score'>1</td><td class='score'>0-1</td><td class='score'>0</td></tr>
</table>`;
const statsPage = (rows: [id: string, name: string, team: string, won: number, games: number][]) =>
  `<table class='groupstandings'>\n<tr class='headerrow'><td></td><td>Navn</td><td>Hold</td><td>Rating</td><td>Sejre</td><td>Kampe</td></tr>\n` +
  rows
    .map(([id, name, team, won, games], i) =>
      `<tr><td class='standing'>${i + 1}</td><td class='team'>${playerLink(id, name)}</td><td class='team'>${teamLink(team)}</td><td class='score'>1200</td><td class='score'>${won}</td><td class='score'>${games}</td></tr>`,
    )
    .join('\n') +
  '\n</table>';
/** One single, the home player beating Bo Berg 3-0. */
const detailsPage = (homeId: string, homeName: string) => `<table class='matchresultschema showmatch'>
<tr class='toprow'><td></td><td>Alpha 1</td><td>Beta 2</td><td>Score</td><td>W.O.</td></tr>
<tr><td class='discipline'>A1/B1</td><td class='playerwinner'><div class='teamhdr'>Alpha 1</div><div>${playerLink(homeId, homeName)}</div></td><td class='player'><div class='teamhdr'>Beta 2</div><div>${playerLink('702', 'Bo Berg')}</div></td><td class='result'><b>3</b>&nbsp;-&nbsp;0</td><td class='wo'></td></tr>
</table>`;

function fakePortal(pages: { matches: string; stats: string; details: Record<string, string> }) {
  const calls: string[] = [];
  const client = {
    requests: 0,
    standing: async (q: StandingQuery) => {
      calls.push(q.matchId ? `${q.subPage}:${q.matchId}` : String(q.subPage));
      if (q.subPage === 4) return pages.matches;
      if (q.subPage === 2) return STANDINGS_PAGE;
      if (q.subPage === 7) return pages.stats;
      if (q.subPage === 5 && q.matchId && pages.details[q.matchId]) return pages.details[q.matchId];
      throw new Error(`unexpected request ${calls.at(-1)}`);
    },
  };
  return { client: client as unknown as PortalClient, calls };
}

const target: PoolLink = { seasonId: '42026', groupId: '900', ageGroupId: '4006', regionId: '4004', label: 'Serie 9 Pulje 1' };
const ctx: Context = { clubs: [], regionName: new Map(), ageGroupName: new Map() };
/** What we imported earlier: Anna Andersen beat Bo Berg in match 5001. */
function previousPool(matches: string): PoolData {
  const list = parseMatchList(matches).matches;
  for (const m of list) if (m.id === '5001') m.games = parseMatchDetails(detailsPage('701', 'Anna Andersen')).games;
  return {
    version: 1,
    pool: { id: '900', seasonId: '42026', season: '2026/2027', regionId: '4004', ageGroupId: '4006', league: 'Test Senior 2026/2027', name: 'Serie 9 Pulje 1', updatedAt: '' },
    teams: [{ id: '11', name: 'Alpha 1' }, { id: '22', name: 'Beta 2' }],
    standings: parseStandings(STANDINGS_PAGE).standings,
    matches: list,
    players: [
      { id: '701', name: 'Anna Andersen', teamId: '11', rating: 1200 },
      { id: '702', name: 'Bo Berg', teamId: '22', rating: 1200 },
    ],
  };
}
const homeOf = (data: PoolData, matchId: string) => data.matches.find((m) => m.id === matchId)?.games?.[0].home;

describe('importPool and the daily check', () => {
  const oneMatch = matchList([matchRow('5001', '01', '1-0', '2-0')]);

  it('reuses an unchanged pool for one request when there is no check', async () => {
    const { client, calls } = fakePortal({ matches: oneMatch, stats: '', details: {} });
    const result = await importPool(client, target, previousPool(oneMatch), ctx, false);
    expect(calls).toEqual(['4']);
    expect(result.check).toBeNull();
    expect(homeOf(result.data, '5001')).toEqual(['701']);
  });

  it("reads the player stats once, and nothing more when every record is the portal's", async () => {
    const stats = statsPage([['701', 'Anna Andersen', '11', 1, 1], ['702', 'Bo Berg', '22', 0, 1]]);
    const { client, calls } = fakePortal({ matches: oneMatch, stats, details: {} });
    const result = await importPool(client, target, previousPool(oneMatch), ctx, false, true);
    expect(calls).toEqual(['4', '7']);
    expect(result.check).toEqual({ reread: false, matchesReread: 0, remaining: [] });
  });

  it('reads the matches again when the portal corrected a card without changing the score', async () => {
    // On the portal, Cai Carlsen played the single instead of Anna Andersen: the same score, 1-0.
    const stats = statsPage([['703', 'Cai Carlsen', '11', 1, 1], ['702', 'Bo Berg', '22', 0, 1]]);
    const { client, calls } = fakePortal({ matches: oneMatch, stats, details: { '5001': detailsPage('703', 'Cai Carlsen') } });
    const result = await importPool(client, target, previousPool(oneMatch), ctx, false, true);
    expect(calls).toEqual(['4', '7', '2', '5:5001']);
    expect(result.check).toEqual({ reread: true, matchesReread: 1, remaining: [] });
    expect(homeOf(result.data, '5001')).toEqual(['703']);
    expect(result.data.players.map((p) => p.id)).toContain('703');
  });

  it('reads the other played matches again too when a pool with a new result differs', async () => {
    // 5002 has just been played; 5001 was corrected on the portal.
    const before = matchList([matchRow('5001', '01', '1-0', '2-0'), matchRow('5002', '08', '-', '-')]);
    const now = matchList([matchRow('5001', '01', '1-0', '2-0'), matchRow('5002', '08', '1-0', '2-0')]);
    const stats = statsPage([['701', 'Anna Andersen', '11', 1, 1], ['703', 'Cai Carlsen', '11', 1, 1], ['702', 'Bo Berg', '22', 0, 2]]);
    const details = { '5001': detailsPage('703', 'Cai Carlsen'), '5002': detailsPage('701', 'Anna Andersen') };
    const { client, calls } = fakePortal({ matches: now, stats, details });
    const result = await importPool(client, target, previousPool(before), ctx, false, true);
    expect(calls).toEqual(['4', '2', '7', '5:5002', '5:5001']);
    expect(result.check).toEqual({ reread: true, matchesReread: 2, remaining: [] });
    expect([homeOf(result.data, '5001'), homeOf(result.data, '5002')]).toEqual([['703'], ['701']]);
  });
});
