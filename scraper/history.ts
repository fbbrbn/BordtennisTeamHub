/**
 * Imports past seasons from bordtennisportalen.dk, newest first, into history/ (published on
 * the `history` branch by .github/workflows/history.yml).
 *
 *   node scraper/history.ts [--out history] [--max-minutes 240] [--delay 1000]
 *                           [--seasons 42025,42024] [--regions 4004] [--age-groups 4006] [--max-versions 12]
 *
 * For every past season:
 *   history/<season>/targets.json      the season's pools, discovered once
 *   history/<season>/pools/<pool>.json one file per pool, the same format as the current season
 *   history/<season>/ratings.json      official ratings from a few rating-list versions
 *   history/<season>/index.json        the season's pools, and whether the season is complete
 *
 * Past seasons do not change, so every pool and rating list is read once. A run stops starting
 * new work after `--max-minutes`; the next run continues where it stopped.
 */
import { readdir } from 'node:fs/promises';
import { join } from 'node:path';
import type { NamedId, PoolData, PoolRef } from '../src/data/model.ts';
import { parseDropdowns, parseRegionPools, seasonName, type PoolLink } from './parse.ts';
import { importPool, loadClubs, message, readJson, toRef, writeJson, type Context } from './pool.ts';
import { PortalClient } from './portal.ts';
import { addVersion, chooseVersions, defaultRatingList, ratingListAt, ratingListVersions, type SeasonRatings } from './ratinglist.ts';

/** The season's pools, with failed attempts so a broken pool is not retried for ever. */
interface Targets {
  version: 1;
  pools: PoolLink[];
  failures: Record<string, number>;
}

export interface SeasonIndex {
  version: 1;
  season: NamedId;
  /** Every pool and rating version has been read. */
  complete: boolean;
  pools: PoolRef[];
  /** Pools that could not be read after several attempts. */
  skipped: string[];
}

const MAX_ATTEMPTS = 3;
const REPO_URL = `https://github.com/${process.env.GITHUB_REPOSITORY ?? 'fbbrbn/BordtennisTeamHub'}`;
const USER_AGENT = `BordtennisTeamHub/0.1 (+${REPO_URL})`;
const cli = process.argv.slice(2);
const option = (name: string, fallback: string) => {
  const i = cli.indexOf(name);
  return i >= 0 && cli[i + 1] ? cli[i + 1] : fallback;
};
const list = (name: string) => option(name, '').split(',').filter(Boolean);
const outDir = option('--out', 'history');
const maxMinutes = Number(option('--max-minutes', '240'));
const maxVersions = Number(option('--max-versions', '12'));

