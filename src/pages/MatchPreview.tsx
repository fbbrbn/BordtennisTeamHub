import { useMemo, useState } from 'react';
import { OddsBar } from '../components/Odds';
import { dayWithYear } from '../components/ui';
import {
  commonOpponentForecast,
  fitScale,
  forecastPlayers,
  FORM_SPREAD,
  homePoints,
  lineupSize,
  matchOdds,
  playerAdjustments,
  predictionOdds,
  ratingForecast,
  ratingSummary,
  teamRoster,
  usualLineup,
  type CommonForecast,
  type Odds,
  type RatingSummary,
} from '../data/forecast';
import { loadHeadToHead, useLoaded } from '../data/load';
import type { HeadToHead, PoolData, TeamMatch } from '../data/model';
import { playersById, teamsById } from '../data/stats';
import { readLastTeam } from '../lib/lastTeam';
import { href } from '../lib/router';
import { t } from '../i18n';
import { listNames, oneDecimal, percent, signed as signedNumber } from '../lib/text';
import { plannedLineup } from '../lineup/planned';

/** One step in how the chances come about: its name, the chance to win at that step, and what it rests on. */
interface Step {
  label: string;
  win: number | null;
  notes: string[];
}

/**
 * How a match's chances come about, step by step: the ratings alone, the ratings with form and the
 * home table, the common opponents, and all together. `adjusted` and `plain` are the rating odds with
 * and without form and the home table.
 */
