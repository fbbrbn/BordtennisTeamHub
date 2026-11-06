# How the data gets from bordtennisportalen.dk to the site

Everything the site shows comes from the public pages of [bordtennisportalen.dk](https://www.bordtennisportalen.dk).
The site itself never calls the portal: a scheduled job copies the data into JSON files, and the site reads those files.

```
bordtennisportalen.dk ──(GitHub Actions: scraper/import.ts)──> `data` branch ──(site build)──> GitHub Pages
                       └─(nightly: scraper/history.ts)───────> `history` branch (past seasons)
```

## 1. Where the data comes from

The portal's own pages load their content from one web service. The importer makes the same calls:

1. It opens the standings page (`/DBTU/HoldTurnering/Stilling/`) once. That gives a session cookie and the page's
   context key, which every service call needs.
2. It calls `GetLeagueStanding` with a `subPage` number:
   - 1: the pools of a region and age group (to find every pool of the season);
   - 4: a pool's match list, with dates, venues and results;
   - 2: the standings;
   - 7: the player stats, with official ratings;
   - 5: one match's games, with players and sets.
3. For the official ratings it calls other methods of the same service:
   - `GetRankingListVersions` and `GetRankingListPlayers` (the rating list, by date);
   - `GetPlayerRankingListPoints` (a player's rated games, to find which games a rating list includes).
4. Club names come from the portal's club-search script.

Each answer is an HTML fragment. `scraper/parse.ts` reads the parts it needs and ignores the rest. The exact calls and
their parameters are in [portal-api.md](portal-api.md).

**Privacy.** The pages also show player numbers (they encode birth dates) and team contact details. They are never
read into the data, and a test checks this. Only names, internal ids, ratings, clubs and results are stored.

## 2. When it runs

| Workflow | When (UTC) | What |
| --- | --- | --- |
| `.github/workflows/data.yml` | 05:23, 12:23, and every hour from 16:23 to 22:23 | The current season. |
| `.github/workflows/history.yml` | 00:41, for up to four hours | Past seasons, back to 2011/2012. |
| `.github/workflows/clock.yml` | Always (one job at a time) | Starts the two imports above on time. |
| `.github/workflows/site.yml` | After every data change and every push | Builds and publishes the site. |

The schedule follows the match evenings: in Danish winter time the evening runs are from 17 to 24.

GitHub delays or drops many scheduled runs when Actions is busy. On 4 and 5 November 2026 only 2 or 3 of the 9 daily
runs started, some hours late, and on the evening of 5 November none did. But a run started with `gh workflow run`
always starts. So the times are kept by the clock workflow:

- One job waits for each time in [`scraper/clock.ts`](../scraper/clock.ts) and starts that workflow itself.
- A job may run six hours, so after 340 minutes it starts the next clock run and ends. One clock is always running.
- A sleeping job is free in a public repository. In a private one it would use up the free Actions minutes.

GitHub's own schedule stays in the import workflows as a backup:

- The data workflow tries every slot several times: 05:23 and 05:53, 12:23 and 12:53, and four times an hour in the
  evening (:08, :23, :38, :53).
- Its first job starts the clock again if it has stopped. It also checks when the last import finished, from a small
  `import-done` artifact each import leaves. A scheduled attempt imports only when that was more than 50 minutes ago,
  and a run from the clock only when it was more than 30 minutes ago.
- So the portal still sees at most one import an hour. A failed import leaves no marker, so the next attempt retries.
- Started by hand, the workflow always imports, and also restarts the clock if needed.
- The history workflow skips a run when another one finished in the last 12 hours (its `history-done` artifact), so
  the clock and the schedule never both run a night's import.

## 3. One data run, step by step

`npm run import` (`scraper/import.ts`):

1. **Pools.** Finds every pool of the season (about 150), at most every 20 hours; otherwise it reuses the last list.
2. **Rating list.** Reads the date of the latest official rating list (2 requests).
3. **Each pool.** Reads its match list (1 request).
   - Nothing changed: the pool's previous file is reused.
   - Something changed: standings and player stats are read again, and the games of newly played matches.
   - A new rating list is out: the player stats are read again for the new ratings.
4. **Ratings across pools.** Players missing from a pool's own stats (for example lent by another team) get their
   official rating from another pool.
5. **Which games the list includes.** The portal does not say, so for a new list a few players' rating pages are
   checked to find the last included match day (`scraper/ratinglist.ts`).
6. **Rating forecasts.** Every singles game after that day is replayed with the official points table
   (`src/data/ratings.ts`), across all pools.
7. **The season's rating lists.** Every list version in force on a match day is kept (about 50 requests per new list).
8. **Predictions and form.** The season is replayed day by day, all pools together (`replaySeason` in
   `src/data/prematch.ts`). Every match gets the prediction made from what was known before its day: the rating list of
   that day, the earlier results and each player's form until then. The season's record goes in the index, and each
   player's form now goes in the pool files, for the forecasts of the matches to come. Last season's form comes from the
   history branch (`form/<season>.json`).
9. **Files.** Pool files are written only when their content changed, then the index, the player list and this
   season's player lines (`careers/`).

Then the workflow publishes the folder to the `data` branch as one new commit, replacing the previous one (so the
repository does not grow with every update), and starts the site build. A quiet run costs about 150 requests and 2 minutes. Requests are spaced 800 ms apart, and a run stops
starting new pools after 5 hours (the next run continues).

## 4. The files

On the `data` branch, copied into the site as `data/`:

| File | What is in it |
| --- | --- |
| `index.json` | The season, regions, age groups and clubs; every pool with its teams, places and points; the rating list in use; how the predictions did this season. |
| `pools/<poolId>.json` | One pool: its teams, standings, matches (results, games and the prediction made before each match) and players (official rating, rating forecast, and form against their rating). |
| `players.json` | Every player with their official rating and the teams they played for, for the player search. |
| `ratings/<seasonId>.json` | The season's official rating lists: every player's rating in each version in force on a match day. |
| `careers/<last three digits of the player id>.json` | This season's line for every player and team (matches, singles, doubles, rating when the pool started), for the player's History tab. |

The fields are described in [`src/data/model.ts`](../src/data/model.ts). Ids are the portal's own: pool ids are
`leagueGroupID`, team ids `leagueGroupTeamID`, match ids `leagueMatchID`, seasons `4YYYY` (42026 is 2026/2027).

On the `history` branch, one folder per past season (for example `42025/`):

| File | What is in it |
| --- | --- |
| `targets.json` | The season's pools, found once. |
| `pools/<poolId>.json` | One pool, in the same format as the current season. |
| `ratings.json` | Official ratings from up to 12 rating lists spread over the season's match days. |
| `index.json` | The season's pools, and whether the season is complete. |

And at the top of the branch:

- `players/<last three digits of the player id>.json`: every player's past seasons (team, pool, matches, singles and
  doubles, rating at the time), for the player page.
- `form/<season>.json`: a complete season's form, every player's singles against their rating and whether they played
  in a youth pool, for the next season's forecasts (`scraper/seasonform.ts`). Written once, when the season is
  complete.

Past seasons do not change, so each pool and rating list is read once. The whole backfill takes about two weeks of
nights, with requests one second apart. Once a season's rating lists are in, its pool files get each player's official
rating when the pool started.

The site build copies the past pools (by pool id) and the player files into the site as `history/`
([`scripts/pull-history.sh`](../scripts/pull-history.sh)). The site looks a pool up in `data/pools/` first, then in
`history/pools/`, and marks it as a past season.

## 5. Running it yourself

```bash
npm run data:pull
```

copies the current data into `public/data/` (ignored by git), so `npm run dev` shows real data.

```bash
npm run import
```

refreshes it from the portal (it needs network access to bordtennisportalen.dk). Behind the Claude cloud proxy, run it
with `NODE_USE_ENV_PROXY=1`. What it imports is set in [`scraper/config.json`](../scraper/config.json).

```bash
node scraper/history.ts --seasons 42025 --regions 4004 --age-groups 4006 --max-minutes 10 --out history
```

imports a small part of a past season into `history/` (also ignored by git).

## Details for developers

- `scraper/config.json` says what to import:
  - `discover`: every pool of a season (`"current"` or an id), for all or some regions and age groups. Pools are
    rediscovered every `everyHours`; otherwise the previous index's list is reused.
  - `pools` / `regions`: extra single pools or whole regions.
- In 2026/2027 there are 154 pools: 200 region and age-group combinations, most of them empty.
- `npm run import` writes `public/data/index.json` and `public/data/pools/<poolId>.json` as compact JSON.
  - The index has the season, regions, age groups, clubs, pools, and each team's club and place.
  - A pool whose match list (subPage 4) is unchanged costs one request: its file is reused.
  - Played-match details are fetched again only when a result changes.
  - Files are rewritten only when their content changes.
  - Requests are spaced 800 ms apart. After `maxMinutes` no new pools are started.
  - Pools no longer in scope are deleted, but only after a complete discovery.
  - Locally behind the cloud proxy, run it with `NODE_USE_ENV_PROXY=1`.
- Clubs come from the portal's club-search script (`clublistclientscript.aspx`, `SportsResultsTeamList`).
  - Each team is matched to the longest club name that prefixes its name, followed by a team number and/or a
    national-league tag such as "(N)", "(O)" or "(I.O)".
  - When nothing matches, the tag and the trailing team number are dropped instead.
- Data lives on the `data` branch, never on `main` (`public/data/` is gitignored):
  - `data.yml` (see "When it runs": started by `clock.yml`, with GitHub's schedule as a backup, and at most one import
    per 50 minutes) restores it, copies the history branch's `form/` files into `history/form/` (through the contents
    API, so not the whole branch), imports, force-pushes a single new commit when anything changed, and then triggers
    `site.yml`. Pushes made with the workflow token don't trigger workflows by themselves.
  - `site.yml` copies the branch into `public/data` before building.
  - Locally, run `npm run data:pull`.
