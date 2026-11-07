/**
 * The site's two languages. Every text is in en.ts and da.ts (da.ts must have every entry of en.ts).
 *
 * - The language is the visitor's saved choice, otherwise the first of the device's languages that
 *   the site has (a Danish phone gets Danish), otherwise English.
 * - `t` and `lang` are live bindings: after `setLang`, every module reads the new language. The app
 *   is rendered again from the root (see main.tsx), so nothing keeps texts in the old language.
 */
import { da } from './da.tsx';
import { en, type Texts } from './en.tsx';

export type Lang = 'en' | 'da';
export type { Texts };

export const LANGS: readonly Lang[] = ['en', 'da'];
const DICTIONARIES: Record<Lang, Texts> = { en, da };
const STORAGE_KEY = 'lang';

/** The saved choice if valid, else the first device language the site has, else English. */
export function detectLang(saved: string | null, languages: readonly string[]): Lang {
  if (saved === 'en' || saved === 'da') return saved;
  for (const tag of languages) {
    const base = tag.toLowerCase().split('-')[0];
    if (base === 'da' || base === 'en') return base;
  }
  return 'en';
}

function readSaved(): string | null {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

function deviceLanguages(): readonly string[] {
  if (typeof navigator === 'undefined') return [];
  return navigator.languages?.length ? navigator.languages : navigator.language ? [navigator.language] : [];
}

export let lang: Lang = detectLang(readSaved(), deviceLanguages());
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
