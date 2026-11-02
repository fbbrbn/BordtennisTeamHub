import { MinCostFlow, type FlowEdge } from './mcmf';
import type {
  Availability,
  Fixture,
  FixturePlan,
  Plan,
  PlannerState,
  PlayerTally,
  RosterPlayer,
} from './types';

/*
 * Season planner.
 *
 * Priorities, strongest first:
 *   1. Fill every slot that can be filled.
 *   2. Respect the captain's overrides and "no" answers (hard rules).
 *   3. If `preferConfirmed` is on: pick "yes" players before "maybe"/unanswered ones.
 *   4. Balance the number of matches per player over the whole season, counting
 *      matches already played. Each extra match costs more than the previous one
 *      (convex cost), so the cheapest plan is the most even one.
 *   5. Prefer "maybe" over unanswered, then a round-robin rest rotation so the
 *      same player does not sit out several matches in a row.
 */
const BALANCE = 100;
const REST_TURN = 1;
type Answer = Exclude<Availability, 'no'>;
const MILD: Record<Answer, number> = { yes: 0, maybe: 20, unknown: 40 };
/** Large enough that no amount of rebalancing outweighs picking a confirmed player. */
const STRONG: Record<Answer, number> = { yes: 0, maybe: 10_000_000, unknown: 10_000_040 };
const ANSWER_RANK: Record<Availability, number> = { yes: 0, maybe: 1, unknown: 2, no: 3 };

export function availabilityOf(state: PlannerState, fixtureId: string, playerId: string): Availability {
  return state.availability[fixtureId]?.[playerId] ?? 'unknown';
}

export function sortFixtures(fixtures: readonly Fixture[]): Fixture[] {
  return [...fixtures].sort((a, b) => compare(a.date, b.date) || compare(a.id, b.id));
}

