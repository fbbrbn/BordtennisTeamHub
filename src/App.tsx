import { LineupPage } from './lineup/LineupPage';
import { ClubPage } from './pages/ClubPage';
import { MatchPage } from './pages/MatchPage';
import { PlayerPage } from './pages/PlayerPage';
import { PoolPage } from './pages/PoolPage';
import { StartPage } from './pages/StartPage';
import { TeamPage } from './pages/TeamPage';
import { Nav } from './components/Nav';
import { goBack, useRoute, type Route } from './lib/router';

const KEY_PATTERN = /^[A-Za-z0-9_-]{1,40}$/;
const ID_PATTERN = /^\d{1,12}$/;

function Page({ route }: { route: Route }) {
  const [section, a = '', b = ''] = route.path;

  if (section === 'lineup') {
    const storageKey = KEY_PATTERN.test(a) ? a : 'my-team';
    const linked = /^team-(\d+)-(\d+)$/.exec(storageKey);
    const link = linked ? { poolId: linked[1], teamId: linked[2] } : null;
    return <LineupPage key={storageKey} storageKey={storageKey} sharedToken={route.query.get('plan')} link={link} />;
  }
  if (section === 'club' && /^[a-z0-9-]{1,80}$/.test(a)) return <ClubPage key={a} slug={a} />;
  if (section === 'pool' && ID_PATTERN.test(a)) return <PoolPage key={a} poolId={a} />;
  if (section === 'team' && ID_PATTERN.test(a) && ID_PATTERN.test(b)) {
    return <TeamPage key={`${a}-${b}`} poolId={a} teamId={b} tab={route.query.get('tab')} />;
  }
  if (section === 'player' && ID_PATTERN.test(a) && ID_PATTERN.test(b)) return <PlayerPage key={`${a}-${b}`} poolId={a} playerId={b} />;
  if (section === 'match' && ID_PATTERN.test(a) && ID_PATTERN.test(b)) return <MatchPage key={`${a}-${b}`} poolId={a} matchId={b} />;
  return <StartPage />;
}

export default function App() {
  const route = useRoute();
  const atHome = route.path.length === 0;
  return (
    <div className="app">
      <header className="topbar">
        <div className="topbar-start">
          {!atHome && (
            <button type="button" className="back-button" onClick={goBack} aria-label="Back">
              <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M15 5 8 12l7 7" />
              </svg>
            </button>
          )}
          <a className="brand" href="#/">
            <span className="brand-mark" aria-hidden="true" />
            Team Hub
          </a>
        </div>
        <Nav route={route} variant="top" />
      </header>
      <main className="content">
        <Page route={route} />
      </main>
      <footer className="footer">
        Unofficial tool, not affiliated with DBTU or bordtennisportalen.dk. Results come from bordtennisportalen.dk and are
        refreshed several times a day, hourly on match evenings. Lineup plans and followed teams are saved in your browser.
      </footer>
      <Nav route={route} variant="bottom" />
    </div>
  );
}
