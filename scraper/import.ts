/**
 * Imports team-tournament data from bordtennisportalen.dk into public/data/.
 *
 *   node scraper/import.ts [--config scraper/config.json] [--out public/data]
 *
 * Writes public/data/index.json (every imported pool, its teams and their clubs) and
 * public/data/pools/<poolId>.json (standings, matches, games, players).
 *
 * Built to cover every pool of a season politely:
 * - The list of pools is discovered at most every `discover.everyHours` hours.
 * - A pool whose match list has not changed costs one request: everything else is reused.
 * - Played-match details are fetched once and reused while the result is unchanged.
 * - After `maxMinutes` no new pools are started; the next run continues from there.
 * - Files are rewritten only when their content changes.
 */
import { mkdir, readdir, readFile, unlink, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { clubOf, clubSlug, type Club } from '../src/data/clubs.ts';
import type { ClubRef, DataIndex, NamedId, PoolData, PoolRef, Player, TeamMatch, TeamRef } from '../src/data/model.ts';
import {
  parseClubList,
  parseDropdowns,
  parseHeadings,
  parseMatchDetails,
  parseMatchList,
  parsePlayerStats,
  parseRegionPools,
  parseStandings,
  seasonName,
  tidyPoolName,
  type PoolLink,
} from './parse.ts';
import { PortalClient } from './portal.ts';

interface ImportConfig {
  delayMs?: number;
  /** Stop starting new pools after this many minutes (the next run continues). */
  maxMinutes?: number;
  /** Every pool of a season, for all or some regions and age groups. */
  discover?: {
    season?: string;
    regions?: 'all' | string[];
    ageGroups?: 'all' | string[];
    everyHours?: number;
  };
  /** Single pools: ids as they appear in the portal's URL hash. */
  pools?: { season: string; region: string; ageGroup: string; pool: string }[];
  /** Every pool of a region and age group. */
  regions?: { season: string; region: string; ageGroup: string }[];
}

interface Context {
  clubs: Club[];
  regionName: Map<string, string>;
  ageGroupName: Map<string, string>;
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
const poolsDir = join(outDir, 'pools');

async function main() {
  const config = JSON.parse(await readFile(configPath, 'utf8')) as ImportConfig;
  const client = new PortalClient({ delayMs: config.delayMs ?? 800, userAgent: USER_AGENT });
  const started = Date.now();
  const now = new Date().toISOString();
  const minutes = () => (Date.now() - started) / 60_000;

  await client.init();
  const lists = parseDropdowns(client.page);
  const ctx: Context = {
    clubs: await loadClubs(client),
    regionName: new Map(lists.regions.map((r) => [r.id, r.name])),
    ageGroupName: new Map(lists.ageGroups.map((a) => [a.id, a.name])),
  };
  console.log(`Portal lists: ${lists.regions.length} regions, ${lists.ageGroups.length} age groups, ${ctx.clubs.length} clubs.`);

  const indexFile = join(outDir, 'index.json');
  const previousIndex = await readJson<DataIndex>(indexFile);
  const targets = new Map<string, PoolLink>();
  for (const p of config.pools ?? []) {
    targets.set(p.pool, { seasonId: p.season, groupId: p.pool, ageGroupId: p.ageGroup, regionId: p.region, label: '' });
  }
  for (const r of config.regions ?? []) {
    const found = parseRegionPools(await client.standing({ subPage: 1, seasonId: r.season, ageGroupId: r.ageGroup, regionId: r.region }));
    for (const link of found) if (!targets.has(link.groupId)) targets.set(link.groupId, link);
  }

  // Discovery of every pool of the season, at most every few hours.
  let discoveredAt = previousIndex?.discoveredAt;
  let discoveryComplete = true;
  let season: NamedId | undefined;
  if (config.discover) {
    const d = config.discover;
    const seasonId = !d.season || d.season === 'current' ? lists.currentSeason : d.season;
    if (!seasonId) throw new Error('Could not tell the current season');
    season = { id: seasonId, name: seasonName(seasonId) };
    const pick = (all: NamedId[], wanted?: 'all' | string[]) => (!wanted || wanted === 'all' ? all : all.filter((x) => wanted.includes(x.id)));
    const age = previousIndex?.discoveredAt ? (Date.now() - Date.parse(previousIndex.discoveredAt)) / 3_600_000 : Infinity;
    if (age >= (d.everyHours ?? 20) || previousIndex?.season?.id !== seasonId) {
      let found = 0;
      for (const region of pick(lists.regions, d.regions)) {
        for (const ageGroup of pick(lists.ageGroups, d.ageGroups)) {
          try {
            const html = await client.standing({ subPage: 1, seasonId, regionId: region.id, ageGroupId: ageGroup.id });
            for (const link of parseRegionPools(html)) {
              if (!targets.has(link.groupId)) targets.set(link.groupId, link);
              found++;
            }
          } catch (error) {
            discoveryComplete = false;
            console.warn(`Discovery failed for ${region.name} / ${ageGroup.name}: ${message(error)}`);
          }
        }
      }
      discoveredAt = discoveryComplete ? now : previousIndex?.discoveredAt;
      console.log(`Discovered ${found} pools for ${season.name}${discoveryComplete ? '' : ' (incomplete)'}.`);
    } else {
      for (const p of previousIndex?.pools ?? []) {
        if (p.seasonId === seasonId && !targets.has(p.id)) {
          targets.set(p.id, { seasonId: p.seasonId, groupId: p.id, ageGroupId: p.ageGroupId, regionId: p.regionId, label: p.name });
        }
      }
      console.log(`Reusing the pool list discovered ${Math.round(age)} hours ago (${targets.size} pools).`);
    }
  }

  const refs: PoolRef[] = [];
  const counts = { updated: 0, unchanged: 0, failed: 0, deferred: 0 };
  const ordered = [...targets.values()].sort(
    (a, b) => a.regionId.localeCompare(b.regionId) || a.ageGroupId.localeCompare(b.ageGroupId) || a.groupId.localeCompare(b.groupId),
  );

  for (const target of ordered) {
    const file = join(poolsDir, `${target.groupId}.json`);
    const previous = await readJson<PoolData>(file);
    if (config.maxMinutes && minutes() > config.maxMinutes) {
      counts.deferred++;
      if (previous) refs.push(toRef(previous));
      continue;
    }
    try {
      const data = await importPool(client, target, previous, ctx);
      if (stableJson(previous) !== stableJson(data)) {
        data.pool.updatedAt = now;
        await writeJson(file, data);
        counts.updated++;
        const played = data.matches.filter((m) => m.score).length;
        console.log(`Updated ${target.groupId} ${data.pool.league} · ${data.pool.name}: ${played}/${data.matches.length} played`);
      } else {
        if (previous) data.pool.updatedAt = previous.pool.updatedAt;
        counts.unchanged++;
      }
      refs.push(toRef(data));
    } catch (error) {
      counts.failed++;
      console.error(`Pool ${target.groupId}: import failed: ${message(error)}`);
      if (previous) refs.push(toRef(previous));
    }
  }

  // Pools no longer in scope: forget them, but only after a complete discovery.
  if (discoveryComplete && counts.deferred === 0) {
    const keep = new Set(refs.map((r) => `${r.id}.json`));
    for (const name of await readdir(poolsDir).catch(() => [] as string[])) {
      if (name.endsWith('.json') && !keep.has(name)) {
        await unlink(join(poolsDir, name));
        console.log(`Removed ${name}: no longer in scope.`);
      }
    }
  }

  refs.sort(
    (a, b) =>
      b.seasonId.localeCompare(a.seasonId) ||
      a.regionId.localeCompare(b.regionId) ||
      a.ageGroupId.localeCompare(b.ageGroupId) ||
      a.name.localeCompare(b.name, 'da', { numeric: true }),
  );
  const clubs = new Map<string, ClubRef>();
  for (const ref of refs) {
    for (const team of ref.teams) {
      if (!team.club) continue;
      const slug = clubSlug(team.club);
      if (!clubs.has(slug)) clubs.set(slug, { slug, name: team.club, id: clubOf(team.name, ctx.clubs).id });
    }
  }
  const used = (ids: string[], names: Map<string, string>) =>
    [...new Set(ids)].map((id) => ({ id, name: names.get(id) ?? id })).sort((a, b) => a.id.localeCompare(b.id));
  const index: DataIndex = {
    version: 1,
    updatedAt: previousIndex?.updatedAt ?? now,
    discoveredAt,
    season,
    regions: used(refs.map((r) => r.regionId), ctx.regionName),
    ageGroups: used(refs.map((r) => r.ageGroupId), ctx.ageGroupName),
    clubs: [...clubs.values()].sort((a, b) => a.name.localeCompare(b.name, 'da')),
    pools: refs,
  };
  if (stableIndex(previousIndex) !== stableIndex(index)) {
    index.updatedAt = now;
    await writeJson(indexFile, index);
  }

  const seconds = Math.round((Date.now() - started) / 1000);
  console.log(
    `Done in ${seconds}s, ${client.requests} requests: ${refs.length} pools, ${counts.updated} updated, ${counts.unchanged} unchanged, ` +
      `${counts.failed} failed, ${counts.deferred} left for the next run.`,
  );
  if (counts.failed > 0 && counts.failed === targets.size) process.exit(1);
}

async function importPool(client: PortalClient, target: PoolLink, previous: PoolData | null, ctx: Context): Promise<PoolData> {
  const query = { seasonId: target.seasonId, groupId: target.groupId, ageGroupId: target.ageGroupId, regionId: target.regionId };
  const { matches, teams: matchTeams } = parseMatchList(await client.standing({ subPage: 4, ...query }));

  // Nothing new in the match list, and every played match has its games: reuse the previous file.
  if (previous && sameSchedule(previous.matches, matches) && previous.matches.every((m) => !m.score || m.games)) {
    return describe(structuredClone(previous), target, ctx);
  }

  const standingsHtml = await client.standing({ subPage: 2, ...query });
  const headings = parseHeadings(standingsHtml);
  const { standings, teams: standingTeams } = parseStandings(standingsHtml);
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

  return describe(
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
      players: [...players.values()].sort((a, b) => a.name.localeCompare(b.name, 'da') || a.id.localeCompare(b.id)),
    },
    target,
    ctx,
  );
}

/** Adds region and age-group names and each team's club; needs no requests. */
function describe(data: PoolData, target: PoolLink, ctx: Context): PoolData {
  const regionName = ctx.regionName.get(target.regionId);
  const ageGroupName = ctx.ageGroupName.get(target.ageGroupId);
  data.pool.name = tidyPoolName(data.pool.name);
  if (regionName) data.pool.regionName = regionName;
  if (ageGroupName) data.pool.ageGroupName = ageGroupName;
  data.teams = data.teams.map((t) => ({ id: t.id, name: t.name, club: clubOf(t.name, ctx.clubs).name }));
  return data;
}

function toRef(data: PoolData): PoolRef {
  const standing = new Map(data.standings.map((s) => [s.teamId, s]));
  return {
    ...data.pool,
    teams: data.teams.map((t) => ({
      ...t,
      position: standing.get(t.id)?.position ?? null,
      points: standing.get(t.id)?.points ?? null,
      played: standing.get(t.id)?.played ?? null,
    })),
  };
}

async function loadClubs(client: PortalClient): Promise<Club[]> {
  const src = /src="([^"]*clublistclientscript\.aspx[^"]*)"/i.exec(client.page)?.[1]?.replace(/&amp;/g, '&');
  if (!src) return [];
  try {
    return parseClubList(await client.text(src));
  } catch (error) {
    console.warn(`Club list unavailable (${message(error)}); club names fall back to team names.`);
    return [];
  }
}

function sameSchedule(a: TeamMatch[], b: TeamMatch[]): boolean {
  const key = (list: TeamMatch[]) =>
    JSON.stringify(
      [...list]
        .sort((x, y) => x.id.localeCompare(y.id))
        .map((m) => [m.id, m.date, m.homeTeamId, m.awayTeamId, m.venue, m.score, m.points, m.walkover]),
    );
  return key(a) === key(b);
}

function sameResult(a: TeamMatch, b: TeamMatch): boolean {
  return JSON.stringify([a.score, a.points, a.walkover]) === JSON.stringify([b.score, b.points, b.walkover]);
}

function mergeTeams(...lists: TeamRef[][]): TeamRef[] {
  const teams = new Map<string, TeamRef>();
  for (const list of lists) for (const team of list) if (!teams.has(team.id)) teams.set(team.id, team);
  return [...teams.values()];
}

/** JSON without timestamps, to tell whether anything really changed. */
function stableJson(data: PoolData | null): string {
  return data ? JSON.stringify({ ...data, pool: { ...data.pool, updatedAt: '' } }) : '';
}

function stableIndex(index: DataIndex | null): string {
  return index ? JSON.stringify({ ...index, updatedAt: '' }) : '';
}

function message(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
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
  await writeFile(file, JSON.stringify(data) + '\n');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
