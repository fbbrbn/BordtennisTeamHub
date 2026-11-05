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
  - `forecast.ts`: match odds.
    - Logistic rating model with a scale calibrated per pool by `fitScale`.
    - Exact distribution of games won, and common-opponent margins.
    - Averaging over the lineups each team has fielded (`ratingSummary`).
    - `projectTable` for projected final points.
  - `insights.ts`: plain-language team and player insights built on the above.
  - `ratings.ts`: the official rating-points table and `forecastRatings`, which replays the games the official list
    does not include yet. The importer runs it over all pools at once, because players appear in several.
  - `prematch.ts`: the prediction made before each match. `poolBefore(pool, day, timeline)` hides results from that day
    on and rates players as on the rating list in force then; the format is shared from the whole season
    (`shareFormat`). The importer stores the result as `match.prediction` (home side); `predictionRecord` scores them.
  - `forecast.ts` averages match odds over a team's form on the day (`FORM_SPREAD`, 100 rating points, three-point
    Gauss-Hermite). It helped the honest backtest; fresher replayed ratings and other scales did not.
  - Unrated players get the pool median inside the model, but the UI must show them as "unrated".
- `src/pages/MatchPreview.tsx`: the upcoming-match page.
  - Chances from either side, a lineup picker and a matchup heat table.
  - It starts from the planner lineup when the captain has answers (`src/lineup/planned.ts`).
- `src/pages/`: the start page, plus club, team, player, pool and match dashboards.
  - The start page shows followed teams first (`src/lib/follow.ts`, localStorage), then a search across every club,
    team and player with region and age-group filters. Player names come from `data/players.json`, loaded on the first
    keystroke (`matchPlayers`). Without a query it shows a short club list.
  - Team pages have tabs via `?tab=overview|matches|players`; the router scrolls to the top only when the path changes.
  - `src/components/Nav.tsx`: Home · My team · Lineup, a bottom bar on phones and top links on desktop. "My team" is
    the first followed team, otherwise the last team opened.
  - Keep pages short on phones: put explanations behind `<details>`, and show the most useful items first.
  - Routes look like `#/team/<poolId>/<teamId>` and `#/club/<slug>`.
  - `src/data/clubs.ts` maps team names to clubs and makes club slugs.
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
- Official ratings (`scraper/ratinglist.ts`), through other methods of the same service. Each page has its own
  `SR_CallbackContext`:
  - `/DBTU/Ranglister/` has `DefaultRankingListID` (59). `GetRankingListVersions` with `rankinglistagegroupid: ''`,
    `rankinglistid` and `seasonid` lists the list's versions as `MM/DD/YYYY`, about every two weeks.
  - `GetPlayerRankingListPoints`, in the context of `/DBTU/Spiller/VisSpiller/`, takes `seasonid`, `playerid`,
    `rankinglistid`, `rankinglistplayerid` and `getplayerdata: false`. The ids come from the rating links in subPage 7:
    `VisSpiller/#<player>,<list>,<listPlayer>,<season>`.
  - Read only its `Html`: the response also has the player number. The table lists the season's start rating, then
    every rated game (date carried down, team games as "Serie 4 #<matchId>", own and opponent rating, points).
  - Rules, checked against every game on those pages: a fixed points table by rating gap; all games of a match day
    use the ratings from before that day; doubles and walkovers are not rated; it is not zero-sum.
  - Each version only includes games up to an unpublished cutoff: the list of 23 Oct 2026 included games up to 19 Oct,
    but not 20 Oct. Replaying from one version reproduces the next best with the cutoff 4 days before each version
    (88% exact from 9 to 23 Oct 2026).
  - `GetRankingListPlayers` (context `/DBTU/Ranglister/`) gives a whole version, 100 players per `pageindex` (from 0),
    with `rankinglistversiondate: 'MM/DD/YYYY'`, `sortfield: 0` and `searchall: true` (all players, about 4,600 in 2026
    and 96% of rated players; `false` gives only recently active ones). Every other parameter is `''` or `false`.
  - Its rows: `td.rank`, the previous rank, `td.playerid` (the player number: never read it), `td.name` with the
    `VisSpiller/#<player>,<list>,<listPlayer>,<season>` link and the club, then `td.points` cells: rating, change,
    matches. `parseRatingListPage` reads only the link and the first points cell.
  - Versions go back to 2011/12: weekly in 2015/16, every two weeks lately, and only two (June 2012) for 2011/12.
