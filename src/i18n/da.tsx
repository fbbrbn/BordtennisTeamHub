/**
 * Every text of the site in Danish, entry for entry as in en.tsx (the type makes sure none is missing).
 * The usual terms of the sport: holdkamp, pulje, række, single, double, sæt, rating, opstilling.
 */
import type { ReactNode } from 'react';
import type { Texts, Thing } from './en.tsx';
import { decimal, list, ordinal, percent, plural } from './format.ts';

/** "holdet", "spilleren" … and "dette hold", "denne spiller" … */
const THE: Record<Thing, string> = { team: 'holdet', player: 'spilleren', pool: 'puljen', club: 'klubben', match: 'kampen' };
const THIS: Record<Thing, string> = { team: 'dette hold', player: 'denne spiller', pool: 'denne pulje', club: 'denne klub', match: 'denne kamp' };

const pct = (rate: number | null) => percent(rate, 'da');
const dec = (n: number) => decimal(n, 'da');
const ord = (n: number) => ordinal(n, 'da');
const names = (items: readonly string[]) => list(items, 'da');
const kampe = (n: number) => (Math.abs(n) === 1 ? 'kamp' : 'kampe');
const sejre = (n: number) => (Math.abs(n) === 1 ? 'sejr' : 'sejre');
const openPlaces = (n: number) => (n === 1 ? '1 ledig plads' : `${n} ledige pladser`);
const capital = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

