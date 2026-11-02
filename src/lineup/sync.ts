import type { PoolData } from '../data/model';
import { isHome, opponentOf, teamMatches } from '../data/stats';
import { newId } from './storage';
import type { PlannerState, RosterPlayer } from './types';

/**
 * Brings a planner linked to a portal team up to date with the imported data:
 * adds players who played for the team, adds and updates its fixtures, and records
 * who actually played. Captain-made fixtures, answers and overrides are untouched.
 * Returns the same object when nothing changed.
 */
export function syncWithPool(state: PlannerState, pool: PoolData, teamId: string): PlannerState {
  const team = pool.teams.find((t) => t.id === teamId);
  if (!team) return state;
  const next = structuredClone(state);
  const teamNames = new Map(pool.teams.map((t) => [t.id, t.name]));
  const info = new Map(pool.players.map((p) => [p.id, p]));
  const matches = teamMatches(pool, teamId);

  if (!next.teamName) next.teamName = team.name;

  // Players: anyone who played for the team (most matches first), then players the portal lists on it.
  const appearances = new Map<string, number>();
  for (const match of matches) {
    const ids = new Set<string>();
    for (const game of match.games ?? []) for (const id of isHome(match, teamId) ? game.home : game.away) ids.add(id);
    for (const id of ids) appearances.set(id, (appearances.get(id) ?? 0) + 1);
  }
  for (const p of pool.players) if (p.teamId === teamId && !appearances.has(p.id)) appearances.set(p.id, 0);

  const rosterByPortal = new Map<string, RosterPlayer>();
  for (const p of next.players) if (p.portalId) rosterByPortal.set(p.portalId, p);
  for (const [portalId] of [...appearances].sort((a, b) => b[1] - a[1])) {
    const known = info.get(portalId);
    const existing = rosterByPortal.get(portalId);
    if (existing) {
      if (known?.rating != null) existing.rating = known.rating;
      continue;
    }
    const player: RosterPlayer = {
      id: newId(next.players.map((p) => p.id)),
      name: known?.name ?? 'Player',
      active: true,
      portalId,
    };
    if (known?.rating != null) player.rating = known.rating;
    next.players.push(player);
    rosterByPortal.set(portalId, player);
  }

  // Fixtures: the portal is the source of truth for date, opponent, venue side and who played.
  const fixtureByPortal = new Map(next.fixtures.filter((f) => f.portalId).map((f) => [f.portalId as string, f]));
  for (const match of matches) {
    const home = isHome(match, teamId);
    const opponent = teamNames.get(opponentOf(match, teamId)) ?? '';
    let fixture = fixtureByPortal.get(match.id);
    if (!fixture) {
      fixture = { id: newId(next.fixtures.map((f) => f.id)), date: match.date, opponent, home, portalId: match.id };
      next.fixtures.push(fixture);
    } else {
      fixture.date = match.date;
      fixture.opponent = opponent;
      fixture.home = home;
    }
    if (match.games) {
      const ids = new Set<string>();
      for (const game of match.games) for (const id of home ? game.home : game.away) ids.add(id);
      fixture.playedBy = [...ids].flatMap((id) => {
        const rosterId = rosterByPortal.get(id)?.id;
        return rosterId ? [rosterId] : [];
      });
    }
  }

  return JSON.stringify(next) === JSON.stringify(state) ? state : next;
}
