import { useMemo, useState } from 'react';
import { OddsBar } from '../components/Odds';
import {
  combineOdds,
  commonOpponentForecast,
  fitScale,
  lineupSize,
  ratingForecast,
  ratingSummary,
  teamRoster,
  usualLineup,
  type CommonForecast,
  type RatingSummary,
} from '../data/forecast';
import type { PoolData, TeamMatch } from '../data/model';
import { playersById, teamsById } from '../data/stats';
import { readLastTeam } from '../lib/lastTeam';
import { href } from '../lib/router';
import { count, oneDecimal, percent } from '../lib/text';
import { plannedLineup } from '../lineup/planned';

export function ratingReason(rating: RatingSummary | null, teamName: string, opponentName: string): string {
  if (!rating) return 'Not enough games yet to compare the players.';
  const diff = Math.round(rating.teamAverage - rating.opponentAverage);
  const balance = Math.abs(diff) < 25 ? 'about even' : diff > 0 ? `${diff} points stronger` : `${-diff} points weaker`;
  const side = (name: string, lineups: number, avg: number) =>
    lineups === 1 ? `${name}'s lineup averages ${Math.round(avg)}` : `${name}'s lineups this season average ${Math.round(avg)}`;
  return `${side(teamName, rating.teamLineups, rating.teamAverage)}; ${side(opponentName, rating.opponentLineups, rating.opponentAverage)}: ${balance}. Ratings alone give ${percent(rating.odds.win)} to win.`;
}

export function commonReason(common: CommonForecast, teamName: string): string {
  if (common.margin === null || !common.odds) return 'No common opponents yet, so this part is left out.';
  const n = common.rows.length;
  const what = [n > 0 ? count(n, 'common opponent') : '', common.direct.length > 0 ? 'their earlier meeting' : ''].filter(Boolean).join(' and ');
  const m = Math.abs(common.margin);
  const how = m < 0.5 ? 'about as well as them' : `${oneDecimal(m)} ${m === 1 ? 'game' : 'games'} per match ${common.margin > 0 ? 'better' : 'worse'}`;
  return `Based on ${what}, ${teamName} did ${how}. That alone gives ${percent(common.odds.win)} to win.`;
}

type HeatBin = 0 | 1 | 2 | 3 | 4;
const heat = (p: number): HeatBin => (p >= 0.8 ? 4 : p >= 0.6 ? 3 : p > 0.4 ? 2 : p > 0.2 ? 1 : 0);

