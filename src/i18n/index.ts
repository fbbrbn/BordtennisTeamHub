/**
 * The site's two languages: Danish first, English second. Every text is in da.tsx and en.tsx (da.tsx
 * must have every entry of en.tsx).
 *
 * - The language is the visitor's saved choice, otherwise Danish: the site is for Danish clubs, and
 *   many Danes keep their phones in English. The switch in the footer offers English.
 * - `t` and `lang` are live bindings: after `setLang`, every module reads the new language. The app
 *   is rendered again from the root (see main.tsx), so nothing keeps texts in the old language.
 */
import { da } from './da.tsx';
import { en, type Texts } from './en.tsx';

export type Lang = 'en' | 'da';
export type { Texts };

/** In the order the switch shows them: Danish first. */
export const LANGS: readonly Lang[] = ['da', 'en'];
const DICTIONARIES: Record<Lang, Texts> = { en, da };
const STORAGE_KEY = 'lang';

/** The saved choice if valid, else Danish. */
export function detectLang(saved: string | null): Lang {
  return saved === 'en' || saved === 'da' ? saved : 'da';
}

function readSaved(): string | null {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

export let lang: Lang = detectLang(readSaved());
export let t: Texts = DICTIONARIES[lang];

const listeners = new Set<() => void>();

/** Switches the language (and remembers it on this device when `save`). */
export function setLang(next: Lang, save = true): void {
  if (save) {
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // Private mode or blocked storage: the choice lasts until the page is closed.
    }
  }
  if (next === lang) return;
  lang = next;
  t = DICTIONARIES[next];
  if (typeof document !== 'undefined') document.documentElement.lang = next;
  for (const listener of listeners) listener();
}

export function subscribeLang(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export const getLang = (): Lang => lang;

/** The locale for dates and numbers. */
export const locale = (): string => (lang === 'da' ? 'da-DK' : 'en-GB');
