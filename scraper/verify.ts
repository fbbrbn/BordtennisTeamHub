/**
 * The daily check: every player's singles record here against the portal's player stats. The portal
 * sometimes corrects a match card after it was imported (a player swapped, say) without changing the
 * score, and the importer only reads a match again when its score changes. A player whose record
 * differs shows such a correction, so the pool's played matches are read again (pool.ts).
 */
import type { PoolData } from '../src/data/model.ts';
import { playerGames, summarize } from '../src/data/stats.ts';

export interface RecordDifference {
  playerId: string;
  /** Singles won and played: on the portal, and here. */
  portal: [number, number];
  here: [number, number];
}

/** The players whose singles record differs from the portal's (`parsePlayerRecords`), walkovers counted as there. */
export function recordDifferences(pool: Pick<PoolData, 'matches'>, portal: ReadonlyMap<string, { won: number; games: number }>): RecordDifference[] {
  const differences: RecordDifference[] = [];
  for (const [playerId, theirs] of portal) {
    const singles = summarize(playerGames(pool, playerId, { walkovers: true })).singles;
    const here: [number, number] = [singles.won, singles.won + singles.lost];
    if (here[0] !== theirs.won || here[1] !== theirs.games) differences.push({ playerId, portal: [theirs.won, theirs.games], here });
  }
  return differences;
}
