/**
 * Parsers for the HTML fragments returned by bordtennisportalen.dk's
 * GetLeagueStanding service. Pure functions: HTML in, normalized data out.
 *
 * Page types (the service's `subPage` argument):
 *   1 region overview (all pools) · 2 pool standings · 3 team matches
 *   4 pool match list · 5 match details · 7 pool player stats
 *
 * Deliberately ignored: player numbers (they encode birth dates) and team
 * contact people, emails and phone numbers.
 */
import { parse, type HTMLElement } from 'node-html-parser';
import type { Game, Player, Standing, TeamMatch, TeamRef } from '../src/data/model.ts';

export interface ShowArgs {
  subPage: string;
  seasonId: string;
  groupId: string;
  ageGroupId: string;
  regionId: string;
  teamId: string;
  matchId: string;
  clubId: string;
  playerId: string;
}

export interface PoolLink {
  seasonId: string;
  groupId: string;
  ageGroupId: string;
  regionId: string;
  /** Division and pool, e.g. "Serie 4 Pulje 4". */
  label: string;
}

/** Reads the arguments of an `onclick="return ShowStanding('3', '42026', ...)"` link. */
export function showArgs(el: HTMLElement | null | undefined): ShowArgs | null {
  const match = /ShowStanding\(([^)]*)\)/.exec(el?.getAttribute('onclick') ?? '');
  if (!match) return null;
  const a = match[1].split(',').map((part) => part.trim().replace(/^'(.*)'$/, '$1'));
  return {
    subPage: a[0] ?? '',
    seasonId: a[1] ?? '',
    groupId: a[2] ?? '',
    ageGroupId: a[3] ?? '',
    regionId: a[4] ?? '',
    teamId: a[5] ?? '',
    matchId: a[6] ?? '',
    clubId: a[7] ?? '',
    playerId: a[8] ?? '',
  };
}

export function parseHeadings(html: string): { league: string; name: string } {
  const root = parse(html);
  return { league: textOf(root.querySelector('h2')), name: tidyPoolName(textOf(root.querySelector('h3'))) };
}

/** The portal joins division and pool, which repeats when they are named alike: "Serie 1 Serie 1" -> "Serie 1". */
export function tidyPoolName(name: string): string {
  const words = name.split(' ');
  if (words.length % 2 === 0) {
    const half = words.length / 2;
    const first = words.slice(0, half).join(' ');
    if (first.toLocaleLowerCase('da') === words.slice(half).join(' ').toLocaleLowerCase('da')) return first;
  }
  return name;
}

export function parseStandings(html: string): { standings: Standing[]; teams: TeamRef[] } {
  const standings: Standing[] = [];
  const teams: TeamRef[] = [];
  for (const row of parse(html).querySelectorAll('table.groupstandings tr')) {
    const cells = row.querySelectorAll('td');
    if (cells.length < 8) continue;
    const link = cells[1].querySelector('a');
    const teamId = showArgs(link)?.teamId;
    if (!teamId || !link) continue;
    const [gamesFor, gamesAgainst] = scorePair(textOf(cells[6])) ?? [0, 0];
    standings.push({
      position: toInt(textOf(cells[0])) ?? standings.length + 1,
      teamId,
      played: toInt(textOf(cells[2])) ?? 0,
      won: toInt(textOf(cells[3])) ?? 0,
      drawn: toInt(textOf(cells[4])) ?? 0,
      lost: toInt(textOf(cells[5])) ?? 0,
      gamesFor,
      gamesAgainst,
      points: toInt(textOf(cells[7])) ?? 0,
    });
    teams.push({ id: teamId, name: textOf(link) });
  }
  return { standings, teams };
}

export function parseMatchList(html: string): { matches: TeamMatch[]; teams: TeamRef[] } {
  const matches: TeamMatch[] = [];
  const teams = new Map<string, TeamRef>();
  for (const row of parse(html).querySelectorAll('table.matchlist tr')) {
    const time = row.querySelector('td.time');
    const number = row.querySelector('td.matchno');
    const sides = row.querySelectorAll('td.team');
    if (!time || !number || sides.length < 2) continue;
    const matchId = showArgs(number.querySelector('a'))?.matchId || textOf(number);
    const [home, away] = sides.map((cell) => {
      const link = cell.querySelector('a');
      return { id: showArgs(link)?.teamId ?? '', name: textOf(link ?? cell) };
    });
    const date = parseDate(textOf(time));
    if (!/^\d+$/.test(matchId) || !home.id || !away.id || !date) continue;
    teams.set(home.id, home);
    teams.set(away.id, away);
    matches.push({
      id: matchId,
      date,
      homeTeamId: home.id,
      awayTeamId: away.id,
      venue: textOf(row.querySelector('td.venue')),
      score: scorePair(textOf(row.querySelector('td.score'))),
      points: scorePair(textOf(row.querySelector('td.points'))),
      walkover: textOf(row.querySelector('td.wo')) !== '',
      games: null,
    });
  }
  return { matches, teams: [...teams.values()] };
}

export function parsePlayerStats(html: string): Player[] {
  const players: Player[] = [];
  for (const row of parse(html).querySelectorAll('table.groupstandings tr')) {
    const cells = row.querySelectorAll('td');
    if (cells.length < 6) continue;
    const link = cells[1].querySelector('a');
    const id = playerIdOf(link);
    if (!id || !link) continue;
    players.push({
      id,
      name: textOf(link),
      teamId: showArgs(cells[2].querySelector('a'))?.teamId || null,
      rating: toInt(textOf(cells[3])),
    });
  }
  return players;
}

