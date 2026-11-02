# Notes for working on this repository

## Goal

An unofficial web app for teams in the Danish table tennis team tournament (DBTU Holdturnering). It has three parts:

1. **Lineup planner.** For example, 5 players and 3 per match: who plays each match.
2. **Interactive dashboards** per team and per player, built from bordtennisportalen.dk results.
3. **A start page** where any team selects itself.

The owner's team, Vallensbæk BTK 3, is the first tester. Nothing may be specific to that team: no hard-coded team
names, ids or pools in code.

## Stack and layout

- Vite + React + TypeScript (strict). The app uses a hash router (`src/lib/router.ts`), so GitHub Pages needs no
  server config.
- `src/lineup/`: the lineup planner.
  - `planner.ts`: pure season planner (min-cost flow in `mcmf.ts`), unit-tested.
  - `storage.ts`: localStorage, share-link encoding (deflate + base64url) and validation of untrusted input.
  - `state.ts`: reducer. The UI lives in `LineupPage.tsx`, `Matches.tsx`, `BalanceTable.tsx` and `RosterEditor.tsx`.
- `src/pages/StartPage.tsx`: the landing page.
- `.github/workflows/site.yml`: typecheck, test and build on every push and PR; deploy to GitHub Pages from `main`.

Commands: `npm test`, `npm run typecheck`, `npm run build`, `npm run dev`.

## Conventions

- English UI. Danish table tennis terms are fine where users expect them (Holdturnering, pulje, række).
- Mobile first: captains and players use phones. Check 390px width; there must be no horizontal page scroll.
- Charts follow the dataviz skill's rules:
  - Validate colors with its script.
  - Thin marks and a legend.
  - Text in text colors, never in series colors.
  - Separate light and dark values.
- Never ship invented match data. Test fixtures stay in tests.

## Data source: not analyzed yet

The match data comes from bordtennisportalen.dk. Example page, the owner's pool standings:
`https://bordtennisportalen.dk/DBTU/HoldTurnering/Stilling/#4,42026,15592,4006,4004,,,4289,`

- In the first session the domain was blocked by the cloud environment's network policy. Nothing about the site's
  internals has been verified.
- To work on the import, `bordtennisportalen.dk` must be in the environment's allowed domains.
- Lead to verify, not a fact: the URL scheme (`/<org>/HoldTurnering/Stilling/#a,b,c,...`) matches badmintonplayer.dk.
  The two sites may share a platform that loads data with AJAX calls returning HTML fragments.
- Read the page's JavaScript to confirm the endpoints and what each of the 9 hash fields means before writing the
  scraper.

## Planned import (not built yet)

- The scraper runs in a scheduled GitHub Action (Node + TypeScript, polite rate limit, cache finished matches).
- It writes normalized JSON (seasons, pools, teams, fixtures, individual games with sets, players, ratings) to a data
  folder the site loads.
- The planner should then prefill its roster and fixtures from that data. `RosterPlayer.portalId` and
  `Fixture.portalId` already exist for that link.
