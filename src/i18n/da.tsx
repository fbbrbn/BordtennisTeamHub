/**
 * Every text of the site in Danish, the site's first language. Entry for entry as in en.tsx: the
 * type makes sure none is missing.
 *
 * House style, so the texts read as one:
 * - The usual terms of the sport: holdkamp (a team match), kamp (one game of it), single, double, sæt,
 *   rating (plural ratinger), ratingliste, ratingpoint, point, pulje, række, opstilling, hjemme/ude,
 *   sejr/uafgjort/nederlag.
 * - No comma before a subordinate clause ("Markér hvem der kan spille"), always one after it
 *   ("Kun spillere der har svaret ja, bliver valgt").
 * - A capital letter after a colon when a whole sentence follows, otherwise a small one.
 * - »Quotes«, "fx", "pr.", a space before %, imperatives with an accent on -ere verbs (Markér, Kopiér)
 *   except Annuller.
 */
import type { ReactNode } from 'react';
import type { Texts, Thing } from './en.tsx';
import { decimal, list, percent, plural } from './format.ts';

/** "holdet", "spilleren" … and "dette hold", "denne spiller" … */
const THE: Record<Thing, string> = { team: 'holdet', player: 'spilleren', pool: 'puljen', club: 'klubben', match: 'kampen' };
const THIS: Record<Thing, string> = { team: 'dette hold', player: 'denne spiller', pool: 'denne pulje', club: 'denne klub', match: 'denne kamp' };

const pct = (rate: number | null) => percent(rate, 'da');
const dec = (n: number) => decimal(n, 'da');
const names = (items: readonly string[]) => list(items, 'da');
const kampe = (n: number) => (Math.abs(n) === 1 ? 'kamp' : 'kampe');
const openPlaces = (n: number) => (n === 1 ? '1 ledig plads' : `${n} ledige pladser`);
const capital = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

