import { LineupPage } from './lineup/LineupPage';
import { ClubPage } from './pages/ClubPage';
import { MatchPage } from './pages/MatchPage';
import { PlayerPage } from './pages/PlayerPage';
import { PoolPage } from './pages/PoolPage';
import { SearchPage } from './pages/SearchPage';
import { StartPage } from './pages/StartPage';
import { TeamPage } from './pages/TeamPage';
import { VersusPage } from './pages/VersusPage';
import { Logo } from './components/Logo';
import { Nav } from './components/Nav';
import { LanguageSwitch } from './components/LanguageSwitch';
import { t } from './i18n';
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
  if (section === 'player' && ID_PATTERN.test(a) && ID_PATTERN.test(b)) {
    return <PlayerPage key={`${a}-${b}`} poolId={a} playerId={b} tab={route.query.get('tab')} />;
  }
  if (section === 'match' && ID_PATTERN.test(a) && ID_PATTERN.test(b)) return <MatchPage key={`${a}-${b}`} poolId={a} matchId={b} />;
  if (section === 'search') return <SearchPage query={route.query} />;
  if (section === 'vs') {
    // #/vs, #/vs/<pool>/<player> or #/vs/<pool>/<player>/<pool>/<player>, and ?match=<id> from a match preview.
    const [c = '', d = ''] = route.path.slice(3);
    const pick = (poolId: string, playerId: string) => (ID_PATTERN.test(poolId) && ID_PATTERN.test(playerId) ? { poolId, playerId } : null);
    const first = pick(a, b);
    const match = route.query.get('match') ?? '';
    return (
      <VersusPage
        key={route.path.join('/')}
        first={first}
        second={first ? pick(c, d) : null}
        matchId={ID_PATTERN.test(match) ? match : null}
      />
    );
  }
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
            <button type="button" className="back-button" onClick={goBack} aria-label={t.app.back}>
              <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M15 5 8 12l7 7" />
              </svg>
            </button>
          )}
          <a className="brand" href="#/">
            <Logo className="brand-mark" />
            Team Hub
          </a>
        </div>
        <Nav route={route} variant="top" />
      </header>
      <main className="content">
        <Page route={route} />
      </main>
      <footer className="footer">
        <LanguageSwitch />
        <p>{t.app.footer}</p>
      </footer>
      <Nav route={route} variant="bottom" />
    </div>
  );
}
