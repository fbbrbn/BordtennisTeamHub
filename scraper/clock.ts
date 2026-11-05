/**
 * When the imports run. GitHub delays or drops many scheduled runs, but a run started with
 * `gh workflow run` always starts, so `.github/workflows/clock.yml` waits for each time here and
 * starts the workflow itself. GitHub's own schedule stays in the workflows as a backup.
 *
 *   node scraper/clock.ts          prints `<unix seconds> <workflow file>` for the next run
 */

export type Workflow = 'data.yml' | 'history.yml';

/** Every day, in UTC. Match results come in from about 17 to 24 Danish time. */
export const TIMETABLE: { at: string; workflow: Workflow }[] = [
  { at: '00:41', workflow: 'history.yml' },
  ...['05:23', '12:23', '16:23', '17:23', '18:23', '19:23', '20:23', '21:23', '22:23'].map((at) => ({
    at,
    workflow: 'data.yml' as const,
  })),
];

export interface Run {
  at: Date;
  workflow: Workflow;
}

/** The first run in the timetable after `now`. */
export function nextRun(now: Date): Run {
  const runs: Run[] = [];
  for (const day of [0, 1]) {
    for (const { at, workflow } of TIMETABLE) {
      const [h, m] = at.split(':').map(Number);
      const date = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + day, h, m));
      runs.push({ at: date, workflow });
    }
  }
  return runs.filter((r) => r.at > now).sort((a, b) => a.at.getTime() - b.at.getTime())[0];
}

if (process.argv[1]?.endsWith('clock.ts')) {
  const next = nextRun(new Date());
  console.log(`${next.at.getTime() / 1000} ${next.workflow}`);
}