async function main() {
  const started = Date.now();
  const timeUp = () => (Date.now() - started) / 60_000 > maxMinutes;
  const client = new PortalClient({ delayMs: Number(option('--delay', '1000')), userAgent: USER_AGENT });
  await client.init();
  const lists = parseDropdowns(client.page);
  const ctx: Context = {
    clubs: await loadClubs(client),
    regionName: new Map(lists.regions.map((r) => [r.id, r.name])),
    ageGroupName: new Map(lists.ageGroups.map((a) => [a.id, a.name])),
  };
  const wanted = list('--seasons');
  const seasons = lists.seasons
    .map((s) => s.id)
    .filter((id) => id !== lists.currentSeason && (wanted.length === 0 || wanted.includes(id)))
    .sort((a, b) => b.localeCompare(a));
  const regions = list('--regions').length > 0 ? list('--regions') : lists.regions.map((r) => r.id);
  const ageGroups = list('--age-groups').length > 0 ? list('--age-groups') : lists.ageGroups.map((a) => a.id);
  const listId = await defaultRatingList(client);
  console.log(`Past seasons: ${seasons.join(', ')}. Rating list ${listId}.`);

  for (const seasonId of seasons) {
    if (timeUp()) break;
    const dir = join(outDir, seasonId);
    const index = await readJson<SeasonIndex>(join(dir, 'index.json'));
    if (index?.complete) continue;
    const season = { id: seasonId, name: seasonName(seasonId) };

    // 1. The season's pools, discovered once.
    let targets = await readJson<Targets>(join(dir, 'targets.json'));
    if (!targets) {
      const pools = new Map<string, PoolLink>();
      let complete = true;
      for (const regionId of regions) {
        for (const ageGroupId of ageGroups) {
          try {
            for (const link of parseRegionPools(await client.standing({ subPage: 1, seasonId, regionId, ageGroupId }))) {
              if (!pools.has(link.groupId)) pools.set(link.groupId, link);
            }
          } catch (error) {
            complete = false;
            console.warn(`${season.name}: discovery failed for ${regionId}/${ageGroupId}: ${message(error)}`);
          }
        }
      }
      if (!complete) {
        console.warn(`${season.name}: discovery incomplete; trying again next run.`);
        continue;
      }
      targets = { version: 1, pools: [...pools.values()], failures: {} };
      await writeJson(join(dir, 'targets.json'), targets);
      console.log(`${season.name}: ${targets.pools.length} pools.`);
    }

    // 2. Every pool, once.
    const stored = new Set((await readdir(join(dir, 'pools')).catch(() => [] as string[])).map((f) => f.replace(/\.json$/, '')));
    let read = 0;
    for (const target of targets.pools) {
      if (stored.has(target.groupId) || (targets.failures[target.groupId] ?? 0) >= MAX_ATTEMPTS) continue;
      if (timeUp()) break;
      try {
        const { data } = await importPool(client, target, null, ctx, false);
        data.pool.updatedAt = new Date().toISOString();
        await writeJson(join(dir, 'pools', `${target.groupId}.json`), data);
        stored.add(target.groupId);
        read++;
      } catch (error) {
        targets.failures[target.groupId] = (targets.failures[target.groupId] ?? 0) + 1;
        await writeJson(join(dir, 'targets.json'), targets);
        console.warn(`${season.name}: pool ${target.groupId} failed (${message(error)})`);
      }
    }
    const pending = targets.pools.filter((t) => !stored.has(t.groupId) && (targets.failures[t.groupId] ?? 0) < MAX_ATTEMPTS);
    console.log(`${season.name}: ${read} pools read, ${stored.size} stored, ${pending.length} to go (${client.requests} requests so far).`);

    // 3. Ratings from a few list versions, spread over the season's match days.
    const refs: PoolRef[] = [];
    let first = '';
    let last = '';
    for (const id of stored) {
      const data = await readJson<PoolData>(join(dir, 'pools', `${id}.json`));
      if (!data) continue;
      refs.push(toRef(data));
      for (const m of data.matches) {
        const day = m.date.slice(0, 10);
        if (!first || day < first) first = day;
        if (!last || day > last) last = day;
      }
    }
    let ratingsDone = false;
    if (pending.length === 0 && first && !timeUp()) {
      const file = join(dir, 'ratings.json');
      const empty: SeasonRatings = { version: 1, listId, available: await ratingListVersions(client, listId, seasonId), versions: [], players: {} };
      const ratings = (await readJson<SeasonRatings>(file)) ?? empty;
      const chosen = chooseVersions(ratings.available, first, last, maxVersions);
      for (const date of chosen) {
        if (ratings.versions.includes(date)) continue;
        if (timeUp()) break;
        const found = await ratingListAt(client, listId, seasonId, date);
        addVersion(ratings, date, found);
        await writeJson(file, ratings);
        console.log(`${season.name}: rating list of ${date}, ${found.size} players.`);
      }
      ratingsDone = chosen.every((d) => ratings.versions.includes(d));
    }

    const skipped = targets.pools.filter((t) => !stored.has(t.groupId)).map((t) => t.groupId);
    const seasonIndex: SeasonIndex = {
      version: 1,
      season,
      complete: pending.length === 0 && ratingsDone,
      pools: refs.sort((a, b) => a.regionId.localeCompare(b.regionId) || a.ageGroupId.localeCompare(b.ageGroupId) || a.name.localeCompare(b.name, 'da', { numeric: true })),
      skipped,
    };
    await writeJson(join(dir, 'index.json'), seasonIndex);
    if (seasonIndex.complete) console.log(`${season.name}: complete.`);
  }
  console.log(`Done in ${Math.round((Date.now() - started) / 60_000)} min, ${client.requests} requests.`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
