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
2. **Common opponents.** It compares how both teams did against the same teams, and against each other if they already
   met. Fewer comparisons pull the estimate towards even.

The match page shows each reason: the ratings alone, then form and the home table (with the players who are well above
or below their rating), then the common opponents.

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

Matches that were a team's first of the season have no prediction, because nothing was known about its lineup yet.
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

### Tried, and not in the model

- Head-to-head records: a small gain once form is counted. Worth showing; not worth a place in the odds.
- The change in a player's rating over 8 weeks or a year: no gain once form is counted.
- Weighting a team's recent lineups more: no consistent gain.
- One global scale, fixed scales, and ratings replayed with the games after each list's cutoff: no better, or
  overconfident.
- Knowing the lineups: with the players who actually played, 73–74% right and Brier 0.357. That is three times the gain
  of all the edges together, and it is what the planner's answers give the match preview, but the stored predictions
  cannot know it.
- First matches of a season, from last season's lineups of the team with the same name in the same age group: they
  cover two thirds of them, at 58–63% right and Brier 0.51–0.54 against 0.60 for guessing (pulled 40% towards even).
  A possible next step.

### Checking a change

```bash
npm run data:pull
git fetch --depth 1 origin history && mkdir -p history && git archive FETCH_HEAD | tar -x -C history
npm run backtest
```

prints the record of every stored season (`scraper/backtest.ts`), predicted the same honest way.

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
