/**
 * Plain-language insights for a team or a player. Each is one sentence built from the
 * data and the forecast model, so the dashboards explain themselves.
 */
import { t, type Texts } from '../i18n';
import { FORM_SPREAD, forecastMatch, lineupSize, projectTable, ratingForecast, ratingsOf, teamRoster, winChance } from './forecast';
import type { PoolData } from './model';
import { isHome, playerGames, playersById, scoreFor, teamMatches, teamsById, type GameRecord } from './stats';

export type InsightId = keyof Texts['insights']['topics'];

export interface Insight {
  /** Which insight it is, whatever the language. */
  id: InsightId;
  /** Short label, e.g. "Table". */
  topic: string;
  text: string;
}

const insight = (id: InsightId, text: string): Insight => ({ id, topic: t.insights.topics[id], text });

export function teamInsights(pool: PoolData, teamId: string, scale: number): Insight[] {
  const insights: Insight[] = [];
  const teams = teamsById(pool);
  const players = playersById(pool);
  const teamName = (id: string) => teams.get(id)?.name ?? t.common.unknownTeam;
  const playerName = (id: string) => players.get(id)?.name ?? t.common.unknownPlayer;

  // Where the team stands, and how far it is from the teams around it.
  const me = pool.standings.find((s) => s.teamId === teamId);
  if (me && me.played > 0) {
    const level = pool.standings.filter((s) => s.teamId !== teamId && s.points === me.points);
    const above = pool.standings.filter((s) => s.points > me.points).sort((a, b) => a.points - b.points)[0];
    const below = pool.standings.filter((s) => s.points < me.points).sort((a, b) => b.points - a.points)[0];
    const parts = [t.insights.place(me.position, pool.standings.length, me.points)];
    if (level.length > 0) parts.push(t.insights.levelWith(level.map((s) => teamName(s.teamId))));
    if (above) parts.push(t.insights.behind(above.points - me.points, teamName(above.teamId), above.position));
    else parts.push(t.insights.top);
    if (below) parts.push(t.insights.ahead(me.points - below.points, teamName(below.teamId)));
    insights.push(insight('table', parts.join(' ')));
  }

  // Results against what the players' ratings predicted, with the lineups that actually played.
  let expected = 0;
  let actual = 0;
  let matches = 0;
  for (const match of teamMatches(pool, teamId)) {
    const score = scoreFor(match, teamId);
    if (!score || !match.games) continue;
    const home = isHome(match, teamId);
    const singles = match.games.filter((g) => g.kind === 'single');
    const ours = [...new Set(singles.flatMap((g) => (home ? g.home : g.away)))];
    const theirs = [...new Set(singles.flatMap((g) => (home ? g.away : g.home)))];
    const forecast = ratingForecast(pool, ours, theirs, scale, home, FORM_SPREAD, false);
    if (!forecast) continue;
    expected += forecast.odds.expectedGames;
    actual += score[0];
    matches++;
  }
  if (matches > 0) {
    insights.push(insight('form', `${t.insights.teamForm(matches, actual, expected)} ${verdict(actual - expected, 1, 'games')}`));
  }

  // Close games and doubles, from the team's own players.
  const records = teamRecords(pool, teamId);
  const fiveSet = records.filter((r) => r.game.kind === 'single' && r.setsFor + r.setsAgainst === 5);
  if (fiveSet.length > 0) {
    const won = fiveSet.filter((r) => r.won).length;
    insights.push(insight('closeGames', t.insights.fifthSets(won, fiveSet.length - won)));
  }
  const doubles = new Map<string, GameRecord[]>();
  for (const r of records) {
    if (r.game.kind !== 'double') continue;
    const pair = [...(isHome(r.match, teamId) ? r.game.home : r.game.away)].sort().join('+');
    doubles.set(pair, [...(doubles.get(pair) ?? []), r]);
  }
  const allDoubles = [...doubles.values()].flat();
  if (allDoubles.length > 0) {
    const [pair, games] = [...doubles].sort((a, b) => wins(b[1]) - wins(a[1]) || b[1].length - a[1].length)[0];
    insights.push(
      insight('doubles', t.insights.doubles(wins(allDoubles), allDoubles.length, wins(games) > 0, pair.split('+').map(playerName), wins(games), games.length - wins(games))),
    );
  }

  // The player doing best compared with their rating (at least 3 singles).
  const rating = ratingsOf(pool);
  const byPlayer = new Map<string, GameRecord[]>();
  for (const r of records) {
    if (r.game.kind !== 'single') continue;
    const id = (isHome(r.match, teamId) ? r.game.home : r.game.away)[0];
    byPlayer.set(id, [...(byPlayer.get(id) ?? []), r]);
  }
  const standouts = [...byPlayer]
    .filter(([, games]) => games.length >= 3)
    .map(([id, games]) => {
      const exp = games.reduce((sum, r) => sum + winChance(rating(id), rating(r.opponents[0]), scale), 0);
      return { id, games, won: wins(games), above: wins(games) - exp };
    })
    .sort((a, b) => b.above - a.above);
  if (standouts.length > 0 && standouts[0].above >= 0.5) {
    const s = standouts[0];
    insights.push(insight('standout', t.insights.standout(playerName(s.id), s.won, s.games.length, s.above)));
  }

  // Season outlook from the forecasts of all remaining matches.
  const projection = projectTable(pool, scale).find((p) => p.teamId === teamId);
  if (projection && projection.remaining > 0) {
    insights.push(insight('outlook', t.insights.outlook(projection.favourite, projection.remaining, Math.round(projection.projected), projection.rank)));

    // The lever a captain controls: how much the strongest lineup would change that.
    const size = lineupSize(pool);
    // Rank by real ratings only; unrated players come last.
    const known = (id: string) => players.get(id)?.rating ?? null;
    const strongest = [...teamRoster(pool, teamId)]
      .sort((a, b) => (known(b) ?? -Infinity) - (known(a) ?? -Infinity))
      .slice(0, size);
    if (strongest.length === size) {
      let favourite = 0;
      for (const match of teamMatches(pool, teamId)) {
        if (match.score) continue;
        const odds = forecastMatch(pool, match, teamId, scale, { team: strongest }).odds;
        if (odds && odds.win > odds.loss) favourite++;
      }
      if (favourite !== projection.favourite) {
        const named = strongest.map((id) => `${playerName(id)} ${known(id) ?? t.common.unrated}`);
        insights.push(insight('bestLineup', t.insights.bestLineup(size, named, favourite, projection.remaining)));
      }
    }
  }
  return insights;
}

