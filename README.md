# Team Hub for Danish table tennis teams

An unofficial companion for teams in the DBTU team tournament (Holdturnering). It shows team and player statistics
built from the public results on [bordtennisportalen.dk](https://bordtennisportalen.dk), and it helps a captain decide
who plays each match.

It is built for any team. Vallensbæk BTK 3 is the first test team.

> Not affiliated with DBTU or bordtennisportalen.dk.

## What works today

**Live site:** https://fbbrbn.github.io/BordtennisPortalen/

- **Find your team** on the start page. For now only the pools listed in `scraper/config.json` are imported; the first
  is ØST Senior 2026/2027, Serie 4 Pulje 4.
- **Team page.**
  - Position, points, record and games won.
  - A points race against the rest of the pool, with a table view.
  - All results and upcoming matches with venues.
  - Every player who played for the team: rating, matches, singles with win rate, doubles and sets.
- **Player page.**
  - Rating and singles, doubles and sets records.
  - Singles results placed by opponent rating.
  - The full game list.
- **Pool page.** Standings, results, next matches and a player table.
- **Match page.** All games of a team match with players and sets.
- **Lineup planner.** It works for typical cases like 5 players with 3 per match.
  - Opening it from a team page fills in the roster, the fixtures and who played from the results, and keeps them up
    to date.
  - For each match, mark every player *I can*, *Maybe* or *I can't*. Nobody is planned on guesses: only players
    who answered *I can* or *Maybe* are picked, and *I can* goes first. Until then the match shows who still has to
    answer.
  - Among the players who can play, whoever has played the fewest matches so far goes first. Matches already played
    count, and so do upcoming matches a player is already picked for. Rests rotate.
  - Captain overrides: *Must play* or *Rest*.
  - Share the plan as a link or as a short message for the team chat. Download a backup and restore it.
  - Plans are stored in the browser of whoever made them. There are no accounts and no server.

Results are refreshed twice a day by a GitHub Action (`.github/workflows/data.yml`).

## What's next

1. **More pools.** Add whole regions to `scraper/config.json`, e.g. all of ØST Senior, then other regions and age
   groups.
2. **Rating history.** Use the portal's ranking-list service to show each player's rating over time.
3. **Danish interface.** Optional.
4. **Shared availability (optional).** Let each player answer in the app instead of through the captain. This needs a
   small shared backend, so it is a later decision.

## Development

Requires Node.js 22 or newer.

```bash
npm install
npm run dev
```

Other commands:

- `npm test`: run the unit tests
- `npm run typecheck`: check the TypeScript types
- `npm run build`: build the production site into `dist/`
- `npm run preview`: serve the built site

The planner's logic is in `src/lineup/planner.ts`. It is a pure function with unit tests in
`src/lineup/planner.test.ts`.

## Deployment

- `.github/workflows/site.yml` runs on every push and pull request: it typechecks, tests and builds the site. Pushes
  and manual runs on `main` also publish it to GitHub Pages.
- `.github/workflows/data.yml` imports fresh results twice a day. When something changed, it commits the data and
  redeploys the site.

To import by hand, run `npm run import`. It needs network access to bordtennisportalen.dk.

## Data and privacy

- **Lineup plans.** They stay in your browser unless you share a link or a backup file yourself.
- **Match data.** It comes from the public pages of bordtennisportalen.dk. The import runs twice a day, spaces its
  requests out, and only re-downloads matches whose result changed.
  - It stores names, internal ids, ratings and results.
  - It never stores player numbers (they contain birth dates) or team contact details.
