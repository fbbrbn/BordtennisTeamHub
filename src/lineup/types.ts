/**
 * Answer a player gave for one match, shown as "I can" (`yes`), "Maybe" and "I can't" (`no`).
 * `unknown` means no answer yet: such a player is never planned for that match.
 */
export type Availability = 'yes' | 'maybe' | 'no' | 'unknown';

/** Captain's manual decision for one player in one match; absent means "let the planner decide". */
export type Override = 'in' | 'out';

export interface RosterPlayer {
  id: string;
  name: string;
  /** Rating from the portal, when known. Used to order a lineup strongest first. */
  rating?: number;
  /** Inactive players (injured, left the team) keep their history but are not planned. */
  active: boolean;
  /** Player id on bordtennisportalen.dk, once the roster is linked to match data. */
  portalId?: string;
}

export interface Fixture {
  id: string;
  /** Local date and time, `YYYY-MM-DDTHH:mm`. */
  date: string;
  opponent: string;
  home: boolean;
  /** Match id on bordtennisportalen.dk, once fixtures are linked to match data. */
  portalId?: string;
  /** Who actually played. Setting this marks the match as played. */
  playedBy?: string[];
}

export interface PlannerSettings {
  playersPerMatch: number;
}

export interface PlannerState {
  version: 1;
  teamName: string;
  settings: PlannerSettings;
  players: RosterPlayer[];
  fixtures: Fixture[];
  /** fixtureId -> playerId -> answer */
  availability: Record<string, Record<string, Availability>>;
  /** fixtureId -> playerId -> captain override */
  overrides: Record<string, Record<string, Override>>;
}

export interface FixturePlan {
  fixture: Fixture;
  status: 'played' | 'planned';
  /** Player ids in the lineup, strongest first when ratings are known. */
  lineup: string[];
  /** Players who can play but are not in the lineup, best replacement first. */
  reserves: string[];
  /** Active players who have not answered for this match yet. */
  unanswered: string[];
  /** Open slots nobody could fill. */
  missing: number;
  /** Players forced in beyond the number of slots. */
  surplus: number;
  /** Players forced in although they said they cannot play. */
  conflicts: string[];
}

export interface PlayerTally {
  playerId: string;
  played: number;
  planned: number;
  total: number;
  /** Even share of the matches played so far among active players; null for inactive players. */
  fairShare: number | null;
}

export interface Plan {
  /** All fixtures, chronological. */
  fixtures: FixturePlan[];
  /** One entry per roster player, in roster order. */
  tallies: PlayerTally[];
}
