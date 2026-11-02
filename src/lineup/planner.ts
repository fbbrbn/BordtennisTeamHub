import { MinCostFlow, type FlowEdge } from './mcmf';
import type { Availability, Fixture, FixturePlan, Plan, PlannerState, PlayerTally, RosterPlayer } from './types';

/*
 * Season planner.
 *
 * Nobody is planned on assumptions: a player is only picked for an upcoming match
 * after answering "I can" or "Maybe" for it (or when the captain sets "Must play").
 *
 * Priorities, strongest first:
 *   1. Captain overrides and "I can't" answers are hard rules.
 *   2. Fill every place that answers allow.
 *   3. "I can" before "Maybe".
 *   4. Fewest matches first: counts start from matches already played, and every
 *      extra match costs more than the previous one (convex cost), so the plan is as
 *      even as possible. Earlier picks based on answers count too, so a player who can
 *      make only a few matches gets those.
 *   5. A round-robin rest rotation breaks remaining ties.
 */
const BALANCE = 100;
const REST_TURN = 1;
/** Large enough that no amount of rebalancing outweighs an "I can" over a "Maybe". */
const MAYBE_COST = 10_000_000;
const ANSWER_RANK: Record<Availability, number> = { yes: 0, maybe: 1, unknown: 2, no: 3 };

export function availabilityOf(state: PlannerState, fixtureId: string, playerId: string): Availability {
  return state.availability[fixtureId]?.[playerId] ?? 'unknown';
}

export function sortFixtures(fixtures: readonly Fixture[]): Fixture[] {
  return [...fixtures].sort((a, b) => compare(a.date, b.date) || compare(a.id, b.id));
}

export function buildPlan(state: PlannerState): Plan {
  const perMatch = Math.max(1, Math.floor(state.settings.playersPerMatch || 1));
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
  const answerOf = (f: Fixture, p: RosterPlayer) => availabilityOf(state, f.id, p.id);
  const isCandidate = (f: Fixture, p: RosterPlayer) => {
    const answer = answerOf(f, p);
    return overrideOf(f, p) === undefined && (answer === 'yes' || answer === 'maybe');
  };

  const forcedIn = new Map<string, string[]>();
  for (const f of upcoming) {
    const ids = active.filter((p) => overrideOf(f, p) === 'in').map((p) => p.id);
    forcedIn.set(f.id, ids);
    ids.forEach((id) => bump(planned, id));
  }

  // Flow network: source -> match (open places) -> player who answered -> sink (convex cost).
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
      const restTurn = restsPerMatch > 0 && mod(pi - fi * restsPerMatch, active.length) < restsPerMatch;
      const cost = (answerOf(f, p) === 'maybe' ? MAYBE_COST : 0) + (restTurn ? REST_TURN : 0);
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
        unanswered: [],
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
      unanswered: active.filter((p) => overrideOf(f, p) === undefined && answerOf(f, p) === 'unknown').map((p) => p.id),
      missing: Math.max(0, perMatch - lineup.length),
      surplus: Math.max(0, forced.length - perMatch),
      conflicts: forced.filter((id) => availabilityOf(state, f.id, id) === 'no'),
    };
  });

  // Even share of the matches played so far, among active players.
  const activeIds = new Set(active.map((p) => p.id));
  let playedByActive = 0;
  for (const f of fixtures) for (const id of f.playedBy ?? []) if (activeIds.has(id)) playedByActive++;
  const fairShare = active.length > 0 ? playedByActive / active.length : null;

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
