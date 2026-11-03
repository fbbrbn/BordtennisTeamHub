import { describe, expect, it } from 'vitest';
import { parseFollowing, toggleFollow } from './follow';

const a = { poolId: '1', teamId: '10', name: 'Alpha 1' };
const b = { poolId: '2', teamId: '20', name: 'Beta 2' };

describe('following teams', () => {
  it('adds a team once and removes it again', () => {
    const once = toggleFollow([], a, true);
    expect(toggleFollow(once, a, true)).toEqual([a]);
    expect(toggleFollow([a, b], a, false)).toEqual([b]);
  });

  it('ignores damaged stored values', () => {
    expect(parseFollowing(null)).toEqual([]);
    expect(parseFollowing('not json')).toEqual([]);
    expect(parseFollowing(JSON.stringify([a, { poolId: 3 }, 'x']))).toEqual([a]);
  });
});