export function MatchPreview({ pool, match }: { pool: PoolData; match: TeamMatch }) {
  const scale = useMemo(() => fitScale(pool), [pool]);
  const size = lineupSize(pool);
  const teams = teamsById(pool);
  const players = playersById(pool);
  const teamName = (id: string) => teams.get(id)?.name ?? 'Team';
  const playerName = (id: string) => players.get(id)?.name ?? 'Unknown player';

  const [perspective, setPerspective] = useState(() => {
    const last = readLastTeam();
    return last && last.poolId === pool.pool.id && (last.teamId === match.homeTeamId || last.teamId === match.awayTeamId)
      ? last.teamId
      : match.homeTeamId;
  });
  // An empty selection means "any lineup the team used this season".
  const [lineups, setLineups] = useState(() => {
    const start = (id: string) => {
      const planned = plannedLineup(pool.pool.id, id, match.id, size);
      return { ids: planned ?? [], planned: planned !== null };
    };
    return { [match.homeTeamId]: start(match.homeTeamId), [match.awayTeamId]: start(match.awayTeamId) };
  });

  const teamId = perspective;
  const opponentId = teamId === match.homeTeamId ? match.awayTeamId : match.homeTeamId;
  const chosen = (id: string) => (lineups[id].ids.length === size ? lineups[id].ids : undefined);
  const summary = ratingSummary(pool, teamId, opponentId, scale, { team: chosen(teamId), opponent: chosen(opponentId) });
  const common = commonOpponentForecast(pool, teamId, opponentId);
  const odds = combineOdds([summary?.odds ?? null, common.odds]);

  const opponentColumns = chosen(opponentId) ?? usualLineup(pool, opponentId, size);
  const shownRating = (id: string) => players.get(id)?.rating ?? null;
  const ourRows = [...teamRoster(pool, teamId)].sort(
    (a, b) => (shownRating(b) ?? -Infinity) - (shownRating(a) ?? -Infinity),
  );
  const grid = opponentColumns.length > 0 ? ratingForecast(pool, ourRows, opponentColumns, scale) : null;

  const toggle = (side: string, playerId: string) =>
    setLineups((current) => {
      const ids = current[side].ids;
      const next = ids.includes(playerId)
        ? ids.filter((id) => id !== playerId)
        : ids.length < size
          ? [...ids, playerId]
          : [...ids.slice(0, size - 1), playerId];
      return { ...current, [side]: { ids: next, planned: false } };
    });
  const reset = (side: string) => setLineups((current) => ({ ...current, [side]: { ids: [], planned: false } }));

  const status = (side: string) => {
    const { ids, planned } = lineups[side];
    if (ids.length === 0) return 'Using the lineups from this season. Tap players to pick your own.';
    if (ids.length < size) return `Pick ${size - ids.length} more. Until then, the lineups from this season are used.`;
    return planned ? 'Lineup from your planner.' : 'Your lineup.';
  };

  return (
    <>
      <section className="card">
        <div className="section-head">
          <h2>Chances</h2>
          <div className="segmented" role="group" aria-label="Show chances for">
            {[match.homeTeamId, match.awayTeamId].map((id) => (
              <button key={id} type="button" aria-pressed={perspective === id} onClick={() => setPerspective(id)}>
                {teamName(id)}
              </button>
            ))}
          </div>
        </div>
        {odds ? (
          <>
            <p className="odds-headline">
              {teamName(teamId)}: <strong>{percent(odds.win)}</strong> chance to win, {percent(odds.draw)} to draw. Expected
              score {oneDecimal(odds.expectedGames)}–{oneDecimal(odds.totalGames - odds.expectedGames)}.
            </p>
            <OddsBar odds={odds} />
          </>
        ) : (
          <p className="muted">Not enough results yet to estimate this match.</p>
        )}
        <ul className="reasons">
          <li>
            <strong>Player ratings.</strong> {ratingReason(summary, teamName(teamId), teamName(opponentId))}
          </li>
          <li>
            <strong>Common opponents.</strong> {commonReason(common, teamName(teamId))}
          </li>
        </ul>
        <p className="muted small">
          Estimates, not certainties. The chances combine both reasons. Each game's chance comes from the rating gap,
          calibrated on this pool's singles results.
        </p>
      </section>

      <section className="card">
        <h2>Lineups</h2>
        <p className="muted">Try a lineup: the chances above update straight away.</p>
        {[teamId, opponentId].map((side) => {
          const selected = lineups[side].ids;
          return (
            <div key={side} className="lineup-picker">
              <h3>{teamName(side)}</h3>
              <p className="muted small">
                {status(side)}{' '}
                {selected.length > 0 && (
                  <button type="button" className="link-button" onClick={() => reset(side)}>
                    Back to this season's lineups
                  </button>
                )}
              </p>
              <div className="chips">
                {teamRoster(pool, side).map((id) => (
                  <button key={id} type="button" className="chip" aria-pressed={selected.includes(id)} onClick={() => toggle(side, id)}>
                    {playerName(id)} <span className="chip-meta">{players.get(id)?.rating ?? 'unrated'}</span>
                  </button>
                ))}
              </div>
            </div>
          );
        })}
      </section>

      {grid && (
        <section className="card">
          <h2>Your players against theirs</h2>
          <p className="muted">
            Chance that each {teamName(teamId)} player wins a singles, from the ratings. Columns:{' '}
            {chosen(opponentId) ? `the ${teamName(opponentId)} lineup you picked` : `${teamName(opponentId)}'s most-used players`}.
          </p>
          <div className="table-scroll">
            <table className="heat-table">
              <thead>
                <tr>
                  <th scope="col">
                    <span className="sr-only">{teamName(teamId)} player</span>
                  </th>
                  {grid.opponent.map((id) => (
                    <th key={id} scope="col">
                      <a href={href('player', pool.pool.id, id)}>{playerName(id)}</a>
                      <span className="muted small"> {shownRating(id) ?? 'unrated'}</span>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {grid.team.map((id, i) => (
                  <tr key={id} className={lineups[teamId].ids.includes(id) ? 'is-picked' : undefined}>
                    <th scope="row">
                      <a href={href('player', pool.pool.id, id)}>{playerName(id)}</a>
                      <span className="muted small"> {shownRating(id) ?? 'unrated'}</span>
                    </th>
                    {grid.singles[i].map((p, j) => (
                      <td key={grid.opponent[j]} className={`heat heat-${heat(p)}`}>
                        {percent(p)}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="legend" aria-hidden="true">
            <span><i className="swatch heat heat-4" /> Clear favourite</span>
            <span><i className="swatch heat heat-3" /> Favourite</span>
            <span><i className="swatch heat heat-2" /> Even</span>
            <span><i className="swatch heat heat-1" /> Underdog</span>
            <span><i className="swatch heat heat-0" /> Clear underdog</span>
          </div>
        </section>
      )}

      {(common.rows.length > 0 || common.direct.length > 0) && (
        <section className="card">
          <h2>Common opponents</h2>
          <p className="muted">How both teams did against the same teams. Difference: games per match, from {teamName(teamId)}'s side.</p>
          <div className="table-scroll">
            <table className="data-table wrap-head">
              <thead>
                <tr>
                  <th scope="col">Against</th>
                  <th scope="col" className="num">{teamName(teamId)}</th>
                  <th scope="col" className="num">{teamName(opponentId)}</th>
                  <th scope="col" className="num">Difference</th>
                </tr>
              </thead>
              <tbody>
                {common.direct.length > 0 && (
                  <tr>
                    <th scope="row">Each other</th>
                    <td className="num">{common.direct.map((s) => s.join('–')).join(', ')}</td>
                    <td className="num">{common.direct.map((s) => [...s].reverse().join('–')).join(', ')}</td>
                    <td className="num strong">{signed(common.direct.reduce((a, [f, x]) => a + f - x, 0) / common.direct.length)}</td>
                  </tr>
                )}
                {common.rows.map((row) => (
                  <tr key={row.opponentId}>
                    <th scope="row">
                      <a href={href('team', pool.pool.id, row.opponentId)}>{teamName(row.opponentId)}</a>
                    </th>
                    <td className="num">{row.ours.map((s) => s.join('–')).join(', ')}</td>
                    <td className="num">{row.theirs.map((s) => s.join('–')).join(', ')}</td>
                    <td className="num strong">{signed(row.difference)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </>
  );
}

function signed(n: number): string {
  const v = oneDecimal(Math.abs(n));
  return n > 0.04 ? `+${v}` : n < -0.04 ? `−${v}` : '0';
}
