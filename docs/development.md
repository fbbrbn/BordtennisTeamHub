# Development

## Getting started

Requires Node.js 22 or newer.

```bash
npm install
npm run data:pull
npm run dev
```

`npm run data:pull` copies the current match data from the `data` branch into `public/data/`, and
`npm run history:pull` the past seasons into `public/history/` (both ignored by git).

Other commands:

- `npm test`: run the unit tests
- `npm run typecheck`: check the TypeScript types
- `npm run build`: build the production site into `dist/`
- `npm run preview`: serve the built site
- `npm run import`: refresh the data from bordtennisportalen.dk (needs network access to it)

The main logic is in pure functions with unit tests:

- `src/lineup/planner.ts`: the lineup planner;
- `src/data/forecast.ts`: the match odds;
- `src/data/prematch.ts`: the predictions made before each match;
- `src/data/ratings.ts`: the rating forecast;
- `scraper/`: reading the portal (`parse.ts`), one pool (`pool.ts`), the season (`import.ts`) and past seasons
  (`history.ts`).

## Code layout

- Vite + React + TypeScript (strict). The app uses a hash router (`src/lib/router.ts`), so GitHub Pages needs no
  server config.
- `src/lineup/`: the lineup planner.
  - `planner.ts`: pure season planner (min-cost flow in `mcmf.ts`), unit-tested.
  - `storage.ts`: localStorage, share-link encoding (deflate + base64url) and validation of untrusted input.
  - `state.ts`: reducer. The UI lives in `LineupPage.tsx`, `Matches.tsx`, `BalanceTable.tsx` and `RosterEditor.tsx`.
- `src/data/`: `model.ts` (shared JSON types), `load.ts` (fetch + cache) and `stats.ts` (pure, tested statistics).
  - `loadPool` tries the current season (`data/pools/`), then past seasons (`history/pools/`, marked `pool.past`).
    `loadCareer` reads a player's past seasons.
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
- `src/components/`: shared UI.
  - `ui.tsx`: stat tiles, badges, dates and page states. `Odds.tsx`: the odds bars.
  - `Prediction.tsx`: the predicted line under results and the prediction record.
  - `RatingForecast.tsx`: the rating forecast card and the points table.
  - `PastSeasons.tsx`: the player's past seasons, and the "Past season" tag. Past teams have no follow or planner
    buttons and are never remembered as "My team".
  - `FollowButton.tsx` and `Nav.tsx`.
- `src/charts/`: hand-written SVG charts. `PointsRace` is a line chart in emphasis form; `RatingStrip` is a strip plot.
  Both have hover, keyboard and touch tooltips and a table twin.
- `src/lineup/sync.ts`: a planner stored under the key `team-<poolId>-<teamId>` syncs its roster, fixtures and
  `playedBy` from the pool data.
- `.github/workflows/site.yml`: typecheck, test and build on every push and PR; deploy to GitHub Pages from `main`.

## Conventions

- English UI. Danish table tennis terms are fine where users expect them (Holdturnering, pulje, række).
- Mobile first: captains and players use phones. Check 390px width; there must be no horizontal page scroll.
- Charts follow the dataviz skill's rules:
  - Validate colors with its script.
  - Thin marks and a legend.
  - Text in text colors, never in series colors.
  - Separate light and dark values.
- Never ship invented match data. Test fixtures stay in tests.
- Node runs the scraper's TypeScript directly through type stripping. Keep its syntax erasable: no enums and no parameter properties. `scraper/tsconfig.json` enforces this.

## Deployment

`.github/workflows/site.yml` runs on every push and pull request: it typechecks, tests and builds the site. Pushes and
manual runs on `main` also publish it to GitHub Pages. The data workflow starts it whenever the data changes.
