import { describe, expect, it } from 'vitest';
import {
  parseClubList,
  parseDate,
  parseDropdowns,
  parseHeadings,
  parseMatchDetails,
  parseMatchList,
  parsePlayerStats,
  parseRatingLinks,
  parseRatingPoints,
  parseRatingVersions,
  parseRegionPools,
  parseStandings,
  seasonName,
  tidyPoolName,
} from './parse.ts';

// Synthetic fragments with the same structure as the portal's HTML (made-up names and ids).
const show = (...args: string[]) => `onclick="return ShowStanding(${args.map((a) => `'${a}'`).join(', ')});"`;
const team = (id: string, name: string) => `<a href="#" ${show('3', '42026', '900', '4006', '4004', id, '', '', '')}>${name}</a>`;
const player = (id: string, name: string) =>
  `<a href='http://www.bordtennisportalen.dk/DBTU/Spiller/VisSpiller/#${id}' title='Vis spiller' >${name}</a>`;

const STANDINGS = `<h2>&Oslash;ST Senior 2026/2027</h2><h3>Serie 9 Pulje 1</h3>
<table class='groupstandings'>
<tr class='headerrow'><td></td><td>Hold</td><td>Kampe</td><td>Vundne</td><td>Uafgjorte</td><td>Tabte</td><td>Score</td><td>Point</td></tr>
<tr class='solidline'><td class='standing'>1</td><td class='team'>${team('11', 'Alpha BTK 1')}</td><td class='score'>2</td><td class='score'>1</td><td class='score'>1</td><td class='score'>0</td><td class='score'>13-7</td><td class='score'>3</td></tr>
<tr><td class='standing'>2</td><td class='team'>${team('22', 'Beta K&#248;benhavn 2')}</td><td class='score'>2</td><td class='score'>0</td><td class='score'>1</td><td class='score'>1</td><td class='score'>7-13</td><td class='score'>1</td></tr>
</table>`;

const MATCHES = `<table class='matchlist'>
<tr class='headerrow'><td>Tid</td><td>#</td><td>Hjemmehold</td><td>Udehold</td><td>Spillested</td><td>Resultat</td><td>Point</td><td></td></tr>
<tr><td class='time'>on 30&#8209;09&#8209;2026 19:30</td><td class='matchno'><a href="#" ${show('5', '42026', '900', '4006', '4004', '', '5001', '', '')}>5001</a></td><td class='team'>${team('11', 'Alpha BTK 1')}</td><td class='team'>${team('22', 'Beta K&#248;benhavn 2')}</td><td class='venue'>Hallen</td><td class='score'>8-2</td><td class='points'>2-0</td><td class='wo'></td></tr>
<tr class='alt'><td class='time'>ti 06&#8209;10&#8209;2026 19:00</td><td class='matchno'><a href="#" ${show('5', '42026', '900', '4006', '4004', '', '5002', '', '')}>5002</a></td><td class='team'>${team('22', 'Beta K&#248;benhavn 2')}</td><td class='team'>${team('11', 'Alpha BTK 1')}</td><td class='venue'>Skolen</td><td class='score'>-</td><td class='points'>-</td><td class='wo'></td></tr>
</table>`;

const PLAYERS = `<table class='groupstandings'>
<tr class='headerrow'><td></td><td>Navn</td><td>Hold</td><td>Rating</td><td>Sejre</td><td>Kampe</td></tr>
<tr><td class='standing'>1</td><td class='team'>010190-ABCD ${player('701', 'Anna Andersen')}</td><td class='team'>${team('11', 'Alpha BTK 1')}</td><td class='score'><a href="/DBTU/Spiller/VisSpiller/#701,59,1,42026">1450</a></td><td class='score'>3</td><td class='score'>3</td></tr>
<tr><td class='standing'>2</td><td class='team'>020290-EFGH ${player('702', 'Bo Berg')}</td><td class='team'>${team('22', 'Beta K&#248;benhavn 2')}</td><td class='score'></td><td class='score'>0</td><td class='score'>3</td></tr>
</table>`;

