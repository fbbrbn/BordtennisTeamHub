/** Number and list formatting in the site's current language (src/i18n). */
import { decimal, list, ordinal as ordinalIn, percent as percentIn } from '../i18n/format';
import { lang } from '../i18n';

export { signed } from '../i18n/format';

/** "1st" and "1." */
export function ordinal(n: number): string {
  return ordinalIn(n, lang);
}

/** One decimal, without a trailing ".0": "5.6" and "5,6". */
export function oneDecimal(n: number): string {
  return decimal(n, lang);
}

export function percent(rate: number | null): string {
  return percentIn(rate, lang);
}

/** "A, B and C" and "A, B og C". */
export function listNames(names: string[]): string {
  return list(names, lang);
}
