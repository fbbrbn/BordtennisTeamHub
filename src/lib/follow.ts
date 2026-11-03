import { useEffect, useState } from 'react';
import { readLastTeam } from './lastTeam';

/** Teams the viewer follows, shown first on the start page. Saved in this browser only. */
export interface FollowedTeam {
  poolId: string;
  teamId: string;
  name: string;
}

const KEY = 'teamhub:following';
const EVENT = 'teamhub:following-changed';
let memory: FollowedTeam[] = [];

export function toggleFollow(list: FollowedTeam[], team: FollowedTeam, follow: boolean): FollowedTeam[] {
  const rest = list.filter((t) => !(t.poolId === team.poolId && t.teamId === team.teamId));
  return follow ? [...rest, team] : rest;
}

export function parseFollowing(raw: string | null): FollowedTeam[] {
  try {
    const value: unknown = JSON.parse(raw ?? '[]');
    if (!Array.isArray(value)) return [];
    return value.filter(
      (t): t is FollowedTeam =>
        typeof t === 'object' && t !== null && typeof t.poolId === 'string' && typeof t.teamId === 'string' && typeof t.name === 'string',
    );
  } catch {
    return [];
  }
}

export function readFollowing(): FollowedTeam[] {
  try {
    memory = parseFollowing(localStorage.getItem(KEY));
  } catch {
    /* storage unavailable: keep the in-memory list for this visit */
  }
  return memory;
}

function writeFollowing(list: FollowedTeam[]) {
  memory = list;
  try {
    localStorage.setItem(KEY, JSON.stringify(list));
  } catch {
    /* storage unavailable: the list lasts for this visit */
  }
  window.dispatchEvent(new Event(EVENT));
}

export function useFollowing() {
  const [following, setFollowing] = useState(readFollowing);
  useEffect(() => {
    const sync = () => setFollowing(readFollowing());
    window.addEventListener(EVENT, sync);
    window.addEventListener('storage', sync);
    return () => {
      window.removeEventListener(EVENT, sync);
      window.removeEventListener('storage', sync);
    };
  }, []);
  return {
    following,
    isFollowing: (poolId: string, teamId: string) => following.some((t) => t.poolId === poolId && t.teamId === teamId),
    setFollow: (team: FollowedTeam, follow: boolean) => writeFollowing(toggleFollow(readFollowing(), team, follow)),
  };
}

/** "My team": the first followed team, otherwise the last team opened. */
export function useMyTeam(): FollowedTeam | null {
  const { following } = useFollowing();
  return following[0] ?? readLastTeam();
}
