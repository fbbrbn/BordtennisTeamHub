# Team Hub for Danish table tennis teams

An unofficial companion for teams in the DBTU team tournament (Holdturnering). It shows statistics for every club, team
and player, built from the public results on [bordtennisportalen.dk](https://bordtennisportalen.dk), and it helps a
captain decide who plays each match.

It is built for any team. Vallensbæk BTK 3 is the first test team.

> Not affiliated with DBTU or bordtennisportalen.dk.

## What works today

**Live site:** https://fbbrbn.github.io/BordtennisTeamHub/

- **Follow your team.** Tap ☆ Follow on a team page. Followed teams come first on the start page, with their next
  match, your chance to win and a button to plan the lineup.
- **Navigation.**
  - Three places, one tap away: Home, My team and Lineup. On phones they are in a bar at the bottom.
  - Inner pages have a Back button.
- **Find any club or team.** The start page searches every pool of the season: all regions (DT, ØST, VEST, MIDT,
  Bornholm and the DGI regions) and all age groups.
  - Filter by region and age group.
  - Results are grouped by club. Without a search, a short club list.
- **Team pages have three tabs:**
  - **Overview:** key numbers, the next match and insights.
  - **Matches:** upcoming matches with chances, then results.
  - **Players:** the player table.
- **Club page.** All of a club's teams across pools, with their place in the table.
- **Team page.**
  - Position, points, record and games won.
  - **Next match:** the chance to win, draw or lose, with the two reasons behind it.
  - **Insights** in plain sentences:
    - the gap to the teams around you;
    - results compared with what the ratings predicted;
    - fifth-set and doubles records, and the standout player;
    - the projected finish;
    - what the strongest lineup would change.
  - A points race against the rest of the pool, with a table view.
  - All results, plus every upcoming match with its chance to win.
  - Every player who played for the team: rating, matches, singles with win rate, doubles and sets.
- **Match preview** (for upcoming matches).
  - Chances from either team's side.
  - A lineup picker for both teams that updates the chances immediately.
  - Every one of your players against their regular lineup.
  - Results against common opponents.
- **Match page.** All games of a played team match, with players and sets.
- **Player page.**
  - Rating and singles, doubles and sets records.
  - Insights: wins compared with the ratings, fifth sets, best win, upset losses and doubles partners.
  - Singles results placed by opponent rating.
  - The full game list.
- **Pool page.** Standings with projected final points, results, next matches and a player table.
- **Lineup planner.**
  - Opening it from a team page fills in the roster, the fixtures, who played and the number of players per match
    from the results, and keeps them up to date.
  - For each match, mark every player *I can*, *Maybe* or *I can't*. Nobody is planned on guesses: only players
    who answered *I can* or *Maybe* are picked, and *I can* goes first. Until then the match shows who still has to
    answer.
  - Among the players who can play, whoever has played the fewest matches so far goes first. Matches already played
    count, and so do upcoming matches a player is already picked for. Rests rotate.
  - Captain overrides: *Must play* or *Rest*.
  - Share the plan as a link or as a short message for the team chat. Download a backup and restore it.
  - Plans are stored in the browser of whoever made them. There are no accounts and no server.

Results are refreshed by a GitHub Action every morning, at midday and every hour on match evenings (see [Data](#data)).

### How the chances are estimated

Two independent estimates are averaged:

1. **Player ratings.** Every game of a team match gets a win chance from the rating gap. In most senior series that is
   9 singles and 1 doubles; other formats work the same way. The curve is calibrated on the pool's own singles results:
   in the first pool, the higher-rated player won 78% of singles. The exact distribution of games won then gives the
   chances of a win, a draw and a loss.
   - Without a chosen or planned lineup, it averages over every lineup each team has fielded this season.
2. **Common opponents.** It compares how both teams did against the same teams, and against each other if they already
   met. Fewer comparisons pull the estimate towards even.

Each pool's real match format is read from its results:
- the number of players per side;
- which positions meet in the singles;
- the number of doubles;
- whether matches stop at "first to N" (the national divisions);
- whether a level score is settled by a deciding game.

Checked against all 1,307 played matches of the season so far, using the actual lineups:

- The probability score was 0.35, where pure guessing scores 0.67.
- The most likely outcome was right 75% of the time.
- The expected score was off by 13% of the games on average.

These checks are in-sample, so real accuracy is a bit lower. The site always labels the chances as estimates.

## What's next

1. **Rating history.** Use the portal's ranking-list service to show each player's rating over time.
2. **Earlier seasons.** The portal goes back to 2011/2012.
3. **Danish interface.** Optional.
4. **Shared availability (optional).** Let each player answer in the app instead of through the captain. This needs a
   small shared backend, so it is a later decision.

## Development

Requires Node.js 22 or newer.

```bash
npm install
npm run data:pull
npm run dev
```

`npm run data:pull` copies the current match data from the `data` branch into `public/data/` (ignored by git).

Other commands:

- `npm test`: run the unit tests
- `npm run typecheck`: check the TypeScript types
- `npm run build`: build the production site into `dist/`
- `npm run preview`: serve the built site
- `npm run import`: refresh the data from bordtennisportalen.dk (needs network access to it)

The planner's logic is in `src/lineup/planner.ts`; the forecasts are in `src/data/forecast.ts`. Both are pure
functions with unit tests.

## Data

- `scraper/config.json` says what to import. By default that is every pool of the current season, in all regions and
  age groups; single pools or regions can be added.
- `.github/workflows/data.yml` runs the import at 05:23 and 12:23 UTC, and every hour from 16:23 to 22:23 UTC on match
  evenings (17:23 to 23:23 Danish time in winter):
  - The list of pools is rediscovered about once a day.
  - A pool whose match list has not changed costs one request.
  - Match details are fetched only for newly played matches.
  - Requests are spaced 800 ms apart.
  - A run stops starting new pools after 5 hours, and the next run continues from there.
- The data is published to the `data` branch as a single commit, so the repository does not grow with every update.
  The site build (`.github/workflows/site.yml`) copies it into the site.

## Deployment

`.github/workflows/site.yml` runs on every push and pull request: it typechecks, tests and builds the site. Pushes and
manual runs on `main` also publish it to GitHub Pages. The data workflow starts it whenever the data changes.

## Data and privacy

- **Lineup plans.** They stay in your browser unless you share a link or a backup file yourself.
- **Match data.** It comes from the public pages of bordtennisportalen.dk.
  - It stores names, internal ids, ratings, clubs and results.
  - It never stores player numbers (they contain birth dates) or team contact details.
