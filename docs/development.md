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
- `npm run backtest`: score the forecast model on every stored season (see [predictions.md](predictions.md))

The main logic is in pure functions with unit tests:

- `src/lineup/planner.ts`: the lineup planner;
- `src/data/forecast.ts`: the match odds;
- `src/data/form.ts`: what the ratings miss (form, youth players, unrated players, the home table);
- `src/data/prematch.ts`: the predictions made before each match, and the season replay;
- `src/data/ratings.ts`: the rating forecast;
- `scraper/`: reading the portal (`parse.ts`), one pool (`pool.ts`), the season (`import.ts`), past seasons
  (`history.ts`) and when the imports run (`clock.ts`).

## Code layout

- Vite + React + TypeScript (strict). The app uses a hash router (`src/lib/router.ts`), so GitHub Pages needs no
  server config.
- `src/i18n/`: the site's two languages, Danish first and English second.
  - `da.tsx` and `en.tsx`: every text the site shows, in Danish and English. `da` is typed as `Texts` (the shape of
    `en`), so a missing Danish entry fails the typecheck; a test checks that lists have the same length.
    Plain strings where nothing varies, functions where numbers, names or links go in. The top of `da.tsx` has the
    house style for Danish: the terms of the sport, commas, capitals after a colon, quotes.
  - `index.ts`: the language is the saved choice (localStorage `lang`), otherwise Danish, whatever the phone's
    language. `t` and `lang` are live bindings; `setLang` switches them, and `main.tsx` renders the app afresh, so
    nothing keeps the old language. `components/LanguageSwitch.tsx` is the switch in the footer (Dansk · English).
    Tests that check English texts call `setLang('en', false)` first.
  - `format.ts`: dates, decimals, percentages, ordinals, lists and plurals in either language ("ons. 4. nov.",
    "5,6", "62 %", "3.", "A, B og C"). `lib/text.ts` and the dates in `components/ui.tsx` use the current language.
- `src/lineup/`: the lineup planner.
  - `planner.ts`: pure season planner (min-cost flow in `mcmf.ts`), unit-tested.
  - `storage.ts`: localStorage, share-link encoding (deflate + base64url) and validation of untrusted input.
  - `state.ts`: reducer. The UI lives in `LineupPage.tsx`, `Matches.tsx`, `BalanceTable.tsx` and `RosterEditor.tsx`.
- `src/data/`: `model.ts` (shared JSON types), `load.ts` (fetch + cache) and `stats.ts` (pure, tested statistics).
  - `loadPool` tries the current season (`data/pools/`), then past seasons (`history/pools/`, marked `pool.past`).
    `loadHistory` merges a player's seasons from `data/careers/` and `history/players/`.
  - `forecast.ts`: match odds.
    - Logistic rating model with a scale calibrated per pool by `fitScale`.
    - Exact distribution of games won, and common-opponent margins.
    - Averaging over the lineups each team has fielded (`ratingSummary`).
    - `projectTable` for projected final points.
  - `insights.ts`: plain-language team and player insights built on the above.
  - `ratings.ts`: the official rating-points table and `forecastRatings`, which replays the games the official list
    does not include yet. The importer runs it over all pools at once, because players appear in several.
  - `form.ts`: edges added to each game's log-odds, read from `player.form` in the pool data: form this season and last,
    youth players, unrated players, and the home table outside veteran pools. `ratingForecast(..., adjust = false)`
    leaves them out, for "ratings alone" and for the insights that compare results with the ratings.
  - `prematch.ts`: the prediction made before each match. `poolBefore(pool, day, timeline, form)` hides results from
    that day on, rates players as on the rating list in force then, and gives them their form from earlier days; the
    format is shared from the whole season (`shareFormat`). `replaySeason` replays all pools of a season day by day;
    the importer stores `match.prediction` (home side) and `player.form`; `predictionRecord` scores them.
  - A team that has not played in its pool yet borrows its lineups in `replaySeason`: from the same team (`teamKey`) in
    an earlier pool this season, or last season (`LineupHints.fallback`, pulled towards even by `BORROWED_SHRINK`).
    The pages show that stored prediction when their own forecast has no odds (`shownOdds` in forecast.ts).
  - `forecast.ts` averages match odds over a team's form on the day (`FORM_SPREAD`, 100 rating points, three-point
    Gauss-Hermite). It helped the honest backtest; fresher replayed ratings and other scales did not.
  - Unrated players get the pool median inside the model, less the unrated edge of `form.ts`, but the UI must show them
    as "unrated".
- `src/pages/MatchPreview.tsx`: the upcoming-match page.
  - Chances from either side, a lineup picker and a matchup heat table.
  - The reasons: ratings alone, form and the home table (`formReason`), common opponents. The team page's next match
    shows the same.
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
- Look: red against blue, the table and the paddle. Colour tokens are at the top of `src/styles.css`, light and dark;
  chart colours are validated with the dataviz skill's script in both modes. Headings and big numbers use Barlow
  Condensed (`@fontsource/barlow-condensed`, bundled, OFL); body text the system font.
- The logo (`src/components/Logo.tsx`, `public/icon.svg`) is a red paddle and a white ball on a navy tile, so it reads
  on light and dark pages. `public/manifest.webmanifest` makes the site installable; the PNG icons, the maskable icon and
  the Apple touch icon are rendered from the SVGs by `node scripts/make-icons.cjs` (needs Playwright).
- `src/components/`: shared UI.
  - `ui.tsx`: stat tiles, badges, dates and page states. `Odds.tsx`: the odds bars.
  - `Prediction.tsx`: the predicted line under results and the prediction record.
  - `RatingForecast.tsx`: the rating forecast card and the points table.
  - `PlayerHistory.tsx`: the player page's History tab (totals, rating over the seasons, every season and team), the
    link to it, and the "Past season" tag. Past teams have no follow or planner buttons and are never "My team".
  - `FollowButton.tsx` and `Nav.tsx`.
- `src/charts/`: hand-written SVG charts. `PointsRace` is a line chart in emphasis form; `RatingStrip` is a strip plot;
  `RatingHistory` is one player's rating over the seasons, with the forecast hollow and dashed. All have hover,
  keyboard and touch tooltips and a table twin.
- `src/lineup/sync.ts`: a planner stored under the key `team-<poolId>-<teamId>` syncs its roster, fixtures and
  `playedBy` from the pool data.
- `.github/workflows/site.yml`: typecheck, test and build on every push and PR; deploy to GitHub Pages from `main`.

## Conventions

- Two languages: Danish first, English second. Every text the site shows goes in both `src/i18n/da.tsx` and
  `src/i18n/en.tsx`; never write a text in a component. Write the Danish first and to the house style at the top of
  `da.tsx` (the usual terms of the sport: holdkamp, pulje, række, single, double, sæt, rating, opstilling, hjemme/ude,
  uafgjort). Names from the portal (teams, clubs, pools, age groups) stay as they are.
- Mobile first: captains and players use phones. Check 390px width in both languages (Danish words are longer); there
  must be no horizontal page scroll.
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
