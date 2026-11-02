/**
 * Normalized match data. The importer in `scraper/` writes it as JSON under
 * `public/data/`; the site reads it from `data/` next to the page.
 *
 * Only public sports data is stored: names, internal portal ids, ratings and
 * results. Never player numbers (they encode birth dates) or contact details.
 */

export interface DataIndex {
  version: 1;
  updatedAt: string;
  /** When the list of pools was last discovered from the portal. */
  discoveredAt?: string;
  season?: NamedId;
  regions?: NamedId[];
  ageGroups?: NamedId[];
  clubs?: ClubRef[];
  pools: PoolRef[];
}

export interface NamedId {
  id: string;
  name: string;
}

export interface ClubRef {
  /** URL key, from `clubSlug(name)`. */
  slug: string;
  name: string;
  /** Club id on bordtennisportalen.dk, when the name matched its club list. */
  id: string | null;
}

export interface PoolInfo {
  /** leagueGroupID on bordtennisportalen.dk */
  id: string;
  seasonId: string;
  /** e.g. "2026/2027" */
  season: string;
  regionId: string;
  ageGroupId: string;
  /** e.g. "ØST Senior 2026/2027" */
  league: string;
  /** e.g. "Serie 4 Pulje 4" */
  name: string;
  regionName?: string;
  ageGroupName?: string;
  updatedAt: string;
}

export interface PoolRef extends PoolInfo {
  teams: IndexTeam[];
}

export interface TeamRef {
  /** leagueGroupTeamID on bordtennisportalen.dk */
  id: string;
  name: string;
  /** Club name, e.g. "Vallensbæk BTK" for "Vallensbæk BTK 3". */
  club?: string;
}

/** A team in the index, with its current place in the table. */
export interface IndexTeam extends TeamRef {
  position: number | null;
  points: number | null;
  played: number | null;
}

export interface PoolData {
  version: 1;
  pool: PoolInfo;
  teams: TeamRef[];
  standings: Standing[];
  matches: TeamMatch[];
  players: Player[];
}

export interface Standing {
  position: number;
  teamId: string;
  played: number;
  won: number;
  drawn: number;
  lost: number;
  gamesFor: number;
  gamesAgainst: number;
  points: number;
}

export interface TeamMatch {
  /** leagueMatchID (the portal's match number) */
  id: string;
  /** Local time, `YYYY-MM-DDTHH:mm` */
  date: string;
  homeTeamId: string;
  awayTeamId: string;
  venue: string;
  /** Games won, home first. Null until the match is played. */
  score: [number, number] | null;
  /** League points, home first. Null until the match is played. */
  points: [number, number] | null;
  walkover: boolean;
  /** Individual games. Null when not played or not fetched yet. */
  games: Game[] | null;
}

export interface Game {
  /** As printed on the portal, e.g. "1. HD" or "A1/B2". */
  label: string;
  kind: 'single' | 'double';
  /** Player ids, home side. */
  home: string[];
  /** Player ids, away side. */
  away: string[];
  /** Sets won, home first. */
  sets: [number, number];
  winner: 'home' | 'away' | null;
  walkover: boolean;
}

export interface Player {
  /** Player id on bordtennisportalen.dk */
  id: string;
  name: string;
  /** Team the player plays for in this pool, when known. */
  teamId: string | null;
  rating: number | null;
}
