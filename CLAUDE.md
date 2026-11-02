# Notes for working on this repository

## Goal

An unofficial web app for teams in the Danish table tennis team tournament (DBTU Holdturnering). It has three parts:

1. **Lineup planner.** For example, 5 players and 3 per match: who plays each match.
2. **Interactive dashboards** per team and per player, built from bordtennisportalen.dk results.
3. **A start page** where any team selects itself.

The owner's team, Vallensbæk BTK 3, is the first tester. Nothing may be specific to that team: no hard-coded team
names, ids or pools in code.

## Stack and layout

- Vite + React + TypeScript (strict). The app uses a hash router (`src/lib/router.ts`), so GitHub Pages needs no
  server config.
- `src/lineup/`: the lineup planner.
  - `planner.ts`: pure season planner (min-cost flow in `mcmf.ts`), unit-tested.
  - `storage.ts`: localStorage, share-link encoding (deflate + base64url) and validation of untrusted input.
  - `state.ts`: reducer. The UI lives in `LineupPage.tsx`, `Matches.tsx`, `BalanceTable.tsx` and `RosterEditor.tsx`.
- `src/data/`: `model.ts` (shared JSON types), `load.ts` (fetch + cache) and `stats.ts` (pure, tested statistics).
- `src/pages/`: the start page (team picker), plus team, player, pool and match dashboards. Routes look like
  `#/team/<poolId>/<teamId>`.
- `src/charts/`: hand-written SVG charts. `PointsRace` is a line chart in emphasis form; `RatingStrip` is a strip plot.
  Both have hover, keyboard and touch tooltips and a table twin.
- `src/lineup/sync.ts`: a planner stored under the key `team-<poolId>-<teamId>` syncs its roster, fixtures and
  `playedBy` from the pool data.
- `.github/workflows/site.yml`: typecheck, test and build on every push and PR; deploy to GitHub Pages from `main`.

Commands: `npm test`, `npm run typecheck`, `npm run build`, `npm run dev`.

## Conventions

- English UI. Danish table tennis terms are fine where users expect them (Holdturnering, pulje, række).
- Mobile first: captains and players use phones. Check 390px width; there must be no horizontal page scroll.
- Charts follow the dataviz skill's rules:
  - Validate colors with its script.
  - Thin marks and a legend.
  - Text in text colors, never in series colors.
  - Separate light and dark values.
- Never ship invented match data. Test fixtures stay in tests.

## Data source (verified)

`scraper/` imports data from bordtennisportalen.dk. Everything below was checked against the live site.

- The team-tournament pages call one ASP.NET AJAX method:
  - `POST https://www.bordtennisportalen.dk/SportsResults/Components/WebService1.asmx/GetLeagueStanding`
  - JSON body: `callbackcontextkey, subPage, seasonID, leagueGroupID, ageGroupID, regionID, leagueGroupTeamID, leagueMatchID, clubID, playerID`
  - Response: `{ d: { html } }`, an HTML fragment.
- The context key is `SR_CallbackContext` in the HTML of `/DBTU/HoldTurnering/Stilling/`. Fetch that page first and keep its cookies.
- The URL hash has the same order: `#subPage,season,pool,ageGroup,region,team,match,club,player`.
- `subPage` values:
  - 1: region overview listing all pools
  - 2: pool standings
  - 3: a team's matches
  - 4: pool match list
  - 5: match details with games
  - 6: club
  - 7: pool player stats with ratings
  - 8: one player's games in a pool
- Ids:
  - Seasons: `4YYYY`, e.g. 42026 = 2026/2027, back to 42011.
  - Regions: 4000 DT (national), 4001 Bornholm, 4002 MIDT, 4003 VEST, 4004 ØST, 4005 to 4010 DGI.
  - Age groups: e.g. 4006 Senior, 4004 Junior, 4008 to 4014 Veteran.
- Team match format in senior series: 1 doubles plus 9 singles (A1/B1 ...). Results are games won ("3-7"). Points are 2 for a win and 1 for a draw.
- Player ids come from links `.../DBTU/Spiller/VisSpiller/#<id>`.
- Privacy: the pages also show player numbers like `ddmmyy-XXXX`, which encode birth dates, and team contact names, emails and phone numbers. Never store either. `scraper/parse.test.ts` checks this.

## Data pipeline

- `scraper/config.json` lists what to import: single `pools`, and/or `regions` for every pool of a region and age group.
- `npm run import` writes `public/data/index.json` and `public/data/pools/<poolId>.json`.
  - Played-match details are cached: they are fetched again only when the result changes.
  - Files are rewritten only when their content changes.
  - Requests are spaced 800 ms apart.
  - Locally behind the cloud proxy, run it with `NODE_USE_ENV_PROXY=1`.
- `.github/workflows/data.yml` runs the import at 05:23 and 12:23 UTC. When data changed it commits, then triggers `site.yml` to redeploy, because pushes made with the workflow token don't trigger workflows by themselves.
- Node runs the scraper's TypeScript directly through type stripping. Keep its syntax erasable: no enums and no parameter properties. `scraper/tsconfig.json` enforces this.
