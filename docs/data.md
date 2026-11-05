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
their parameters are in [CLAUDE.md](../CLAUDE.md#data-source-verified).

**Privacy.** The pages also show player numbers (they encode birth dates) and team contact details. They are never
read into the data, and a test checks this. Only names, internal ids, ratings, clubs and results are stored.

## 2. When it runs

| Workflow | When (UTC) | What |
| --- | --- | --- |
| `.github/workflows/data.yml` | 05:23, 12:23, and hourly 16:23 to 22:23 | The current season. |
| `.github/workflows/history.yml` | 00:41, for up to four hours | Past seasons, back to 2011/2012. |
| `.github/workflows/site.yml` | After every data change and every push | Builds and publishes the site. |

The schedule follows the match evenings: in Danish winter time the evening runs are 17:23 to 23:23.

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
8. **Predictions.** Every match gets the prediction made from what was known before its day: the rating list of that
   day and the earlier results (`src/data/prematch.ts`). The season's record goes in the index.
9. **Files.** Pool files are written only when their content changed, then the index and the player list.

Then the workflow publishes the folder to the `data` branch as one new commit, replacing the previous one, and starts
the site build. A quiet run costs about 150 requests and 2 minutes. Requests are spaced 800 ms apart, and a run stops
starting new pools after 5 hours (the next run continues).

## 4. The files

On the `data` branch, copied into the site as `data/`:

| File | What is in it |
| --- | --- |
| `index.json` | The season, regions, age groups and clubs; every pool with its teams, places and points; the rating list in use; how the predictions did this season. |
| `pools/<poolId>.json` | One pool: its teams, standings, matches (results, games and the prediction made before each match) and players (official rating and rating forecast). |
| `players.json` | Every player with their official rating and the teams they played for, for the player search. |
| `ratings/<seasonId>.json` | The season's official rating lists: every player's rating in each version in force on a match day. |

The fields are described in [`src/data/model.ts`](../src/data/model.ts). Ids are the portal's own: pool ids are
`leagueGroupID`, team ids `leagueGroupTeamID`, match ids `leagueMatchID`, seasons `4YYYY` (42026 is 2026/2027).

On the `history` branch, one folder per past season (for example `42025/`):

| File | What is in it |
| --- | --- |
| `targets.json` | The season's pools, found once. |
| `pools/<poolId>.json` | One pool, in the same format as the current season. |
| `ratings.json` | Official ratings from up to 12 rating lists spread over the season's match days. |
| `index.json` | The season's pools, and whether the season is complete. |

Past seasons do not change, so each pool and rating list is read once. The whole backfill takes about two weeks of
nights, with requests one second apart. This branch is not copied into the site yet.

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
