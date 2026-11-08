/**
 * Scores the forecast model on stored seasons, the honest way the site's own record is kept: every
 * match predicted only from what was known before its day (src/data/prematch.ts replaySeason).
 * Change the model, run this, and compare.
 *
 *   npm run data:pull                       the current season, into public/data
 *   git fetch --depth 1 origin history && mkdir -p history && git archive FETCH_HEAD | tar -x -C history
 *   npm run backtest                        [--data public/data] [--history history]
 *
 * Past seasons need their pools and ratings.json (complete seasons on the history branch). Each
 * season's form carries over to the next, as in the importer.
 */
import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { MatchPrediction, PoolData } from '../src/data/model.ts';
import { homeOutcome, predictionRecord, replaySeason, seasonLineups, type LastSeason, type RatingTimeline } from '../src/data/prematch.ts';
import { lastSeasonOf, seasonFormFile } from './seasonform.ts';

const cli = process.argv.slice(2);
const option = (name: string, fallback: string) => {
  const i = cli.indexOf(name);
  return i >= 0 && cli[i + 1] ? cli[i + 1] : fallback;
};
const dataDir = option('--data', 'public/data');
const historyDir = option('--history', 'history');
/** To tune BORROWED_SHRINK (src/data/forecast.ts), for lineups borrowed from this season or last. */
const shrink = {
  ...(cli.includes('--season-shrink') ? { season: Number(option('--season-shrink', '')) } : {}),
  ...(cli.includes('--last-shrink') ? { lastSeason: Number(option('--last-shrink', '')) } : {}),
};

async function readJson<T>(file: string): Promise<T | null> {
  try {
    return JSON.parse(await readFile(file, 'utf8')) as T;
  } catch {
    return null;
  }
}

async function readPools(dir: string): Promise<PoolData[]> {
  const names = (await readdir(dir).catch(() => [] as string[])).filter((n) => n.endsWith('.json'));
  const pools = await Promise.all(names.map((n) => readJson<PoolData>(join(dir, n))));
  return pools.filter((p): p is PoolData => p !== null);
}

async function main() {
  const seasons: { id: string; pools: PoolData[]; timeline: RatingTimeline }[] = [];
  for (const id of (await readdir(historyDir).catch(() => [] as string[])).filter((n) => /^4\d{4}$/.test(n)).sort()) {
    const timeline = await readJson<RatingTimeline>(join(historyDir, id, 'ratings.json'));
    const index = await readJson<{ complete: boolean }>(join(historyDir, id, 'index.json'));
    if (timeline && index?.complete) seasons.push({ id, pools: await readPools(join(historyDir, id, 'pools')), timeline });
  }
  const current = await readPools(join(dataDir, 'pools'));
  const currentId = current[0]?.pool.seasonId;
  const currentTimeline = currentId ? await readJson<RatingTimeline>(join(dataDir, 'ratings', `${currentId}.json`)) : null;
  if (currentId && currentTimeline) seasons.push({ id: currentId, pools: current, timeline: currentTimeline });
  if (seasons.length === 0) throw new Error(`No seasons found in ${historyDir}/ or ${dataDir}/`);

  let last: LastSeason | null = null;
  let previousId = '';
  for (const season of seasons) {
    const replay = replaySeason(season.pools, season.timeline, Number(season.id) - 1 === Number(previousId) ? last : null, { shrink });
    const matches = season.pools.flatMap((p) => p.matches.map((m) => ({ ...m, prediction: replay.predictions.get(p.pool.id)?.get(m.id) })));
    const played = matches.filter((m) => homeOutcome(m.score, m.walkover)).length;
    const report = (label: string, keep: (p: MatchPrediction) => boolean) => {
      const subset = matches.map((m) => ({ ...m, prediction: m.prediction && keep(m.prediction) ? m.prediction : undefined }));
      const record = predictionRecord(subset);
      if (!record) return;
      let logLoss = 0;
      for (const m of subset) {
        const outcome = homeOutcome(m.score, m.walkover);
        if (outcome && m.prediction) logLoss -= Math.log(Math.max(1e-4, m.prediction[outcome]));
      }
      console.log(
        `${season.id} ${label}: ${record.matches} of ${played} played matches. Right ${((100 * record.right) / record.matches).toFixed(1)}%, ` +
          `Brier ${record.brier.toFixed(4)}, log loss ${(logLoss / record.matches).toFixed(4)}, games off ${(100 * record.gamesError).toFixed(1)}%.`,
      );
    };
    report('all predictions', () => true);
    report('  with lineups from the pool', (p) => !p.lineups);
    report('  first matches, lineups from earlier this season', (p) => p.lineups === 'season');
    report('  first matches, lineups from last season', (p) => p.lineups === 'last-season');
    // What the next season gets from this one, the way history.ts writes it.
    last = lastSeasonOf(seasonFormFile(season.id, replay, seasonLineups(season.pools)));
    previousId = season.id;
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
