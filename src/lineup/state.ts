import type { PoolData } from '../data/model';
import { newId } from './storage';
import { syncWithPool } from './sync';
import type { Availability, Fixture, Override, PlannerSettings, PlannerState, RosterPlayer } from './types';

export type Action =
  | { type: 'replace'; state: PlannerState }
  | { type: 'sync'; pool: PoolData; teamId: string }
  | { type: 'teamName'; name: string }
  | { type: 'settings'; patch: Partial<PlannerSettings> }
  | { type: 'addPlayer'; name: string; rating?: number }
  | { type: 'updatePlayer'; id: string; patch: Partial<Omit<RosterPlayer, 'id'>> }
  | { type: 'removePlayer'; id: string }
  | { type: 'addFixture'; date: string; opponent: string; home: boolean }
  | { type: 'updateFixture'; id: string; patch: Partial<Omit<Fixture, 'id' | 'playedBy'>> }
  | { type: 'removeFixture'; id: string }
  | { type: 'availability'; fixtureId: string; playerId: string; value: Availability }
  | { type: 'override'; fixtureId: string; playerId: string; value: Override | null }
  | { type: 'markPlayed'; fixtureId: string; playerIds: string[] }
  | { type: 'unmarkPlayed'; fixtureId: string };

export function reducer(state: PlannerState, action: Action): PlannerState {
  switch (action.type) {
    case 'replace':
      return action.state;
    case 'sync':
      return syncWithPool(state, action.pool, action.teamId);
    case 'teamName':
      return { ...state, teamName: action.name };
    case 'settings':
      return { ...state, settings: { ...state.settings, ...action.patch } };
    case 'addPlayer': {
      const player: RosterPlayer = {
        id: newId(state.players.map((p) => p.id)),
        name: action.name.trim(),
        active: true,
      };
      if (action.rating !== undefined) player.rating = action.rating;
      return { ...state, players: [...state.players, player] };
    }
    case 'updatePlayer':
      return {
        ...state,
        players: state.players.map((p) => (p.id === action.id ? { ...p, ...action.patch } : p)),
      };
    case 'removePlayer':
      return {
        ...state,
        players: state.players.filter((p) => p.id !== action.id),
        fixtures: state.fixtures.map((f) =>
          f.playedBy?.includes(action.id) ? { ...f, playedBy: f.playedBy.filter((id) => id !== action.id) } : f,
        ),
        availability: withoutInner(state.availability, action.id),
        overrides: withoutInner(state.overrides, action.id),
      };
    case 'addFixture': {
      const fixture: Fixture = {
        id: newId(state.fixtures.map((f) => f.id)),
        date: action.date,
        opponent: action.opponent.trim(),
        home: action.home,
      };
      return { ...state, fixtures: [...state.fixtures, fixture] };
    }
    case 'updateFixture':
      return {
        ...state,
        fixtures: state.fixtures.map((f) => (f.id === action.id ? { ...f, ...action.patch } : f)),
      };
    case 'removeFixture': {
      const { [action.id]: _a, ...availability } = state.availability;
      const { [action.id]: _o, ...overrides } = state.overrides;
      return { ...state, fixtures: state.fixtures.filter((f) => f.id !== action.id), availability, overrides };
    }
    case 'availability':
      return {
        ...state,
        availability: setInner(state.availability, action.fixtureId, action.playerId, action.value === 'unknown' ? null : action.value),
      };
    case 'override':
      return { ...state, overrides: setInner(state.overrides, action.fixtureId, action.playerId, action.value) };
    case 'markPlayed':
      return {
        ...state,
        fixtures: state.fixtures.map((f) => (f.id === action.fixtureId ? { ...f, playedBy: [...action.playerIds] } : f)),
      };
    case 'unmarkPlayed':
      return {
        ...state,
        fixtures: state.fixtures.map((f) => {
          if (f.id !== action.fixtureId) return f;
          const { playedBy: _p, ...rest } = f;
          return rest;
        }),
      };
  }
}

function setInner<T>(
  map: Record<string, Record<string, T>>,
  outer: string,
  inner: string,
  value: T | null,
): Record<string, Record<string, T>> {
  const current = { ...(map[outer] ?? {}) };
  if (value === null) delete current[inner];
  else current[inner] = value;
  const next = { ...map };
  if (Object.keys(current).length === 0) delete next[outer];
  else next[outer] = current;
  return next;
}

function withoutInner<T>(map: Record<string, Record<string, T>>, inner: string): Record<string, Record<string, T>> {
  const next: Record<string, Record<string, T>> = {};
  for (const [outer, values] of Object.entries(map)) {
    const { [inner]: _removed, ...rest } = values;
    if (Object.keys(rest).length > 0) next[outer] = rest;
  }
  return next;
}