export const da: Texts = {
  language: { label: 'Sprog', en: 'English', da: 'Dansk' },

  app: {
    back: 'Tilbage',
    footer:
      'Uofficielt værktøj uden tilknytning til DBTU eller bordtennisportalen.dk. Resultaterne kommer fra bordtennisportalen.dk og opdateres flere gange om dagen, hver time på kampaftener. Opstillingsplaner og fulgte hold gemmes i din browser.',
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
    failed: (thing) => `Kunne ikke hente ${THE[thing]}. Tjek forbindelsen, og prøv igen.`,
    notFound: 'Ikke fundet',
    noData: (thing) => `Der er endnu ingen data for ${THIS[thing]}. Kun importerede puljer er med.`,
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
    against: 'Mod',
    result: 'Resultat',
    points: 'Point',
    results: 'Resultater',
    insights: 'Værd at vide',
    openOnPortal: 'Åbn på bordtennisportalen.dk',
    showAsTable: 'Vis som tabel',
    howWorkedOut: 'Hvordan regnes det ud?',
    pastSeason: 'Tidligere sæson',
    planLineup: 'Planlæg opstilling',
    played: (n) => `${n} spillet`,
    wonShare: (rate) => `${pct(rate)} vundet`,
    meterLabel: (label, rate) => `${label}: ${pct(rate)} vundet`,
    ratingOf: (rating) => `rating ${rating}`,
    andJoin: ' & ',
  },

  n: {
    matches: (n) => plural(n, 'kamp', 'kampe'),
    teamMatches: (n) => plural(n, 'holdkamp', 'holdkampe'),
    teams: (n) => plural(n, 'hold', 'hold'),
    clubs: (n) => plural(n, 'klub', 'klubber'),
    pools: (n) => plural(n, 'pulje', 'puljer'),
    players: (n) => plural(n, 'spiller', 'spillere'),
    points: (n) => plural(n, 'point', 'point'),
    pts: (n) => plural(n, 'p', 'p'),
    seasons: (n) => plural(n, 'sæson', 'sæsoner'),
    singles: (n) => plural(n, 'single', 'singler'),
    singlesGames: (n) => plural(n, 'single', 'singler'),
    games: (n) => plural(n, 'kamp', 'kampe'),
  },

  odds: {
    win: 'Sejr',
    draw: 'Uafgjort',
    loss: 'Nederlag',
    summary: (win, draw, loss, drawPossible) =>
      drawPossible ? `Sejr ${pct(win)}, uafgjort ${pct(draw)}, nederlag ${pct(loss)}` : `Sejr ${pct(win)}, nederlag ${pct(loss)}`,
    sentence: (draw, drawPossible) => (drawPossible ? `chance for sejr, ${pct(draw)} for uafgjort.` : 'chance for sejr.'),
    chanceToWin: 'chance for sejr',
    winShort: (win) => `${pct(win)} sejr`,
  },

  prediction: {
    line: (home, away, win) => `Forudsagt ${dec(home)}–${dec(away)}, ${pct(win)} for sejr`,
    record: (right, matches) => `Forudsagt før hver kamp: rigtigt i ${right} af ${matches}`,
    recordNote:
      'Hver spillet kamp beholder den forudsigelse, der blev lavet ud fra det, man vidste før kampdagen: dagens officielle ratingliste, de tidligere resultater og hver spillers form indtil da. »Rigtigt« betyder, at det mest sandsynlige udfald skete. Kampe uden forudsigelse var et holds første i sæsonen.',
  },

  follow: {
    follow: 'Følg',
    following: 'Følger',
    titleOn: 'Vises først på forsiden. Tryk for at stoppe med at følge holdet.',
    titleOff: 'Vis holdet først på forsiden',
  },

  ratings: {
    listNote: (listDate, ratedThrough) => `liste fra ${listDate}, som har kampe med til og med ${ratedThrough}`,
    forecastTitle: 'Ratingprognose',
    forecastHeadline: (rating, change, games) => (
      <>
        <strong>{rating}</strong> ({change}), når {plural(games, 'single', 'singler')} siden den officielle liste er blevet ratet.
      </>
    ),
    official: (rating, note) => `Officiel rating ${rating} fra den officielle ${note}.`,
    ratedAt: (rating) => `Rating ${rating}`,
    rules: [
      'Hver single flytter begge spilleres rating et fast antal point, ud fra ratingforskellen og hvem der vandt. En sejr over en spiller med højere rating giver mest.',
      'Alle kampe på en kampdag bruger ratingerne fra før den dag.',
      'Doubler og walkovers tæller ikke. Turneringskampe og kampe mod spillere uden rating er ikke med her, så den officielle rating kan afvige.',
    ],
    tableCaption: 'Point efter ratingforskel',
    gap: 'Forskel',
    higherRated: 'Højest ratede',
    lowerRated: 'Lavest ratede',
    wins: 'vinder',
    loses: 'taber',
    rulesNote: 'Aflæst fra ratede kampe på bordtennisportalen.dk. Et skøn, ikke den officielle beregning.',
    forecastNote: (note) => `→ Prognose: ratingen, når de singler, der er spillet siden den officielle ${note}, er blevet ratet.`,
    forecastTitleShort: 'Prognose',
    forecastDetail: (rating, change) => `Prognose ${rating} (${change})`,
  },

  history: {
    tab: 'Historik',
    linkSummary: (seasons, since) => `· ${plural(seasons, 'sæson', 'sæsoner')} siden ${since}`,
    loading: 'Henter historikken…',
    empty: 'Ingen sæsoner fundet endnu. Tidligere sæsoner kommer til, efterhånden som importen arbejder sig tilbage til 2011/2012.',
    startOf: (season) => `Start på ${season}`,
    now: 'Nu',
    nowTitle: 'Officiel rating nu',
    next: 'Næste',
    nextTitle: 'Prognose, når de spillede kampe er blevet ratet',
    seasons: 'Sæsoner',
    since: (season) => `siden ${season}`,
    singlesWonLost: 'Singler vundet og tabt',
    teamMatches: 'Holdkampe',
    clubs: (n) => (n === 1 ? 'Klub' : 'Klubber'),
    overSeasons: 'Rating gennem sæsonerne',
    overSeasonsNote: (withToday) => `Den officielle rating ved hver sæsonstart${withToday ? ' og så i dag' : ''}.`,
    everySeason: 'Alle sæsoner',
    tapScore: 'Tryk på et resultat for at se sæsonens kampe.',
    about: 'Om tallene',
    aboutNote:
      'Kun holdturneringskampe fra bordtennisportalen.dk; turneringer er ikke med. Ratingen er den officielle, da puljen startede. Tidligere sæsoner kommer til, efterhånden som importen arbejder sig tilbage til 2011/2012.',
    thisPage: ' · denne side',
    scoreLabel: (season, won, lost) => `Kampe i ${season}: singler ${won} vundet, ${lost} tabt`,
    singles: 'singler',
  },

  start: {
    welcomeBack: 'Velkommen tilbage',
    findTeam: 'Find dit hold',
    intro: 'Resultater, chancer og planlægning af opstillinger for alle hold i Holdturneringen i bordtennis.',
    myTeams: 'Mine hold',
    continueWith: (team: ReactNode) => <>Fortsæt med {team}</>,
    followHint: 'Følg holdet for at have det øverst på siden, med næste kamp.',
    howItWorks: 'Sådan virker det',
    steps: [
      <>
        <strong>Find dit hold</strong> ud fra klub, hold eller spiller herunder.
      </>,
      <>
        <strong>Følg det</strong> med ☆, så det altid er her med næste kamp og jeres chancer.
      </>,
      <>
        <strong>Planlæg opstillingen</strong>: markér, hvem der kan spille, så fordeler planlæggeren kampene retfærdigt.
      </>,
    ],
    findHeading: 'Find en klub, et hold eller en spiller',
    loadingClubs: 'Henter klubber…',
    clubsUnavailable: 'Klubberne er ikke tilgængelige lige nu.',
    notListed: 'Planlægger du for et hold, der ikke er med?',
    notListedNote: 'Holdplanlæggeren virker også i hånden: tilføj selv spillere og kampe.',
    unnamedTeam: 'Hold uden navn',
    planByHand: 'Planlæg i hånden',
    planAnother: 'Planlæg endnu et hold i hånden',
    standing: (position, teams, points) => ` · nr. ${position} af ${teams}, ${plural(points, 'point', 'point')}`,
    next: (day, time) => `Næste: ${day} · ${time}`,
    opponent: 'modstander',
    noMoreMatches: 'Ikke flere kampe i denne sæson.',
    teamPage: 'Holdside',
    searching: 'Søger…',
    nothingMatches: (query) => `Intet passer på »${query}«. Prøv med en del af et klub-, hold- eller spillernavn.`,
    searchLabel: 'Klub, hold eller spiller',
    searchPlaceholder: 'Søg, fx Vallensbæk',
    region: 'Region',
    allRegions: 'Alle regioner',
    ageGroup: 'Aldersgruppe',
    allAgeGroups: 'Alle grupper',
    showMore: (left) => `Vis flere (${left} tilbage)`,
    showMorePlayers: (left) => `Vis flere spillere (${left} tilbage)`,
    season: (name) => ` · sæson ${name}`,
    showFewerClubs: 'Vis færre klubber',
    showAllClubs: (n) => `Vis alle ${n} klubber`,
  },

  team: {
    tabs: { overview: 'Overblik', matches: 'Kampe', players: 'Spillere' },
    tabsLabel: 'Holdsider',
    onPortal: 'Se holdet på bordtennisportalen.dk',
    position: 'Placering',
    ofTeams: (n) => `af ${n} hold`,
    afterMatches: (n) => `efter ${plural(n, 'kamp', 'kampe')}`,
    wonDrawnLost: 'Vundet, uafgjort, tabt',
    gamesWonLost: 'Kampscore',
    nextMatch: 'Næste kamp',
    theOpponent: 'modstanderen',
    whyChances: 'Hvorfor disse chancer?',
    plannedLineup: (players) => `Bruger opstillingen fra din planlægger: ${players}.`,
    seasonLineups:
      'Bygger på de opstillinger, begge hold har brugt i sæsonen. Markér i planlæggeren, hvem der kan spille, for at bruge jeres rigtige opstilling.',
    preview: 'Se kampen, og prøv opstillinger',
    moreInsights: (n) => `${n} mere`,
    pointsRace: 'Point gennem sæsonen',
    pointsRaceNote: 'Point efter hver kamp, sammenlignet med resten af puljen.',
    comingUp: 'Kommende kampe',
    left: (n) => `${n} tilbage`,
    comingUpNote: 'Chancen for sejr i hver kamp. Tryk på en kamp for at se den og prøve opstillinger.',
    previewLabel: (win) => `Se kampen: ${pct(win)} chance for sejr`,
    nonePlayed: 'Ingen kampe spillet endnu.',
    scoreLabel: (score) => `Kampens enkeltkampe, ${score}`,
    to: ' mod ',
    tapName: 'Tryk på et navn for spillerens kampe',
    noGames: 'Ingen kampe registreret endnu.',
    singlesFor: (name) => `Singler for ${name}`,
  },

  player: {
    tabsLabel: 'Spillersider',
    thisSeason: 'Denne sæson',
    stripWon: (sets, name) => `Vandt ${sets} mod ${name}`,
    stripLost: (sets, name) => `Tabte ${sets} mod ${name}`,
    stripRating: (rating, team) => `Rating ${rating} · ${team}`,
    singlesWonLost: 'Singler vundet og tabt',
    doublesWonLost: 'Doubler vundet og tabt',
    setsWonLost: 'Sæt vundet og tabt',
    inMatches: (n) => `i ${plural(n, 'kamp', 'kampe')}`,
    byOpponent: 'Singler efter modstanderens rating',
    byOpponentNote: (name) =>
      `Sejre i øverste række, nederlag nedenunder. Prikker til højre for linjen er modstandere med højere rating end ${name}.`,
    unratedNotShown: (n) => ` ${n} ${kampe(n)} mod modstandere uden rating vises ikke.`,
    games: 'Kampe',
    noGames: 'Ingen kampe registreret i denne pulje.',
    doublesWith: (partners) => ` med ${partners}`,
  },

  club: {
    eyebrow: (season) => `Klub${season ? ` · ${season}` : ''}`,
    teamsInPools: (teams, pools) => `${plural(teams, 'hold', 'hold')} i ${plural(pools, 'pulje', 'puljer')}`,
    of: (teams, points) => ` af ${teams} · ${plural(points, 'p', 'p')}`,
    notStarted: 'Ikke startet',
  },

  pool: {
    standings: 'Stilling',
    columns: {
      matches: ['K', 'Kampe'],
      won: ['V', 'Vundet'],
      drawn: ['U', 'Uafgjort'],
      lost: ['T', 'Tabt'],
      games: 'Score',
      points: 'Point',
      projected: ['Prog.', 'Forventede point ved sæsonens slutning'],
    },
    projectedNote:
      'Prog.: forventede point ved sæsonens slutning, med den forventede placering under. Tallet lægger chancerne for sejr og uafgjort sammen for alle resterende kampe, hvis hvert hold stiller med opstillinger, det har brugt i sæsonen.',
    playedOf: (played, total) => `${played} af ${plural(total, 'kamp', 'kampe')} spillet`,
    showFewer: 'Vis færre',
    showAllResults: (n) => `Vis alle ${n} resultater`,
    nextMatches: 'Næste kampe',
    sortedBySingles: 'Sorteret efter vundne singler',
    wonColumn: 'Vundet',
  },

  match: {
    noPlayer: 'Ingen spiller',
    eyebrow: (id) => `Kamp ${id}`,
    walkover: ' · walkover',
    games: 'Kampe',
    gamesUnavailable: 'Kampens enkeltkampe er ikke tilgængelige endnu.',
    game: 'Kamp',
    wo: ' (w.o.)',
    wonSr: ' (vundet)',
    predictionTitle: 'Forudsigelse og resultat',
    predictionHeadline: (win, home, draw) => (
      <>
        {win} chance for, at {home} vinder{draw ? `, ${draw} for uafgjort` : ''}, før kampen.
      </>
    ),
    winFor: (team) => `sejr til ${team}`,
    aDraw: 'uafgjort',
    expectedEnded: (expected, ended) => (
      <>
        Forventet resultat {expected}; det endte {ended}.
      </>
    ),
    likeliestHappened: (outcome) => `Det mest sandsynlige udfald, ${outcome}, skete.`,
    notLikeliest: (outcome) => `Ikke det mest sandsynlige udfald: forudsigelsen pegede på ${outcome}.`,
    howPredicted: 'Hvordan blev det forudsagt?',
    howPredictedNote: (home) =>
      `Ud fra det, man vidste før kampdagen: den officielle ratingliste den dag, resultaterne af tidligere kampe (for de opstillinger, begge hold havde brugt, og for fælles modstandere) og hver spillers form indtil da. Sejr, uafgjort og nederlag er set fra hjemmeholdet, ${home}.`,
    ratingPoints: 'Ratingpoint',
    ratingPointsNote: (note) =>
      `Skøn: kampen er ikke med i de officielle ratings endnu (den officielle ${note}). »Før« er ratingen op til kampen, efter eventuelle tidligere kampe, som listen ikke har med.`,
    before: 'Før',
  },

  preview: {
    chances: 'Chancer',
    showFor: 'Vis chancer for',
    headline: (team, win, sentence, expected) => (
      <>
        {team}: {win} {sentence} Forventet resultat {expected}.
      </>
    ),
    notEnough: 'Endnu ikke nok resultater til at vurdere kampen.',
    reasonRatings: 'Spillernes rating.',
    reasonForm: 'Form og hjemmebane.',
    reasonCommon: 'Fælles modstandere.',
    lineups: 'Opstillinger',
    tryLineup: 'Prøv en opstilling: chancerne ovenfor opdateres med det samme.',
    statusSeason: 'Bruger sæsonens opstillinger. Tryk på spillere for at vælge din egen.',
    statusPickMore: (n) => `Vælg ${n} mere. Indtil da bruges sæsonens opstillinger.`,
    statusPlanned: 'Opstilling fra din planlægger.',
    statusYours: 'Din opstilling.',
    backToSeason: 'Tilbage til sæsonens opstillinger',
    grid: 'Jeres spillere mod deres',
    gridNote: (team, columns) => `Chancen for, at hver spiller fra ${team} vinder en single, ud fra rating, form og hjemmebane. Kolonner: ${columns}.`,
    columnsPicked: (team) => `den opstilling for ${team}, du har valgt`,
    columnsUsual: (team) => `de mest brugte spillere fra ${team}`,
    gridPlayer: (team) => `Spiller fra ${team}`,
    heat: ['Klar underdog', 'Underdog', 'Lige', 'Favorit', 'Klar favorit'],
    commonTitle: 'Fælles modstandere',
    commonNote: (team) => `Hvordan begge hold klarede sig mod de samme hold. Forskel: kampe pr. holdkamp, set fra ${team}.`,
    difference: 'Forskel',
    eachOther: 'Mod hinanden',
    howWorkedOut:
      'Hver kamp får en chance ud fra ratingforskellen, kalibreret på puljens singler. Så kommer det, ratingerne ikke fanger, afprøvet på alle kampe i de sidste tre sæsoner: hver spillers singler i denne sæson, i alle puljer, set i forhold til hvad ratingen forventede (sidste sæson tæller en tredjedel så meget); ungdomsspillere, der forbedrer sig hurtigere end ratinglisten; spillere uden rating, der er svagere end den medianrating i puljen, de står i stedet for; og hjemmebanen, undtagen i veteranpuljer. Fælles modstandere tæller en fjerdedel. Skøn, ikke sikkerheder.',
  },

  reasons: {
    noRatings: 'Endnu ikke nok kampe til at sammenligne spillerne.',
    aboutEven: 'omtrent lige',
    stronger: (points) => `${points} point stærkere`,
    weaker: (points) => `${points} point svagere`,
    lineupAverage: (team, average) => `opstillingen for ${team} har i snit ${average}`,
    lineupsAverage: (team, average) => `opstillingerne for ${team} i denne sæson har i snit ${average}`,
    ratings: (ours, theirs, balance, win) => `${capital(ours)}; ${theirs}: ${balance}. Ratingerne alene giver ${pct(win)} for sejr.`,
    noCommon: 'Endnu ingen fælles modstandere, så den del er udeladt.',
    commonOpponents: (n) => plural(n, 'fælles modstander', 'fælles modstandere'),
    earlierMeeting: 'deres tidligere opgør',
    asWell: 'omtrent lige så godt som dem',
    better: (margin) => `${dec(margin)} ${kampe(margin)} bedre pr. holdkamp`,
    worse: (margin) => `${dec(margin)} ${kampe(margin)} dårligere pr. holdkamp`,
    common: (what, team, how, win) => `Ud fra ${what} klarede ${team} sig ${how}. Det alene giver ${pct(win)} for sejr.`,
    atHome: (team, points) => `${team} spiller hjemme: omkring +${points} ratingpoint pr. kamp.`,
    noHomeEdge: 'Ingen hjemmebanefordel i veteranpuljer.',
    youth: ' (ungdom)',
    unrated: ' (uden rating)',
    forTeam: (players, team) => `${players} for ${team}`,
    formList: (lists) => `Form i forhold til rating: ${lists}.`,
    noForm: 'Ingen spiller ligger langt fra sin rating.',
    hardlyChange: 'Tilsammen ændrer det næsten ikke chancerne.',
    withThese: (after, before) => `Med dem giver ratingerne ${pct(after)} i stedet for ${pct(before)}.`,
  },

  insights: {
    topics: {
      table: 'Stilling',
      outlook: 'Udsigt',
      bestLineup: 'Bedste opstilling',
      standout: 'Overpræsterer',
      form: 'Form',
      closeGames: 'Tætte kampe',
      doubles: 'Doubler',
      bestWin: 'Bedste sejr',
      upsetLoss: 'Overraskende nederlag',
    },
    place: (position, teams, points) => `Nr. ${position} af ${teams} med ${plural(points, 'point', 'point')}.`,
    levelWith: (teams) => `På point med ${names(teams)}.`,
    behind: (points, team, position) => `${plural(points, 'point', 'point')} efter ${team} (nr. ${position}).`,
    top: 'Fører puljen.',
    ahead: (points, team) => `${plural(points, 'point', 'point')} foran ${team}.`,
    teamForm: (matches, won, expected) =>
      `I ${plural(matches, 'holdkamp', 'holdkampe')} vandt holdet ${plural(won, 'kamp', 'kampe')}; spillernes rating forudsagde ${dec(expected)}.`,
    moreGames: (diff) => `Det er ${dec(diff)} ${kampe(diff)} mere end ventet: holdet spiller over sin rating.`,
    fewerGames: (diff) => `Det er ${dec(diff)} ${kampe(diff)} færre end ventet.`,
    moreWins: (diff) => `Det er ${dec(diff)} ${sejre(diff)} mere end ventet: spiller over sin rating.`,
    fewerWins: (diff) => `Det er ${dec(diff)} ${sejre(diff)} færre end ventet.`,
    asExpected: 'Omtrent som ventet.',
    fifthSets: (won, lost) => `Singler, der gik i femte sæt: ${won} vundet, ${lost} tabt.`,
    doubles: (won, played, best, pair, pairWon, pairLost) =>
      `Doubler vundet: ${won} af ${played}. ${best ? 'Bedste par' : 'Mest brugte par'}: ${names(pair)} (${pairWon}–${pairLost}).`,
    standout: (name, won, singles, above) =>
      `${name} har vundet ${won} af ${plural(singles, 'single', 'singler')}, ${dec(above)} flere, end ratingen forudsiger.`,
    outlook: (favourite, remaining, projected, rank) =>
      `Favorit i ${favourite} af de ${plural(remaining, 'resterende kamp', 'resterende kampe')}. Forventet slutning: omkring ${projected} point og en ${ord(rank)} plads (hvis hvert hold stiller med opstillinger, det har brugt i sæsonen).`,
    bestLineup: (size, players, favourite, remaining) =>
      `Med sine ${plural(size, 'højest ratede spiller', 'højest ratede spillere')} (${names(players)}) ville holdet være favorit i ${favourite} af de ${remaining}.`,
    playerForm: (won, singles, expected) => `Vandt ${won} af ${plural(singles, 'single', 'singler')}; ratingen forudsagde ${dec(expected)}.`,
    playerFifthSets: (won, played) => `Femte sæt: ${won} vundet af ${played}.`,
    bestWin: (name, rating, sets, gap) => `${name} (${rating}), ${sets}.${gap > 0 ? ` En overraskelse: ${gap} ratingpoint højere.` : ''}`,
    upsetLoss: (name, rating, sets, gap) => `${name} (${rating}), ${sets}: ${gap} ratingpoint lavere.`,
    partner: (won, lost, name) => `${won}–${lost} med ${name}`,
  },

  charts: {
    raceLabel: (team, points) =>
      `Point efter hver kamp. ${team !== null && points !== null ? `${team} har ${plural(points, 'point', 'point')}. ` : ''}Brug piletasterne til at gå gennem kampene.`,
    pts: (n) => `${n} p`,
    afterMatch: (n) => `Efter kamp ${n}`,
    otherTeams: 'Andre hold i puljen',
    xAxisMatches: 'Vandret akse: spillede kampe',
    historyLabel: (from, to) => `Rating over tid, fra ${from} til ${to}. Brug piletasterne til at gå gennem punkterne.`,
    forecast: 'prognose',
    rating: 'rating',
    forecastLegend: 'Prognose: når de allerede spillede kampe er blevet ratet',
    forecastSuffix: ' (prognose)',
    stripLabel: 'Singleresultater efter modstanderens rating',
    ownRating: (rating) => `Egen rating ${rating}`,
    stripNote: 'Hver prik er en single, placeret efter modstanderens rating. Kamplisten herunder har alle tallene.',
  },

  planner: {
    title: 'Holdplanlægger',
    team: 'Hold',
    teamPlaceholder: 'Holdnavn, fx Vallensbæk BTK 3',
    savingBlocked: 'Denne browser blokerer for at gemme. Download en sikkerhedskopi for at beholde planen.',
    brokenLink: 'Delingslinket er ufuldstændigt eller i stykker.',
    formerPlayer: 'Tidligere spiller',
    playersPerMatch: 'Spillere pr. kamp',
    linkCopied: 'Delingslink kopieret',
    messageCopied: 'Besked kopieret',
    notBackup: 'Filen er ikke en sikkerhedskopi af en holdplan.',
    replaceConfirm: 'Vil du erstatte den nuværende plan med denne sikkerhedskopi?',
    restored: 'Sikkerhedskopi gendannet',
    unreadable: 'Filen kunne ikke læses.',
    loadFailed: 'Kunne ikke hente de seneste resultater. Planen herunder er den senest gemte.',
    linked: (team) => <>Koblet til {team}: spillere, kampe og resultater opdaterer sig selv. Markér bare, hvem der kan spille.</>,
    yourTeam: 'jeres hold',
    incoming: (team) => <>Linket indeholder en plan for {team}, som er forskellig fra den, der er gemt på denne enhed.</>,
    aTeam: 'et hold',
    useShared: 'Brug den delte plan',
    keepMine: 'Behold min',
    howMade: 'Sådan bliver planen lavet',
    howMade1: (
      <>
        Ingen bliver planlagt på gætværk. Markér for hver kamp, hvem der har sagt <em>Jeg kan</em>, <em>Måske</em> eller{' '}
        <em>Jeg kan ikke</em>. Kun spillere, der har sagt <em>Jeg kan</em> eller <em>Måske</em>, bliver valgt, og{' '}
        <em>Jeg kan</em> kommer først.
      </>
    ),
    howMade2: (
      <>
        Blandt dem vælger planlæggeren dem, der har spillet færrest kampe indtil nu. Spillede kampe tæller med, og det gør de
        kommende kampe, en spiller allerede er valgt til, også. Brug <em>Skal spille</em> eller <em>Hvil</em> for at
        tilsidesætte planen i én kamp.
      </>
    ),
    upcoming: 'Kommende kampe',
    addMatch: 'Tilføj kamp',
    done: 'Færdig',
    matchAdded: 'Kamp tilføjet',
    noUpcoming: 'Ingen kommende kampe endnu. Tilføj dem fra holdets kampprogram.',
    playedMatches: 'Spillede kampe',
    players: 'Spillere',
    activeEdit: (n) => `${n} aktive · ret`,
    active: (n) => `${n} aktive`,
    untickNote: 'Fjern fluebenet i Aktiv for dem, der ikke skal planlægges, fx en reserve.',
    share: 'Del og sikkerhedskopiér',
    shareNote: 'Planen gemmes kun i denne browser. Send linket i holdets chat: den, der åbner det, får sin egen kopi.',
    copyLink: 'Kopiér delingslink',
    copyMessage: 'Kopiér besked til holdets chat',
    download: 'Download sikkerhedskopi',
    restore: 'Gendan sikkerhedskopi',
    copyBlocked: 'Kopiering er blokeret her. Markér teksten, og kopiér den selv:',
    status: { plays: 'Spiller', reserve: 'Reserve', rest: 'Hviler', out: 'Kan ikke', waiting: 'Intet svar' },
    answers: { yes: 'Jeg kan', maybe: 'Måske', no: 'Jeg kan ikke' },
    deleteConfirm: 'Vil du slette kampen fra planen?',
    lineup: 'Opstilling',
    waitingAnswers: 'Venter på svar',
    nobodyCan: 'Ingen kan spille',
    whoCanPlay: 'Hvem kan spille?',
    addPlayersFirst: 'Tilføj spillere til truppen for at planlægge kampen.',
    setByCaptain: ' (valgt af kaptajnen)',
    selectionFor: (name) => `Udtagelse af ${name}`,
    auto: 'Auto',
    mustPlay: 'Skal spille',
    rest: 'Hvil',
    markPlayed: 'Markér som spillet',
    noOpponent: 'modstander ikke angivet',
    nobodyRecorded: 'Ingen registreret',
    edit: 'Ret',
    whoPlayed: 'Hvem spillede?',
    save: 'Gem',
    cancel: 'Annullér',
    notPlayedYet: 'Ikke spillet endnu',
    noAnswersYet: 'Ingen svar endnu. Spørg holdet, hvem der kan spille.',
    stillToAnswer: (open, names) => `${capital(openPlaces(open))}. Mangler svar fra ${names}.`,
    everyoneAnswered: (open) => `${capital(openPlaces(open))}, og alle har svaret.`,
    surplus: (n) => `Der er sat ${n} ${n === 1 ? 'spiller' : 'spillere'} mere til »Skal spille«, end der er pladser.`,
    conflicts: (names) => `${names} er sat til »Skal spille«, men har sagt »Jeg kan ikke«.`,
    datePassed: 'Datoen er passeret. Markér kampen som spillet, så tællingen passer.',
    warning: 'Advarsel: ',
    note: 'Bemærk: ',
    canPlay: (name) => `Kan ${name} spille?`,
    date: 'Dato',
    time: 'Tid',
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
    rosterIntro: 'Start med holdets spillere. Rating er valgfri: den bestemmer kun rækkefølgen af navnene i en opstilling.',
    playerName: 'Spillerens navn',
    ratingFor: (name) => `Rating for ${name}`,
    activeLabel: 'Aktiv',
    remove: 'Fjern',
    removeLabel: (name) => `Fjern ${name}`,
    removeConfirm: (name) =>
      `Vil du fjerne ${name}? Spillerens svar og spillede kampe i planen bliver også fjernet. Fjern i stedet fluebenet i Aktiv for at beholde historikken.`,
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
      ask: 'Sig til kaptajnen for hver kamp: Jeg kan, Måske eller Jeg kan ikke.',
    },
  },
};
