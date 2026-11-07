import type { ReactNode } from 'react';
import { t } from '../i18n';
import { useMyTeam } from '../lib/follow';
import { href, type Route } from '../lib/router';

const icon = (path: ReactNode) => (
  <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    {path}
  </svg>
);

const HOME = icon(<path d="M3 11.5 12 4l9 7.5M5.5 9.5V20h13V9.5" />);
const TEAM = icon(
  <>
    <circle cx="9" cy="8" r="3" />
    <circle cx="17" cy="9.5" r="2.4" />
    <path d="M3.5 19c.6-3.2 3-5 5.5-5s4.9 1.8 5.5 5M14.5 14.6c.8-.4 1.6-.6 2.5-.6 2 0 3.7 1.4 4 4" />
  </>,
);
const LINEUP = icon(
  <>
    <rect x="5" y="4" width="14" height="17" rx="2" />
    <path d="M9 4.5V3h6v1.5M8.5 10h7M8.5 14h7M8.5 18h4" />
  </>,
);

/** The three places people go most: home (search), their team, and its lineup planner. */
export function Nav({ route, variant }: { route: Route; variant: 'top' | 'bottom' }) {
  const myTeam = useMyTeam();
  const [section, a, b] = route.path;
  const onMyTeam = section === 'team' && myTeam !== null && a === myTeam.poolId && b === myTeam.teamId;
  const items = [
    { id: 'home', label: t.nav.home, to: '#/', icon: HOME, active: !section },
    {
      id: 'team',
      label: t.nav.myTeam,
      to: myTeam ? href('team', myTeam.poolId, myTeam.teamId) : '#/',
      icon: TEAM,
      active: onMyTeam,
      title: myTeam ? myTeam.name : t.nav.followFirst,
    },
    {
      id: 'lineup',
      label: t.nav.lineup,
      to: myTeam ? href('lineup', `team-${myTeam.poolId}-${myTeam.teamId}`) : href('lineup', 'my-team'),
      icon: LINEUP,
      active: section === 'lineup',
      title: myTeam ? t.nav.plannerFor(myTeam.name) : t.nav.planner,
    },
  ];
  return (
    <nav className={variant === 'top' ? 'nav-top' : 'nav-bottom'} aria-label={t.nav.main}>
      {items.map((item) => (
        <a key={item.id} href={item.to} className="nav-link" aria-current={item.active ? 'page' : undefined} title={item.title}>
          {variant === 'bottom' && item.icon}
          <span>{item.label}</span>
        </a>
      ))}
    </nav>
  );
}
