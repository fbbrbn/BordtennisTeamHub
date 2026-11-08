import { afterEach, describe, expect, it } from 'vitest';
import { oneDecimal, ordinal as currentOrdinal, percent as currentPercent } from '../lib/text';
import { da } from './da';
import { en } from './en';
import { dayDate, decimal, list, longDate, ordinal, percent, plural, shortDate, signed, weekdayDate } from './format';
import { detectLang, lang, setLang, t } from '.';

afterEach(() => setLang('da', false));

describe('choosing the language', () => {
  it('is Danish unless the visitor chose English', () => {
    expect(detectLang(null)).toBe('da');
    expect(detectLang('en')).toBe('en');
    expect(detectLang('da')).toBe('da');
    expect(detectLang('fr')).toBe('da');
  });

  it('switches every text and number at once', () => {
    setLang('da', false);
    expect(lang).toBe('da');
    expect(t.nav.home).toBe('Forside');
    expect(oneDecimal(5.55)).toBe('5,6');
    expect(currentPercent(0.62)).toBe('62 %');
    expect(currentOrdinal(2)).toBe('2.');
    setLang('en', false);
    expect(t.nav.home).toBe('Home');
    expect(oneDecimal(5.55)).toBe('5.6');
  });
});

describe('formats', () => {
  it('writes dates the Danish way', () => {
    expect(weekdayDate('2026-11-04T19:00', 'da')).toBe('ons. 4. nov.');
    expect(longDate('2026-11-04T19:00', 'da')).toBe('onsdag den 4. november 2026');
    expect(shortDate('2026-10-23', 'da')).toBe('23. okt.');
    expect(dayDate('2025-10-12', 'da')).toBe('12. okt. 2025');
    expect(dayDate('2025-10-12', 'en')).toBe('12 Oct 2025');
    expect(weekdayDate('2026-11-04T19:00', 'en')).toBe('Wed 4 Nov');
  });

  it('writes numbers, ordinals, lists and plurals in both languages', () => {
    expect(decimal(5.6, 'da')).toBe('5,6');
    expect(decimal(4, 'da')).toBe('4');
    expect(percent(0.455, 'en')).toBe('46%');
    expect(percent(null, 'da')).toBe('–');
    expect(ordinal(1, 'en')).toBe('1st');
    expect(ordinal(12, 'en')).toBe('12th');
    expect(ordinal(23, 'da')).toBe('23.');
    expect(list(['Ann', 'Bo', 'Al'], 'da')).toBe('Ann, Bo og Al');
    expect(list(['Ann'], 'en')).toBe('Ann');
    expect(plural(1, 'kamp', 'kampe')).toBe('1 kamp');
    expect(signed(-5)).toBe('−5');
    expect([da.n.matches(3), da.n.teams(2), da.n.clubs(2), da.n.points(1)]).toEqual(['3 kampe', '2 hold', '2 klubber', '1 point']);
  });
});

describe('the dictionaries', () => {
  /** Lists (rules, steps, legend labels) must have as many entries in Danish as in English. */
  function lists(value: unknown, path = ''): [string, number][] {
    if (Array.isArray(value)) return [[path, value.length]];
    if (value && typeof value === 'object' && !('$$typeof' in value)) {
      return Object.entries(value).flatMap(([key, v]) => lists(v, `${path}.${key}`));
    }
    return [];
  }

  it('have lists of the same length', () => {
    expect(lists(da)).toEqual(lists(en));
  });

  it('have no empty text', () => {
    const empty = (value: unknown, path = ''): string[] =>
      typeof value === 'string'
        ? value.trim() === '' ? [path] : []
        : value && typeof value === 'object' && !('$$typeof' in value)
          ? Object.entries(value).flatMap(([key, v]) => empty(v, `${path}.${key}`))
          : [];
    expect(empty(da)).toEqual([]);
  });
});
