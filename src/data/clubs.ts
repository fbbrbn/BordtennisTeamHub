/**
 * Clubs. Team names are "<club> <team number>", e.g. "Vallensbæk BTK 3" or "B 77 5".
 * The importer matches them against the portal's official club list; when no club
 * matches, the trailing team number is dropped instead.
 */
export interface Club {
  id: string;
  name: string;
}

/** A team number, optionally followed by a bracketed tag such as "(N)" or "(I.O)" used in the national leagues. */
const TEAM_SUFFIX = /^(?: \d{1,3})?(?: \([^)]*\))?$/;

export function fallbackClubName(teamName: string): string {
  const name = teamName.trim().replace(/\s+/g, ' ').replace(/\s*\([^)]*\)$/, '');
  return /^(.*\S)\s+\d{1,3}$/.exec(name)?.[1] ?? name;
}

/** The official club whose name is the longest prefix of the team name, followed by a team number, a tag or nothing. */
export function clubOf(teamName: string, clubs: readonly Club[]): { name: string; id: string | null } {
  const name = teamName.trim().replace(/\s+/g, ' ');
  const lower = name.toLocaleLowerCase('da');
  let best: Club | null = null;
  for (const club of clubs) {
    const prefix = club.name.toLocaleLowerCase('da');
    const rest = lower.slice(prefix.length);
    if (lower.startsWith(prefix) && TEAM_SUFFIX.test(rest) && (!best || club.name.length > best.name.length)) {
      best = club;
    }
  }
  return best ? { name: best.name, id: best.id } : { name: fallbackClubName(name), id: null };
}

/** URL-friendly key for a club name. */
export function clubSlug(name: string): string {
  return (
    name
      .toLocaleLowerCase('da')
      .replace(/æ/g, 'ae')
      .replace(/ø/g, 'oe')
      .replace(/å/g, 'aa')
      .normalize('NFKD')
      .replace(/[̀-ͯ]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '') || 'club'
  );
}