- `scraper/pool.ts` reads one pool (shared by `import.ts` and `history.ts`). `import.ts` also writes:
  - `data/players.json`: every player with their teams, for the player search.
  - `data/ratings/<season>.json`: every rating-list version in force on a match day of the season (`seasonTimeline`).
  - `match.prediction` in every pool of the season, and the season's record as `index.predictions`.
  - `player.form` in every pool of the season: singles this season and wins above expectation, last season's, and
    `youth` (see [predictions.md](predictions.md)). The importer reads last season's from `history/form/<season>.json`
    (`--history-form` to change the folder); without the file, last season counts as nothing.
- Past seasons: `scraper/history.ts` and `.github/workflows/history.yml` (nightly at 00:41 UTC from the clock, four
  hours, requests one second apart) write `history/<season>/` on the `history` branch, newest season first:
  - `targets.json` (the season's pools, discovered once), `pools/<pool>.json` (same format as the current season),
    `ratings.json` (up to 12 versions spread over the match days, `chooseVersions`) and `index.json` (`complete`).
  - Also `players/<shard>.json` (`scraper/careers.ts`, rebuilt from every stored pool at the end of each run). A
    complete season's pools get the ratings at the time (`applyRatings`).
  - And `form/<season>.json` for every complete season that has none yet (`writeSeasonForms`: the season replayed with
    `replaySeason`).
  - The branch gets one ordinary commit per night, and then the workflow starts `site.yml`, which copies it in with
    `scripts/pull-history.sh` (`npm run history:pull` locally).
- The clock (`clock.yml`): its only job sleeps until the next time in `scraper/clock.ts` (`nextRun`), starts that
  workflow with `gh workflow run <file> -f clock=true`, and repeats. Times up to 5 minutes after its 340 minutes still
  belong to it, so none falls between two clocks; then it starts the next clock run. The `clock` concurrency group
  keeps one clock: a second one waits, and the next clock run replaces it. To change the times, edit `TIMETABLE`.
  Each clock run reads it when it starts, so a change applies within six hours. To apply it at once, cancel the
  running clock and start a data run, which starts a new clock.
- Rating forecasts:
  - Each run reads the latest list version (2 requests). A new version means each pool's subPage 7 is read again,
    then `findRatedThrough` binary-searches the cutoff over the season's match days using a few players' rating pages.
  - Pools are written at the end, after `forecastRatings`: `pool.ratings` says which list and cutoff, and
    `player.forecast` has the estimated rating and the pending games. The index has `ratings` once.
  - When the cutoff cannot be found there are no forecasts; the next run tries again.
