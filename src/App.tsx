import { LineupPage } from './lineup/LineupPage';
import { StartPage } from './pages/StartPage';
import { useRoute } from './lib/router';

const KEY_PATTERN = /^[A-Za-z0-9_-]{1,40}$/;

export default function App() {
  const route = useRoute();
  const [section, key] = route.path;

  let page = <StartPage />;
  if (section === 'lineup') {
    const storageKey = key && KEY_PATTERN.test(key) ? key : 'my-team';
    page = <LineupPage key={storageKey} storageKey={storageKey} sharedToken={route.query.get('plan')} />;
  }

  return (
    <div className="app">
      <header className="topbar">
        <a className="brand" href="#/">
          <span className="brand-mark" aria-hidden="true" />
          Team Hub
        </a>
        <span className="topbar-note">Unofficial · for DBTU team matches</span>
      </header>
      <main className="content">{page}</main>
      <footer className="footer">
        Unofficial tool, not affiliated with DBTU or bordtennisportalen.dk. Lineup plans are saved in your browser.
      </footer>
    </div>
  );
}
