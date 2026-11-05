# Match predictions

How the site estimates a team match's chances, and how good those estimates have been. The code is in
[`src/data/forecast.ts`](../src/data/forecast.ts) and [`src/data/prematch.ts`](../src/data/prematch.ts).

## How the chances are estimated

Two independent estimates are averaged:

1. **Player ratings.** Every game of a team match gets a win chance from the rating gap. In most senior series that is
   9 singles and 1 doubles; other formats work the same way. The curve is calibrated on the pool's own singles results:
   in the first pool, the higher-rated player won 78% of singles. The exact distribution of games won then gives the
   chances of a win, a draw and a loss.
   - The games of one match are not independent: on a good evening the whole team plays better. The odds are averaged
     over a team's form on the day, which varies by about 100 rating points.
   - Without a chosen or planned lineup, it averages over every lineup each team has fielded this season.
2. **Common opponents.** It compares how both teams did against the same teams, and against each other if they already
   met. Fewer comparisons pull the estimate towards even.

Each pool's real match format is read from its results:
- the number of players per side;
- which positions meet in the singles;
- the number of doubles;
- whether matches stop at "first to N" (the national divisions);
- whether a level score is settled by a deciding game.

## How good the predictions are

Every match keeps the prediction made from what was known before its day: the official rating list in force then, and
the results of earlier matches only. Checked against the 946 matches of 2026/27 played by 5 November that had one:

- The likeliest outcome happened 69% of the time.
- The probability score (Brier) was 0.431, where pure guessing scores 0.67.
- The expected score was off by 16% of the games on average.

Averaging over the day's form improved the probability score from 0.440 and the log loss from 0.778 to 0.744; the share
of right outcomes stayed about the same. Matches that were a team's first of the season have no prediction, because
nothing was known about its lineup yet. Earlier seasons (see [the data pipeline](data-pipeline.md)) should fill that gap. The site always
labels the chances as estimates.

## Details for developers

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

### Model check

- Model check, honest: each of the 946 matches played by 5 Nov 2026 that has a prediction was predicted only from what
  was known before its day (`src/data/prematch.ts`):
  - The most likely outcome was right 69% of the time; Brier 0.431, where guessing scores 0.67; log loss 0.744.
  - The expected score was off by 16% of the games.
  - About a third of played matches have no prediction: they were a team's first of the season.
  - Tried and rejected: one global scale (no better), fixed scales, and ratings replayed with the games after each
    list's cutoff. Replayed ratings fitted the pool scale on post-game ratings and made the odds overconfident.
  - An older in-sample check with the actual lineups gave Brier 0.35 and 75%: that is not what the site can know in
    advance.
