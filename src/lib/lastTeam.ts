/** The team the viewer last opened, so pages can show things from "your" side. */
export const LAST_TEAM_KEY = 'teamhub:last-team';

export interface LastTeam {
  poolId: string;
  teamId: string;
  name: string;
}

export function readLastTeam(): LastTeam | null {
  try {
    const value = JSON.parse(localStorage.getItem(LAST_TEAM_KEY) ?? 'null');
    return value && typeof value.poolId === 'string' && typeof value.teamId === 'string' && typeof value.name === 'string'
      ? value
      : null;
  } catch {
    return null;
  }
}

export function rememberTeam(team: LastTeam): void {
  try {
    localStorage.setItem(LAST_TEAM_KEY, JSON.stringify(team));
  } catch {
    /* storage unavailable */
  }
  // Lets the navigation update its "My team" link (see useFollowing).
  window.dispatchEvent(new Event('teamhub:following-changed'));
}
