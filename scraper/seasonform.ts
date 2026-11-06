/**
 * A finished season's form, for the next season's forecasts (src/data/form.ts): every player's singles
 * against their ratings, and whether they played in a youth pool. history.ts writes it once a season
 * is complete, as form/<season>.json on the history branch; import.ts reads last season's file.
 */
import { join } from 'node:path';
import type { LastSeason, SeasonReplay } from '../src/data/prematch.ts';
import { readJson } from './pool.ts';

export interface SeasonFormFile {
  version: 1;
  seasonId: string;
  /** By player id: singles counted, wins above expectation, and 1 for a youth player. */
  players: Record<string, [number, number, 0 | 1]>;
}

export function seasonFormFile(seasonId: string, replay: Pick<SeasonReplay, 'tallies' | 'youth'>): SeasonFormFile {
  const players: SeasonFormFile['players'] = {};
  const ids = [...new Set([...replay.tallies.keys(), ...replay.youth])].sort();
  for (const id of ids) {
    const t = replay.tallies.get(id) ?? { games: 0, above: 0 };
    players[id] = [t.games, Math.round(t.above * 100) / 100, replay.youth.has(id) ? 1 : 0];
  }
  return { version: 1, seasonId, players };
}

/** Last season's form for the season `seasonId` (4YYYY), from `dir`; null when there is no file. */
export async function readLastSeason(dir: string, seasonId: string): Promise<LastSeason | null> {
  const previous = String(Number(seasonId) - 1);
  const file = await readJson<SeasonFormFile>(join(dir, `${previous}.json`));
  if (!file || file.version !== 1) return null;
  return new Map(Object.entries(file.players).map(([id, [games, above, youth]]) => [id, { games, above, youth: youth === 1 }]));
}
