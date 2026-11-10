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
const capital = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

export const en = {
  language: { label: 'Language', en: 'English', da: 'Dansk' },

  app: {
    back: 'Back',
    footer: 'Unofficial, not affiliated with DBTU. Results from bordtennisportalen.dk. Plans and followed teams stay in your browser.',
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
    onPortal: 'See on bordtennisportalen.dk',
    showAll: (n: number) => `Show all ${n}`,
    showFewer: 'Show fewer',
    showAsTable: 'Show as table',
    howWorkedOut: 'How is this worked out?',
    pastSeason: 'Past season',
    planLineup: 'Plan lineup',
    played: (n: number) => `${n} played`,
    meterLabel: (label: string, rate: number | null) => `${label}: ${pct(rate)} won`,
    ratingOf: (rating: number) => `rating ${rating}`,
    andJoin: ' & ',
  },

  /** Counted nouns: "1 match", "3 matches". */
  n: {
    matches: (n: number) => plural(n, 'match', 'matches'),
    teams: (n: number) => plural(n, 'team', 'teams'),
    clubs: (n: number) => plural(n, 'club', 'clubs'),
    players: (n: number) => plural(n, 'player', 'players'),
    points: (n: number) => plural(n, 'point', 'points'),
    games: (n: number) => plural(n, 'game', 'games'),
  },

  odds: {
    win: 'Win',
    draw: 'Draw',
    loss: 'Loss',
    summary: (win: number, draw: number, loss: number, drawPossible: boolean) =>
      drawPossible ? `Win ${pct(win)}, draw ${pct(draw)}, loss ${pct(loss)}` : `Win ${pct(win)}, loss ${pct(loss)}`,
    chanceToWin: 'chance to win',
    winShort: (win: number) => `${pct(win)} win`,
  },

  prediction: {
    line: (home: number, away: number) => `Predicted ${dec(home)}–${dec(away)}`,
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
        <strong>{rating}</strong> ({change}) after {plural(games, 'singles game', 'singles games')} since the official list.
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
    forecastNote: (day: string) => `→ Forecast: the rating once the games after ${day} are rated.`,
    forecastTitleShort: 'Forecast',
    /** Under the rating in a tile: the forecast. */
    forecastDetail: (rating: number) => `→ ${rating}`,
  },

  history: {
    tab: 'History',
    loading: 'Loading the history…',
    empty: 'No seasons found yet. Past seasons are added as the import works back to 2011/2012.',
    startOf: (season: string) => `Start of ${season}`,
    now: 'Now',
    nowTitle: 'Official rating now',
    next: 'Next',
    nextTitle: 'Forecast, once the games played are rated',
    seasons: 'Seasons',
    since: (season: string) => `since ${season}`,
    teamMatches: 'Matches',
    clubs: (n: number): string => (n === 1 ? 'Club' : 'Clubs'),
    overSeasons: 'Rating over the seasons',
    overSeasonsNote: (withToday: boolean) => `The official rating when each season started${withToday ? ', then today' : ''}.`,
    everySeason: 'Every season',
    about: 'About these numbers',
    aboutNote:
      'Team-tournament matches only, from bordtennisportalen.dk; tournaments are not included. The rating is the official one when the pool started. Earlier seasons are added as the import works back in time, to 2011/2012.',
    thisPage: ' · this page',
    scoreLabel: (won: number, lost: number) => `Singles: ${won} won, ${lost} lost`,
    singles: 'singles',
  },

  start: {
    findTeam: 'Find your team',
    intro: 'Follow your team with ☆ to keep its next match, your chances and the lineup in one place.',
    myTeams: 'My teams',
    continueWith: (team: ReactNode) => <>Continue with {team}</>,
    followHint: 'Follow it to keep it at the top of this page, with its next match.',
    findHeading: 'Find a club, team or player',
    loadingClubs: 'Loading clubs…',
    clubsUnavailable: 'Club data is not available right now.',
    notListed: 'Is your team missing?',
    notListedNote: 'Add the players and matches yourself in the lineup planner.',
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
    searchLabel: 'Search for a club, team or player',
    searchPlaceholder: 'Club, team or player',
    filters: 'Region and age group',
    /** A team's place in its pool, in a search result: "2nd". */
    place: (position: number) => ord(position),
    allTeams: (n: number) => `All ${n} teams`,
    region: 'Region',
    allRegions: 'All regions',
    ageGroup: 'Age group',
    allAgeGroups: 'All age groups',
    showMore: (left: number) => `Show more (${left} left)`,
    showMorePlayers: (left: number) => `Show more players (${left} left)`,
    showFewerClubs: 'Show fewer clubs',
    showAllClubs: (n: number) => `Show all ${n} clubs`,
  },

  team: {
    tabs: { overview: 'Overview', matches: 'Matches', players: 'Players' },
    tabsLabel: 'Team pages',
    position: 'Position',
    ofTeams: (n: number) => `of ${n}`,
    /** Short tile labels, each with what it stands for. */
    wonDrawnLost: ['W–D–L', 'Won, drawn, lost'],
    gamesWonLost: ['Games', 'Games won and lost'],
    nextMatch: 'Next match',
    theOpponent: 'the opponent',
    whyChances: 'Why these chances?',
    plannedLineup: (players: string) => `With the lineup from your planner: ${players}.`,
    seasonLineups: 'From the lineups both teams have used this season.',
    preview: 'See the match',
    moreInsights: (n: number) => `${n} more`,
    pointsRace: 'Points over the season',
    comingUp: 'Coming up',
    left: (n: number) => `${n} left`,
    nonePlayed: 'No matches played yet.',
    noGames: 'No games recorded yet.',
    singlesFor: (name: string) => `Singles for ${name}`,
  },

  player: {
    tabsLabel: 'Player pages',
    thisSeason: 'This season',
    stripWon: (sets: string, name: string) => `Won ${sets} against ${name}`,
    stripLost: (sets: string, name: string) => `Lost ${sets} against ${name}`,
    stripRating: (rating: number, team: string) => `Rating ${rating} · ${team}`,
    byOpponent: 'Singles by opponent rating',
    unratedNotShown: (n: number) => `${n} game${n === 1 ? '' : 's'} against unrated opponents not shown.`,
    games: 'Games',
    noGames: 'No games recorded in this pool.',
    /** One doubles game, in a list of games. */
    doubleGame: 'Doubles',
    doublesWith: (partners: string) => ` with ${partners}`,
  },

  club: {
    eyebrow: (season: string | null, teams: number) => `Club${season ? ` · ${season}` : ''} · ${plural(teams, 'team', 'teams')}`,
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
    },
    projected: 'Projected final standings',
    projectedNote: 'The win and draw chances of every remaining match added up, with the lineups the teams have used this season.',
    playedOf: (played: number, total: number) => `${played} of ${total} played`,
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
    predictionTitle: 'Predicted before the match',
    expectedEnded: (expected: ReactNode, ended: ReactNode, likeliest: boolean) => (
      <>
        Expected score {expected}. It ended {ended}
        {likeliest ? ', the likeliest outcome' : ''}.
      </>
    ),
    howPredicted: 'How was this predicted?',
    howPredictedNote:
      "From what was known before the match day: the official rating list in force that day, the earlier results and each player's form until then.",
    ratingPoints: 'Rating points',
    ratingPointsNote: 'An estimate, until the official rating list includes this match.',
    /** `note` is the list: "list of 23 Oct, which includes games up to 14 Oct". */
    beforeNote: (note: string) => `“Before” is the rating going into the match, after any earlier games that the official ${note} leaves out.`,
    before: 'Before',
  },

  preview: {
    chances: 'Chances',
    showFor: 'Show chances for',
    /** After the bold share: "87% chance of a win for Smørum BTK 2". */
    winFor: (team: string) => `chance of a win for ${team}`,
    expected: (score: string) => `Expected score ${score}`,
    notEnough: 'Not enough results yet to estimate this match.',
    lineups: 'Lineups',
    tryLineup: 'Tap players to try a lineup. The chances update straight away.',
    tryLineupStored: 'The chances stay as they are until both teams have played in the pool.',
    statusNoPlayers: 'Has not played in this pool yet.',
    statusPickMore: (n: number) => `Pick ${n} more.`,
    statusPlanned: 'From your planner.',
    backToSeason: "Back to this season's lineups",
    grid: 'Your players against theirs',
    gridNote: (team: string, columns: string) => `Chance that each ${team} player wins their singles. Columns: ${columns}.`,
    columnsPicked: 'the lineup you picked',
    columnsUsual: (team: string) => `${team}'s most-used players`,
    gridPlayer: (team: string) => `${team} player`,
    /** Head-to-head records (src/data/headtohead.ts), from our player's side. */
    h2hSr: 'Head-to-head:',
    h2hNote: (from: string) => `Small numbers: the two players' singles against each other since ${from} (won–lost).`,
    h2hAll: (pairs: number) => `${pairs === 1 ? '1 pair of players has' : `${pairs} pairs of players have`} met before`,
    h2hItem: (player: string, opponent: string, won: number, lost: number, last: string, lastWon: boolean) =>
      `${player} v ${opponent}: ${won}–${lost}, ${won + lost === 1 ? '' : 'most recently '}${lastWon ? 'a win' : 'a loss'} on ${last}`,
    heat: ['Clear underdog', 'Underdog', 'Even', 'Favourite', 'Clear favourite'],
    commonTitle: 'Common opponents',
    commonNote: (team: string) => `Results against the same teams. Difference from ${team}'s side.`,
    difference: 'Difference',
    eachOther: 'Each other',
    howWorkedOut:
      "Each game gets a chance from the rating gap, calibrated on the pool's results. Form is a player's singles this season against what their rating expected; last season counts a third as much. Youth and unrated players are adjusted, and the home table counts except in veteran pools. All of it is an estimate.",
  },

  reasons: {
    /** The steps of "Why these chances?" (WhyChances in pages/MatchPreview.tsx). */
    chanceToWin: 'Chance to win',
    ratings: 'Ratings alone',
    averages: (ours: number, theirs: number) => `Average rating ${ours} against ${theirs}.`,
    noRatings: 'Not enough games yet to compare the players.',
    form: 'With form and the home table',
    atHome: (team: string, points: number) => `Home table: +${points} rating points for ${team}.`,
    noHomeEdge: 'No home edge in veteran pools.',
    /** A team's players who are well above or below their rating: "Ann +61, Bo −39". */
    forTeam: (team: string, players: string) => `${team}: ${players}`,
    youth: ' (youth)',
    unrated: ' (unrated)',
    noForm: 'No player is far from their rating.',
    common: 'Common opponents',
    commonNote: (what: string, how: string) => `${capital(what)}: ${how}.`,
    noCommon: 'None yet.',
    commonOpponents: (n: number) => plural(n, 'common opponent', 'common opponents'),
    earlierMeeting: 'their earlier meeting',
    asWell: 'about as good',
    better: (margin: number) => `${dec(margin)} ${games(margin)} better per match`,
    worse: (margin: number) => `${dec(margin)} ${games(margin)} worse per match`,
    total: 'Together',
    weights: 'Ratings with form count three quarters, common opponents a quarter.',
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
    levelWith: (teams: readonly string[]) => `Level with ${names(teams)}.`,
    behind: (points: number, team: string, position: number) => `${plural(points, 'point', 'points')} behind ${team} (${ord(position)}).`,
    top: 'Top of the table.',
    ahead: (points: number, team: string) => `${plural(points, 'point', 'points')} ahead of ${team}.`,
    teamForm: (matches: number, won: number, expected: number) =>
      `Won ${plural(won, 'game', 'games')} in ${plural(matches, 'match', 'matches')}; the ratings predicted ${dec(expected)}.`,
    more: (diff: number) => `That is ${dec(diff)} more than expected.`,
    fewer: (diff: number) => `That is ${dec(diff)} fewer than expected.`,
    asExpected: 'About as expected.',
    fifthSets: (won: number, lost: number) => `Fifth sets in singles: won ${won}, lost ${lost}.`,
    doubles: (won: number, played: number, best: boolean, pair: readonly string[], pairWon: number, pairLost: number) =>
      `Won ${won} of ${played}. ${best ? 'Best pair' : 'Most used pair'}: ${names(pair)} (${pairWon}–${pairLost}).`,
    standout: (name: string, won: number, singles: number, above: number) =>
      `${name} has won ${won} of ${plural(singles, 'single', 'singles')}, ${dec(above)} more than the rating predicts.`,
    outlook: (favourite: number, remaining: number, projected: number, rank: number) =>
      `${
        remaining === 1
          ? favourite === 1
            ? 'Favourite in the last match.'
            : 'Not favourite in the last match.'
          : `Favourite in ${favourite} of ${remaining} remaining matches.`
      } Projected finish: ${ord(rank)} with about ${plural(projected, 'point', 'points')}.`,
    bestLineup: (size: number, players: readonly string[], favourite: number, remaining: number) =>
      `With the ${plural(size, 'highest-rated player', 'highest-rated players')} (${names(players)}): ${
        remaining === 1 ? (favourite === 1 ? 'favourite in the last match' : 'not favourite in the last match') : `favourite in ${favourite} of ${remaining} matches`
      }.`,
    playerForm: (won: number, singles: number, expected: number) =>
      `Won ${won} of ${plural(singles, 'single', 'singles')}; the rating predicted ${dec(expected)}.`,
    playerFifthSets: (won: number, played: number) => `Fifth sets: won ${won} of ${played}.`,
    bestWin: (name: string, rating: number, sets: string, gap: number) => `${name} (${rating}), ${sets}.${gap > 0 ? ` Rated ${gap} higher.` : ''}`,
    upsetLoss: (name: string, rating: number, sets: string, gap: number) => `${name} (${rating}), ${sets}. Rated ${gap} lower.`,
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
    stripNote: "Each dot is one singles game, placed by the opponent's rating.",
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
    linked: (team: ReactNode) => <>{team}: matches and players update by themselves. Just mark who can play.</>,
    findTeamHint: 'Does the team play in the team tournament? Find it on the start page, and its players and matches fill in by themselves.',
    findTeam: 'Find your team',
    yourTeam: 'your team',
    incoming: (team: ReactNode) => <>This link holds a plan for {team} that differs from the one saved on this device.</>,
    aTeam: 'a team',
    useShared: 'Use the shared plan',
    keepMine: 'Keep mine',
    howMade: 'How the plan is made',
    howMade1: (
      <>
        Nobody is planned on guesses. Only players marked <em>Can</em> or <em>Maybe</em> are picked, and <em>Can</em> goes
        first.
      </>
    ),
    howMade2: (
      <>
        Among them, the planner picks whoever has played the fewest matches, counting played and planned ones. Use{' '}
        <em>Must play</em> or <em>Rest</em> to decide yourself for one match.
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
    share: 'Share the plan',
    shareNote: 'The plan lives in this browser only. Whoever opens the link gets their own copy.',
    copyLink: 'Copy link',
    copyMessage: 'Copy message for the team',
    backup: 'Backup',
    download: 'Download',
    restore: 'Restore',
    copyBlocked: 'Copying is blocked here. Select the text and copy it yourself:',
    status: { plays: 'Plays', reserve: 'Reserve', rest: 'Resting' },
    /** The captain marks each player's answer for a match. */
    answers: { yes: 'Can', maybe: 'Maybe', no: "Can't" },
    deleteConfirm: 'Delete this match from the plan?',
    lineup: 'Lineup',
    waitingAnswers: 'Waiting for answers',
    nobodyCan: 'Nobody can play',
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
    editMatch: 'Edit match',
    whoPlayed: 'Who played?',
    save: 'Save',
    cancel: 'Cancel',
    notPlayedYet: 'Not played yet',
    openPlaces: (open: number) => `${plural(open, 'place', 'places')} open`,
    stillToAnswer: (open: number, names: string) => `${plural(open, 'place', 'places')} open. Still to answer: ${names}.`,
    everyoneAnswered: (open: number) => `${plural(open, 'place', 'places')} open, and everyone has answered.`,
    surplus: (n: number) => `${n} more ${n === 1 ? 'player is' : 'players are'} set to "Must play" than there are places.`,
    conflicts: (names: string) => `${names} set to "Must play" but marked "Can't".`,
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
