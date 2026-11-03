import { useFollowing, type FollowedTeam } from '../lib/follow';

export function FollowButton({ team }: { team: FollowedTeam }) {
  const { isFollowing, setFollow } = useFollowing();
  const on = isFollowing(team.poolId, team.teamId);
  return (
    <button
      type="button"
      className={on ? 'button follow is-on' : 'button follow'}
      aria-pressed={on}
      title={on ? 'Shown first on the start page. Tap to stop following.' : 'Show this team first on the start page'}
      onClick={() => setFollow(team, !on)}
    >
      <span aria-hidden="true">{on ? '★' : '☆'}</span> {on ? 'Following' : 'Follow'}
    </button>
  );
}