export function buildPlan(state: PlannerState): Plan {
  const perMatch = Math.max(1, Math.floor(state.settings.playersPerMatch || 1));
  const tierCost = state.settings.preferConfirmed ? STRONG : MILD;
  const roster = state.players;
  const rosterIndex = new Map(roster.map((p, i) => [p.id, i]));
  const ratingOf = new Map(roster.map((p) => [p.id, p.rating]));
  const active = roster.filter((p) => p.active);
  const fixtures = sortFixtures(state.fixtures);
  const upcoming = fixtures.filter((f) => !f.playedBy);

  const played = new Map<string, number>();
  const planned = new Map<string, number>();
  for (const f of fixtures) for (const id of f.playedBy ?? []) bump(played, id);

  const overrideOf = (f: Fixture, p: RosterPlayer) => state.overrides[f.id]?.[p.id];
  const isCandidate = (f: Fixture, p: RosterPlayer) =>
    overrideOf(f, p) === undefined && availabilityOf(state, f.id, p.id) !== 'no';

  const forcedIn = new Map<string, string[]>();
  for (const f of upcoming) {
    const ids = active.filter((p) => overrideOf(f, p) === 'in').map((p) => p.id);
    forcedIn.set(f.id, ids);
    ids.forEach((id) => bump(planned, id));
  }

  // Flow network: source -> match (open slots) -> eligible player -> sink (convex cost).
  const SOURCE = 0;
  const SINK = 1;
  const firstMatch = 2;
  const firstPlayer = firstMatch + upcoming.length;
  const flow = new MinCostFlow(firstPlayer + active.length);
  const slotEdges: { fixtureId: string; playerId: string; edge: FlowEdge }[] = [];
  const restsPerMatch = Math.max(0, active.length - perMatch);

  upcoming.forEach((f, fi) => {
    const open = Math.max(0, perMatch - (forcedIn.get(f.id)?.length ?? 0));
    if (open > 0) flow.addEdge(SOURCE, firstMatch + fi, open, 0);
    active.forEach((p, pi) => {
      if (!isCandidate(f, p)) return;
      const answer = availabilityOf(state, f.id, p.id) as Answer;
      const restTurn = restsPerMatch > 0 && mod(pi - fi * restsPerMatch, active.length) < restsPerMatch;
      const cost = tierCost[answer] + (restTurn ? REST_TURN : 0);
      const edge = flow.addEdge(firstMatch + fi, firstPlayer + pi, 1, cost);
      slotEdges.push({ fixtureId: f.id, playerId: p.id, edge });
    });
  });

  active.forEach((p, pi) => {
    const already = (played.get(p.id) ?? 0) + (planned.get(p.id) ?? 0);
    const chances = upcoming.filter((f) => isCandidate(f, p)).length;
    for (let k = 1; k <= chances; k++) {
      flow.addEdge(firstPlayer + pi, SINK, 1, BALANCE * (2 * (already + k) - 1));
    }
  });

  flow.run(SOURCE, SINK);

  const picked = new Map<string, string[]>(upcoming.map((f) => [f.id, []]));
  for (const { fixtureId, playerId, edge } of slotEdges) {
    if (edge.cap === 0) {
      picked.get(fixtureId)?.push(playerId);
      bump(planned, playerId);
    }
  }

  const totalOf = (id: string) => (played.get(id) ?? 0) + (planned.get(id) ?? 0);
  const byRoster = (a: string, b: string) =>
    (rosterIndex.get(a) ?? Number.MAX_SAFE_INTEGER) - (rosterIndex.get(b) ?? Number.MAX_SAFE_INTEGER) ||
    compare(a, b);
  const strongestFirst = (ids: readonly string[]) =>
    [...ids].sort((a, b) => {
      const ra = ratingOf.get(a);
      const rb = ratingOf.get(b);
      if (ra !== undefined && rb !== undefined && ra !== rb) return rb - ra;
      if (ra !== undefined && rb === undefined) return -1;
      if (ra === undefined && rb !== undefined) return 1;
      return byRoster(a, b);
    });

  const plans: FixturePlan[] = fixtures.map((f) => {
    if (f.playedBy) {
      return {
        fixture: f,
        status: 'played',
        lineup: strongestFirst(f.playedBy),
        reserves: [],
        missing: Math.max(0, perMatch - f.playedBy.length),
        surplus: 0,
        conflicts: [],
      };
    }
    const forced = forcedIn.get(f.id) ?? [];
    const chosen = picked.get(f.id) ?? [];
    const lineup = strongestFirst([...forced, ...chosen]);
    const reserves = active
      .filter((p) => isCandidate(f, p) && !chosen.includes(p.id))
      .map((p) => p.id)
      .sort(
        (a, b) =>
          ANSWER_RANK[availabilityOf(state, f.id, a)] - ANSWER_RANK[availabilityOf(state, f.id, b)] ||
          totalOf(a) - totalOf(b) ||
          byRoster(a, b),
      );
    return {
      fixture: f,
      status: 'planned',
      lineup,
      reserves,
      missing: Math.max(0, perMatch - lineup.length),
      surplus: Math.max(0, forced.length - perMatch),
      conflicts: forced.filter((id) => availabilityOf(state, f.id, id) === 'no'),
    };
  });

  const activeIds = new Set(active.map((p) => p.id));
  const totalSlots = fixtures.reduce((sum, f) => sum + (f.playedBy ? f.playedBy.length : perMatch), 0);
  let slotsOfOthers = 0;
  for (const f of fixtures) for (const id of f.playedBy ?? []) if (!activeIds.has(id)) slotsOfOthers++;
  const fairShare = active.length > 0 ? (totalSlots - slotsOfOthers) / active.length : null;

  const tallies: PlayerTally[] = roster.map((p) => ({
    playerId: p.id,
    played: played.get(p.id) ?? 0,
    planned: planned.get(p.id) ?? 0,
    total: totalOf(p.id),
    fairShare: p.active ? fairShare : null,
  }));

  return { fixtures: plans, tallies };
}

function bump(map: Map<string, number>, id: string) {
  map.set(id, (map.get(id) ?? 0) + 1);
}

function mod(n: number, m: number) {
  return ((n % m) + m) % m;
}

function compare(a: string, b: string) {
  return a < b ? -1 : a > b ? 1 : 0;
}
