/**
 * Plain-language insights for a team or a player. Each is one sentence built from the
 * data and the forecast model, so the dashboards explain themselves.
 */
import { count, listNames, oneDecimal, ordinal } from '../lib/text';
import { forecastMatch, lineupSize, projectTable, ratingForecast, ratingsOf, teamRoster, winChance } from './forecast';
import type { PoolData } from './model';
import { isHome, playerGames, playersById, scoreFor, teamMatches, teamsById, type GameRecord } from './stats';

export interface Insight {
  /** Short label, e.g. "Table". */
  topic: string;
  text: string;
}

export function teamInsights(pool: PoolData, teamId: string, scale: number): Insight[] {
  const insights: Insight[] = [];
  const teams = teamsById(pool);
  const players = playersById(pool);
  const teamName = (id: string) => teams.get(id)?.name ?? 'another team';
  const playerName = (id: string) => players.get(id)?.name ?? 'Unknown player';

  // Where the team stands, and how far it is from the teams around it.
  const me = pool.standings.find((s) => s.teamId === teamId);
  if (me && me.played > 0) {
    const level = pool.standings.filter((s) => s.teamId !== teamId && s.points === me.points);
    const above = pool.standings.filter((s) => s.points > me.points).sort((a, b) => a.points - b.points)[0];
    const below = pool.standings.filter((s) => s.points < me.points).sort((a, b) => b.points - a.points)[0];
    const parts = [`${ordinal(me.position)} of ${pool.standings.length} with ${count(me.points, 'point')}.`];
    if (level.length > 0) parts.push(`Level with ${listNames(level.map((s) => teamName(s.teamId)))}.`);
    if (above) parts.push(`${count(above.points - me.points, 'point')} behind ${teamName(above.teamId)} (${ordinal(above.position)}).`);
    else parts.push('Top of the table.');
    if (below) parts.push(`${count(me.points - below.points, 'point')} ahead of ${teamName(below.teamId)}.`);
    insights.push({ topic: 'Table', text: parts.join(' ') });
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
    const forecast = ratingForecast(pool, ours, theirs, scale, home);
    if (!forecast) continue;
    expected += forecast.odds.expectedGames;
    actual += score[0];
    matches++;
  }
  if (matches > 0) {
    insights.push({
      topic: 'Form',
      text: `In ${count(matches, 'match', 'matches')} the team won ${count(actual, 'game')}; the players' ratings predicted ${oneDecimal(expected)}. ${verdict(actual - expected, 1, 'game')}`,
    });
  }

  // Close games and doubles, from the team's own players.
  const records = teamRecords(pool, teamId);
  const fiveSet = records.filter((r) => r.game.kind === 'single' && r.setsFor + r.setsAgainst === 5);
  if (fiveSet.length > 0) {
    const won = fiveSet.filter((r) => r.won).length;
    insights.push({ topic: 'Close games', text: `Singles that went to a fifth set: won ${won}, lost ${fiveSet.length - won}.` });
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
    const label = wins(games) > 0 ? 'Best pair' : 'Most used pair';
    insights.push({
      topic: 'Doubles',
      text: `Doubles won: ${wins(allDoubles)} of ${allDoubles.length}. ${label}: ${listNames(pair.split('+').map(playerName))} (${wins(games)}–${games.length - wins(games)}).`,
    });
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
    insights.push({
      topic: 'Standout',
      text: `${playerName(s.id)} has won ${s.won} of ${count(s.games.length, 'single')}, ${oneDecimal(s.above)} more than the rating predicts.`,
    });
  }

  // Season outlook from the forecasts of all remaining matches.
  const projection = projectTable(pool, scale).find((p) => p.teamId === teamId);
  if (projection && projection.remaining > 0) {
    insights.push({
      topic: 'Outlook',
      text: `Favourite in ${projection.favourite} of the ${count(projection.remaining, 'remaining match', 'remaining matches')}. Projected finish: about ${Math.round(projection.projected)} points, ${ordinal(projection.rank)} place (assuming each team fields lineups it has used this season).`,
    });

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
        insights.push({
          topic: 'Best lineup',
          text: `With its ${count(size, 'highest-rated player')} (${listNames(strongest.map((id) => `${playerName(id)} ${known(id) ?? 'unrated'}`))}), the team would be favourite in ${favourite} of the ${projection.remaining}.`,
        });
      }
    }
  }
  return insights;
}

export function playerInsights(pool: PoolData, playerId: string, scale: number): Insight[] {
  const insights: Insight[] = [];
  const players = playersById(pool);
  const name = (id: string) => players.get(id)?.name ?? 'Unknown player';
  const rating = ratingsOf(pool);
  const own = players.get(playerId)?.rating ?? null;
  const records = playerGames(pool, playerId);
  const singles = records.filter((r) => r.game.kind === 'single');

  if (singles.length > 0 && own !== null) {
    const expected = singles.reduce((sum, r) => sum + winChance(own, rating(r.opponents[0]), scale), 0);
    insights.push({
      topic: 'Form',
      text: `Won ${wins(singles)} of ${count(singles.length, 'single')}; the ratings predicted ${oneDecimal(expected)}. ${verdict(wins(singles) - expected, 0.75, 'win')}`,
    });
  }

  const fiveSet = singles.filter((r) => r.setsFor + r.setsAgainst === 5);
  if (fiveSet.length > 0) {
    insights.push({ topic: 'Close games', text: `Fifth sets: won ${wins(fiveSet)} of ${fiveSet.length}.` });
  }

  const rated = (r: GameRecord) => players.get(r.opponents[0])?.rating ?? null;
  const wonGames = singles.filter((r) => r.won && rated(r) !== null).sort((a, b) => rated(b)! - rated(a)!);
  if (wonGames.length > 0) {
    const best = wonGames[0];
    const gap = own !== null ? rated(best)! - own : 0;
    insights.push({
      topic: 'Best win',
      text: `${name(best.opponents[0])} (${rated(best)}), ${best.setsFor}–${best.setsAgainst}.${gap > 0 ? ` An upset: rated ${gap} higher.` : ''}`,
    });
  }
  const lostGames = singles.filter((r) => !r.won && rated(r) !== null).sort((a, b) => rated(a)! - rated(b)!);
  if (lostGames.length > 0 && own !== null && rated(lostGames[0])! < own) {
    const worst = lostGames[0];
    insights.push({
      topic: 'Upset loss',
      text: `${name(worst.opponents[0])} (${rated(worst)}), ${worst.setsFor}–${worst.setsAgainst}: rated ${own - rated(worst)!} lower.`,
    });
  }

  const partners = new Map<string, GameRecord[]>();
  for (const r of records) {
    if (r.game.kind !== 'double') continue;
    for (const p of r.partners) partners.set(p, [...(partners.get(p) ?? []), r]);
  }
  if (partners.size > 0) {
    const text = [...partners]
      .sort((a, b) => b[1].length - a[1].length)
      .map(([id, games]) => `${wins(games)}–${games.length - wins(games)} with ${name(id)}`)
      .join(', ');
    insights.push({ topic: 'Doubles', text: `${text.charAt(0).toUpperCase()}${text.slice(1)}.` });
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

function verdict(diff: number, threshold: number, unit: string): string {
  if (diff >= threshold) return `That is ${oneDecimal(diff)} more ${unit}${Math.abs(diff) === 1 ? '' : 's'} than expected: playing above the ratings.`;
  if (diff <= -threshold) return `That is ${oneDecimal(-diff)} fewer ${unit}${Math.abs(diff) === 1 ? '' : 's'} than expected.`;
  return 'About as expected.';
}
