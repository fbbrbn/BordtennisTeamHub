import { buildPlan } from './planner';
import { loadState } from './storage';

/**
 * The lineup the captain's planner currently proposes for a portal match, as portal
 * player ids. Only a complete lineup counts; otherwise the caller falls back to the
 * team's most-used players.
 */
export function plannedLineup(poolId: string, teamId: string, matchId: string, size: number): string[] | null {
  const state = loadState(`team-${poolId}-${teamId}`);
  if (!state) return null;
  const item = buildPlan(state).fixtures.find((f) => f.fixture.portalId === matchId && f.status === 'planned');
  if (!item || item.lineup.length !== size) return null;
  const portal = new Map(state.players.map((p) => [p.id, p.portalId]));
  const ids = item.lineup.map((id) => portal.get(id)).filter((id): id is string => Boolean(id));
  return ids.length === size ? ids : null;
}
