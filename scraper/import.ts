/**
 * Imports team-tournament data from bordtennisportalen.dk into public/data/.
 *
 *   node scraper/import.ts [--config scraper/config.json] [--out public/data]
 *
 * Writes public/data/index.json (all imported pools and their teams) and
 * public/data/pools/<poolId>.json (standings, matches, games, players).
 * Details of played matches are fetched once and reused while the result is unchanged.
 * Files are rewritten only when their content changes, so scheduled runs make no
 * empty commits.
 */
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { DataIndex, PoolData, PoolRef, Player, TeamMatch, TeamRef } from '../src/data/model.ts';
import {
  parseHeadings,
  parseMatchDetails,
  parseMatchList,
  parsePlayerStats,
  parseRegionPools,
  parseStandings,
  seasonName,
  type PoolLink,
} from './parse.ts';
import { PortalClient } from './portal.ts';

interface ImportConfig {
  delayMs?: number;
  /** Single pools: ids as they appear in the portal's URL hash. */
  pools?: { season: string; region: string; ageGroup: string; pool: string }[];
  /** Every pool of a region and age group. */
  regions?: { season: string; region: string; ageGroup: string }[];
}

const USER_AGENT = 'BordtennisTeamHub/0.1 (+https://github.com/fbbrbn/BordtennisPortalen)';
const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..');
const cli = process.argv.slice(2);
const option = (name: string, fallback: string) => {
  const i = cli.indexOf(name);
  return i >= 0 && cli[i + 1] ? cli[i + 1] : fallback;
};
const configPath = option('--config', join(repoRoot, 'scraper/config.json'));
const outDir = option('--out', join(repoRoot, 'public/data'));

async function main() {
  const config = JSON.parse(await readFile(configPath, 'utf8')) as ImportConfig;
  const client = new PortalClient({ delayMs: config.delayMs ?? 800, userAgent: USER_AGENT });
  const started = Date.now();

  const targets = new Map<string, PoolLink>();
  for (const p of config.pools ?? []) {
    targets.set(p.pool, { seasonId: p.season, groupId: p.pool, ageGroupId: p.ageGroup, regionId: p.region, label: '' });
  }
  for (const r of config.regions ?? []) {
    const html = await client.standing({ subPage: 1, seasonId: r.season, ageGroupId: r.ageGroup, regionId: r.region });
    const found = parseRegionPools(html);
    console.log(`Region ${r.region}, age group ${r.ageGroup}, season ${r.season}: ${found.length} pools`);
    for (const link of found) if (!targets.has(link.groupId)) targets.set(link.groupId, link);
  }

  const now = new Date().toISOString();
  const refs: PoolRef[] = [];
  const failed: string[] = [];
  let written = 0;

  for (const target of targets.values()) {
    const file = join(outDir, 'pools', `${target.groupId}.json`);
    const previous = await readJson<PoolData>(file);
    try {
      const data = await importPool(client, target, previous);
      if (stableJson(previous) !== stableJson(data)) {
        data.pool.updatedAt = now;
        await writeJson(file, data);
        written++;
      } else if (previous) {
        data.pool.updatedAt = previous.pool.updatedAt;
      }
      refs.push({ ...data.pool, teams: data.teams });
      const played = data.matches.filter((m) => m.score).length;
      const detailed = data.matches.filter((m) => m.games).length;
      console.log(`Pool ${target.groupId} ${data.pool.name}: ${data.teams.length} teams, ${played}/${data.matches.length} played, ${detailed} with games`);
    } catch (error) {
      failed.push(target.groupId);
      console.error(`Pool ${target.groupId}: import failed: ${error instanceof Error ? error.message : String(error)}`);
      if (previous) refs.push({ ...previous.pool, teams: previous.teams });
    }
  }

  refs.sort((a, b) => b.seasonId.localeCompare(a.seasonId) || a.league.localeCompare(b.league, 'da') || a.name.localeCompare(b.name, 'da', { numeric: true }));
  const indexFile = join(outDir, 'index.json');
  const previousIndex = await readJson<DataIndex>(indexFile);
  if (JSON.stringify(previousIndex?.pools) !== JSON.stringify(refs)) {
    await writeJson(indexFile, { version: 1, updatedAt: now, pools: refs } satisfies DataIndex);
    written++;
  }

  const seconds = Math.round((Date.now() - started) / 1000);
  console.log(`Done in ${seconds}s: ${client.requests} requests, ${written} files written, ${failed.length} pools failed.`);
  if (failed.length > 0 && failed.length === targets.size) process.exit(1);
}

async function importPool(client: PortalClient, target: PoolLink, previous: PoolData | null): Promise<PoolData> {
  const query = { seasonId: target.seasonId, groupId: target.groupId, ageGroupId: target.ageGroupId, regionId: target.regionId };

  const standingsHtml = await client.standing({ subPage: 2, ...query });
  const headings = parseHeadings(standingsHtml);
  const { standings, teams: standingTeams } = parseStandings(standingsHtml);
  const { matches, teams: matchTeams } = parseMatchList(await client.standing({ subPage: 4, ...query }));
  const stats = parsePlayerStats(await client.standing({ subPage: 7, ...query }));
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
      console.warn(`  match ${match.id}: could not read games (${error instanceof Error ? error.message : String(error)})`);
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

  return {
    version: 1,
    pool: {
      id: target.groupId,
      seasonId: target.seasonId,
      season: seasonName(target.seasonId),
      regionId: target.regionId,
      ageGroupId: target.ageGroupId,
      league: headings.league,
      name: headings.name || target.label,
      updatedAt: previous?.pool.updatedAt ?? '',
    },
    teams: mergeTeams(standingTeams, matchTeams),
    standings,
    matches,
    players: [...players.values()].sort((a, b) => a.name.localeCompare(b.name, 'da') || a.id.localeCompare(b.id)),
  };
}

function sameResult(a: TeamMatch, b: TeamMatch): boolean {
  return JSON.stringify([a.score, a.points, a.walkover]) === JSON.stringify([b.score, b.points, b.walkover]);
}

function mergeTeams(...lists: TeamRef[][]): TeamRef[] {
  const teams = new Map<string, TeamRef>();
  for (const list of lists) for (const team of list) if (!teams.has(team.id)) teams.set(team.id, team);
  return [...teams.values()];
}

/** JSON without the timestamp, to tell whether anything really changed. */
function stableJson(data: PoolData | null): string {
  return data ? JSON.stringify({ ...data, pool: { ...data.pool, updatedAt: '' } }) : '';
}

async function readJson<T>(file: string): Promise<T | null> {
  try {
    return JSON.parse(await readFile(file, 'utf8')) as T;
  } catch {
    return null;
  }
}

async function writeJson(file: string, data: unknown): Promise<void> {
  await mkdir(dirname(file), { recursive: true });
  await writeFile(file, JSON.stringify(data, null, 1) + '\n');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
