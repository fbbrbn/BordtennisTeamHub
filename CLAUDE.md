# Notes for Claude Code

## Goal

An unofficial web app for teams in the Danish table tennis team tournament (DBTU Holdturnering). It has three parts:

1. **Lineup planner.** For example, 5 players and 3 per match: who plays each match.
2. **Interactive dashboards** per team and per player, built from bordtennisportalen.dk results.
3. **A start page** where any team selects itself.

The owner's team, Vallensbæk BTK 3, is the first tester. Nothing may be specific to that team: no hard-coded team
names, ids or pools in code.

## Documentation

The documentation is in [README.md](README.md) and `docs/`. The technical documents are imported here, so they load in
every session:

@docs/development.md
@docs/portal-api.md
@docs/data-pipeline.md
@docs/predictions.md

`docs/rating-forecast.md` explains the rating forecast. Keep the documents up to date when the code changes.
