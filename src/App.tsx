import { LineupPage } from './lineup/LineupPage';
import { ClubPage } from './pages/ClubPage';
import { MatchPage } from './pages/MatchPage';
import { PlayerPage } from './pages/PlayerPage';
import { PoolPage } from './pages/PoolPage';
import { StartPage } from './pages/StartPage';
import { TeamPage } from './pages/TeamPage';
import { useRoute } from './lib/router';

const KEY_PATTERN = /^[A-Za-z0-9_-]{1,40}$/;
const ID_PATTERN = /^\d{1,12}$/;

function Page() {
  const route = useRoute();
  const [section, a = '', b = ''] = route.path;

  if (section === 'lineup') {
    const storageKey = KEY_PATTERN.test(a) ? a : 'my-team';
    const linked = /^team-(\d+)-(\d+)$/.exec(storageKey);
    const link = linked ? { poolId: linked[1], teamId: linked[2] } : null;
    return <LineupPage key={storageKey} storageKey={storageKey} sharedToken={route.query.get('plan')} link={link} />;
  }
  if (section === 'club' && /^[a-z0-9-]{1,80}$/.test(a)) return <ClubPage key={a} slug={a} />;
  if (section === 'pool' && ID_PATTERN.test(a)) return <PoolPage key={a} poolId={a} />;
  if (section === 'team' && ID_PATTERN.test(a) && ID_PATTERN.test(b)) return <TeamPage key={`${a}-${b}`} poolId={a} teamId={b} />;
  if (section === 'player' && ID_PATTERN.test(a) && ID_PATTERN.test(b)) return <PlayerPage key={`${a}-${b}`} poolId={a} playerId={b} />;
  if (section === 'match' && ID_PATTERN.test(a) && ID_PATTERN.test(b)) return <MatchPage key={`${a}-${b}`} poolId={a} matchId={b} />;
  return <StartPage />;
}

export default function App() {
  return (
    <div className="app">
      <header className="topbar">
        <a className="brand" href="#/">
          <span className="brand-mark" aria-hidden="true" />
          Team Hub
        </a>
        <span className="topbar-note">Unofficial · for DBTU team matches</span>
      </header>
      <main className="content">
        <Page />
      </main>
      <footer className="footer">
        Unofficial tool, not affiliated with DBTU or bordtennisportalen.dk. Results come from bordtennisportalen.dk and are
        refreshed twice a day. Lineup plans are saved in your browser.
      </footer>
    </div>
  );
}