export function playerInsights(pool: PoolData, playerId: string, scale: number): Insight[] {
  const insights: Insight[] = [];
  const players = playersById(pool);
  const name = (id: string) => players.get(id)?.name ?? t.common.unknownPlayer;
  const rating = ratingsOf(pool);
  const own = players.get(playerId)?.rating ?? null;
  const records = playerGames(pool, playerId);
  const singles = records.filter((r) => r.game.kind === 'single');

  if (singles.length > 0 && own !== null) {
    const expected = singles.reduce((sum, r) => sum + winChance(own, rating(r.opponents[0]), scale), 0);
    insights.push(insight('form', `${t.insights.playerForm(wins(singles), singles.length, expected)} ${verdict(wins(singles) - expected, 0.75, 'wins')}`));
  }

  const fiveSet = singles.filter((r) => r.setsFor + r.setsAgainst === 5);
  if (fiveSet.length > 0) {
    insights.push(insight('closeGames', t.insights.playerFifthSets(wins(fiveSet), fiveSet.length)));
  }

  const rated = (r: GameRecord) => players.get(r.opponents[0])?.rating ?? null;
  const wonGames = singles.filter((r) => r.won && rated(r) !== null).sort((a, b) => rated(b)! - rated(a)!);
  if (wonGames.length > 0) {
    const best = wonGames[0];
    const gap = own !== null ? rated(best)! - own : 0;
    insights.push(insight('bestWin', t.insights.bestWin(name(best.opponents[0]), rated(best)!, `${best.setsFor}–${best.setsAgainst}`, gap)));
  }
  const lostGames = singles.filter((r) => !r.won && rated(r) !== null).sort((a, b) => rated(a)! - rated(b)!);
  if (lostGames.length > 0 && own !== null && rated(lostGames[0])! < own) {
    const worst = lostGames[0];
    insights.push(insight('upsetLoss', t.insights.upsetLoss(name(worst.opponents[0]), rated(worst)!, `${worst.setsFor}–${worst.setsAgainst}`, own - rated(worst)!)));
  }

  const partners = new Map<string, GameRecord[]>();
  for (const r of records) {
    if (r.game.kind !== 'double') continue;
    for (const p of r.partners) partners.set(p, [...(partners.get(p) ?? []), r]);
  }
  if (partners.size > 0) {
    const text = [...partners]
      .sort((a, b) => b[1].length - a[1].length)
      .map(([id, games]) => t.insights.partner(wins(games), games.length - wins(games), name(id)))
      .join(', ');
    insights.push(insight('doubles', `${text.charAt(0).toUpperCase()}${text.slice(1)}.`));
  }
  return insights;
}

/** All games played by a team's players for that team. */
function teamRecords(pool: PoolData, teamId: string): GameRecord[] {
  const ids = new Set<string>();
  for (const match of teamMatches(pool, teamId)) {
    for (const g of match.games ?? []) for (const id of isHome(match, teamId) ? g.home : g.away) ids.add(id);
  }
  const seen = new Set<string>();
  const records: GameRecord[] = [];
  for (const id of ids) {
    for (const r of playerGames(pool, id)) {
      const key = `${r.match.id}/${r.game.label}`;
      if (r.teamId !== teamId || seen.has(key)) continue;
      seen.add(key);
      records.push(r);
    }
  }
  return records;
}

function wins(records: GameRecord[]): number {
  return records.filter((r) => r.won).length;
}

/** "That is 2.5 more games than expected: playing above the ratings." */
function verdict(diff: number, threshold: number, unit: 'games' | 'wins'): string {
  if (diff >= threshold) return unit === 'games' ? t.insights.moreGames(diff) : t.insights.moreWins(diff);
  if (diff <= -threshold) return unit === 'games' ? t.insights.fewerGames(-diff) : t.insights.fewerWins(-diff);
  return t.insights.asExpected;
}
