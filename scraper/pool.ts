/**
 * Reading one pool from the portal, shared by the season importer (import.ts) and the
 * past-season backfill (history.ts).
 */
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import { clubOf, type Club } from '../src/data/clubs.ts';
import type { PoolData, PoolRef, Player, TeamMatch, TeamRef } from '../src/data/model.ts';
import {
  parseClubList,
  parseHeadings,
  parseMatchDetails,
  parseMatchList,
  parsePlayerStats,
  parseRatingLinks,
  parseStandings,
  seasonName,
  tidyPoolName,
  type PoolLink,
} from './parse.ts';
import type { PortalClient } from './portal.ts';
import type { RatingLink } from './ratinglist.ts';

/** Names that need no requests: clubs, regions and age groups. */
export interface Context {
  clubs: Club[];
  regionName: Map<string, string>;
  ageGroupName: Map<string, string>;
}

/**
 * One pool's data. `refreshRatings` reads the players' official ratings again even when nothing
 * else changed. Returns the player stats and their rating links whenever they were read.
 */
export async function importPool(
  client: PortalClient,
  target: PoolLink,
  previous: PoolData | null,
  ctx: Context,
  refreshRatings: boolean,
): Promise<{ data: PoolData; links: Map<string, RatingLink>; stats: Player[] | null }> {
  const query = { seasonId: target.seasonId, groupId: target.groupId, ageGroupId: target.ageGroupId, regionId: target.regionId };
  const { matches, teams: matchTeams } = parseMatchList(await client.standing({ subPage: 4, ...query }));

  // Nothing new in the match list, and every played match has its games: reuse the previous file.
  if (previous && sameSchedule(previous.matches, matches) && previous.matches.every((m) => !m.score || m.games)) {
    const data = describe(structuredClone(previous), target, ctx);
    if (!refreshRatings) return { data, links: new Map(), stats: null };
    const statsHtml = await client.standing({ subPage: 7, ...query });
    const stats = parsePlayerStats(statsHtml);
    data.players = withRatings(data.players, stats);
    return { data, links: parseRatingLinks(statsHtml), stats };
  }

  const standingsHtml = await client.standing({ subPage: 2, ...query });
  const headings = parseHeadings(standingsHtml);
  const { standings, teams: standingTeams } = parseStandings(standingsHtml);
  const statsHtml = await client.standing({ subPage: 7, ...query });
  const stats = parsePlayerStats(statsHtml);
  if (matches.length === 0 && standings.length === 0) throw new Error('no matches or standings found');

  const names = new Map<string, string>((previous?.players ?? []).map((p) => [p.id, p.name]));
  const oldMatches = new Map((previous?.matches ?? []).map((m) => [m.id, m]));
  for (const match of matches) {
    if (!match.score) continue;
    const old = oldMatches.get(match.id);
    if (old?.games && sameResult(old, match)) {
      match.games = old.games;
      continue;
    }
    try {
      const details = parseMatchDetails(await client.standing({ subPage: 5, ...query, matchId: match.id }));
      match.games = details.games.length > 0 ? details.games : null;
      for (const [id, name] of details.names) names.set(id, name);
    } catch (error) {
      console.warn(`  match ${match.id}: could not read games (${message(error)})`);
      match.games = old?.games ?? null;
    }
  }
  matches.sort((a, b) => a.date.localeCompare(b.date) || a.id.localeCompare(b.id));

  // Who played for which team, from the games themselves (latest match wins).
  const playedFor = new Map<string, string>();
  for (const match of matches) {
    for (const game of match.games ?? []) {
      for (const id of game.home) playedFor.set(id, match.homeTeamId);
      for (const id of game.away) playedFor.set(id, match.awayTeamId);
    }
  }
  const players = new Map<string, Player>();
  for (const s of stats) players.set(s.id, { ...s, teamId: s.teamId ?? playedFor.get(s.id) ?? null });
  for (const [id, teamId] of playedFor) {
    if (!players.has(id)) players.set(id, { id, name: names.get(id) ?? 'Unknown player', teamId, rating: null });
  }

  const data = describe(
    {
      version: 1,
      pool: {
        id: target.groupId,
        seasonId: target.seasonId,
        season: seasonName(target.seasonId),
        regionId: target.regionId,
        ageGroupId: target.ageGroupId,
        league: headings.league || previous?.pool.league || '',
        name: headings.name || target.label || previous?.pool.name || `Pool ${target.groupId}`,
        updatedAt: previous?.pool.updatedAt ?? '',
      },
      teams: mergeTeams(standingTeams, matchTeams),
      standings,
      matches,
      players: [...players.values()].sort(byName),
    },
    target,
    ctx,
  );
  return { data, links: parseRatingLinks(statsHtml), stats };
}