const DETAILS = `<table class='matchinfo'><tr><td>Hjemmehold</td><td>Alpha BTK 1 Kontakt Person kontakt@example.com 12345678</td></tr></table>
<table class='matchresultschema showmatch'>
<tr class='toprow'><td></td><td>Alpha BTK 1</td><td>Beta</td><td>Score</td><td>W.O.</td></tr>
<tr><td class='discipline'>1. HD</td><td class='playerwinner'><div class='teamhdr'>Alpha BTK 1</div><div>${player('701', 'Anna Andersen')}</div><div>${player('703', 'Cai Carlsen')}</div></td><td class='player'><div class='teamhdr'>Beta</div><div>${player('702', 'Bo Berg')}</div><div>${player('704', 'Dan Dahl')}</div></td><td class='result'><b>3</b>&nbsp;-&nbsp;1</td><td class='wo'></td></tr>
<tr><td class='discipline'>A1/B1</td><td class='player'><div class='teamhdr'>Alpha BTK 1</div><div>${player('701', 'Anna Andersen')}</div></td><td class='playerwinner'><div class='teamhdr'>Beta</div><div>${player('702', 'Bo Berg')}</div></td><td class='result'>2&nbsp;-&nbsp;<b>3</b></td><td class='wo'></td></tr>
<tr><td class='discipline'>A2/B2</td><td class='playerwinner'><div class='teamhdr'>Alpha BTK 1</div><div>${player('703', 'Cai Carlsen')}</div></td><td class='player'><div class='teamhdr'>Beta</div><div></div></td><td class='result'><b>3</b>&nbsp;-&nbsp;0</td><td class='wo'>X</td></tr>
</table><h3>Reserver</h3>Ingen`;

const REGION = `<h2>ØST Senior 2026/2027</h2><h3>Østserien</h3>
<a href="#" ${show('2', '42026', '901', '4006', '4004', '', '', '', '')}>Pulje 1</a>
<h3>Serie 1</h3>
<a href="#" ${show('2', '42026', '902', '4006', '4004', '', '', '', '')}>Pulje 1</a>
<a href="#" ${show('2', '42026', '903', '4006', '4004', '', '', '', '')}>Pulje 2</a>
<a href="#" ${show('6', '42026', '', '', '', '', '', '55', '')}>Klub</a>`;

describe('portal parsers', () => {
  it('reads pool headings with entities decoded', () => {
    expect(parseHeadings(STANDINGS)).toEqual({ league: 'ØST Senior 2026/2027', name: 'Serie 9 Pulje 1' });
  });

  it('reads standings rows and team ids', () => {
    const { standings, teams } = parseStandings(STANDINGS);
    expect(teams).toEqual([
      { id: '11', name: 'Alpha BTK 1' },
      { id: '22', name: 'Beta København 2' },
    ]);
    expect(standings[0]).toEqual({ position: 1, teamId: '11', played: 2, won: 1, drawn: 1, lost: 0, gamesFor: 13, gamesAgainst: 7, points: 3 });
  });

  it('reads the match list, including unplayed matches', () => {
    const { matches, teams } = parseMatchList(MATCHES);
    expect(teams).toHaveLength(2);
    expect(matches).toEqual([
      { id: '5001', date: '2026-09-30T19:30', homeTeamId: '11', awayTeamId: '22', venue: 'Hallen', score: [8, 2], points: [2, 0], walkover: false, games: null },
      { id: '5002', date: '2026-10-06T19:00', homeTeamId: '22', awayTeamId: '11', venue: 'Skolen', score: null, points: null, walkover: false, games: null },
    ]);
  });

  it('reads player stats without the player number', () => {
    const players = parsePlayerStats(PLAYERS);
    expect(players).toEqual([
      { id: '701', name: 'Anna Andersen', teamId: '11', rating: 1450 },
      { id: '702', name: 'Bo Berg', teamId: '22', rating: null },
    ]);
    expect(JSON.stringify(players)).not.toMatch(/010190|ABCD/);
  });

  it('reads games, doubles, winners and walkovers, and ignores contact details', () => {
    const { games, names } = parseMatchDetails(DETAILS);
    expect(games).toEqual([
      { label: '1. HD', kind: 'double', home: ['701', '703'], away: ['702', '704'], sets: [3, 1], winner: 'home', walkover: false },
      { label: 'A1/B1', kind: 'single', home: ['701'], away: ['702'], sets: [2, 3], winner: 'away', walkover: false },
      { label: 'A2/B2', kind: 'single', home: ['703'], away: [], sets: [3, 0], winner: 'home', walkover: true },
    ]);
    expect(names.get('704')).toBe('Dan Dahl');
    expect(JSON.stringify([...names])).not.toMatch(/kontakt|12345678/);
  });

  it('lists the pools of a region with their division', () => {
    expect(parseRegionPools(REGION).map((p) => [p.groupId, p.label])).toEqual([
      ['901', 'Østserien Pulje 1'],
      ['902', 'Serie 1 Pulje 1'],
      ['903', 'Serie 1 Pulje 2'],
    ]);
  });

  it('parses dates and season names', () => {
    expect(parseDate('on 30‑09‑2026 19:30')).toBe('2026-09-30T19:30');
    expect(parseDate('3-1-2027')).toBe('2027-01-03');
    expect(parseDate('-')).toBeNull();
    expect(seasonName('42026')).toBe('2026/2027');
  });
});