export function parseMatchDetails(html: string): { games: Game[]; names: Map<string, string> } {
  const games: Game[] = [];
  const names = new Map<string, string>();
  for (const row of parse(html).querySelectorAll('table.matchresultschema tr')) {
    const cells = row.querySelectorAll('td');
    if (row.classList.contains('toprow') || cells.length < 4) continue;
    const [labelCell, homeCell, awayCell, resultCell] = cells;
    const side = (cell: HTMLElement) =>
      cell.querySelectorAll('a').flatMap((link) => {
        const id = playerIdOf(link);
        if (!id) return [];
        names.set(id, textOf(link));
        return [id];
      });
    const home = side(homeCell);
    const away = side(awayCell);
    const sets = scorePair(textOf(resultCell)) ?? [0, 0];
    let winner: Game['winner'] = null;
    if (homeCell.classList.contains('playerwinner')) winner = 'home';
    else if (awayCell.classList.contains('playerwinner')) winner = 'away';
    else if (sets[0] !== sets[1]) winner = sets[0] > sets[1] ? 'home' : 'away';
    games.push({
      label: textOf(labelCell),
      kind: home.length > 1 || away.length > 1 ? 'double' : 'single',
      home,
      away,
      sets,
      winner,
      walkover: textOf(cells[4]) !== '',
    });
  }
  return { games, names };
}

export interface Option {
  id: string;
  name: string;
}

/** Season, region and age-group choices from the standings page's dropdowns. */
export function parseDropdowns(html: string): { seasons: Option[]; currentSeason: string | null; regions: Option[]; ageGroups: Option[] } {
  const root = parse(html);
  const options = (idSuffix: string) =>
    root
      .querySelectorAll(`select[id$="${idSuffix}"] option`)
      .map((o) => ({ id: o.getAttribute('value') ?? '', name: textOf(o), selected: o.hasAttribute('selected') }))
      .filter((o) => /^\d+$/.test(o.id));
  const seasons = options('DropDownListSeason');
  return {
    seasons: seasons.map(({ id, name }) => ({ id, name })),
    currentSeason: seasons.find((s) => s.selected)?.id ?? seasons[seasons.length - 1]?.id ?? null,
    regions: options('DropDownListRegion').map(({ id, name }) => ({ id, name })),
    ageGroups: options('DropDownListAgeGroup').map(({ id, name }) => ({ id, name })),
  };
}

/** Clubs from the portal's club-search script: `SportsResultsTeamList = [['Name', 'id'], ...]`. Positive ids are clubs. */
export function parseClubList(script: string): Option[] {
  const body = /SportsResultsTeamList\s*=\s*\[([\s\S]*?)\];/.exec(script)?.[1] ?? '';
  const clubs: Option[] = [];
  for (const m of body.matchAll(/\[\s*'((?:[^'\\]|\\.)*)'\s*,\s*'(-?\d+)'\s*\]/g)) {
    const name = m[1].replace(/\\'/g, "'").trim();
    if (Number(m[2]) > 0 && name) clubs.push({ id: m[2], name });
  }
  return clubs;
}

/** All pools linked from a region overview, with their division heading. */
export function parseRegionPools(html: string): PoolLink[] {
  const pools: PoolLink[] = [];
  let heading = '';
  for (const el of parse(html).querySelectorAll('h3, h4, a')) {
    if (el.tagName !== 'A') {
      heading = textOf(el);
      continue;
    }
    const args = showArgs(el);
    if (args?.subPage !== '2' || !args.groupId) continue;
    pools.push({
      seasonId: args.seasonId,
      groupId: args.groupId,
      ageGroupId: args.ageGroupId,
      regionId: args.regionId,
      label: [heading, textOf(el)].filter(Boolean).join(' '),
    });
  }
  return pools;
}

/** "on 30‑09‑2026 19:30" -> "2026-09-30T19:30" (the portal uses non-breaking hyphens). */
export function parseDate(text: string): string | null {
  const m = /(\d{1,2})\D(\d{1,2})\D(\d{4})(?:\D+(\d{1,2}):(\d{2}))?/.exec(text);
  if (!m) return null;
  const day = `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`;
  return m[4] ? `${day}T${m[4].padStart(2, '0')}:${m[5]}` : day;
}

export function seasonName(seasonId: string): string {
  const start = Number(seasonId) % 10000;
  return Number.isFinite(start) && start > 1900 ? `${start}/${start + 1}` : seasonId;
}

function scorePair(text: string): [number, number] | null {
  const m = /(\d+)\s*-\s*(\d+)/.exec(text);
  return m ? [Number(m[1]), Number(m[2])] : null;
}

function playerIdOf(link: HTMLElement | null | undefined): string | null {
  const href = link?.getAttribute('href') ?? '';
  return /VisSpiller\/?#(\d+)/i.exec(href)?.[1] ?? null;
}

function toInt(text: string): number | null {
  const m = /-?\d+/.exec(text);
  return m ? Number(m[0]) : null;
}

function textOf(el: HTMLElement | null | undefined): string {
  return (el?.text ?? '').replace(/[\s ]+/g, ' ').trim();
}