export function byName(a: Player, b: Player): number {
  return a.name.localeCompare(b.name, 'da') || a.id.localeCompare(b.id);
}

/** Takes the official ratings from fresh player stats; everyone else stays as they were. */
export function withRatings(players: Player[], stats: Player[]): Player[] {
  const byId = new Map(players.map((p) => [p.id, p]));
  for (const s of stats) {
    const player = byId.get(s.id);
    if (player) player.rating = s.rating;
    else byId.set(s.id, s);
  }
  return [...byId.values()].sort(byName);
}

/** Adds region and age-group names and each team's club; needs no requests. */
export function describe(data: PoolData, target: PoolLink, ctx: Context): PoolData {
  const regionName = ctx.regionName.get(target.regionId);
  const ageGroupName = ctx.ageGroupName.get(target.ageGroupId);
  data.pool.name = tidyPoolName(data.pool.name);
  if (regionName) data.pool.regionName = regionName;
  if (ageGroupName) data.pool.ageGroupName = ageGroupName;
  data.teams = data.teams.map((t) => ({ id: t.id, name: t.name, club: clubOf(t.name, ctx.clubs).name }));
  return data;
}

export function toRef(data: PoolData): PoolRef {
  const standing = new Map(data.standings.map((s) => [s.teamId, s]));
  const { ratings: _ratings, ...pool } = data.pool; // the index has them once, for all pools
  return {
    ...pool,
    teams: data.teams.map((t) => ({
      ...t,
      position: standing.get(t.id)?.position ?? null,
      points: standing.get(t.id)?.points ?? null,
      played: standing.get(t.id)?.played ?? null,
    })),
  };
}

export async function loadClubs(client: PortalClient): Promise<Club[]> {
  const src = /src="([^"]*clublistclientscript\.aspx[^"]*)"/i.exec(client.page)?.[1]?.replace(/&amp;/g, '&');
  if (!src) return [];
  try {
    return parseClubList(await client.text(src));
  } catch (error) {
    console.warn(`Club list unavailable (${message(error)}); club names fall back to team names.`);
    return [];
  }
}

export function sameSchedule(a: TeamMatch[], b: TeamMatch[]): boolean {
  const key = (list: TeamMatch[]) =>
    JSON.stringify(
      [...list]
        .sort((x, y) => x.id.localeCompare(y.id))
        .map((m) => [m.id, m.date, m.homeTeamId, m.awayTeamId, m.venue, m.score, m.points, m.walkover]),
    );
  return key(a) === key(b);
}

export function sameResult(a: TeamMatch, b: TeamMatch): boolean {
  return JSON.stringify([a.score, a.points, a.walkover]) === JSON.stringify([b.score, b.points, b.walkover]);
}

export function mergeTeams(...lists: TeamRef[][]): TeamRef[] {
  const teams = new Map<string, TeamRef>();
  for (const list of lists) for (const team of list) if (!teams.has(team.id)) teams.set(team.id, team);
  return [...teams.values()];
}

export function message(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export async function readJson<T>(file: string): Promise<T | null> {
  try {
    return JSON.parse(await readFile(file, 'utf8')) as T;
  } catch {
    return null;
  }
}

export async function writeJson(file: string, data: unknown): Promise<void> {
  await mkdir(dirname(file), { recursive: true });
  await writeFile(file, JSON.stringify(data) + '\n');
}
