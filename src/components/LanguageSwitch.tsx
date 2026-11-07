import { lang, LANGS, setLang, t } from '../i18n';

/** English or Danish, remembered on this device. Each name is in its own language. */
export function LanguageSwitch() {
  return (
    <div className="segmented language-switch" role="group" aria-label={t.language.label}>
      {LANGS.map((l) => (
        <button key={l} type="button" lang={l} aria-pressed={lang === l} onClick={() => setLang(l)}>
          {t.language[l]}
        </button>
      ))}
    </div>
  );
}