describe('page lists', () => {
  it('reads seasons, regions and age groups from the dropdowns', () => {
    const html = `<select id="ctl00_x_DropDownListSeason"><option value="42025">2025/2026</option><option selected="selected" value="42026">2026/2027</option></select>
<select id="ctl00_x_DropDownListRegion"><option value="4004">&Oslash;ST</option></select>
<select id="ctl00_x_DropDownListAgeGroup"><option value="">Alle</option><option value="4006">Senior</option></select>`;
    expect(parseDropdowns(html)).toEqual({
      seasons: [{ id: '42025', name: '2025/2026' }, { id: '42026', name: '2026/2027' }],
      currentSeason: '42026',
      regions: [{ id: '4004', name: 'ØST' }],
      ageGroups: [{ id: '4006', name: 'Senior' }],
    });
  });

  it('reads clubs from the club-search script, skipping combined teams', () => {
    const script = "function x(v){return v[1] > 0;}\nvar SportsResultsTeamList = [['Alpha BTK', '11'],['O\\'Brien IF', '12'],['Alpha/Beta', '-3']];";
    expect(parseClubList(script)).toEqual([
      { id: '11', name: 'Alpha BTK' },
      { id: '12', name: "O'Brien IF" },
    ]);
  });
});

describe('pool names', () => {
  it('collapses a division repeated as the pool name', () => {
    expect(tidyPoolName('Serie 1 Serie 1')).toBe('Serie 1');
    expect(tidyPoolName('Serie 4 Pulje 4')).toBe('Serie 4 Pulje 4');
    expect(tidyPoolName('60+ 60 A')).toBe('60+ 60 A');
  });
});

describe('rating pages', () => {
  it('reads rating-list ids from player stats links', () => {
    expect(parseRatingLinks(PLAYERS).get('701')).toEqual({ listId: '59', listPlayerId: '1', seasonId: '42026' });
  });

  it('reads the start rating and rated games, with match ids for team games', () => {
    const html = `<h2>Opnåede point</h2><table class='playerprofilerankingpointstable'>
<tr class='headerrow'><td>Dato</td><td>Stævne/Holdkamp</td><td>Modstander</td><td>Egen rating</td><td>Modst. rating</td><td>Point</td></tr>
<tr><td>01-07-2026</td><td>Startrating</td><td></td><td>0</td><td>0</td><td>1150</td></tr>
<tr class='altsep'><td>30-09-2026</td><td>Serie 9 #5001</td><td>Bo Berg , Beta</td><td>1150</td><td>1183</td><td>12</td></tr>
<tr><td></td><td>Serie 9 #5001</td><td>Cy Carl , Beta</td><td>1150</td><td>1115</td><td>-5</td></tr>
<tr class='altsep'><td>04-10-2026</td><td>Beta Efterårsstævne</td><td>Di Dahl , Gamma</td><td>1157</td><td>1300</td><td>22</td></tr>
</table>`;
    expect(parseRatingPoints(html)).toEqual({
      start: { date: '2026-07-01', rating: 1150 },
      games: [
        { date: '2026-09-30', matchId: '5001', own: 1150, opp: 1183, points: 12 },
        { date: '2026-09-30', matchId: '5001', own: 1150, opp: 1115, points: -5 },
        { date: '2026-10-04', matchId: null, own: 1157, opp: 1300, points: 22 },
      ],
    });
  });

  it('reads rating-list dates, newest first', () => {
    const result = { Versions: [{ Text: '09-10-2026', Value: '10/09/2026' }, { Text: '23-10-2026', Value: '10/23/2026' }, { Value: 'x' }] };
    expect(parseRatingVersions(result)).toEqual(['2026-10-23', '2026-10-09']);
    expect(parseRatingVersions(null)).toEqual([]);
  });
});
