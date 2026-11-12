# Team Hub for Danish table tennis teams

An unofficial companion for teams in the DBTU team tournament (Holdturnering). It shows statistics for every club, team
and player, built from the public results on [bordtennisportalen.dk](https://bordtennisportalen.dk), and it helps a
captain decide who plays each match.

It is built for any team. Vallensbæk BTK 3 is the first test team.

> Not affiliated with DBTU or bordtennisportalen.dk.

## What works today

**Live site:** https://fbbrbn.github.io/BordtennisTeamHub/

- **In Danish, with English as an option.** The site opens in Danish; the switch at the bottom of every page changes
  it to English, and the choice is remembered on the device.
- **Install it on your phone.** "Add to Home screen" gives it its own app icon, in light and dark mode.
- **Made for a phone.** Pages say a thing once and keep it short. A list row is one thing to tap, long lists start
  with the first few rows, and the explanations wait behind "Why these chances?" and "How is this worked out?".
- **Follow your team.** Tap ☆ Follow on a team page. Followed teams come first on the start page, with their next
  match, your chance to win and a button to plan the lineup.
- **Navigation.**
  - Three places, one tap away: Home, My team and Lineup. On phones they are in a bar at the bottom.
  - Inner pages have a Back button.
- **Find any club, team or player.** The start page searches every pool of the season: all unions (Bordtennis
  Danmark/DT, ØST, VEST, MIDT and Bornholm) and all age groups.
  - Results are grouped by club. Without a search, a short club list.
  - Type a player's name to see their team and pool.
- **Advanced search**, by the portal's three levels: union, age group and league ("række", such as Serie 4 or Herre
  2. Division), plus words.
  - Three tabs: the pools (with their players' average rating, to compare levels), the teams (with their place) and
    the players (by rating, so the strongest of a league come first).
  - Open it from the start page (it takes what you typed along) or from "All pools in Serie 4" on a pool page. The
    address keeps the search, so Back and a shared link return to it.
- **Team pages have three tabs:**
  - **Overview:** key numbers, the next match and insights.
  - **Matches:** the next matches with chances, then results.
  - **Players:** the player table.
- **Club page.** All of a club's teams across pools, with their place in the table.
- **Team page.**
  - Position, points, record and games won.
  - **Next match:** the chance to win, draw or lose. "Why these chances?" shows the steps: the ratings alone, with
    form and the home table, the common opponents, and all together.
  - **Insights** in plain sentences:
    - the gap to the teams around you;
    - results compared with what the ratings predicted;
    - fifth-set and doubles records, and the standout player;
    - the projected finish;
    - what the strongest lineup would change.
  - A points race against the rest of the pool, with a table view.
  - The next five matches with the chance to win (the rest behind a button), and all results. Tapping a row opens
    the match.
  - Every result keeps the score predicted before the match, with a record of how often the likeliest outcome
    happened. A team's first match in a pool borrows its lineups from an earlier pool or last season.
  - Every player who played for the team: rating, rating forecast, matches, singles with win rate, doubles and sets.
- **Match preview** (for upcoming matches).
  - Chances from either team's side.
  - A lineup picker for both teams that updates the chances immediately.
  - Every one of your players against their regular lineup, with how each pair has done against each other in
    singles, this season and before. Tapping a chance opens those two players' page (see Player vs player).
  - Why, step by step: the ratings alone, players' form against their rating and the home table, and results against
    common opponents.
- **Player vs player.** The chance that one player beats another in a single, and why, step by step: the two ratings,
  form this season and last, youth and unrated players, and the home table when their teams meet. Each step shows its
  rating points and the chance once it is counted; below, their singles against each other.
  - Open it from a chance in a match preview's matchup table, with "Compare with another player" on a player page,
    or with "Compare two players" on the start page.
  - Pick the opponent from the next opposing team, the rest of the pool, or a search across every player of the
    season. Players from two pools are compared on a curve fitted on both pools' singles.
- **Match page.** A scoreboard, then all games of a played team match, with players and sets.
  - The prediction made before the match, next to how it ended.
  - Until the official rating list includes the match, each player's estimated rating points.
- **Player page**, with two tabs:
  - **History:** every season the player played, this one included: totals, clubs, the rating over the seasons
    (with today's rating and the forecast) and every team, each linking to that season's pages.
  - **This season:** the rest of this list.
  - Rating and singles, doubles and sets records.
  - **Rating forecast:** the rating once the singles played since the official list are rated, game by game.
  - Insights: wins compared with the ratings, fifth sets, best win, upset losses and doubles partners.
  - Singles results placed by opponent rating.
  - The full game list.
- **Pool page.** Standings (with the projected final standings behind a fold), results (with the prediction record),
  next matches and a player table. Each list starts with its first rows.
- **Past seasons**, back to 2011/2012 as the import works back in time: their pools, teams, matches and players open in
  the same pages, marked as a past season.
- **Lineup planner.**
  - Opening it from a team page fills in the roster, the fixtures, who played and the number of players per match
    from the results, and keeps them up to date.
  - For each match, mark every player *Can*, *Maybe* or *Can't*. Nobody is planned on guesses: only players
    marked *Can* or *Maybe* are picked, and *Can* goes first. Until then the match shows who still has to answer.
  - The next match is open; the others are one row each, with the lineup so far, and open when tapped.
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
| [docs/roadmap.md](docs/roadmap.md) | The next steps: domain, a review of the Danish texts, shared login, donations and taxes. |

## What's next

The plan, with the steps and decisions for each, is in [docs/roadmap.md](docs/roadmap.md):

1. **Own domain** on Cloudflare.
2. **Danish:** done. Danish is the site's first language; a Danish-speaking club member can still review the texts
   (`src/i18n/da.tsx`).
3. **A legal home** for the project: you personally, or a small association.
4. **Shared login** for teams and clubs, so every player answers in the app.
5. **Donations**, within the Danish rules for fundraising and tax.

Also planned in the code: calibrating the predictions on all the past seasons.

## Data and privacy

- **Lineup plans.** They stay in your browser unless you share a link or a backup file yourself.
- **Match data.** It comes from the public pages of bordtennisportalen.dk.
  - It stores names, internal ids, ratings, clubs and results.
  - It never stores player numbers (they contain birth dates) or team contact details.

## Copyright

© 2026 fbbrbn. All rights reserved. The code and design of this project may not be copied, reused or published elsewhere
without permission. The match data comes from bordtennisportalen.dk and is not covered by this notice.
