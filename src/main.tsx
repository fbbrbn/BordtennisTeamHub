import { StrictMode, useSyncExternalStore } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import { getLang, subscribeLang } from './i18n';
import '@fontsource/barlow-condensed/600.css';
import '@fontsource/barlow-condensed/700.css';
import './styles.css';

/** Renders the app afresh when the language changes, so no text stays in the old one. */
function Root() {
  const lang = useSyncExternalStore(subscribeLang, getLang);
  return <App key={lang} />;
}

document.documentElement.lang = getLang();
createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Root />
  </StrictMode>,
);
