# Match predictions

How the site estimates a team match's chances, and how good those estimates have been. The code is in
[`src/data/forecast.ts`](../src/data/forecast.ts), [`src/data/form.ts`](../src/data/form.ts) and
[`src/data/prematch.ts`](../src/data/prematch.ts).

## How the chances are estimated

Two independent estimates are combined, the ratings counting three times as much:

1. **Player ratings.** Every game of a team match gets a win chance from the rating gap. In most senior series that is
   9 singles and 1 doubles; other formats work the same way. The curve is calibrated on the pool's own singles results:
   in the first pool, the higher-rated player won 78% of singles. Then come the things the ratings miss, because
   official ratings move slowly (at most about 22 points a game):
   - **Form.** A player who has won more singles than their rating expected, this season in every pool, keeps doing so.
     Three wins more than expected in 15 games is worth about 60 rating points. Last season counts a third as much.
   - **Youth players**, who also play in a youth pool, beat their rating by about 115 points: they improve faster than
     the rating list. Only the pools a player plays in are used, never an age.
   - **Unrated players** are weaker than the pool's median rating they stand in for: about 45 points. Youth players are
     the exception.
   - **The home table** is worth about 22 rating points a game, except in veteran pools, where it makes no difference.

   The exact distribution of games won then gives the chances of a win, a draw and a loss.
   - The games of one match are not independent: on a good evening the whole team plays better. The odds are averaged
     over a team's form on the day, which varies by about 100 rating points.
   - Without a chosen or planned lineup, it averages over every lineup each team has fielded this season.
   - A team that has not played in the pool yet borrows its lineups: from the same team (same name and age group) in
     an earlier pool this season, otherwise from last season. Only about half of a team's players are the same from
     one season to the next, so those chances are pulled towards even: a little for this season's lineups, halfway for
     last season's.
2. **Common opponents.** It compares how both teams did against the same teams, and against each other if they already
   met. Fewer comparisons pull the estimate towards even.

