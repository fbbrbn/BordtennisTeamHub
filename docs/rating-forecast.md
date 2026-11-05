# Rating forecast

The rating a player will have once the official list includes the games they have already played. The code is in
[`src/data/ratings.ts`](../src/data/ratings.ts); how the importer finds which games a list includes is in
[the data pipeline](data-pipeline.md).

The official rating list is published about every two weeks, and each version only includes games up to a few days
before it came out, so a result can take up to three weeks to show. The forecast rates those games straight away:

- Every singles game moves both players by a fixed number of points, from the rating gap and who won:

  | Rating gap | Higher rated wins | Higher rated loses | Lower rated wins | Lower rated loses |
  | ---------- | ----------------: | -----------------: | ---------------: | ----------------: |
  | 0–24       |                +7 |                 −5 |               +7 |                −5 |
  | 25–49      |                +6 |                −10 |              +12 |                −4 |
  | 50–74      |                +5 |                −14 |              +16 |                −3 |
  | 75–99      |                +4 |                −17 |              +19 |                −3 |
  | 100–199    |                +3 |                −20 |              +22 |                −3 |
  | 200–299    |                +2 |                −18 |              +22 |                −2 |
  | 300+       |                +1 |                −15 |              +22 |                −1 |

- All games of a match day use the ratings from before that day.
- Doubles and walkovers are not rated.

The table and the rules were read from the portal's "Opnåede point" pages and reproduce every one of more than 200
rated games checked. Which games a list includes is not published either: the import finds the last included match day
from a few players' rating pages. Tournament games and games against unrated players are not in the forecast, so the
official rating can differ a little.
