import type { Availability, Fixture, Override, PlannerState, RosterPlayer } from './types';

const PREFIX = 'teamhub:lineup:';
const ANSWERS: readonly Availability[] = ['yes', 'maybe', 'no', 'unknown'];
const OVERRIDES: readonly Override[] = ['in', 'out'];

export function emptyState(teamName = ''): PlannerState {
  return {
    version: 1,
    teamName,
    settings: { playersPerMatch: 3 },
    players: [],
    fixtures: [],
    availability: {},
    overrides: {},
  };
}

export function newId(taken: Iterable<string> = []): string {
  const used = new Set(taken);
  for (;;) {
    const id = Math.random().toString(36).slice(2, 8);
    if (id.length === 6 && !used.has(id)) return id;
  }
}

/* ---------- Browser storage (per device; every access may throw) ---------- */

export function loadState(key: string): PlannerState | null {
  try {
    const raw = localStorage.getItem(PREFIX + key);
    return raw ? normalizeState(JSON.parse(raw)) : null;
  } catch {
    return null;
  }
}

export function saveState(key: string, state: PlannerState): boolean {
  try {
    localStorage.setItem(PREFIX + key, JSON.stringify(state));
    return true;
  } catch {
    return false;
  }
}

export function listSavedPlanners(): { key: string; teamName: string }[] {
  const found: { key: string; teamName: string }[] = [];
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const storageKey = localStorage.key(i);
      if (!storageKey?.startsWith(PREFIX)) continue;
      const key = storageKey.slice(PREFIX.length);
      const state = loadState(key);
      if (state) found.push({ key, teamName: state.teamName });
    }
  } catch {
    /* storage unavailable: nothing saved */
  }
  return found.sort((a, b) => a.teamName.localeCompare(b.teamName));
}

/* ---------- Share links: JSON -> deflate -> base64url ---------- */

export async function encodeState(state: PlannerState): Promise<string> {
  const bytes = new TextEncoder().encode(JSON.stringify(state));
  if (typeof CompressionStream === 'function') {
    const packed = await pipe(bytes, new CompressionStream('deflate-raw'));
    return 'z' + toBase64Url(packed);
  }
  return 'j' + toBase64Url(bytes);
}

export async function decodeState(token: string): Promise<PlannerState | null> {
  try {
    const bytes = fromBase64Url(token.slice(1));
    let json: string;
    if (token.startsWith('z')) {
      if (typeof DecompressionStream !== 'function') return null;
      json = new TextDecoder().decode(await pipe(bytes, new DecompressionStream('deflate-raw')));
    } else if (token.startsWith('j')) {
      json = new TextDecoder().decode(bytes);
    } else {
      return null;
    }
    return normalizeState(JSON.parse(json));
  } catch {
    return null;
  }
}

async function pipe(bytes: Uint8Array<ArrayBuffer>, transform: CompressionStream | DecompressionStream) {
  const stream = new Blob([bytes]).stream().pipeThrough(transform);
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

function toBase64Url(bytes: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < bytes.length; i += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  }
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function fromBase64Url(text: string): Uint8Array<ArrayBuffer> {
  const binary = atob(text.replace(/-/g, '+').replace(/_/g, '/'));
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

/* ---------- Validation: anything loaded from storage, links or files is untrusted ---------- */

export function normalizeState(input: unknown): PlannerState | null {
  if (!isRecord(input) || input.version !== 1) return null;
  const state = emptyState(text(input.teamName, 80));

  if (isRecord(input.settings)) {
    const perMatch = Number(input.settings.playersPerMatch);
    if (Number.isInteger(perMatch) && perMatch >= 1 && perMatch <= 12) state.settings.playersPerMatch = perMatch;
  }

  const playerIds = new Set<string>();
  for (const raw of asArray(input.players)) {
    if (!isRecord(raw) || !isId(raw.id) || playerIds.has(raw.id)) continue;
    const player: RosterPlayer = { id: raw.id, name: text(raw.name, 80) || 'Player', active: raw.active !== false };
    if (typeof raw.rating === 'number' && Number.isFinite(raw.rating)) player.rating = raw.rating;
    if (isId(raw.portalId)) player.portalId = raw.portalId;
    playerIds.add(player.id);
    state.players.push(player);
  }

  const fixtureIds = new Set<string>();
  for (const raw of asArray(input.fixtures)) {
    if (!isRecord(raw) || !isId(raw.id) || fixtureIds.has(raw.id)) continue;
    if (typeof raw.date !== 'string' || !/^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2})?$/.test(raw.date)) continue;
    const fixture: Fixture = { id: raw.id, date: raw.date, opponent: text(raw.opponent, 80), home: raw.home !== false };
    if (isId(raw.portalId)) fixture.portalId = raw.portalId;
    if (Array.isArray(raw.playedBy)) fixture.playedBy = [...new Set(raw.playedBy.filter(isId))];
    fixtureIds.add(fixture.id);
    state.fixtures.push(fixture);
  }

  state.availability = nestedMap(input.availability, fixtureIds, playerIds, ANSWERS);
  state.overrides = nestedMap(input.overrides, fixtureIds, playerIds, OVERRIDES);
  return state;
}

function nestedMap<T extends string>(
  input: unknown,
  outerKeys: Set<string>,
  innerKeys: Set<string>,
  allowed: readonly T[],
): Record<string, Record<string, T>> {
  const result: Record<string, Record<string, T>> = {};
  if (!isRecord(input)) return result;
  for (const [outer, inner] of Object.entries(input)) {
    if (!outerKeys.has(outer) || !isRecord(inner)) continue;
    for (const [key, value] of Object.entries(inner)) {
      if (innerKeys.has(key) && allowed.includes(value as T)) (result[outer] ??= {})[key] = value as T;
    }
  }
  return result;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function isId(value: unknown): value is string {
  return typeof value === 'string' && /^[A-Za-z0-9_-]{1,40}$/.test(value);
}

function text(value: unknown, max: number): string {
  return typeof value === 'string' ? value.trim().slice(0, max) : '';
}