The match page shows the steps behind "Why these chances?", each with the chance to win at that step: the ratings
alone, then with form and the home table (with the players who are well above or below their rating), then the common
opponents, and all together. Its matchup table also shows how each pair of players has done
against each other in singles, this season and before. That record is not part of the chances (see "Tried, and not in
the model").

Each chance in the matchup table opens the "Player vs player" page, which takes one single apart the same way: the
two ratings on the pool's curve, each player's form this season and last, a youth or unrated player, and the home
table, each as rating points with the chance once it is counted. The page also compares any two players on demand;
for players of two pools, the curve is fitted on the singles of both pools and the home table does not count.

Each pool's real match format is read from its results:
- the number of players per side;
- which positions meet in the singles;
- the number of doubles;
- whether matches stop at "first to N" (the national divisions);
- whether a level score is settled by a deciding game.

## How good the predictions are

Every match keeps the prediction made from what was known before its day: the official rating list in force then, the
results of earlier matches, and each player's form until then. Checked against the 1,031 matches of 2026/27 played by
6 November that had one:

| | Before form and the home table | Now |
| --- | --- | --- |
| The likeliest outcome happened | 68.1% | 70.3% |
| Probability score (Brier; guessing scores 0.67) | 0.437 | 0.418 |
| Log loss | 0.750 | 0.721 |
| Expected score off by (share of the games) | 16.2% | 15.4% |

The two complete past seasons improve too: 2025/26 from 69.5% and 0.419 to 70.5% and 0.411, and 2024/25 from 69.2% and
0.416 to 70.2% and 0.409.

### First matches

A team's first match in a pool has no lineups of its own yet, so it borrows them (see above). That gives a prediction
to 94–97% of the played matches of each past season instead of 81–84%, and to 89% of 2026/27's so far instead of
65%. They are rough: the likeliest outcome happens in 54–67% of them, against 69–71% once a team has played in the
pool. Guessing (a third each, or half each when no draw is possible) scores 0.58–0.62 on the same matches.

| Season | Own lineups in the pool | First matches, lineups from earlier this season | First matches, lineups from last season |
| --- | --- | --- | --- |
| 2021/22 | 4,605 matches: 69.2% right, Brier 0.431 | 406: 60.1%, 0.507 | 341: 58.4%, 0.543 |
| 2022/23 | 4,558: 69.7%, 0.416 | 284: 64.4%, 0.475 | 372: 54.0%, 0.555 |
| 2023/24 | 5,108: 70.8%, 0.407 | 256: 66.8%, 0.480 | 381: 55.6%, 0.537 |
| 2024/25 | 5,220: 70.3%, 0.409 | 346: 60.1%, 0.519 | 464: 58.2%, 0.539 |
| 2025/26 | 5,441: 70.5%, 0.411 | 328: 60.1%, 0.495 | 459: 59.0%, 0.529 |
| 2026/27, to 8 November | 1,057: 70.8%, 0.414 | 11 | 371: 61.5%, 0.500 |

So the season's record on the site, which counts every prediction, reads about two points lower than the matches with
their own lineups alone (2026/27: 68.6% right and Brier 0.43), while covering far more matches. Matches still without a
prediction had a team with no lineups to borrow: a new team, or a renamed one.

The site always labels the chances as estimates.

## Details for developers

### What the ratings miss (`form.ts`)

Each edge is added to a game's log-odds in `gameChance` (forecast.ts). As rating points, an edge is
`log-odds × scale / (0.84 × ln 10)`: at the usual scale of 300, one unit of log-odds is about 155 points.

| Edge | Log-odds | About |
| --- | --- | --- |
| Calibration | 84% of the rating gap (`CALIBRATION`) | |
| Form this season | 3.75 × wins above expectation / (games + 15) | 3 more wins in 15 games: +58 points |
| Form last season | 1.25 × the same | a third as much |
| Youth player | +0.75 | +115 points |
| Unrated, not a youth player | −0.3 | −47 points |
| Home table, not in veteran pools | +0.14 for the home side | +22 points a game |

- How they were found: logistic fits on every singles game of 2024/25 and 2025/26, each with the ratings and pool scale
  of its own day and only earlier results, tested on 2026/27. The fitted values barely moved between seasons.
- "Wins above expectation": a player's singles in every pool of the season, against the plain rating curve
  (`winChance`) with the ratings and pool scale of each game's day. A day's results count from the next day.
  `replaySeason` (prematch.ts) replays the season day by day with all its pools, for the stored predictions and for
  each player's `form` in the pool files.
- Last season's tallies are in `form/<season>.json` on the history branch (`scraper/seasonform.ts`).
- Calibration: a pool's scale is fitted on its earlier games with today's ratings, which already include those games,
  so the plain chances were too confident by about 16%.
- Home table: home players won 52.5% of singles that the ratings put at 50.4%, the same in every season, in singles and
  doubles. In veteran pools the difference was nil.
- Unrated players won about 43% of the singles where the model expected 48%; unrated youth players did better than that.

### First matches (`prematch.ts`)

- `ratingSummary` (forecast.ts) asks `LineupHints.fallback` for a side with no lineups in the pool: no fielded lineup
  and no players. Only `replaySeason` passes one:
  - the same team (`teamKey`: age group and name, ignoring case and spacing) in pools of this season, from matches on
    earlier days, each lineup weighted by how often it was fielded;
  - otherwise last season's lineups, from `teams` in `form/<season>.json` (version 2, `scraper/seasonform.ts`).
  - Borrowed players join the pool as it was before the day, with the rating of that day's list and their form.
- The odds are then pulled towards even by `BORROWED_SHRINK` (forecast.ts): 0.2 with this season's lineups, 0.5 with
  last season's. The win and the loss move towards each other and the draw stays (`towardsEven`); the larger share
  wins when both sides borrow.
- Why: of the players in a team's first match, 53–61% had played for the team last season, and 36–45% were in its
  most-used lineup. The shares were tuned on 2021/22 to 2024/25 (best: 0.2, and 0.5–0.6 for last season) and checked
  on 2025/26 and 2026/27 (0.5 best). To tune them again: `npm run backtest -- --season-shrink 0.2 --last-shrink 0.5`.
- The stored prediction says where the lineups came from: `lineups: 'season' | 'last-season'`.
- The site's own forecasts cannot borrow, because the browser loads only one pool. Where they have no odds for a
  match to come, the pages show the stored prediction instead (`shownOdds`): the team page, the match preview, the
  start page, the projected table and the insights.

### Tried, and not in the model

- Head-to-head records: a small gain once form is counted. Worth showing, so the match preview shows them
  (`src/data/headtohead.ts`); not worth a place in the odds.
- The change in a player's rating over 8 weeks or a year: no gain once form is counted.
- Weighting a team's recent lineups more: no consistent gain.
- One global scale, fixed scales, and ratings replayed with the games after each list's cutoff: no better, or
  overconfident.
- Knowing the lineups: with the players who actually played, 73–74% right and Brier 0.357. That is three times the gain
  of all the edges together, and it is what the planner's answers give the match preview, but the stored predictions
  cannot know it.
- For first matches, a wider spread of form on the day instead of pulling the odds towards even: up to 0.02 worse
  Brier with last season's lineups, in every season and at every spread tried (up to 1,200 points). Pulling towards a
  third each instead of keeping the draw: up to 0.015 worse.

### Checking a change

```bash
npm run data:pull
git fetch --depth 1 origin history && mkdir -p history && git archive FETCH_HEAD | tar -x -C history
npm run backtest
```

prints the record of every stored season (`scraper/backtest.ts`), predicted the same honest way: all predictions, then
the matches with their own lineups and the first matches by where their lineups came from.

### Match formats

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
