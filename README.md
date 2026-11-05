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
- **Find any club, team or player.** The start page searches every pool of the season: all regions (DT, ØST, VEST,
  MIDT, Bornholm and the DGI regions) and all age groups.
  - Filter by region and age group.
  - Results are grouped by club. Without a search, a short club list.
  - Type a player's name to see their club, team and pool.
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
  - Every result keeps the prediction made before the match (expected score and chance to win), with a record of how
    often the likeliest outcome happened.
  - Every player who played for the team: rating, rating forecast, matches, singles with win rate, doubles and sets.
- **Match preview** (for upcoming matches).
  - Chances from either team's side.
  - A lineup picker for both teams that updates the chances immediately.
  - Every one of your players against their regular lineup.
  - Results against common opponents.
- **Match page.** All games of a played team match, with players and sets.
  - The prediction made before the match, next to how it ended.
  - Until the official rating list includes the match, each player's estimated rating points.
- **Player page.**
  - Rating and singles, doubles and sets records.
  - **Rating forecast:** the rating once the singles played since the official list are rated, game by game.
  - Insights: wins compared with the ratings, fifth sets, best win, upset losses and doubles partners.
  - Singles results placed by opponent rating.
  - The full game list.
- **Pool page.** Standings with projected final points, results (with the prediction record), next matches and a player
  table.
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

Results are refreshed by a GitHub Action every morning, at midday and every hour on match evenings.

## Documentation

| Document | What it covers |
| --- | --- |
| [docs/predictions.md](docs/predictions.md) | How the match chances are estimated, and how good the predictions have been. |
| [docs/rating-forecast.md](docs/rating-forecast.md) | The rating forecast and the official points table. |
| [docs/data-pipeline.md](docs/data-pipeline.md) | How the data gets from bordtennisportalen.dk to the site, and what is in each file. |
| [docs/portal-api.md](docs/portal-api.md) | The portal's web service: the calls, their parameters and answers. |
| [docs/development.md](docs/development.md) | Setting up, commands, how the code is organised, conventions and deployment. |

## What's next

1. **Use the earlier seasons.** Predict a team's first matches from last season's lineups, and calibrate the model on
   ten seasons of games.
2. **Rating history.** Show each player's rating over time, from the rating lists already stored.
3. **Danish interface.** Optional.
4. **Shared availability (optional).** Let each player answer in the app instead of through the captain. This needs a
   small shared backend, so it is a later decision.

## Data and privacy

- **Lineup plans.** They stay in your browser unless you share a link or a backup file yourself.
- **Match data.** It comes from the public pages of bordtennisportalen.dk.
  - It stores names, internal ids, ratings, clubs and results.
  - It never stores player numbers (they contain birth dates) or team contact details.

## Copyright

© 2026 fbbrbn. All rights reserved. The code and design of this project may not be copied, reused or published elsewhere
without permission. The match data comes from bordtennisportalen.dk and is not covered by this notice.
