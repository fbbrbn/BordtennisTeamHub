import { useMemo, useState } from 'react';
import { OddsBar, oddsSentence } from '../components/Odds';
import {
  commonOpponentForecast,
  fitScale,
  forecastPlayers,
  FORM_SPREAD,
  homePoints,
  lineupSize,
  matchOdds,
  playerAdjustments,
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
import { t } from '../i18n';
import { listNames, oneDecimal, percent, signed as signedNumber } from '../lib/text';
import { plannedLineup } from '../lineup/planned';

export function ratingReason(rating: RatingSummary | null, teamName: string, opponentName: string): string {
  if (!rating) return t.reasons.noRatings;
  const diff = Math.round(rating.teamAverage - rating.opponentAverage);
  const balance = Math.abs(diff) < 25 ? t.reasons.aboutEven : diff > 0 ? t.reasons.stronger(teamName, diff) : t.reasons.weaker(teamName, -diff);
  const side = (name: string, lineups: number, avg: number) =>
    lineups === 1 ? t.reasons.lineupAverage(name, Math.round(avg)) : t.reasons.lineupsAverage(name, Math.round(avg));
  return t.reasons.ratings(
    side(teamName, rating.teamLineups, rating.teamAverage),
    side(opponentName, rating.opponentLineups, rating.opponentAverage),
    balance,
    rating.odds.win,
  );
}

export function commonReason(common: CommonForecast, teamName: string): string {
  if (common.margin === null || !common.odds) return t.reasons.noCommon;
  const n = common.rows.length;
  const what = listNames([n > 0 ? t.reasons.commonOpponents(n) : '', common.direct.length > 0 ? t.reasons.earlierMeeting : ''].filter(Boolean));
  const m = Math.abs(common.margin);
  const how = m < 0.5 ? t.reasons.asWell : common.margin > 0 ? t.reasons.better(m) : t.reasons.worse(m);
  return t.reasons.common(what, teamName, how, common.odds.win);
}

/**
 * What moves the chances beyond the ratings: the home table, and players playing better or worse than
 * their rating. `adjusted` and `plain` are the rating odds with and without these.
 */
export function formReason(
  pool: PoolData,
  scale: number,
  match: TeamMatch,
  sides: { teamId: string; lineup?: string[] }[],
  adjusted: RatingSummary | null,
  plain: RatingSummary | null,
  teamName: (id: string) => string,
  playerName: (id: string) => string,
): string {
  const home = homePoints(pool, scale);
  const parts = [home > 0 ? t.reasons.atHome(teamName(match.homeTeamId), home) : t.reasons.noHomeEdge];
  const lists = sides.flatMap(({ teamId, lineup }) => {
    const list = playerAdjustments(pool, forecastPlayers(pool, teamId, lineup), scale, 15).slice(0, 4);
    const names = list.map((a) => `${playerName(a.id)} ${signedNumber(a.points)}${a.youth ? t.reasons.youth : a.unrated ? t.reasons.unrated : ''}`);
    return list.length > 0 ? [t.reasons.forTeam(listNames(names), teamName(teamId))] : [];
  });
  parts.push(lists.length > 0 ? t.reasons.formList(lists.join('; ')) : t.reasons.noForm);
  if (adjusted && plain) {
    const same = percent(adjusted.odds.win) === percent(plain.odds.win);
    parts.push(same ? t.reasons.hardlyChange : t.reasons.withThese(adjusted.odds.win, plain.odds.win));
  }
  return parts.join(' ');
}

/** How the chances are worked out, for a "How is this worked out?" box. */
export function HowWorkedOut() {
  return (
    <details className="why">
      <summary>{t.common.howWorkedOut}</summary>
      <p className="muted small">{t.preview.howWorkedOut}</p>
    </details>
  );
}

type HeatBin = 0 | 1 | 2 | 3 | 4;
const heat = (p: number): HeatBin => (p >= 0.8 ? 4 : p >= 0.6 ? 3 : p > 0.4 ? 2 : p > 0.2 ? 1 : 0);

export function MatchPreview({ pool, match }: { pool: PoolData; match: TeamMatch }) {
  const scale = useMemo(() => fitScale(pool), [pool]);
  const size = lineupSize(pool);
  const teams = teamsById(pool);
  const players = playersById(pool);
  const teamName = (id: string) => teams.get(id)?.name ?? t.common.team;
  const playerName = (id: string) => players.get(id)?.name ?? t.common.unknownPlayer;

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
  const home = teamId === match.homeTeamId;
  const picked = { team: chosen(teamId), opponent: chosen(opponentId) };
  const summary = ratingSummary(pool, teamId, opponentId, scale, picked, home);
  const plain = ratingSummary(pool, teamId, opponentId, scale, picked, home, false);
  const common = commonOpponentForecast(pool, teamId, opponentId);
  const odds = matchOdds(summary?.odds ?? null, common.odds);

  const opponentColumns = chosen(opponentId) ?? usualLineup(pool, opponentId, size);
  const shownRating = (id: string) => players.get(id)?.rating ?? null;
  const ourRows = [...teamRoster(pool, teamId)].sort(
    (a, b) => (shownRating(b) ?? -Infinity) - (shownRating(a) ?? -Infinity),
  );
  const grid = opponentColumns.length > 0 ? ratingForecast(pool, ourRows, opponentColumns, scale, home, FORM_SPREAD) : null;

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
    if (ids.length === 0) return t.preview.statusSeason;
    if (ids.length < size) return t.preview.statusPickMore(size - ids.length);
    return planned ? t.preview.statusPlanned : t.preview.statusYours;
  };

  return (
    <>
      <section className="card">
        <div className="section-head">
          <h2>{t.preview.chances}</h2>
          <div className="segmented" role="group" aria-label={t.preview.showFor}>
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
              {t.preview.headline(
                teamName(teamId),
                <strong>{percent(odds.win)}</strong>,
                oddsSentence(odds),
                `${oneDecimal(odds.expectedGames)}–${oneDecimal(odds.totalGames - odds.expectedGames)}`,
              )}
            </p>
            <OddsBar odds={odds} />
          </>
        ) : (
          <p className="muted">{t.preview.notEnough}</p>
        )}
        <ul className="reasons">
          <li>
            <strong>{t.preview.reasonRatings}</strong> {ratingReason(plain, teamName(teamId), teamName(opponentId))}
          </li>
          <li>
            <strong>{t.preview.reasonForm}</strong>{' '}
            {formReason(pool, scale, match, [{ teamId, lineup: picked.team }, { teamId: opponentId, lineup: picked.opponent }], summary, plain, teamName, playerName)}
          </li>
          <li>
            <strong>{t.preview.reasonCommon}</strong> {commonReason(common, teamName(teamId))}
          </li>
        </ul>
        <HowWorkedOut />
      </section>

      <section className="card">
        <h2>{t.preview.lineups}</h2>
        <p className="muted">{t.preview.tryLineup}</p>
        {[teamId, opponentId].map((side) => {
          const selected = lineups[side].ids;
          return (
            <div key={side} className="lineup-picker">
              <h3>{teamName(side)}</h3>
              <p className="muted small">
                {status(side)}{' '}
                {selected.length > 0 && (
                  <button type="button" className="link-button" onClick={() => reset(side)}>
                    {t.preview.backToSeason}
                  </button>
                )}
              </p>
              <div className="chips">
                {teamRoster(pool, side).map((id) => (
                  <button key={id} type="button" className="chip" aria-pressed={selected.includes(id)} onClick={() => toggle(side, id)}>
                    {playerName(id)} <span className="chip-meta">{players.get(id)?.rating ?? t.common.unrated}</span>
                  </button>
                ))}
              </div>
            </div>
          );
        })}
      </section>

      {grid && (
        <section className="card">
          <h2>{t.preview.grid}</h2>
          <p className="muted">
            {t.preview.gridNote(
              teamName(teamId),
              chosen(opponentId) ? t.preview.columnsPicked(teamName(opponentId)) : t.preview.columnsUsual(teamName(opponentId)),
            )}
          </p>
          <div className="table-scroll">
            <table className="heat-table">
              <thead>
                <tr>
                  <th scope="col">
                    <span className="sr-only">{t.preview.gridPlayer(teamName(teamId))}</span>
                  </th>
                  {grid.opponent.map((id) => (
                    <th key={id} scope="col">
                      <a href={href('player', pool.pool.id, id)}>{playerName(id)}</a>
                      <span className="muted small"> {shownRating(id) ?? t.common.unrated}</span>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {grid.team.map((id, i) => (
                  <tr key={id} className={lineups[teamId].ids.includes(id) ? 'is-picked' : undefined}>
                    <th scope="row">
                      <a href={href('player', pool.pool.id, id)}>{playerName(id)}</a>
                      <span className="muted small"> {shownRating(id) ?? t.common.unrated}</span>
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
            {[4, 3, 2, 1, 0].map((bin) => (
              <span key={bin}>
                <i className={`swatch heat heat-${bin}`} /> {t.preview.heat[bin]}
              </span>
            ))}
          </div>
        </section>
      )}

      {(common.rows.length > 0 || common.direct.length > 0) && (
        <section className="card">
          <h2>{t.preview.commonTitle}</h2>
          <p className="muted">{t.preview.commonNote(teamName(teamId))}</p>
          <div className="table-scroll">
            <table className="data-table wrap-head">
              <thead>
                <tr>
                  <th scope="col">{t.common.against}</th>
                  <th scope="col" className="num">{teamName(teamId)}</th>
                  <th scope="col" className="num">{teamName(opponentId)}</th>
                  <th scope="col" className="num">{t.preview.difference}</th>
                </tr>
              </thead>
              <tbody>
                {common.direct.length > 0 && (
                  <tr>
                    <th scope="row">{t.preview.eachOther}</th>
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
