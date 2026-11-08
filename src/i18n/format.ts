/** Numbers, lists and dates in either language. Pure: the language is always given. */
export type Language = 'en' | 'da';

const LOCALE: Record<Language, string> = { en: 'en-GB', da: 'da-DK' };

/** One decimal, without a trailing ".0": "5.6" and "5,6". */
export function decimal(n: number, language: Language): string {
  const rounded = Math.round(n * 10) / 10;
  const text = Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1);
  return language === 'da' ? text.replace('.', ',') : text;
}

/** "62%" and "62 %" (Danish puts a space before the sign; a no-break one, so it never wraps). */
export function percent(rate: number | null, language: Language): string {
  if (rate === null) return '–';
  const value = Math.round(rate * 100);
  return language === 'da' ? `${value} %` : `${value}%`;
}

/** "1st", "2nd" and "1.", "2." */
export function ordinal(n: number, language: Language): string {
  if (language === 'da') return `${n}.`;
  const tail = n % 100 >= 11 && n % 100 <= 13 ? 'th' : (['th', 'st', 'nd', 'rd'][n % 10] ?? 'th');
  return `${n}${tail}`;
}

/** "A, B and C" and "A, B og C". */
export function list(names: readonly string[], language: Language): string {
  if (names.length <= 1) return names.join('');
  return `${names.slice(0, -1).join(', ')} ${language === 'da' ? 'og' : 'and'} ${names[names.length - 1]}`;
}

/** "1 match", "3 matches": `one` for exactly 1, `other` otherwise (the same rule in Danish). */
export function plural(n: number, one: string, other: string): string {
  return `${n} ${n === 1 ? one : other}`;
}

/** "+12", "−5" (with a real minus sign), "±0". */
export function signed(n: number): string {
  return n > 0 ? `+${n}` : n < 0 ? `−${Math.abs(n)}` : '±0';
}

const formats = new Map<string, Intl.DateTimeFormat>();
function dateFormat(language: Language, options: Intl.DateTimeFormatOptions): Intl.DateTimeFormat {
  const key = `${language}:${JSON.stringify(options)}`;
  let format = formats.get(key);
  if (!format) {
    format = new Intl.DateTimeFormat(LOCALE[language], options);
    formats.set(key, format);
  }
  return format;
}

/** Parses `YYYY-MM-DD` or `YYYY-MM-DDTHH:mm` as a local date. */
export function parseLocal(date: string): Date {
  const [day, time = '00:00'] = date.split('T');
  const [y, m, d] = day.split('-').map(Number);
  const [hh, mm] = time.split(':').map(Number);
  return new Date(y, m - 1, d, hh, mm);
}

/** "Sat 7 Nov" and "lør. 7. nov." */
export function weekdayDate(date: string, language: Language): string {
  return dateFormat(language, { weekday: 'short', day: 'numeric', month: 'short' }).format(parseLocal(date));
}

/** "Saturday 7 November 2026" and "lørdag den 7. november 2026". */
export function longDate(date: string, language: Language): string {
  return dateFormat(language, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }).format(parseLocal(date));
}

/** "12 Oct 2025" and "12. okt. 2025" */
export function dayDate(date: string, language: Language): string {
  return dateFormat(language, { day: 'numeric', month: 'short', year: 'numeric' }).format(parseLocal(date));
}

/** "7 Nov" and "7. nov." */
export function shortDate(date: string, language: Language): string {
  return dateFormat(language, { day: 'numeric', month: 'short' }).format(parseLocal(date));
}
