# Team Hub for Danish table tennis teams

An unofficial companion for teams in the DBTU team tournament (Holdturnering). It helps a captain decide who plays
each match. Next it will show team and player statistics built from the public results on
[bordtennisportalen.dk](https://bordtennisportalen.dk).

It is built for any team. Vallensbæk BTK 3 is the first test team.

> Not affiliated with DBTU or bordtennisportalen.dk.

## What works today: the lineup planner

Typical case: 5 players on the team, 3 play each match.

- **Roster and schedule.** Add your players and your matches (date, opponent, home or away).
- **Availability.** Mark each player Yes, Maybe or No for each match.
- **A fair plan for the whole season.** The planner proposes a lineup for every upcoming match:
  - It keeps the number of matches per player as even as possible over the season, counting matches already played.
  - A player who will miss later matches gets more of the earlier ones.
  - It rotates rests, so nobody sits out twice in a row when it can be avoided.
  - Players who said Yes go before Maybe or unanswered ones. You can turn this off.
- **Captain overrides.** Set any player to *Must play* or *Rest* for a single match.
- **Warnings.** The planner flags open places, too many must-plays, and must-plays who answered No.
- **Season balance.** A table shows played, planned and total matches per player against an even share.
- **Sharing.**
  - Copy a link with the whole plan, or a short text summary for the team chat.
  - Download a backup and restore it later.

Plans are stored in the browser of whoever made them. There are no accounts and no server. A share link carries a copy
of the plan, so changes made after opening a link stay on that device.

## What's next

1. **Match data import.** A scheduled GitHub Action reads the public standings, matches and individual results from
   bordtennisportalen.dk and saves them as JSON files in this repository. The site reads those files, so it stays a
   static site on GitHub Pages.
2. **Team dashboard.**
   - Standings and the results timeline.
   - Points over the season compared with the rest of the pool.
   - Each player's contribution.
3. **Player dashboard.**
   - Matches, games and sets won.
   - Results against opponents' ratings.
   - Rating trend and head-to-head records.
4. **Start page team picker.** Choose season, region, pool and team, and get the same dashboards and planner for any
   team.
5. **Planner linked to data.**
   - Roster and fixtures fill in automatically.
   - Played matches record who actually played.
6. **Shared availability (optional).** Let each player answer in the app instead of through the captain. This needs a
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

`.github/workflows/site.yml` runs on every push and pull request: it typechecks, tests and builds the site. Pushes to
`main` also publish the site to GitHub Pages. To turn that on, open the repository's **Settings → Pages** and set
**Source** to **GitHub Actions**.

## Data and privacy

- **Lineup plans.** They stay in your browser unless you share a link or a backup file yourself.
- **Match data.** It will come from the public pages of bordtennisportalen.dk. The import will run at most once a day
  and only re-download matches that have changed.
