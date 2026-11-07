import { t } from '../i18n';
import { useFollowing, type FollowedTeam } from '../lib/follow';

export function FollowButton({ team }: { team: FollowedTeam }) {
  const { isFollowing, setFollow } = useFollowing();
  const on = isFollowing(team.poolId, team.teamId);
  return (
    <button
      type="button"
      className={on ? 'button follow is-on' : 'button follow'}
      aria-pressed={on}
      title={on ? t.follow.titleOn : t.follow.titleOff}
      onClick={() => setFollow(team, !on)}
    >
      <span aria-hidden="true">{on ? '★' : '☆'}</span> {on ? t.follow.following : t.follow.follow}
    </button>
  );
}