export function WhyChances({
  pool,
  scale,
  match,
  sides,
  adjusted,
  plain,
  common,
  odds,
  basis,
  teamName,
  playerName,
}: {
  pool: PoolData;
  scale: number;
  match: TeamMatch;
  /** Our side first: each team, and the lineup picked for it if any. */
  sides: { teamId: string; lineup?: string[] }[];
  adjusted: RatingSummary | null;
  plain: RatingSummary | null;
  common: CommonForecast;
  odds: Odds;
  /** Which lineups the chances rest on, where the page does not show them itself. */
  basis?: string;
  teamName: (id: string) => string;
  playerName: (id: string) => string;
}) {
  const home = homePoints(pool, scale);
  // Players well above or below their rating, by team.
  const form = sides.flatMap(({ teamId, lineup }) => {
    const list = playerAdjustments(pool, forecastPlayers(pool, teamId, lineup), scale, 15).slice(0, 4);
    const names = list.map((a) => `${playerName(a.id)} ${signedNumber(a.points)}${a.youth ? t.reasons.youth : a.unrated ? t.reasons.unrated : ''}`);
    return list.length > 0 ? [t.reasons.forTeam(teamName(teamId), names.join(', '))] : [];
  });
  const what = listNames(
    [common.rows.length > 0 ? t.reasons.commonOpponents(common.rows.length) : '', common.direct.length > 0 ? t.reasons.earlierMeeting : ''].filter(Boolean),
  );
  const margin = Math.abs(common.margin ?? 0);
  const how = margin < 0.5 ? t.reasons.asWell : (common.margin ?? 0) > 0 ? t.reasons.better(margin) : t.reasons.worse(margin);
  const steps: Step[] = [
    {
      label: t.reasons.ratings,
      win: plain?.odds.win ?? null,
      notes: [plain ? t.reasons.averages(Math.round(plain.teamAverage), Math.round(plain.opponentAverage)) : t.reasons.noRatings],
    },
    {
      label: t.reasons.form,
      win: adjusted?.odds.win ?? null,
      notes: [home > 0 ? t.reasons.atHome(teamName(match.homeTeamId), home) : t.reasons.noHomeEdge, ...(form.length > 0 ? form : [t.reasons.noForm])],
    },
    {
      label: t.reasons.common,
      win: common.odds?.win ?? null,
      notes: [common.margin === null || !common.odds ? t.reasons.noCommon : t.reasons.commonNote(what, how)],
    },
  ];
  const share = (win: number | null) => (win === null ? '–' : percent(win));

  return (
    <>
      <div className="steps">
        <p className="steps-head">{t.reasons.chanceToWin}</p>
        {steps.map((step) => (
          <div key={step.label} className="step">
            <p className="step-line">
              <span>{step.label}</span>
              <span className="step-win">{share(step.win)}</span>
            </p>
            {step.notes.map((note) => (
              <p key={note} className="step-note">
                {note}
              </p>
            ))}
          </div>
        ))}
        <div className="step step-total">
          <p className="step-line">
            <span>{t.reasons.total}</span>
            <span className="step-win">{share(odds.win)}</span>
          </p>
          {adjusted && common.odds && <p className="step-note">{t.reasons.weights}</p>}
        </div>
      </div>
      {basis && <p className="muted small">{basis}</p>}
      <details className="why">
        <summary>{t.common.howWorkedOut}</summary>
        <p className="muted small">{t.preview.howWorkedOut}</p>
      </details>
    </>
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
  // A team that has not played in the pool yet: the importer's prediction, made from borrowed lineups.
  const live = matchOdds(summary?.odds ?? null, common.odds);
  const stored = live || match.score ? null : predictionOdds(match, teamId);
  const odds = live ?? stored;
  const basis = match.prediction?.lineups;

  const opponentColumns = chosen(opponentId) ?? usualLineup(pool, opponentId, size);
  const shownRating = (id: string) => players.get(id)?.rating ?? null;
  const ourRows = [...teamRoster(pool, teamId)].sort(
    (a, b) => (shownRating(b) ?? -Infinity) - (shownRating(a) ?? -Infinity),
  );
  const grid = opponentColumns.length > 0 ? ratingForecast(pool, ourRows, opponentColumns, scale, home, FORM_SPREAD) : null;

  // Singles between our players and theirs, this season and before (src/data/headtohead.ts).
  const h2hState = useLoaded(() => loadHeadToHead(ourRows), `h2h:${ourRows.join(',')}`);
  const h2h = h2hState.status === 'ready' ? h2hState.data : null;
  const record = (ours: string, theirs: string) => h2h?.records.get(ours)?.get(theirs);
  const meetings = ourRows
    .flatMap((ours) => teamRoster(pool, opponentId).map((theirs) => ({ ours, theirs, record: record(ours, theirs) })))
    .filter((m): m is { ours: string; theirs: string; record: HeadToHead } => m.record !== undefined)
    .sort((a, b) => b.record[0] + b.record[1] - (a.record[0] + a.record[1]) || b.record[2].localeCompare(a.record[2]));
  const meetingText = (m: { ours: string; theirs: string; record: HeadToHead }) =>
    t.preview.h2hItem(playerName(m.ours), playerName(m.theirs), m.record[0], m.record[1], dayWithYear(m.record[2]), m.record[3] === 1);
  const gridMeetings = grid ? meetings.filter((m) => grid.team.includes(m.ours) && grid.opponent.includes(m.theirs)) : [];

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

  /** What to say under a team's name: nothing while it uses the season's lineups or a full pick of your own. */
  const status = (side: string) => {
    const { ids, planned } = lineups[side];
    if (teamRoster(pool, side).length === 0) return t.preview.statusNoPlayers;
    if (ids.length === 0) return null;
    if (ids.length < size) return t.preview.statusPickMore(size - ids.length);
    return planned ? t.preview.statusPlanned : null;
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
              <strong>{percent(odds.win)}</strong> {t.preview.winFor(teamName(teamId))}
              <span className="odds-expected">
                {t.preview.expected(`${oneDecimal(odds.expectedGames)}–${oneDecimal(odds.totalGames - odds.expectedGames)}`)}
              </span>
            </p>
            <OddsBar odds={odds} />
            <details className="why">
              <summary>{t.team.whyChances}</summary>
              {stored ? (
                basis && <p className="muted small">{t.prediction.borrowed[basis]}</p>
              ) : (
                <WhyChances
                  pool={pool}
                  scale={scale}
                  match={match}
                  sides={[
                    { teamId, lineup: picked.team },
                    { teamId: opponentId, lineup: picked.opponent },
                  ]}
                  adjusted={summary}
                  plain={plain}
                  common={common}
                  odds={odds}
                  teamName={teamName}
                  playerName={playerName}
                />
              )}
            </details>
          </>
        ) : (
          <p className="muted">{t.preview.notEnough}</p>
        )}
      </section>

      <section className="card">
        <h2>{t.preview.lineups}</h2>
        <p className="muted">{stored ? t.preview.tryLineupStored : t.preview.tryLineup}</p>
        {[teamId, opponentId].map((side) => {
          const selected = lineups[side].ids;
          return (
            <div key={side} className="lineup-picker">
              <h3>{teamName(side)}</h3>
              {(status(side) || selected.length > 0) && (
                <p className="muted small">
                  {status(side)}{' '}
                  {selected.length > 0 && (
                    <button type="button" className="link-button" onClick={() => reset(side)}>
                      {t.preview.backToSeason}
                    </button>
                  )}
                </p>
              )}
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
              chosen(opponentId) ? t.preview.columnsPicked : t.preview.columnsUsual(teamName(opponentId)),
            )}{' '}
            {t.preview.gridTap}
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
                    {grid.singles[i].map((p, j) => {
                      const theirs = grid.opponent[j];
                      const met = gridMeetings.find((m) => m.ours === id && m.theirs === theirs);
                      const record = met ? `${met.record[0]}–${met.record[1]}` : null;
                      return (
                        <td key={theirs} className={`heat heat-${heat(p)}`}>
                          {/* The whole cell opens the two players' page, with why the chance is what it is. */}
                          <a
                            className="heat-link"
                            href={`${href('vs', pool.pool.id, id, pool.pool.id, theirs)}?match=${encodeURIComponent(match.id)}`}
                            aria-label={t.preview.cellLabel(playerName(id), playerName(theirs), percent(p), record)}
                          >
                            {percent(p)}
                            {met && (
                              <span className="h2h" title={meetingText(met)}>
                                {record}
                              </span>
                            )}
                          </a>
                        </td>
                      );
                    })}
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
          {gridMeetings.length > 0 && h2h && <p className="muted small">{t.preview.h2hNote(h2h.from)}</p>}
          {meetings.length > 0 && (
            <details className="why">
              <summary>{t.preview.h2hAll(meetings.length)}</summary>
              <ul className="reasons small">
                {meetings.map((m) => (
                  <li key={`${m.ours}-${m.theirs}`}>{meetingText(m)}</li>
                ))}
              </ul>
            </details>
          )}
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