- Past seasons: every pool, match and game back to 2011/12 is on the portal, but the pools' player stats show no
  ratings for past seasons; ratings at the time come from the rating-list versions.

## Data pipeline

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
  - `data.yml` (05:23, 12:23 and hourly 16:23 to 22:23 UTC) restores it, imports, force-pushes a single new commit when anything changed, and
    then triggers `site.yml`. Pushes made with the workflow token don't trigger workflows by themselves.
  - `site.yml` copies the branch into `public/data` before building.
  - Locally, run `npm run data:pull`.
- `scraper/pool.ts` reads one pool (shared by `import.ts` and `history.ts`). `import.ts` also writes:
  - `data/players.json`: every player with their teams, for the player search.
  - `data/ratings/<season>.json`: every rating-list version in force on a match day of the season (`seasonTimeline`).
  - `match.prediction` in every pool of the season, and the season's record as `index.predictions`.
- Past seasons: `scraper/history.ts` and `.github/workflows/history.yml` (nightly at 00:41 UTC, four hours, requests one
  second apart) write `history/<season>/` on the `history` branch, newest season first:
  - `targets.json` (the season's pools, discovered once), `pools/<pool>.json` (same format as the current season),
    `ratings.json` (up to 12 versions spread over the match days, `chooseVersions`) and `index.json` (`complete`).
  - The branch gets one ordinary commit per night; it is not copied into the site.
- Rating forecasts:
  - Each run reads the latest list version (2 requests). A new version means each pool's subPage 7 is read again,
    then `findRatedThrough` binary-searches the cutoff over the season's match days using a few players' rating pages.
  - Pools are written at the end, after `forecastRatings`: `pool.ratings` says which list and cutoff, and
    `player.forecast` has the estimated rating and the pending games. The index has `ratings` once.
  - When the cutoff cannot be found there are no forecasts; the next run tries again.
- Formats differ between pools. `matchFormat(pool)` in `forecast.ts` reads each pool's format from its played matches;
  never assume 3 players or 10 games. In 2026/27:
  - 3 v 3 with 9 singles and 1 doubles: 89 pools.
  - 2 v 2 with 4 singles and 1 doubles: 23.
  - 4 v 4 with 12 singles and 2 doubles (Jyllandsserie): 15.
  - National divisions: first to 8, with a golden set.
  - Dame BordtennisLigaen: first to 6.
  - Some leagues settle a level score with a deciding game.
- How `matchFormat` reads them:
  - The games in playing order come from labels like "A2/B1" or "A2-B1" (home position, away position; position 1 is
    the strongest). Doubles and golden sets are team games.
  - `raceTo`: one winning score in at least 80% of matches while totals vary.
  - `decider`: some matches have exactly one game more than the format.
- `ratingForecast` maps lineups to positions by rating and needs to know whether our team is home. A missing player
  loses their games by walkover. `oddsForFormat` applies first-to-N and deciding games.
- Model check, honest: each of the 946 matches played by 5 Nov 2026 that has a prediction was predicted only from what
  was known before its day (`src/data/prematch.ts`):
  - The most likely outcome was right 69% of the time; Brier 0.431, where guessing scores 0.67; log loss 0.744.
  - The expected score was off by 16% of the games.
  - About a third of played matches have no prediction: they were a team's first of the season.
  - Tried and rejected: one global scale (no better), fixed scales, and ratings replayed with the games after each
    list's cutoff. Replayed ratings fitted the pool scale on post-game ratings and made the odds overconfident.
  - An older in-sample check with the actual lineups gave Brier 0.35 and 75%: that is not what the site can know in
    advance.
- Node runs the scraper's TypeScript directly through type stripping. Keep its syntax erasable: no enums and no parameter properties. `scraper/tsconfig.json` enforces this.
