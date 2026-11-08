/**
 * Every text of the site in English, the second language (Danish, in da.tsx, is the first). This file
 * sets the shape both follow: keep them in step. Plain strings where nothing varies; functions where
 * numbers, names or links go in.
 */
import type { ReactNode } from 'react';
import { decimal, list, ordinal, percent, plural } from './format.ts';

export type Thing = 'team' | 'player' | 'pool' | 'club' | 'match';
const THIS: Record<Thing, string> = { team: 'this team', player: 'this player', pool: 'this pool', club: 'this club', match: 'this match' };

const pct = (rate: number | null) => percent(rate, 'en');
const dec = (n: number) => decimal(n, 'en');
const ord = (n: number) => ordinal(n, 'en');
const names = (items: readonly string[]) => list(items, 'en');
/** "1 more game", "2.5 more games" */
const games = (n: number) => (Math.abs(n) === 1 ? 'game' : 'games');

export const en = {
  language: { label: 'Language', en: 'English', da: 'Dansk' },

  app: {
    back: 'Back',
    footer:
      'Unofficial tool, not affiliated with DBTU or bordtennisportalen.dk. Results come from bordtennisportalen.dk and are refreshed several times a day, hourly on match evenings. Lineup plans and followed teams are saved in your browser.',
  },

  nav: {
    main: 'Main',
    home: 'Home',
    myTeam: 'My team',
    lineup: 'Lineup',
    followFirst: 'Find and follow your team first',
    plannerFor: (team: string) => `Lineup planner for ${team}`,
    planner: 'Lineup planner',
  },

  states: {
    loading: (thing: Thing) => `Loading ${THIS[thing]}…`,
    failed: (thing: Thing) => `Could not load ${THIS[thing]}. Check your connection and try again.`,
    notFound: 'Not found',
    noData: (thing: Thing) => `There is no data for ${THIS[thing]} yet. Only imported pools are available.`,
    backToStart: 'Back to start',
    loadingShort: 'Loading…',
    unavailable: 'Not available right now',
  },

  /** Words used on many pages. */
  common: {
    home: 'Home',
    away: 'Away',
    vs: 'vs',
    won: 'Won',
    draw: 'Draw',
    lost: 'Lost',
    unrated: 'unrated',
    unknownPlayer: 'Unknown player',
    unknownTeam: 'Unknown team',
    team: 'Team',
    player: 'Player',
    players: 'Players',
    rating: 'Rating',
    singles: 'Singles',
    doubles: 'Doubles',
    sets: 'Sets',
    date: 'Date',
    against: 'Against',
    result: 'Result',
    points: 'Points',
    results: 'Results',
    insights: 'Insights',
    openOnPortal: 'Open on bordtennisportalen.dk',
    showAsTable: 'Show as table',
    howWorkedOut: 'How is this worked out?',
    pastSeason: 'Past season',
    planLineup: 'Plan lineup',
    played: (n: number) => `${n} played`,
    wonShare: (rate: number | null) => `${pct(rate)} won`,
    meterLabel: (label: string, rate: number | null) => `${label}: ${pct(rate)} won`,
    ratingOf: (rating: number) => `rating ${rating}`,
    andJoin: ' & ',
  },

  /** Counted nouns: "1 match", "3 matches". */
  n: {
    matches: (n: number) => plural(n, 'match', 'matches'),
    teamMatches: (n: number) => plural(n, 'team match', 'team matches'),
    teams: (n: number) => plural(n, 'team', 'teams'),
    clubs: (n: number) => plural(n, 'club', 'clubs'),
    pools: (n: number) => plural(n, 'pool', 'pools'),
    players: (n: number) => plural(n, 'player', 'players'),
    points: (n: number) => plural(n, 'point', 'points'),
    pts: (n: number) => plural(n, 'pt', 'pts'),
    seasons: (n: number) => plural(n, 'season', 'seasons'),
    singles: (n: number) => plural(n, 'single', 'singles'),
    singlesGames: (n: number) => plural(n, 'singles game', 'singles games'),
    games: (n: number) => plural(n, 'game', 'games'),
  },

  odds: {
    win: 'Win',
    draw: 'Draw',
    loss: 'Loss',
    summary: (win: number, draw: number, loss: number, drawPossible: boolean) =>
      drawPossible ? `Win ${pct(win)}, draw ${pct(draw)}, loss ${pct(loss)}` : `Win ${pct(win)}, loss ${pct(loss)}`,
    /** After the bold win share: "45% chance to win, 22% to draw." */
    sentence: (draw: number, drawPossible: boolean) => (drawPossible ? `chance to win, ${pct(draw)} to draw.` : 'chance to win.'),
    chanceToWin: 'chance to win',
    winShort: (win: number) => `${pct(win)} win`,
  },

  prediction: {
    line: (home: number, away: number, win: number) => `Predicted ${dec(home)}–${dec(away)}, ${pct(win)} to win`,
    record: (right: number, matches: number) => `Predicted before each match: right in ${right} of ${matches}`,
    recordNote:
      "Each played match keeps the prediction made from what was known before its day: the official rating list of that day, the earlier results, and each player's form until then. “Right” means the likeliest outcome happened. A team that had not played in the pool yet borrows its lineups from an earlier pool this season or from last season. Matches without a prediction had a team with no lineups to borrow.",
    /** Why the chances of a match rest on borrowed lineups (MatchPrediction.lineups). */
    borrowed: {
      season:
        'At least one of the teams has not played in this pool yet, so the chances use its lineups from an earlier pool this season, pulled a little towards even.',
      'last-season':
        "At least one of the teams has not played in this pool yet, so the chances use its lineups from last season. They are pulled halfway towards even, as only about half of a team's players are usually the same from one season to the next.",
    },
  },

  follow: {
    follow: 'Follow',
    following: 'Following',
    titleOn: 'Shown first on the start page. Tap to stop following.',
    titleOff: 'Show this team first on the start page',
  },

  ratings: {
    /** "list of 23 Oct, which includes games up to 14 Oct" */
    listNote: (listDate: string, ratedThrough: string) => `list of ${listDate}, which includes games up to ${ratedThrough}`,
    forecastTitle: 'Rating forecast',
    forecastHeadline: (rating: number, change: string, games: number) => (
      <>
        <strong>{rating}</strong> ({change}) once {plural(games, 'singles game', 'singles games')} since the official list are rated.
      </>
    ),
    official: (rating: number, note: string) => `Official rating ${rating}, from the ${note}.`,
    ratedAt: (rating: number) => `Rated ${rating}`,
    rules: [
      "Each singles game moves both players' ratings by a set number of points, from the rating gap and who won. Beating a higher-rated player earns the most.",
      'All games of a match day use the ratings from before that day.',
      'Doubles and walkovers do not count. Tournament games and games against unrated players are not included here, so the official rating can differ.',
    ],
    tableCaption: 'Points by rating gap',
    gap: 'Gap',
    higherRated: 'Higher rated',
    lowerRated: 'Lower rated',
    wins: 'wins',
    loses: 'loses',
    rulesNote: 'Read from rated games on bordtennisportalen.dk. This is an estimate, not the official calculation.',
    forecastNote: (note: string) => `→ Forecast: the rating once the singles played since the official ${note} are rated.`,
    forecastTitleShort: 'Forecast',
    forecastDetail: (rating: number, change: string) => `Forecast ${rating} (${change})`,
  },

  history: {
    tab: 'History',
    linkSummary: (seasons: number, since: string) => `· ${plural(seasons, 'season', 'seasons')} since ${since}`,
    loading: 'Loading the history…',
    empty: 'No seasons found yet. Past seasons are added as the import works back to 2011/2012.',
    startOf: (season: string) => `Start of ${season}`,
    now: 'Now',
    nowTitle: 'Official rating now',
    next: 'Next',
    nextTitle: 'Forecast, once the games played are rated',
    seasons: 'Seasons',
    since: (season: string) => `since ${season}`,
    singlesWonLost: 'Singles won and lost',
    teamMatches: 'Team matches',
    clubs: (n: number): string => (n === 1 ? 'Club' : 'Clubs'),
    overSeasons: 'Rating over the seasons',
    overSeasonsNote: (withToday: boolean) => `The official rating when each season started${withToday ? ', then today' : ''}.`,
    everySeason: 'Every season',
    tapScore: 'Tap a score for the games of that season.',
    about: 'About these numbers',
    aboutNote:
      'Team-tournament matches only, from bordtennisportalen.dk; tournaments are not included. The rating is the official one when the pool started. Earlier seasons are added as the import works back in time, to 2011/2012.',
    thisPage: ' · this page',
    scoreLabel: (season: string, won: number, lost: number) => `Games in ${season}: singles ${won} won, ${lost} lost`,
    singles: 'singles',
  },

  start: {
    welcomeBack: 'Welcome back',
    findTeam: 'Find your team',
    intro: 'Results, chances and lineup planning for every team in the Danish table tennis team tournament.',
    myTeams: 'My teams',
    continueWith: (team: ReactNode) => <>Continue with {team}</>,
    followHint: 'Follow it to keep it at the top of this page, with its next match.',
    howItWorks: 'How it works',
    steps: [
      <>
        <strong>Find your team</strong> by club, team or player name below.
      </>,
      <>
        <strong>Follow it</strong> with ☆ so it is always here, with its next match and your chances.
      </>,
      <>
        <strong>Plan your lineup</strong>: mark who can play, and the planner keeps the matches fair for everyone.
      </>,
    ],
    findHeading: 'Find a club, team or player',
    loadingClubs: 'Loading clubs…',
    clubsUnavailable: 'Club data is not available right now.',
    notListed: 'Planning for a team that is not listed?',
    notListedNote: 'The lineup planner also works by hand: add your players and matches yourself.',
    unnamedTeam: 'Unnamed team',
    planByHand: 'Plan by hand',
    planAnother: 'Plan another team by hand',
    standing: (position: number, teams: number, points: number) => ` · ${ord(position)} of ${teams}, ${plural(points, 'point', 'points')}`,
    next: (day: string, time: string) => `Next: ${day} · ${time}`,
    opponent: 'opponent',
    noMoreMatches: 'No more matches this season.',
    teamPage: 'Team page',
    searching: 'Searching…',
    nothingMatches: (query: string) => `Nothing matches “${query}”. Try part of a club, team or player name.`,
    searchLabel: 'Club, team or player',
    searchPlaceholder: 'Search, e.g. Vallensbæk',
    region: 'Region',
    allRegions: 'All regions',
    ageGroup: 'Age group',
    allAgeGroups: 'All age groups',
    showMore: (left: number) => `Show more (${left} left)`,
    showMorePlayers: (left: number) => `Show more players (${left} left)`,
    season: (name: string) => ` · season ${name}`,
    showFewerClubs: 'Show fewer clubs',
    showAllClubs: (n: number) => `Show all ${n} clubs`,
  },

  team: {
    tabs: { overview: 'Overview', matches: 'Matches', players: 'Players' },
    tabsLabel: 'Team pages',
    onPortal: 'See this team on bordtennisportalen.dk',
    position: 'Position',
    ofTeams: (n: number) => `of ${n} teams`,
    afterMatches: (n: number) => `after ${plural(n, 'match', 'matches')}`,
    wonDrawnLost: 'Won, drawn, lost',
    gamesWonLost: 'Games won and lost',
    nextMatch: 'Next match',
    theOpponent: 'the opponent',
    whyChances: 'Why these chances?',
    plannedLineup: (players: string) => `Using the lineup from your planner: ${players}.`,
    seasonLineups: 'Based on the lineups both teams have used this season. Mark who can play in the planner to use your real lineup.',
    preview: 'Preview and try lineups',
    moreInsights: (n: number) => `${n} more insight${n === 1 ? '' : 's'}`,
    pointsRace: 'Points over the season',
    pointsRaceNote: 'League points after each match, compared with the rest of the pool.',
    comingUp: 'Coming up',
    left: (n: number) => `${n} left`,
    comingUpNote: 'Chance to win each match. Tap a match for the preview and to try lineups.',
    previewLabel: (win: number) => `Preview: ${pct(win)} chance to win`,
    nonePlayed: 'No matches played yet.',
    scoreLabel: (score: string) => `Games of the match, ${score}`,
    to: ' to ',
    tapName: 'Tap a name for their games and insights',
    noGames: 'No games recorded yet.',
    singlesFor: (name: string) => `Singles for ${name}`,
  },

  player: {
    tabsLabel: 'Player pages',
    thisSeason: 'This season',
    stripWon: (sets: string, name: string) => `Won ${sets} against ${name}`,
    stripLost: (sets: string, name: string) => `Lost ${sets} against ${name}`,
    stripRating: (rating: number, team: string) => `Rating ${rating} · ${team}`,
    singlesWonLost: 'Singles won and lost',
    doublesWonLost: 'Doubles won and lost',
    setsWonLost: 'Sets won and lost',
    inMatches: (n: number) => `in ${plural(n, 'match', 'matches')}`,
    byOpponent: 'Singles by opponent rating',
    byOpponentNote: (name: string) =>
      `Wins on the top row, losses below. Dots to the right of the line are opponents rated higher than ${name}.`,
    unratedNotShown: (n: number) => ` ${n} game${n === 1 ? '' : 's'} against unrated opponents not shown.`,
    games: 'Games',
    noGames: 'No games recorded in this pool.',
    /** One doubles game, in a list of games. */
    doubleGame: 'Doubles',
    doublesWith: (partners: string) => ` with ${partners}`,
  },

  club: {
    eyebrow: (season: string | null) => `Club${season ? ` · ${season}` : ''}`,
    teamsInPools: (teams: number, pools: number) => `${plural(teams, 'team', 'teams')} in ${plural(pools, 'pool', 'pools')}`,
    of: (teams: number, points: number) => ` of ${teams} · ${plural(points, 'pt', 'pts')}`,
    notStarted: 'Not started',
  },

  pool: {
    standings: 'Standings',
    columns: {
      matches: ['M', 'Matches'],
      won: ['W', 'Won'],
      drawn: ['D', 'Drawn'],
      lost: ['L', 'Lost'],
      games: 'Games',
      points: 'Points',
      projected: ['Proj.', 'Projected final points'],
    },
    projectedNote:
      'Proj.: projected final points, with the projected position under them. It adds up the win and draw chances of every remaining match, assuming each team fields lineups it has used this season.',
    playedOf: (played: number, total: number) => `${played} of ${plural(total, 'match', 'matches')} played`,
    showFewer: 'Show fewer',
    showAllResults: (n: number) => `Show all ${n} results`,
    nextMatches: 'Next matches',
    sortedBySingles: 'Sorted by singles won',
    wonColumn: 'Won',
  },

  match: {
    noPlayer: 'No player',
    eyebrow: (id: string) => `Match ${id}`,
    walkover: ' · walkover',
    games: 'Games',
    gamesUnavailable: 'The games of this match are not available yet.',
    game: 'Game',
    wo: ' (w.o.)',
    wonSr: ' (won)',
    predictionTitle: 'Prediction and result',
    predictionHeadline: (win: ReactNode, home: string, draw: string | null) => (
      <>
        {win} chance for {home} to win{draw ? `, ${draw} to draw` : ''}, before the match.
      </>
    ),
    winFor: (team: string) => `a win for ${team}`,
    aDraw: 'a draw',
    expectedEnded: (expected: ReactNode, ended: ReactNode) => (
      <>
        Expected score {expected}; it ended {ended}.
      </>
    ),
    likeliestHappened: (outcome: string) => `The likeliest outcome, ${outcome}, happened.`,
    notLikeliest: (outcome: string) => `Not the likeliest outcome: the prediction favoured ${outcome}.`,
    howPredicted: 'How was this predicted?',
    howPredictedNote: (home: string) =>
      `From what was known before the match day: the official rating list in force that day, the results of earlier matches (for the lineups both teams had used and for common opponents) and each player's form until then. Win, draw and loss are from ${home}'s side.`,
    ratingPoints: 'Rating points',
    ratingPointsNote: (note: string) =>
      `Estimated: this match is not in the official ratings yet (${note}). Before is the rating going into the match, after any earlier games the list does not include.`,
    before: 'Before',
  },

  preview: {
    chances: 'Chances',
    showFor: 'Show chances for',
    headline: (team: string, win: ReactNode, sentence: string, expected: string) => (
      <>
        {team}: {win} {sentence} Expected score {expected}.
      </>
    ),
    notEnough: 'Not enough results yet to estimate this match.',
    reasonRatings: 'Player ratings.',
    reasonForm: 'Form and home table.',
    reasonCommon: 'Common opponents.',
    lineups: 'Lineups',
    tryLineup: 'Try a lineup: the chances above update straight away.',
    tryLineupStored: 'The chances above stay as they are until both teams have played in the pool.',
    statusSeason: 'Using the lineups from this season. Tap players to pick your own.',
    statusNoPlayers: 'Has not played in this pool yet, so there are no players to pick.',
    statusPickMore: (n: number) => `Pick ${n} more. Until then, the lineups from this season are used.`,
    statusPlanned: 'Lineup from your planner.',
    statusYours: 'Your lineup.',
    backToSeason: "Back to this season's lineups",
    grid: 'Your players against theirs',
    gridNote: (team: string, columns: string) => `Chance that each ${team} player wins a singles, from the ratings, form and home table. Columns: ${columns}.`,
    columnsPicked: (team: string) => `the ${team} lineup you picked`,
    columnsUsual: (team: string) => `${team}'s most-used players`,
    gridPlayer: (team: string) => `${team} player`,
    /** Head-to-head records (src/data/headtohead.ts), from our player's side. */
    h2hSr: 'Head-to-head:',
    h2hNote: (from: string) => `Under a chance: the two players' singles against each other since ${from}, won–lost.`,
    h2hAll: (pairs: number) => `${pairs === 1 ? '1 pair of players has' : `${pairs} pairs of players have`} met before`,
    h2hItem: (player: string, opponent: string, won: number, lost: number, last: string, lastWon: boolean) =>
      `${player} v ${opponent}: ${won}–${lost}, ${won + lost === 1 ? '' : 'most recently '}${lastWon ? 'a win' : 'a loss'} on ${last}`,
    heat: ['Clear underdog', 'Underdog', 'Even', 'Favourite', 'Clear favourite'],
    commonTitle: 'Common opponents',
    commonNote: (team: string) => `How both teams did against the same teams. Difference: games per match, from ${team}'s side.`,
    difference: 'Difference',
    eachOther: 'Each other',
    howWorkedOut:
      "Each game gets a chance from the rating gap, calibrated on this pool's singles. Then come the things the ratings miss, checked on every match of the last three seasons: each player's singles this season, in every pool, against what their rating expected (last season counts a third as much); youth players, who improve faster than the rating list; unrated players, who are weaker than the pool's median rating they stand in for; and the home table, except in veteran pools. Common opponents count a quarter. Estimates, not certainties.",
  },

  reasons: {
    noRatings: 'Not enough games yet to compare the players.',
    aboutEven: 'about even',
    stronger: (_team: string, points: number) => `${points} points stronger`,
    weaker: (_team: string, points: number) => `${points} points weaker`,
    lineupAverage: (team: string, average: number) => `${team}'s lineup averages ${average}`,
    lineupsAverage: (team: string, average: number) => `${team}'s lineups this season average ${average}`,
    ratings: (ours: string, theirs: string, balance: string, win: number) => `${ours}; ${theirs}: ${balance}. Ratings alone give ${pct(win)} to win.`,
    noCommon: 'No common opponents yet, so this part is left out.',
    commonOpponents: (n: number) => plural(n, 'common opponent', 'common opponents'),
    earlierMeeting: 'their earlier meeting',
    asWell: 'about as well as them',
    better: (margin: number) => `${dec(margin)} ${games(margin)} per match better`,
    worse: (margin: number) => `${dec(margin)} ${games(margin)} per match worse`,
    common: (what: string, team: string, how: string, win: number) => `Based on ${what}, ${team} did ${how}. That alone gives ${pct(win)} to win.`,
    atHome: (team: string, points: number) => `${team} plays at home: about +${points} rating points a game.`,
    noHomeEdge: 'No home edge in veteran pools.',
    youth: ' (youth)',
    unrated: ' (unrated)',
    forTeam: (players: string, team: string) => `${players} for ${team}`,
    formList: (lists: string) => `Form against rating: ${lists}.`,
    noForm: 'No player is far from their rating.',
    hardlyChange: 'Together they hardly change the chances.',
    withThese: (after: number, before: number) => `With these, the ratings give ${pct(after)} instead of ${pct(before)}.`,
  },

  insights: {
    topics: {
      table: 'Table',
      outlook: 'Outlook',
      bestLineup: 'Best lineup',
      standout: 'Standout',
      form: 'Form',
      closeGames: 'Close games',
      doubles: 'Doubles',
      bestWin: 'Best win',
      upsetLoss: 'Upset loss',
    },
    place: (position: number, teams: number, points: number) => `${ord(position)} of ${teams} with ${plural(points, 'point', 'points')}.`,
    levelWith: (teams: readonly string[]) => `Level with ${names(teams)}.`,
    behind: (points: number, team: string, position: number) => `${plural(points, 'point', 'points')} behind ${team} (${ord(position)}).`,
    top: 'Top of the table.',
    ahead: (points: number, team: string) => `${plural(points, 'point', 'points')} ahead of ${team}.`,
    teamForm: (matches: number, won: number, expected: number) =>
      `In ${plural(matches, 'match', 'matches')} the team won ${plural(won, 'game', 'games')}; the players' ratings predicted ${dec(expected)}.`,
    moreGames: (diff: number) => `That is ${dec(diff)} more ${games(diff)} than expected: playing above the ratings.`,
    fewerGames: (diff: number) => `That is ${dec(diff)} fewer ${games(diff)} than expected.`,
    moreWins: (diff: number) => `That is ${dec(diff)} more ${Math.abs(diff) === 1 ? 'win' : 'wins'} than expected: playing above the ratings.`,
    fewerWins: (diff: number) => `That is ${dec(diff)} fewer ${Math.abs(diff) === 1 ? 'win' : 'wins'} than expected.`,
    asExpected: 'About as expected.',
    fifthSets: (won: number, lost: number) => `Singles that went to a fifth set: won ${won}, lost ${lost}.`,
    doubles: (won: number, played: number, best: boolean, pair: readonly string[], pairWon: number, pairLost: number) =>
      `Doubles won: ${won} of ${played}. ${best ? 'Best pair' : 'Most used pair'}: ${names(pair)} (${pairWon}–${pairLost}).`,
    standout: (name: string, won: number, singles: number, above: number) =>
      `${name} has won ${won} of ${plural(singles, 'single', 'singles')}, ${dec(above)} more than the rating predicts.`,
    outlook: (favourite: number, remaining: number, projected: number, rank: number) =>
      `${
        remaining === 1
          ? favourite === 1
            ? 'Favourite in the last match.'
            : 'Not favourite in the last match.'
          : `Favourite in ${favourite} of the ${remaining} remaining matches.`
      } Projected finish: about ${plural(projected, 'point', 'points')}, ${ord(rank)} place (assuming each team fields lineups it has used this season).`,
    bestLineup: (size: number, players: readonly string[], favourite: number, remaining: number) =>
      `With its ${plural(size, 'highest-rated player', 'highest-rated players')} (${names(players)}), the team would ${
        remaining === 1 ? (favourite === 1 ? 'be favourite in the last match' : 'not be favourite in the last match') : `be favourite in ${favourite} of the ${remaining}`
      }.`,
    playerForm: (won: number, singles: number, expected: number) =>
      `Won ${won} of ${plural(singles, 'single', 'singles')}; the ratings predicted ${dec(expected)}.`,
    playerFifthSets: (won: number, played: number) => `Fifth sets: won ${won} of ${played}.`,
    bestWin: (name: string, rating: number, sets: string, gap: number) => `${name} (${rating}), ${sets}.${gap > 0 ? ` An upset: rated ${gap} higher.` : ''}`,
    upsetLoss: (name: string, rating: number, sets: string, gap: number) => `${name} (${rating}), ${sets}: rated ${gap} lower.`,
    partner: (won: number, lost: number, name: string) => `${won}–${lost} with ${name}`,
  },

  charts: {
    raceLabel: (team: string | null, points: number | null) =>
      `Points after each match. ${team !== null && points !== null ? `${team} has ${points} points. ` : ''}Use the arrow keys to step through matches.`,
    pts: (n: number) => `${n} pts`,
    afterMatch: (n: number) => `After match ${n}`,
    otherTeams: 'Other teams in the pool',
    xAxisMatches: 'Horizontal axis: matches played',
    historyLabel: (from: number, to: number) => `Rating over time, from ${from} to ${to}. Use the arrow keys to step through the points.`,
    forecast: 'forecast',
    rating: 'rating',
    forecastLegend: 'Forecast: once the games already played are rated',
    forecastSuffix: ' (forecast)',
    stripLabel: 'Singles results by opponent rating',
    ownRating: (rating: number) => `Own rating ${rating}`,
    stripNote: "Each dot is one singles game, placed by the opponent's rating. The game list below has every value.",
  },

  planner: {
    title: 'Lineup planner',
    team: 'Team',
    teamPlaceholder: 'Team name, e.g. Vallensbæk BTK 3',
    savingBlocked: 'This browser blocks saving. Download a backup to keep your plan.',
    brokenLink: 'That share link is incomplete or broken.',
    formerPlayer: 'Former player',
    playersPerMatch: 'Players per match',
    linkCopied: 'Share link copied',
    messageCopied: 'Message copied',
    notBackup: 'That file is not a lineup backup.',
    replaceConfirm: 'Replace the current plan with this backup?',
    restored: 'Backup restored',
    unreadable: 'That file could not be read.',
    loadFailed: 'Could not load the latest results. The plan below is the last saved version.',
    linked: (team: ReactNode) => <>Linked to {team}: players, matches and results update by themselves. Just mark who can play.</>,
    yourTeam: 'your team',
    incoming: (team: ReactNode) => <>This link holds a plan for {team} that differs from the one saved on this device.</>,
    aTeam: 'a team',
    useShared: 'Use the shared plan',
    keepMine: 'Keep mine',
    howMade: 'How the plan is made',
    howMade1: (
      <>
        Nobody is planned on guesses. For each match, mark who said <em>I can</em>, <em>Maybe</em> or <em>I can't</em>. Only
        players who said <em>I can</em> or <em>Maybe</em> are picked, and <em>I can</em> goes first.
      </>
    ),
    howMade2: (
      <>
        Among them, the planner picks whoever has played the fewest matches so far. Matches already played count, and so do
        the upcoming matches a player is already picked for. Use <em>Must play</em> or <em>Rest</em> to overrule it for one
        match.
      </>
    ),
    upcoming: 'Upcoming matches',
    addMatch: 'Add match',
    done: 'Done',
    matchAdded: 'Match added',
    noUpcoming: "No upcoming matches yet. Add them from your team's schedule.",
    playedMatches: 'Played matches',
    players: 'Players',
    activeEdit: (n: number) => `${n} active · edit`,
    active: (n: number) => `${n} active`,
    untickNote: 'Untick Active for anyone who should not be planned, for example a reserve.',
    share: 'Share and back up',
    shareNote: 'The plan is saved in this browser only. Send the link in your team chat: whoever opens it gets their own copy.',
    copyLink: 'Copy share link',
    copyMessage: 'Copy message for the team chat',
    download: 'Download backup',
    restore: 'Restore backup',
    copyBlocked: 'Copying is blocked here. Select the text and copy it yourself:',
    status: { plays: 'Plays', reserve: 'Reserve', rest: 'Resting', out: "Can't play", waiting: 'No answer' },
    answers: { yes: 'I can', maybe: 'Maybe', no: "I can't" },
    deleteConfirm: 'Delete this match from the plan?',
    lineup: 'Lineup',
    waitingAnswers: 'Waiting for answers',
    nobodyCan: 'Nobody can play',
    whoCanPlay: 'Who can play?',
    addPlayersFirst: 'Add players to the roster to plan this match.',
    setByCaptain: ' (set by captain)',
    selectionFor: (name: string) => `Selection for ${name}`,
    auto: 'Auto',
    mustPlay: 'Must play',
    rest: 'Rest',
    markPlayed: 'Mark as played',
    noOpponent: 'opponent not set',
    nobodyRecorded: 'Nobody recorded',
    edit: 'Edit',
    whoPlayed: 'Who played?',
    save: 'Save',
    cancel: 'Cancel',
    notPlayedYet: 'Not played yet',
    noAnswersYet: 'No answers yet. Ask the team who can play.',
    stillToAnswer: (open: number, names: string) => `${plural(open, 'place', 'places')} open. Still to answer: ${names}.`,
    everyoneAnswered: (open: number) => `${plural(open, 'place', 'places')} open, and everyone has answered.`,
    surplus: (n: number) => `${n} more ${n === 1 ? 'player is' : 'players are'} set to "Must play" than there are places.`,
    conflicts: (names: string) => `${names} set to "Must play" but said "I can't".`,
    datePassed: 'This date has passed. Mark the match as played to keep the count right.',
    warning: 'Warning: ',
    note: 'Note: ',
    canPlay: (name: string) => `Can ${name} play?`,
    date: 'Date',
    time: 'Time',
    opponent: 'Opponent',
    opponentPlaceholder: 'Club and team number',
    venue: 'Venue',
    saveMatch: 'Save match',
    deleteMatch: 'Delete match',
    balance: 'Season balance',
    evenShare: (share: string) => `Even share so far: ${share} matches each`,
    noneYet: 'No matches played yet',
    playedColumn: 'Played',
    plannedColumn: 'Planned',
    total: 'Total',
    barLabel: 'Total compared with the even share',
    inactive: ' · inactive',
    evenShareLegend: 'Even share so far',
    rosterIntro: "Start with your team's players. Ratings are optional: they only decide the order of names in a lineup.",
    playerName: 'Player name',
    ratingFor: (name: string) => `Rating for ${name}`,
    activeLabel: 'Active',
    remove: 'Remove',
    removeLabel: (name: string) => `Remove ${name}`,
    removeConfirm: (name: string) =>
      `Remove ${name}? Their answers and played matches in this plan are removed too. To keep their history, untick Active instead.`,
    newPlayer: 'New player name',
    addPlayer: 'Add player',
    message: {
      title: (team: string) => `${team}: lineup plan`,
      ourTeam: 'Our team',
      home: 'home',
      away: 'away',
      noAnswers: 'no answers yet',
      noLineup: 'no lineup yet',
      moreNeededWaiting: (n: number, names: string) => ` (${n} more needed, waiting for ${names})`,
      moreNeeded: (n: number) => ` (${n} more needed)`,
      reserve: (name: string) => `, reserve: ${name}`,
      noUpcoming: 'No upcoming matches planned.',
      playedSoFar: (list: string) => `Matches played so far: ${list}`,
      ask: "For every match, tell the captain: I can, Maybe or I can't.",
    },
  },
};

export type Texts = typeof en;
