# The bordtennisportalen.dk web service

What the importer (`scraper/`) calls, and how the answers look. Everything below was checked against the live site.

- The team-tournament pages call one ASP.NET AJAX method:
  - `POST https://www.bordtennisportalen.dk/SportsResults/Components/WebService1.asmx/GetLeagueStanding`
  - JSON body: `callbackcontextkey, subPage, seasonID, leagueGroupID, ageGroupID, regionID, leagueGroupTeamID, leagueMatchID, clubID, playerID`
  - Response: `{ d: { html } }`, an HTML fragment.
- The context key is `SR_CallbackContext` in the HTML of `/DBTU/HoldTurnering/Stilling/`. Fetch that page first and keep its cookies.
- The URL hash has the same order: `#subPage,season,pool,ageGroup,region,team,match,club,player`.
- `subPage` values:
  - 1: region overview listing all pools: under an `h2` with the union, age group and season ("ØST Senior
    2026/2027"), each league ("række", an `h3` such as "Serie 4") lists its pools as links, in the portal's order
  - 2: pool standings
  - 3: a team's matches
  - 4: pool match list
  - 5: match details with games
  - 6: club
  - 7: pool player stats with ratings
  - 8: one player's games in a pool
- Ids:
  - Seasons: `4YYYY`, e.g. 42026 = 2026/2027, back to 42011.
  - Regions: 4000 DT (national), 4001 Bornholm, 4002 MIDT, 4003 VEST, 4004 ØST, 4005 to 4010 DGI. The portal's own
    dropdown calls them "Union" (the code says region).
  - Age groups: e.g. 4006 Senior, 4004 Junior, 4008 to 4014 Veteran.
- Team match format in senior series: 1 doubles plus 9 singles (A1/B1 ...). Results are games won ("3-7"). Points are 2 for a win and 1 for a draw.
- Player ids come from links `.../DBTU/Spiller/VisSpiller/#<id>`.
- Privacy: the pages also show player numbers like `ddmmyy-XXXX`, which encode birth dates, and team contact names, emails and phone numbers. Never store either. `scraper/parse.test.ts` checks this.
- Official ratings (`scraper/ratinglist.ts`), through other methods of the same service. Each page has its own
  `SR_CallbackContext`:
  - `/DBTU/Ranglister/` has `DefaultRankingListID` (59). `GetRankingListVersions` with `rankinglistagegroupid: ''`,
    `rankinglistid` and `seasonid` lists the list's versions as `MM/DD/YYYY`, about every two weeks.
  - `GetPlayerRankingListPoints`, in the context of `/DBTU/Spiller/VisSpiller/`, takes `seasonid`, `playerid`,
    `rankinglistid`, `rankinglistplayerid` and `getplayerdata: false`. The ids come from the rating links in subPage 7:
    `VisSpiller/#<player>,<list>,<listPlayer>,<season>`.
  - Read only its `Html`: the response also has the player number. The table lists the season's start rating, then
    every rated game (date carried down, team games as "Serie 4 #<matchId>", own and opponent rating, points).
  - Rules, checked against every game on those pages: a fixed points table by rating gap; all games of a match day
    use the ratings from before that day; doubles and walkovers are not rated; it is not zero-sum.
  - Each version only includes games up to an unpublished cutoff: the list of 23 Oct 2026 included games up to 19 Oct,
    but not 20 Oct. Replaying from one version reproduces the next best with the cutoff 4 days before each version
    (88% exact from 9 to 23 Oct 2026).
  - `GetRankingListPlayers` (context `/DBTU/Ranglister/`) gives a whole version, 100 players per `pageindex` (from 0),
    with `rankinglistversiondate: 'MM/DD/YYYY'`, `sortfield: 0` and `searchall: true` (all players, about 4,600 in 2026
    and 96% of rated players; `false` gives only recently active ones). Every other parameter is `''` or `false`.
  - Its rows: `td.rank`, the previous rank, `td.playerid` (the player number: never read it), `td.name` with the
    `VisSpiller/#<player>,<list>,<listPlayer>,<season>` link and the club, then `td.points` cells: rating, change,
    matches. `parseRatingListPage` reads only the link and the first points cell.
  - Versions go back to 2011/12: weekly in 2015/16, every two weeks lately, and only two (June 2012) for 2011/12.
- Past seasons: every pool, match and game back to 2011/12 is on the portal, but the pools' player stats show no
  ratings for past seasons; ratings at the time come from the rating-list versions.