export const da: Texts = {
  language: { label: 'Sprog', en: 'English', da: 'Dansk' },

  app: {
    back: 'Tilbage',
    footer: 'Uofficielt og uden tilknytning til Bordtennis Danmark. Resultater fra bordtennisportalen.dk. Planer og fulgte hold gemmes kun i din browser.',
  },

  nav: {
    main: 'Hovedmenu',
    home: 'Forside',
    myTeam: 'Mit hold',
    lineup: 'Opstilling',
    followFirst: 'Find og følg dit hold først',
    plannerFor: (team) => `Holdplanlægger for ${team}`,
    planner: 'Holdplanlægger',
  },

  states: {
    loading: (thing) => `Henter ${THE[thing]}…`,
    failed: (thing) => `${capital(THE[thing])} kunne ikke hentes. Tjek forbindelsen og prøv igen.`,
    notFound: 'Ikke fundet',
    noData: (thing) => `Der er endnu ingen data for ${THIS[thing]}. Kun puljer der er hentet fra bordtennisportalen.dk, er med.`,
    backToStart: 'Tilbage til forsiden',
    loadingShort: 'Henter…',
    unavailable: 'Ikke tilgængelig lige nu',
  },

  common: {
    home: 'Hjemme',
    away: 'Ude',
    vs: 'mod',
    won: 'Vundet',
    draw: 'Uafgjort',
    lost: 'Tabt',
    unrated: 'uden rating',
    unknownPlayer: 'Ukendt spiller',
    unknownTeam: 'Ukendt hold',
    team: 'Hold',
    player: 'Spiller',
    players: 'Spillere',
    rating: 'Rating',
    singles: 'Singler',
    doubles: 'Doubler',
    sets: 'Sæt',
    date: 'Dato',
    against: 'Modstander',
    result: 'Resultat',
    points: 'Point',
    results: 'Resultater',
    insights: 'Værd at vide',
    onPortal: 'Se på bordtennisportalen.dk',
    showAll: (n) => `Vis alle ${n}`,
    showFewer: 'Vis færre',
    showAsTable: 'Vis som tabel',
    howWorkedOut: 'Hvordan regnes det ud?',
    pastSeason: 'Tidligere sæson',
    planLineup: 'Planlæg opstilling',
    played: (n) => `${n} spillet`,
    meterLabel: (label, rate) => `${label}: ${pct(rate)} vundet`,
    ratingOf: (rating) => `rating ${rating}`,
    andJoin: ' & ',
  },

  n: {
    matches: (n) => plural(n, 'kamp', 'kampe'),
    teams: (n) => plural(n, 'hold', 'hold'),
    clubs: (n) => plural(n, 'klub', 'klubber'),
    players: (n) => plural(n, 'spiller', 'spillere'),
    points: (n) => plural(n, 'point', 'point'),
    games: (n) => plural(n, 'kamp', 'kampe'),
  },

  odds: {
    win: 'Sejr',
    draw: 'Uafgjort',
    loss: 'Nederlag',
    summary: (win, draw, loss, drawPossible) =>
      drawPossible ? `Sejr ${pct(win)}, uafgjort ${pct(draw)}, nederlag ${pct(loss)}` : `Sejr ${pct(win)}, nederlag ${pct(loss)}`,
    chanceToWin: 'chance for sejr',
    winShort: (win) => `${pct(win)} for sejr`,
  },

  prediction: {
    line: (home, away) => `Forudsagt ${dec(home)}–${dec(away)}`,
    record: (right, matches) => `Forudsagt før kampene: rigtigt i ${right} af ${matches}`,
    recordNote:
      'Hver spillet kamp beholder den forudsigelse der blev lavet ud fra det man vidste før kampdagen: dagens officielle ratingliste, de tidligere resultater og hver spillers form indtil da. »Rigtigt« betyder at det mest sandsynlige udfald blev resultatet. Et hold der ikke havde spillet i puljen endnu, låner sine opstillinger fra en tidligere pulje i sæsonen eller fra sidste sæson. Kampe uden forudsigelse er kampe hvor et hold ikke havde nogen opstillinger at låne.',
    borrowed: {
      season:
        'Mindst ét af holdene har ikke spillet i puljen endnu, så chancerne bygger på holdets opstillinger fra en tidligere pulje i sæsonen og er trukket lidt mod lige chancer.',
      'last-season':
        'Mindst ét af holdene har ikke spillet i puljen endnu, så chancerne bygger på holdets opstillinger fra sidste sæson. De er trukket halvvejs mod lige chancer, for kun omkring halvdelen af et holds spillere plejer at være de samme fra sæson til sæson.',
    },
  },

  follow: {
    follow: 'Følg',
    following: 'Følger',
    titleOn: 'Vises først på forsiden. Tryk for ikke længere at følge holdet.',
    titleOff: 'Vis holdet først på forsiden',
  },

  ratings: {
    listNote: (listDate, ratedThrough) => `liste fra ${listDate} med kampe til og med ${ratedThrough}`,
    forecastTitle: 'Ratingprognose',
    forecastHeadline: (rating, change, games) => (
      <>
        <strong>{rating}</strong> ({change}) efter {plural(games, 'single', 'singler')} siden den officielle liste.
      </>
    ),
    official: (rating, note) => `Officiel rating: ${rating} (${note}).`,
    ratedAt: (rating) => `Rating ${rating}`,
    rules: [
      'Hver single flytter begge spilleres rating et fast antal point ud fra ratingforskellen og hvem der vandt. En sejr over en spiller med højere rating giver flest point.',
      'Alle kampe på en kampdag regnes ud fra ratingerne fra før den dag.',
      'Doubler og walkovers tæller ikke. Turneringskampe og kampe mod spillere uden rating er ikke med her, så den officielle rating kan afvige.',
    ],
    tableCaption: 'Point efter ratingforskel',
    gap: 'Forskel',
    higherRated: 'Højest ratede',
    lowerRated: 'Lavest ratede',
    wins: 'vinder',
    loses: 'taber',
    rulesNote: 'Aflæst fra ratede kampe på bordtennisportalen.dk. Det er et skøn og ikke den officielle beregning.',
    forecastNote: (day) => `→ Prognose: ratingen når kampene efter ${day} er ratet.`,
    forecastTitleShort: 'Prognose',
    forecastDetail: (rating) => `→ ${rating}`,
  },

  history: {
    tab: 'Historik',
    loading: 'Henter historikken…',
    empty: 'Ingen sæsoner fundet endnu. Tidligere sæsoner kommer med efterhånden som importen arbejder sig tilbage til 2011/2012.',
    startOf: (season) => `Starten af ${season}`,
    now: 'Nu',
    nowTitle: 'Officiel rating nu',
    next: 'Næste',
    nextTitle: 'Prognose når de spillede kampe er ratet',
    seasons: 'Sæsoner',
    since: (season) => `siden ${season}`,
    teamMatches: 'Holdkampe',
    clubs: (n) => (n === 1 ? 'Klub' : 'Klubber'),
    overSeasons: 'Rating gennem sæsonerne',
    overSeasonsNote: (withToday) => `Den officielle rating ved hver sæsonstart${withToday ? ' og ratingen i dag' : ''}.`,
    everySeason: 'Alle sæsoner',
    about: 'Om tallene',
    aboutNote:
      'Kun kampe i holdturneringen fra bordtennisportalen.dk, ikke individuelle turneringer. Ratingen er den officielle fra da puljen startede. Tidligere sæsoner kommer med efterhånden som importen arbejder sig tilbage til 2011/2012.',
    thisPage: ' · denne side',
    scoreLabel: (won, lost) => `Singler: ${won} vundet, ${lost} tabt`,
    singles: 'singler',
  },

  start: {
    findTeam: 'Find dit hold',
    intro: 'Følg dit hold med ☆ og få næste kamp, jeres chancer og opstillingen samlet ét sted.',
    myTeams: 'Mine hold',
    continueWith: (team: ReactNode) => <>Fortsæt med {team}</>,
    followHint: 'Følg holdet for at få det øverst på siden sammen med næste kamp.',
    findHeading: 'Find klub, hold eller spiller',
    loadingClubs: 'Henter klubber…',
    clubsUnavailable: 'Klubberne kan ikke hentes lige nu.',
    notListed: 'Mangler dit hold?',
    notListedNote: 'Tilføj selv spillere og kampe i holdplanlæggeren.',
    unnamedTeam: 'Hold uden navn',
    planByHand: 'Planlæg manuelt',
    planAnother: 'Planlæg endnu et hold manuelt',
    standing: (position, teams, points) => ` · nr. ${position} af ${teams}, ${plural(points, 'point', 'point')}`,
    next: (day, time) => `Næste kamp: ${day} · ${time}`,
    opponent: 'modstander',
    noMoreMatches: 'Ikke flere kampe i denne sæson.',
    teamPage: 'Holdside',
    searching: 'Søger…',
    nothingMatches: (query) => `Intet passer på »${query}«. Prøv med en del af et klub-, hold- eller spillernavn.`,
    searchLabel: 'Søg efter klub, hold eller spiller',
    searchPlaceholder: 'Klub, hold eller spiller',
    filters: 'Region og aldersgruppe',
    place: (position) => `nr. ${position}`,
    allTeams: (n) => `Alle ${n} hold`,
    region: 'Region',
    allRegions: 'Alle regioner',
    ageGroup: 'Aldersgruppe',
    allAgeGroups: 'Alle grupper',
    showMore: (left) => `Vis flere (${left} tilbage)`,
    showMorePlayers: (left) => `Vis flere spillere (${left} tilbage)`,
    showFewerClubs: 'Vis færre klubber',
    showAllClubs: (n) => `Vis alle ${n} klubber`,
  },

  team: {
    tabs: { overview: 'Overblik', matches: 'Kampe', players: 'Spillere' },
    tabsLabel: 'Holdsider',
    position: 'Placering',
    ofTeams: (n) => `af ${n}`,
    wonDrawnLost: ['V–U–T', 'Vundet, uafgjort, tabt'],
    gamesWonLost: ['Kampscore', 'Vundne og tabte kampe'],
    nextMatch: 'Næste kamp',
    theOpponent: 'modstanderen',
    whyChances: 'Hvorfor disse chancer?',
    plannedLineup: (players) => `Med opstillingen fra holdplanlæggeren: ${players}.`,
    seasonLineups: 'Ud fra de opstillinger begge hold har brugt i sæsonen.',
    preview: 'Se kampen',
    moreInsights: (n) => `Vis ${n} mere`,
    pointsRace: 'Point gennem sæsonen',
    comingUp: 'Kommende kampe',
    left: (n) => `${n} tilbage`,
    nonePlayed: 'Ingen kampe spillet endnu.',
    noGames: 'Ingen kampe registreret endnu.',
    singlesFor: (name) => `Singler for ${name}`,
  },

  player: {
    tabsLabel: 'Spillersider',
    thisSeason: 'Denne sæson',
    stripWon: (sets, name) => `Vandt ${sets} mod ${name}`,
    stripLost: (sets, name) => `Tabte ${sets} mod ${name}`,
    stripRating: (rating, team) => `Rating ${rating} · ${team}`,
    byOpponent: 'Singler efter modstanderens rating',
    unratedNotShown: (n) => `${n} ${kampe(n)} mod modstandere uden rating er ikke vist.`,
    games: 'Kampe',
    noGames: 'Ingen kampe registreret i denne pulje.',
    doubleGame: 'Double',
    doublesWith: (partners) => ` med ${partners}`,
  },

  club: {
    eyebrow: (season, teams) => `Klub${season ? ` · ${season}` : ''} · ${plural(teams, 'hold', 'hold')}`,
    of: (teams, points) => ` af ${teams} · ${plural(points, 'p', 'p')}`,
    notStarted: 'Ikke startet',
  },

  pool: {
    standings: 'Stilling',
    columns: {
      matches: ['K', 'Kampe'],
      won: ['V', 'Vundne'],
      drawn: ['U', 'Uafgjorte'],
      lost: ['T', 'Tabte'],
      games: 'Score',
      points: 'Point',
    },
    projected: 'Forventet slutstilling',
    projectedNote: 'Chancerne for sejr og uafgjort lagt sammen for alle resterende kampe, med de opstillinger holdene har brugt i sæsonen.',
    playedOf: (played, total) => `${played} af ${total} spillet`,
    nextMatches: 'Næste kampe',
    sortedBySingles: 'Sorteret efter vundne singler',
    wonColumn: 'Vundet',
  },

  match: {
    noPlayer: 'Ingen spiller',
    eyebrow: (id) => `Kamp nr. ${id}`,
    walkover: ' · walkover',
    games: 'Kampene',
    gamesUnavailable: 'Kampene i denne holdkamp er ikke tilgængelige endnu.',
    game: 'Kamp',
    wo: ' (w.o.)',
    wonSr: ' (vundet)',
    predictionTitle: 'Forudsagt før kampen',
    expectedEnded: (expected, ended, likeliest) => (
      <>
        Forventet resultat {expected}. Det blev {ended}
        {likeliest ? ', det mest sandsynlige udfald' : ''}.
      </>
    ),
    howPredicted: 'Hvordan blev det forudsagt?',
    howPredictedNote:
      'Ud fra det man vidste før kampdagen: den officielle ratingliste den dag, de tidligere resultater og hver spillers form indtil da.',
    ratingPoints: 'Ratingpoint',
    ratingPointsNote: 'Et skøn, indtil kampen er med på den officielle ratingliste.',
    beforeNote: (note) => `»Før« er ratingen op til kampen, efter eventuelle tidligere kampe som den officielle ${note} ikke har med.`,
    before: 'Før',
  },

  preview: {
    chances: 'Chancer',
    showFor: 'Vis chancer for',
    winFor: (team) => `chance for sejr til ${team}`,
    expected: (score) => `Forventet resultat ${score}`,
    notEnough: 'Der er endnu ikke nok resultater til at vurdere kampen.',
    lineups: 'Opstillinger',
    tryLineup: 'Tryk på spillere for at prøve en opstilling. Chancerne opdateres med det samme.',
    tryLineupStored: 'Chancerne ændrer sig ikke før begge hold har spillet i puljen.',
    statusNoPlayers: 'Har ikke spillet i puljen endnu.',
    statusPickMore: (n) => `Vælg ${n} mere.`,
    statusPlanned: 'Fra holdplanlæggeren.',
    backToSeason: 'Tilbage til sæsonens opstillinger',
    grid: 'Jeres spillere mod deres',
    gridNote: (team, columns) => `Chancen for at hver spiller fra ${team} vinder sin single. Kolonner: ${columns}.`,
    columnsPicked: 'den valgte opstilling',
    columnsUsual: (team) => `de mest brugte spillere fra ${team}`,
    gridPlayer: (team) => `Spiller fra ${team}`,
    h2hSr: 'Indbyrdes:',
    h2hNote: (from) => `Små tal: de to spilleres indbyrdes singler siden ${from} (vundet–tabt).`,
    h2hAll: (pairs) => `${pairs} par spillere har mødt hinanden før`,
    h2hItem: (player, opponent, won, lost, last, lastWon) =>
      `${player} mod ${opponent}: ${won}–${lost}, ${won + lost === 1 ? '' : 'senest '}${lastWon ? 'en sejr' : 'et nederlag'} den ${last}`,
    heat: ['Klar underdog', 'Underdog', 'Lige', 'Favorit', 'Klar favorit'],
    commonTitle: 'Fælles modstandere',
    commonNote: (team) => `Resultater mod de samme hold. Forskel set fra ${team}.`,
    difference: 'Forskel',
    eachOther: 'Indbyrdes',
    howWorkedOut:
      'Hver kamp får en chance ud fra ratingforskellen, kalibreret efter puljens resultater. Form er spillerens singler i sæsonen målt mod det ratingen forventede; sidste sæson tæller en tredjedel så meget. Ungdomsspillere og spillere uden rating justeres, og hjemmebanen tæller undtagen i veteranpuljer. Alt er skøn.',
  },

  reasons: {
    chanceToWin: 'Chance for sejr',
    ratings: 'Rating alene',
    averages: (ours, theirs) => `Gennemsnitlig rating ${ours} mod ${theirs}.`,
    noRatings: 'Der er endnu ikke nok kampe til at sammenligne spillerne.',
    form: 'Med form og hjemmebane',
    atHome: (team, points) => `Hjemmebane: +${points} ratingpoint til ${team}.`,
    noHomeEdge: 'Ingen hjemmebanefordel i veteranpuljer.',
    forTeam: (team, players) => `${team}: ${players}`,
    youth: ' (ungdomsspiller)',
    unrated: ' (uden rating)',
    noForm: 'Ingen spiller ligger langt fra sin rating.',
    common: 'Fælles modstandere',
    commonNote: (what, how) => `${capital(what)}: ${how}.`,
    noCommon: 'Ingen endnu.',
    commonOpponents: (n) => plural(n, 'fælles modstander', 'fælles modstandere'),
    earlierMeeting: 'holdenes indbyrdes kamp',
    asWell: 'omtrent lige gode',
    better: (margin) => `${dec(margin)} ${kampe(margin)} bedre pr. holdkamp`,
    worse: (margin) => `${dec(margin)} ${kampe(margin)} dårligere pr. holdkamp`,
    total: 'Samlet',
    weights: 'Rating med form tæller tre fjerdedele, fælles modstandere en fjerdedel.',
  },

  insights: {
    topics: {
      table: 'Stilling',
      outlook: 'Prognose',
      bestLineup: 'Stærkeste opstilling',
      standout: 'Formstærk',
      form: 'Form',
      closeGames: 'Tætte kampe',
      doubles: 'Doubler',
      bestWin: 'Bedste sejr',
      upsetLoss: 'Overraskende nederlag',
    },
    levelWith: (teams) => `Lige på point med ${names(teams)}.`,
    behind: (points, team, position) => `${plural(points, 'point', 'point')} efter ${team} (nr. ${position}).`,
    top: 'Fører puljen.',
    ahead: (points, team) => `${plural(points, 'point', 'point')} foran ${team}.`,
    teamForm: (matches, won, expected) =>
      `${plural(won, 'vunden kamp', 'vundne kampe')} i ${plural(matches, 'holdkamp', 'holdkampe')}; ratingerne forudsagde ${dec(expected)}.`,
    more: (diff) => `Det er ${dec(diff)} mere end ventet.`,
    fewer: (diff) => `Det er ${dec(diff)} mindre end ventet.`,
    asExpected: 'Omtrent som ventet.',
    fifthSets: (won, lost) => `Femte sæt i singler: ${won} vundet, ${lost} tabt.`,
    doubles: (won, played, best, pair, pairWon, pairLost) =>
      `${won} af ${played} vundet. ${best ? 'Bedste par' : 'Mest brugte par'}: ${names(pair)} (${pairWon}–${pairLost}).`,
    standout: (name, won, singles, above) =>
      `${name} har vundet ${won} af ${plural(singles, 'single', 'singler')}, ${dec(above)} flere end ratingen forudsiger.`,
    outlook: (favourite, remaining, projected, rank) =>
      `${
        remaining === 1
          ? favourite === 1
            ? 'Favorit i den sidste kamp.'
            : 'Ikke favorit i den sidste kamp.'
          : `Favorit i ${favourite} af ${remaining} resterende kampe.`
      } Forventet slutplacering: nr. ${rank} med omkring ${plural(projected, 'point', 'point')}.`,
    bestLineup: (size, players, favourite, remaining) =>
      `Med ${size === 1 ? 'den højest ratede spiller' : `de ${size} højest ratede spillere`} (${names(players)}): ${
        remaining === 1 ? (favourite === 1 ? 'favorit i den sidste kamp' : 'ikke favorit i den sidste kamp') : `favorit i ${favourite} af ${remaining} kampe`
      }.`,
    playerForm: (won, singles, expected) => `Vandt ${won} af ${plural(singles, 'single', 'singler')}; ratingen forudsagde ${dec(expected)}.`,
    playerFifthSets: (won, played) => `Femte sæt: ${won} vundet ud af ${played}.`,
    bestWin: (name, rating, sets, gap) => `${name} (${rating}), ${sets}.${gap > 0 ? ` Ratet ${gap} point højere.` : ''}`,
    upsetLoss: (name, rating, sets, gap) => `${name} (${rating}), ${sets}. Ratet ${gap} point lavere.`,
    partner: (won, lost, name) => `${won}–${lost} med ${name}`,
  },

  charts: {
    raceLabel: (team, points) =>
      `Point efter hver kamp. ${team !== null && points !== null ? `${team} har ${plural(points, 'point', 'point')}. ` : ''}Brug piletasterne til at gå gennem kampene.`,
    pts: (n) => `${n} p`,
    afterMatch: (n) => `Efter ${n}. kamp`,
    otherTeams: 'Andre hold i puljen',
    xAxisMatches: 'Vandret akse: spillede kampe',
    historyLabel: (from, to) => `Rating over tid fra ${from} til ${to}. Brug piletasterne til at gå gennem punkterne.`,
    forecast: 'prognose',
    rating: 'rating',
    forecastLegend: 'Prognose: når de allerede spillede kampe er ratet',
    forecastSuffix: ' (prognose)',
    stripLabel: 'Singleresultater efter modstanderens rating',
    ownRating: (rating) => `Egen rating ${rating}`,
    stripNote: 'Hver prik er en single, placeret efter modstanderens rating.',
  },

  planner: {
    title: 'Holdplanlægger',
    team: 'Hold',
    teamPlaceholder: 'Holdnavn, fx Vallensbæk BTK 3',
    savingBlocked: 'Browseren blokerer for at gemme. Hent en sikkerhedskopi for at beholde planen.',
    brokenLink: 'Linket er ufuldstændigt eller ødelagt.',
    formerPlayer: 'Tidligere spiller',
    playersPerMatch: 'Spillere pr. kamp',
    linkCopied: 'Linket er kopieret',
    messageCopied: 'Beskeden er kopieret',
    notBackup: 'Filen er ikke en sikkerhedskopi af en holdplan.',
    replaceConfirm: 'Vil du erstatte den nuværende plan med sikkerhedskopien?',
    restored: 'Sikkerhedskopien er gendannet',
    unreadable: 'Filen kunne ikke læses.',
    loadFailed: 'De seneste resultater kunne ikke hentes. Planen herunder er den senest gemte.',
    linked: (team) => <>{team}: Kampe og spillere hentes automatisk. Markér bare hvem der kan spille.</>,
    findTeamHint: 'Spiller holdet i Holdturneringen? Find det på forsiden, så hentes spillere og kampe automatisk.',
    findTeam: 'Find dit hold',
    yourTeam: 'jeres hold',
    incoming: (team) => <>Linket indeholder en plan for {team} som afviger fra den der er gemt på denne enhed.</>,
    aTeam: 'et hold',
    useShared: 'Brug den delte plan',
    keepMine: 'Behold min',
    howMade: 'Sådan bliver planen lavet',
    howMade1: (
      <>
        Ingen bliver sat på holdet ud fra gæt. Kun spillere der er markeret <em>Kan</em> eller <em>Måske</em>, bliver valgt,
        og <em>Kan</em> kommer først.
      </>
    ),
    howMade2: (
      <>
        Blandt dem vælger planlæggeren dem der har spillet færrest kampe, når spillede og planlagte kampe tælles sammen. Brug{' '}
        <em>Skal spille</em> eller <em>Hvil</em> for selv at bestemme i en enkelt kamp.
      </>
    ),
    upcoming: 'Kommende kampe',
    addMatch: 'Tilføj kamp',
    done: 'Færdig',
    matchAdded: 'Kampen er tilføjet',
    noUpcoming: 'Ingen kommende kampe endnu. Tilføj dem fra holdets kampprogram.',
    playedMatches: 'Spillede kampe',
    players: 'Spillere',
    activeEdit: (n) => `${n} aktive · rediger`,
    active: (n) => `${n} aktive`,
    untickNote: 'Fjern fluebenet ved Aktiv for spillere der ikke skal planlægges, fx en reserve.',
    share: 'Del planen',
    shareNote: 'Planen ligger kun i denne browser. Den der åbner linket, får sin egen kopi.',
    copyLink: 'Kopiér link',
    copyMessage: 'Kopiér besked til holdet',
    backup: 'Sikkerhedskopi',
    download: 'Hent',
    restore: 'Gendan',
    copyBlocked: 'Kopiering er blokeret her. Markér teksten og kopiér den selv:',
    status: { plays: 'Spiller', reserve: 'Reserve', rest: 'Hviler' },
    answers: { yes: 'Kan', maybe: 'Måske', no: 'Kan ikke' },
    deleteConfirm: 'Vil du slette kampen fra planen?',
    lineup: 'Opstilling',
    waitingAnswers: 'Venter på svar',
    nobodyCan: 'Ingen kan spille',
    addPlayersFirst: 'Tilføj spillere til truppen for at planlægge kampen.',
    setByCaptain: ' (valgt af kaptajnen)',
    selectionFor: (name) => `Udtagelse af ${name}`,
    auto: 'Auto',
    mustPlay: 'Skal spille',
    rest: 'Hvil',
    markPlayed: 'Markér som spillet',
    noOpponent: 'modstander ikke angivet',
    nobodyRecorded: 'Ingen registreret',
    edit: 'Rediger',
    editMatch: 'Rediger kamp',
    whoPlayed: 'Hvem spillede?',
    save: 'Gem',
    cancel: 'Annuller',
    notPlayedYet: 'Ikke spillet endnu',
    stillToAnswer: (open, names) => `${capital(openPlaces(open))}. Mangler svar fra ${names}.`,
    everyoneAnswered: (open) => `${capital(openPlaces(open))}, og alle har svaret.`,
    surplus: (n) => `Der er sat ${n} ${n === 1 ? 'spiller' : 'spillere'} mere til »Skal spille« end der er pladser.`,
    conflicts: (names) => `${names} er sat til »Skal spille« men er markeret »Kan ikke«.`,
    datePassed: 'Datoen er passeret. Markér kampen som spillet så optællingen passer.',
    warning: 'Advarsel: ',
    note: 'Bemærk: ',
    canPlay: (name) => `Kan ${name} spille?`,
    date: 'Dato',
    time: 'Klokkeslæt',
    opponent: 'Modstander',
    opponentPlaceholder: 'Klub og holdnummer',
    venue: 'Hjemme eller ude',
    saveMatch: 'Gem kamp',
    deleteMatch: 'Slet kamp',
    balance: 'Fordeling i sæsonen',
    evenShare: (share) => `Lige fordeling indtil nu: ${share} kampe hver`,
    noneYet: 'Ingen kampe spillet endnu',
    playedColumn: 'Spillet',
    plannedColumn: 'Planlagt',
    total: 'I alt',
    barLabel: 'I alt sammenlignet med en lige fordeling',
    inactive: ' · inaktiv',
    evenShareLegend: 'Lige fordeling indtil nu',
    rosterIntro: 'Start med holdets spillere. Rating er valgfri og bestemmer kun rækkefølgen af navnene i en opstilling.',
    playerName: 'Spillerens navn',
    ratingFor: (name) => `Rating for ${name}`,
    activeLabel: 'Aktiv',
    remove: 'Fjern',
    removeLabel: (name) => `Fjern ${name}`,
    removeConfirm: (name) =>
      `Vil du fjerne ${name}? Spillerens svar og spillede kampe i planen bliver også fjernet. Fjern i stedet fluebenet ved Aktiv hvis historikken skal blive.`,
    newPlayer: 'Navn på ny spiller',
    addPlayer: 'Tilføj spiller',
    message: {
      title: (team) => `${team}: opstillingsplan`,
      ourTeam: 'Vores hold',
      home: 'hjemme',
      away: 'ude',
      noAnswers: 'ingen svar endnu',
      noLineup: 'ingen opstilling endnu',
      moreNeededWaiting: (n, names) => ` (mangler ${n}, venter på ${names})`,
      moreNeeded: (n) => ` (mangler ${n})`,
      reserve: (name) => `, reserve: ${name}`,
      noUpcoming: 'Ingen kommende kampe planlagt.',
      playedSoFar: (list) => `Spillede kampe indtil nu: ${list}`,
      ask: 'Giv kaptajnen besked om hver kamp: Jeg kan, Måske eller Jeg kan ikke.',
    },
  },
};
