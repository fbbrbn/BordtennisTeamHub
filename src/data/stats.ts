import type { Game, Player, PoolData, TeamMatch, TeamRef } from './model';

export type Outcome = 'won' | 'drawn' | 'lost';

export interface WinLoss {
  won: number;
  lost: number;
}

export interface PlayerLine {
  playerId: string;
  /** Team matches the player appeared in. */
  matches: number;
  singles: WinLoss;
  doubles: WinLoss;
  sets: WinLoss;
}

export interface GameRecord {
  match: TeamMatch;
  game: Game;
  teamId: string;
  opponentTeamId: string;
  partners: string[];
  opponents: string[];
  won: boolean;
  setsFor: number;
  setsAgainst: number;
}

export function teamsById(pool: PoolData): Map<string, TeamRef> {
  return new Map(pool.teams.map((t) => [t.id, t]));
}

export function playersById(pool: PoolData): Map<string, Player> {
  return new Map(pool.players.map((p) => [p.id, p]));
}

export function isHome(match: TeamMatch, teamId: string): boolean {
  return match.homeTeamId === teamId;
}

export function opponentOf(match: TeamMatch, teamId: string): string {
  return isHome(match, teamId) ? match.awayTeamId : match.homeTeamId;
}

/** Games won and lost from one team's point of view. */
export function scoreFor(match: TeamMatch, teamId: string): [number, number] | null {
  if (!match.score) return null;
  return isHome(match, teamId) ? match.score : [match.score[1], match.score[0]];
}

export function outcomeFor(match: TeamMatch, teamId: string): Outcome | null {
  const score = scoreFor(match, teamId);
  if (!score) return null;
  return score[0] > score[1] ? 'won' : score[0] < score[1] ? 'lost' : 'drawn';
}

export function teamMatches(pool: PoolData, teamId: string): TeamMatch[] {
  return pool.matches.filter((m) => m.homeTeamId === teamId || m.awayTeamId === teamId);
}

/** Cumulative league points per team after each of its played matches; index 0 is the start (0 points). */
export function pointsRace(pool: PoolData): { teamId: string; points: number[] }[] {
  return pool.teams.map((team) => {
    const points = [0];
    for (const match of teamMatches(pool, team.id)) {
      if (!match.points) continue;
      const earned = isHome(match, team.id) ? match.points[0] : match.points[1];
      points.push(points[points.length - 1] + earned);
    }
    return { teamId: team.id, points };
  });
}

/** Every game a player played (walkovers excluded), oldest first. */
export function playerGames(pool: PoolData, playerId: string): GameRecord[] {
  const records: GameRecord[] = [];
  for (const match of pool.matches) {
    for (const game of match.games ?? []) {
      if (game.walkover) continue;
      const side = game.home.includes(playerId) ? 'home' : game.away.includes(playerId) ? 'away' : null;
      if (!side || game.winner === null) continue;
      const mine = side === 'home' ? game.home : game.away;
      records.push({
        match,
        game,
        teamId: side === 'home' ? match.homeTeamId : match.awayTeamId,
        opponentTeamId: side === 'home' ? match.awayTeamId : match.homeTeamId,
        partners: mine.filter((id) => id !== playerId),
        opponents: side === 'home' ? game.away : game.home,
        won: game.winner === side,
        setsFor: side === 'home' ? game.sets[0] : game.sets[1],
        setsAgainst: side === 'home' ? game.sets[1] : game.sets[0],
      });
    }
  }
  return records;
}

export function summarize(records: GameRecord[]): Omit<PlayerLine, 'playerId'> {
  const line = { matches: new Set(records.map((r) => r.match.id)).size, singles: wl(), doubles: wl(), sets: wl() };
  for (const r of records) {
    const bucket = r.game.kind === 'single' ? line.singles : line.doubles;
    if (r.won) bucket.won++;
    else bucket.lost++;
    line.sets.won += r.setsFor;
    line.sets.lost += r.setsAgainst;
  }
  return line;
}

/** Everyone who played for a team in this pool, most matches first. */
export function teamPlayerLines(pool: PoolData, teamId: string): PlayerLine[] {
  const ids = new Set<string>();
  for (const match of teamMatches(pool, teamId)) {
    for (const game of match.games ?? []) for (const id of isHome(match, teamId) ? game.home : game.away) ids.add(id);
  }
  return [...ids]
    .map((playerId) => ({ playerId, ...summarize(playerGames(pool, playerId).filter((r) => r.teamId === teamId)) }))
    .sort((a, b) => b.matches - a.matches || b.singles.won - a.singles.won || a.playerId.localeCompare(b.playerId));
}

export function winRate(record: WinLoss): number | null {
  const total = record.won + record.lost;
  return total > 0 ? record.won / total : null;
}

function wl(): WinLoss {
  return { won: 0, lost: 0 };
}
