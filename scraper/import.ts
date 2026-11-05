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
 * - When a new official rating list is out, each pool's player ratings are read again (one
 *   request per pool), and the games the list does not include yet get a rating forecast.
 * - Files are rewritten only when their content changes.
 */
import { readdir, readFile, unlink } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { clubOf, clubSlug } from '../src/data/clubs.ts';
import type { ClubRef, DataIndex, NamedId, PoolData, PoolRef, RatingStatus } from '../src/data/model.ts';
import { forecastRatings, ratingPoints, type RatingForecast } from '../src/data/ratings.ts';
import { parseDropdowns, parseRatingLinks, parseRegionPools, seasonName, type PoolLink } from './parse.ts';
import { importPool, loadClubs, message, readJson, toRef, writeJson, type Context } from './pool.ts';
import { PortalClient } from './portal.ts';
import { findRatedThrough, latestRatingList, ratingPointsOf, type RatingLink } from './ratinglist.ts';

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

type RatingList = Awaited<ReturnType<typeof latestRatingList>>;
type IndexRatings = NonNullable<DataIndex['ratings']>;

// Contact URL for the portal's logs; in GitHub Actions it follows the repository, even after a rename.
const REPO_URL = `https://github.com/${process.env.GITHUB_REPOSITORY ?? 'fbbrbn/BordtennisTeamHub'}`;
const USER_AGENT = `BordtennisTeamHub/0.1 (+${REPO_URL})`;
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
      const found = new Set<string>();
      for (const region of pick(lists.regions, d.regions)) {
        for (const ageGroup of pick(lists.ageGroups, d.ageGroups)) {
          try {
            const html = await client.standing({ subPage: 1, seasonId, regionId: region.id, ageGroupId: ageGroup.id });
            for (const link of parseRegionPools(html)) {
              if (!targets.has(link.groupId)) targets.set(link.groupId, link);
              found.add(link.groupId);
            }
          } catch (error) {
            discoveryComplete = false;
            console.warn(`Discovery failed for ${region.name} / ${ageGroup.name}: ${message(error)}`);
          }
        }
      }
      discoveredAt = discoveryComplete ? now : previousIndex?.discoveredAt;
      console.log(`Discovered ${found.size} pools for ${season.name}${discoveryComplete ? '' : ' (incomplete)'}.`);
    } else {
      for (const p of previousIndex?.pools ?? []) {
        if (p.seasonId === seasonId && !targets.has(p.id)) {
          targets.set(p.id, { seasonId: p.seasonId, groupId: p.id, ageGroupId: p.ageGroupId, regionId: p.regionId, label: p.name });
        }
      }
      console.log(`Reusing the pool list discovered ${Math.round(age)} hours ago (${targets.size} pools).`);
    }
  }

  // The official rating list. When a new version is out, every pool's ratings are read again.
  const ratingSeason = season?.id ?? lists.currentSeason;
  let ratingList: RatingList | null = null;
  try {
    if (ratingSeason) ratingList = await latestRatingList(client, ratingSeason);
  } catch (error) {
    console.warn(`Rating list unavailable (${message(error)}); keeping the last known one.`);
  }

  const counts = { updated: 0, unchanged: 0, failed: 0, deferred: 0 };
  const ordered = [...targets.values()].sort(
    (a, b) => a.regionId.localeCompare(b.regionId) || a.ageGroupId.localeCompare(b.ageGroupId) || a.groupId.localeCompare(b.groupId),
  );

  // Pools are written at the end, once the rating forecasts (which span pools) are known.
  const imported: { file: string; previous: PoolData | null; data: PoolData }[] = [];
  /** Failed or deferred pools: their previous file stays as it is. */
  const kept: PoolData[] = [];
  const links = new Map<string, RatingLink>();
  /** Official ratings from the player stats read in this run. */
  const freshRatings = new Map<string, number>();
  for (const [i, target] of ordered.entries()) {
    if (i > 0 && i % 25 === 0) console.log(`  ${i}/${ordered.length} pools read (${Math.round(minutes())} min)`);
    const file = join(poolsDir, `${target.groupId}.json`);
    const previous = await readJson<PoolData>(file);
    if (config.maxMinutes && minutes() > config.maxMinutes) {
      counts.deferred++;
      if (previous) kept.push(previous);
      continue;
    }
    try {
      const refreshRatings =
        !!ratingList && target.seasonId === ratingList.seasonId && previous?.pool.ratings?.listDate !== ratingList.listDate;
      const result = await importPool(client, target, previous, ctx, refreshRatings);
      for (const [id, link] of result.links) links.set(id, link);
      for (const s of result.stats ?? []) if (s.rating !== null && target.seasonId === ratingSeason) freshRatings.set(s.id, s.rating);
      imported.push({ file, previous, data: result.data });
    } catch (error) {
      counts.failed++;
      console.error(`Pool ${target.groupId}: import failed: ${message(error)}`);
      if (previous) kept.push(previous);
    }
  }

  // A pool's player stats leave out some of the players who played in it (lent by another team, say).
  // They get their official rating from another pool of the season; ratings read in this run come first.
  const all = [...kept, ...imported.map((i) => i.data)];
  const official = new Map(freshRatings);
  for (const pool of [...imported.map((i) => i.data), ...kept]) {
    if (pool.pool.seasonId !== ratingSeason) continue;
    for (const p of pool.players) if (p.rating !== null && !official.has(p.id)) official.set(p.id, p.rating);
  }
  for (const { data } of imported) {
    if (data.pool.seasonId !== ratingSeason) continue;
    for (const p of data.players) p.rating = official.get(p.id) ?? p.rating;
  }

  // Rating forecasts: kept pools first, so ratings read in this run win for players in several pools.
  const ratings = await ratingStatus(client, ratingList, previousIndex?.ratings, all, links);
  const inSeason = (data: PoolData) => !!ratings && data.pool.seasonId === ratings.seasonId;
  const forecasts = ratings ? forecastRatings(all.filter(inSeason), ratings.ratedThrough) : new Map<string, RatingForecast>();
  if (ratings) {
    // Every game counts for both players.
    const games = [...forecasts.values()].reduce((sum, f) => sum + f.games.length, 0) / 2;
    console.log(`Rating forecasts: ${forecasts.size} players, ${games} singles played after ${ratings.ratedThrough}.`);
  }

  const refs: PoolRef[] = kept.map(toRef);
  for (const { file, previous, data } of imported) {
    applyForecasts(data, inSeason(data) ? ratings : null, forecasts);
    if (stableJson(previous) !== stableJson(data)) {
      data.pool.updatedAt = now;
      await writeJson(file, data);
      counts.updated++;
      const played = data.matches.filter((m) => m.score).length;
      console.log(`Updated ${data.pool.id} ${data.pool.league} · ${data.pool.name}: ${played}/${data.matches.length} played`);
    } else {
      if (previous) data.pool.updatedAt = previous.pool.updatedAt;
      counts.unchanged++;
    }
    refs.push(toRef(data));
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
    ...(ratings ? { ratings } : {}),
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

/**
 * Which games the official ratings include: reused while the list is the same, otherwise
 * found from a few players' rating pages. Null when unknown, and then there are no forecasts.
 */
async function ratingStatus(
  client: PortalClient,
  list: RatingList | null,
  previous: IndexRatings | undefined,
  pools: PoolData[],
  links: Map<string, RatingLink>,
): Promise<IndexRatings | null> {
  if (!list) return previous ?? null;
  if (previous && previous.listId === list.listId && previous.seasonId === list.seasonId && previous.listDate === list.listDate) {
    return previous;
  }
  const season = pools.filter((p) => p.pool.seasonId === list.seasonId);
  const read = new Set<string>();
  const probe = async (playerId: string) => {
    // Players seen only in pools whose stats were not read in this run: read those stats now.
    const pool = links.has(playerId) ? undefined : season.find((p) => !read.has(p.pool.id) && p.players.some((x) => x.id === playerId));
    if (pool) {
      read.add(pool.pool.id);
      const { seasonId, id: groupId, ageGroupId, regionId } = pool.pool;
      for (const [id, link] of parseRatingLinks(await client.standing({ subPage: 7, seasonId, groupId, ageGroupId, regionId }))) {
        links.set(id, link);
      }
    }
    const link = links.get(playerId);
    return link ? ratingPointsOf(client, playerId, link) : null;
  };
  try {
    const found = await findRatedThrough(season, list.listDate, probe);
    if (!found) throw new Error('no player could be looked up');
    // Checks for the log: the pages' totals against the official ratings, and the points table.
    const official = new Map(season.flatMap((p) => p.players.flatMap((x) => (x.rating === null ? [] : [[x.id, x.rating] as const]))));
    let agree = 0;
    let games = 0;
    let matched = 0;
    for (const { playerId, points } of found.probes) {
      if ((points.start?.rating ?? 0) + points.games.reduce((sum, g) => sum + g.points, 0) === official.get(playerId)) agree++;
      for (const g of points.games) {
        games++;
        if (ratingPoints(g.own, g.opp, g.points > 0) === g.points) matched++;
      }
    }
    console.log(
      `Rating list of ${list.listDate} includes games up to ${found.ratedThrough}. Checked ${found.probes.length} players: ` +
        `${agree} totals agree with their official rating, and the points table matches ${matched} of ${games} rated games.`,
    );
    return { ...list, ratedThrough: found.ratedThrough };
  } catch (error) {
    console.warn(`Could not tell which games the rating list of ${list.listDate} includes (${message(error)}); no rating forecasts.`);
    return null;
  }
}

/** Sets which games the official ratings include, and each player's forecast. */
function applyForecasts(data: PoolData, status: RatingStatus | null, forecasts: Map<string, RatingForecast>): void {
  if (status) data.pool.ratings = { listDate: status.listDate, ratedThrough: status.ratedThrough };
  else delete data.pool.ratings;
  for (const player of data.players) {
    const forecast = status && player.rating !== null ? forecasts.get(player.id) : undefined;
    if (forecast) player.forecast = { rating: forecast.rating, games: forecast.games };
    else delete player.forecast;
  }
}

/** JSON without timestamps, to tell whether anything really changed. */
function stableJson(data: PoolData | null): string {
  return data ? JSON.stringify({ ...data, pool: { ...data.pool, updatedAt: '' } }) : '';
}

function stableIndex(index: DataIndex | null): string {
  return index ? JSON.stringify({ ...index, updatedAt: '' }) : '';
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
