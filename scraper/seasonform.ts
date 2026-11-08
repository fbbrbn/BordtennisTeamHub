/**
 * What the next season's forecasts need from a finished one (src/data/form.ts, src/data/prematch.ts):
 * every player's singles against their ratings, whether they played in a youth pool, and every team's
 * lineups, so a team's first match next season can borrow them. history.ts writes it once a season is
 * complete, as form/<season>.json on the history branch; import.ts reads last season's file.
 */
import { join } from 'node:path';
import type { WeightedLineup } from '../src/data/forecast.ts';
import type { LastSeason, SeasonReplay } from '../src/data/prematch.ts';
import { readJson } from './pool.ts';

/** Version 2 added the teams' lineups; older files are written again. */
export const SEASON_FORM_VERSION = 2;

export interface SeasonFormFile {
  version: number;
  seasonId: string;
  /** By player id: singles counted, wins above expectation, and 1 for a youth player. */
  players: Record<string, [number, number, 0 | 1]>;
  /** By team key (src/data/prematch.ts teamKey): each lineup's player ids and how often it was fielded. */
  teams?: Record<string, [string[], number][]>;
}

export function seasonFormFile(
  seasonId: string,
  replay: Pick<SeasonReplay, 'tallies' | 'youth'>,
  teams: Map<string, WeightedLineup[]>,
): SeasonFormFile {
  const players: SeasonFormFile['players'] = {};
  const ids = [...new Set([...replay.tallies.keys(), ...replay.youth])].sort();
  for (const id of ids) {
    const t = replay.tallies.get(id) ?? { games: 0, above: 0 };
    players[id] = [t.games, Math.round(t.above * 100) / 100, replay.youth.has(id) ? 1 : 0];
  }
  const lineups: NonNullable<SeasonFormFile['teams']> = {};
  for (const key of [...teams.keys()].sort()) lineups[key] = teams.get(key)!.map((l) => [l.ids, l.weight]);
  return { version: SEASON_FORM_VERSION, seasonId, players, teams: lineups };
}

/** The file as the next season's replay takes it. A version 1 file has no teams. */
export function lastSeasonOf(file: SeasonFormFile): LastSeason {
  return {
    players: new Map(Object.entries(file.players).map(([id, [games, above, youth]]) => [id, { games, above, youth: youth === 1 }])),
    teams: new Map(Object.entries(file.teams ?? {}).map(([key, lineups]) => [key, lineups.map(([ids, weight]) => ({ ids, weight }))])),
  };
}

/** Last season's file for the season `seasonId` (4YYYY), from `dir`; null when there is none. */
export async function readLastSeason(dir: string, seasonId: string): Promise<LastSeason | null> {
  const previous = String(Number(seasonId) - 1);
  const file = await readJson<SeasonFormFile>(join(dir, `${previous}.json`));
  return file && file.version >= 1 && file.players ? lastSeasonOf(file) : null;
}
