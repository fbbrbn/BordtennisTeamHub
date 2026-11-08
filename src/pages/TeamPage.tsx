import { useEffect, useMemo } from 'react';
import { PointsRace } from '../charts/PointsRace';
import { FollowButton } from '../components/FollowButton';
import { OddsBar, oddsSentence, ThinOdds } from '../components/Odds';
import { PastSeasonTag } from '../components/PlayerHistory';
import { PredictedLine, PredictionRecordNote } from '../components/Prediction';
import { listNote } from '../components/RatingForecast';
import { clubSlug } from '../data/clubs';
import { fitScale, forecastMatch, lineupSize, ratingSummary, shownOdds, type MatchForecast } from '../data/forecast';
import { teamInsights, type Insight, type InsightId } from '../data/insights';
import { loadPool, useLoaded } from '../data/load';
import type { PoolData, TeamMatch, TeamRef } from '../data/model';
import {
  isHome,
  opponentOf,
  outcomeFor,
  playersById,
  pointsRace,
  scoreFor,
  teamMatches,
  teamPlayerLines,
  teamsById,
  winRate,
} from '../data/stats';
import { t } from '../i18n';
import { rememberTeam } from '../lib/lastTeam';
import { href } from '../lib/router';
import { matchDay, matchTime, NotFound, ordinal, OutcomeBadge, PageState, percent, portalUrl, signed, StatTile, WinMeter } from '../components/ui';
import { plannedLineup } from '../lineup/planned';
import { commonReason, formReason, HowWorkedOut, ratingReason } from './MatchPreview';

type Tab = 'overview' | 'matches' | 'players';
const TABS: Tab[] = ['overview', 'matches', 'players'];
/** Insights a captain acts on come first; the rest sit behind "More insights". */
const INSIGHT_ORDER: InsightId[] = ['table', 'outlook', 'bestLineup', 'standout', 'form', 'closeGames', 'doubles'];
const INSIGHTS_SHOWN = 4;

export function TeamPage({ poolId, teamId, tab }: { poolId: string; teamId: string; tab: string | null }) {
  const loaded = useLoaded(() => loadPool(poolId), poolId);
  if (loaded.status !== 'ready') return <PageState state={loaded} what="team" />;
  const team = loaded.data.teams.find((x) => x.id === teamId);
  if (!team) return <NotFound what="team" />;
  const active = TABS.find((x) => x === tab) ?? 'overview';
  return <TeamView pool={loaded.data} team={team} tab={active} />;
}

interface Forecasts {
  get(matchId: string): { planned: boolean; forecast: MatchForecast } | undefined;
}

function TeamView({ pool, team, tab }: { pool: PoolData; team: TeamRef; tab: Tab }) {
  // A past season's team is not "My team".
  const past = pool.pool.past === true;
  useEffect(() => {
    if (!past) rememberTeam({ poolId: pool.pool.id, teamId: team.id, name: team.name });
  }, [past, pool.pool.id, team.id, team.name]);

  const matches = teamMatches(pool, team.id);
  const upcoming = matches.filter((m) => !m.score);
  const scale = useMemo(() => fitScale(pool), [pool]);
  const size = lineupSize(pool);
  const forecasts = useMemo(
    () =>
      new Map(
        upcoming.map((m) => {
          const planned = plannedLineup(pool.pool.id, team.id, m.id, size);
          return [m.id, { planned: planned !== null, forecast: forecastMatch(pool, m, team.id, scale, planned ? { team: planned } : {}) }];
        }),
      ),
    // `upcoming` is derived from pool and team, which are already dependencies.
    [pool, team.id, scale, size],
  );
  const base = href('team', pool.pool.id, team.id);

  return (
    <div className="dash">
      <header className="dash-head">
        <p className="eyebrow">
          {team.club && (
            <>
              <a href={href('club', clubSlug(team.club))}>{team.club}</a> ·{' '}
            </>
          )}
          <a href={href('pool', pool.pool.id)}>{pool.pool.name}</a> · {pool.pool.league} <PastSeasonTag pool={pool.pool} />
        </p>
        <h1>{team.name}</h1>
        {!past && (
          <div className="button-row">
            <FollowButton team={{ poolId: pool.pool.id, teamId: team.id, name: team.name }} />
            <a className="button primary" href={href('lineup', `team-${pool.pool.id}-${team.id}`)}>
              {t.common.planLineup}
            </a>
          </div>
        )}
      </header>

      <nav className="tabs" aria-label={t.team.tabsLabel}>
        {TABS.map((id) => (
          <a key={id} href={id === 'overview' ? base : `${base}?tab=${id}`} aria-current={tab === id ? 'page' : undefined}>
            {t.team.tabs[id]}
          </a>
        ))}
      </nav>

      {tab === 'overview' && <Overview pool={pool} team={team} upcoming={upcoming} forecasts={forecasts} scale={scale} />}
      {tab === 'matches' && <Matches pool={pool} team={team} matches={matches} forecasts={forecasts} />}
      {tab === 'players' && <Players pool={pool} team={team} />}

      <p className="page-source muted small">
        <a href={portalUrl(pool.pool, 3, { teamId: team.id })} target="_blank" rel="noreferrer">
          {t.team.onPortal}
        </a>
      </p>
    </div>
  );
}

function Overview({
  pool,
  team,
  upcoming,
  forecasts,
  scale,
}: {
  pool: PoolData;
  team: TeamRef;
  upcoming: TeamMatch[];
  forecasts: Forecasts;
  scale: number;
}) {
  const teams = teamsById(pool);
  const players = playersById(pool);
  const standing = pool.standings.find((s) => s.teamId === team.id);
  const insights = useMemo(() => sortInsights(teamInsights(pool, team.id, scale)), [pool, team.id, scale]);
  const race = pointsRace(pool).map((r) => ({ id: r.teamId, name: teams.get(r.teamId)?.name ?? r.teamId, points: r.points }));
  const anyPlayed = race.some((r) => r.points.length > 1);
  const next = upcoming[0];
  const nextForecast = next ? forecasts.get(next.id) : undefined;
  // A team that has not played in the pool yet: the importer's prediction, from borrowed lineups.
  const shown = next && nextForecast ? shownOdds(nextForecast.forecast, next) : null;
  const odds = shown?.odds;
  const opponent = next ? (teams.get(opponentOf(next, team.id))?.name ?? t.team.theOpponent) : '';
  // The same forecast without form and the home table, for "ratings alone".
  const nextLineup = next ? (plannedLineup(pool.pool.id, team.id, next.id, lineupSize(pool)) ?? undefined) : undefined;
  const plain = next ? ratingSummary(pool, team.id, opponentOf(next, team.id), scale, { team: nextLineup }, isHome(next, team.id), false) : null;
  const nameOf = (id: string) => teams.get(id)?.name ?? t.common.team;
  const playerName = (id: string) => players.get(id)?.name ?? t.common.unknownPlayer;

  return (
    <>
      {standing && (
        <div className="tiles">
          <StatTile label={t.team.position} value={ordinal(standing.position)} detail={t.team.ofTeams(pool.standings.length)} />
          <StatTile label={t.common.points} value={standing.points} detail={t.team.afterMatches(standing.played)} />
          <StatTile label={t.team.wonDrawnLost} value={`${standing.won}–${standing.drawn}–${standing.lost}`} />
          <StatTile label={t.team.gamesWonLost} value={`${standing.gamesFor}–${standing.gamesAgainst}`} />
        </div>
      )}

      {next && (
        <section className="card next-match">
          <div className="section-head">
            <h2>{t.team.nextMatch}</h2>
            <span className="muted small">
              {matchDay(next.date)} · {matchTime(next.date)}
            </span>
          </div>
          <p className="next-when">
            {t.common.vs} <a href={href('team', pool.pool.id, opponentOf(next, team.id))}>{opponent}</a>{' '}
            <span className="tag">{isHome(next, team.id) ? t.common.home : t.common.away}</span>
            <span className="muted small"> · {next.venue}</span>
          </p>
          {odds && nextForecast && (
            <>
              <p className="odds-headline">
                <strong>{percent(odds.win)}</strong> {oddsSentence(odds)}
              </p>
              <OddsBar odds={odds} />
              <details className="why">
                <summary>{t.team.whyChances}</summary>
                {shown?.stored ? (
                  next.prediction?.lineups && <p className="muted small">{t.prediction.borrowed[next.prediction.lineups]}</p>
                ) : (
                  <>
                    <ul className="reasons">
                      <li>
                        <strong>{t.preview.reasonRatings}</strong> {ratingReason(plain, team.name, opponent)}
                      </li>
                      <li>
                        <strong>{t.preview.reasonForm}</strong>{' '}
                        {formReason(pool, scale, next, [{ teamId: team.id, lineup: nextLineup }, { teamId: opponentOf(next, team.id) }], nextForecast.forecast.rating, plain, nameOf, playerName)}
                      </li>
                      <li>
                        <strong>{t.preview.reasonCommon}</strong> {commonReason(nextForecast.forecast.common, team.name)}
                      </li>
                    </ul>
                    <p className="muted small">
                      {nextForecast.planned
                        ? t.team.plannedLineup((nextForecast.forecast.rating?.team ?? []).map((id) => players.get(id)?.name ?? '?').join(', '))
                        : t.team.seasonLineups}
                    </p>
                  </>
                )}
                <HowWorkedOut />
              </details>
            </>
          )}
          <a className="button" href={href('match', pool.pool.id, next.id)}>
            {t.team.preview}
          </a>
        </section>
      )}

      {insights.length > 0 && (
        <section className="card">
          <h2>{t.common.insights}</h2>
          <InsightList insights={insights.slice(0, INSIGHTS_SHOWN)} />
          {insights.length > INSIGHTS_SHOWN && (
            <details className="more">
              <summary>{t.team.moreInsights(insights.length - INSIGHTS_SHOWN)}</summary>
              <InsightList insights={insights.slice(INSIGHTS_SHOWN)} />
            </details>
          )}
        </section>
      )}

      {anyPlayed && (
        <section className="card">
          <h2>{t.team.pointsRace}</h2>
          <p className="muted">{t.team.pointsRaceNote}</p>
          <PointsRace series={race} highlightId={team.id} />
        </section>
      )}
    </>
  );
}

function Matches({ pool, team, matches, forecasts }: { pool: PoolData; team: TeamRef; matches: TeamMatch[]; forecasts: Forecasts }) {
  const teams = teamsById(pool);
  const teamName = (id: string) => teams.get(id)?.name ?? t.common.unknownTeam;
  const upcoming = matches.filter((m) => !m.score);
  const played = matches.filter((m) => m.score).reverse();
  const opponentLink = (m: TeamMatch) => (
    <span className="result-vs">
      {t.common.vs} <a href={href('team', pool.pool.id, opponentOf(m, team.id))}>{teamName(opponentOf(m, team.id))}</a>{' '}
      <span className="tag">{isHome(m, team.id) ? t.common.home : t.common.away}</span>
    </span>
  );

  return (
    <>
      {upcoming.length > 0 && (
        <section className="card">
          <div className="section-head">
            <h2>{t.team.comingUp}</h2>
            <span className="muted">{t.team.left(upcoming.length)}</span>
          </div>
          <p className="muted small">{t.team.comingUpNote}</p>
          <ul className="result-list">
            {upcoming.map((m) => {
              const f = forecasts.get(m.id);
              const odds = f ? shownOdds(f.forecast, m).odds : null;
              return (
                <li key={m.id} className="result-row">
                  <div className="result-main">
                    <span className="result-when">
                      {matchDay(m.date)} · {matchTime(m.date)}
                    </span>
                    {opponentLink(m)}
                    <span className="result-venue">{m.venue}</span>
                  </div>
                  {odds && (
                    <a className="result-odds" href={href('match', pool.pool.id, m.id)} aria-label={t.team.previewLabel(odds.win)}>
                      <span className="result-odds-text">{t.odds.winShort(odds.win)}</span>
                      <ThinOdds odds={odds} />
                    </a>
                  )}
                </li>
              );
            })}
          </ul>
        </section>
      )}

      <section className="card">
        <div className="section-head">
          <h2>{t.common.results}</h2>
          <span className="muted">{t.common.played(played.length)}</span>
        </div>
        <PredictionRecordNote matches={played} />
        {played.length === 0 ? (
          <p className="muted">{t.team.nonePlayed}</p>
        ) : (
          <ul className="result-list">
            {played.map((m) => {
              const score = scoreFor(m, team.id);
              const outcome = outcomeFor(m, team.id);
              return (
                <li key={m.id} className="result-row">
                  <div className="result-main">
                    <span className="result-when">{matchDay(m.date)}</span>
                    {opponentLink(m)}
                    <PredictedLine match={m} teamId={team.id} />
                  </div>
                  <div className="result-side">
                    <a className="result-score" href={href('match', pool.pool.id, m.id)} aria-label={t.team.scoreLabel(score?.join(t.team.to) ?? '')}>
                      {score?.join('–')}
                    </a>
                    {outcome && <OutcomeBadge outcome={outcome} />}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </>
  );
}

function Players({ pool, team }: { pool: PoolData; team: TeamRef }) {
  const players = playersById(pool);
  const lines = teamPlayerLines(pool, team.id);
  const status = pool.pool.ratings;
  const forecasts = !!status && lines.some((line) => players.get(line.playerId)?.forecast);
  return (
    <section className="card">
      <div className="section-head">
        <h2>{t.common.players}</h2>
        <span className="muted small">{t.team.tapName}</span>
      </div>
      {lines.length === 0 ? (
        <p className="muted">{t.team.noGames}</p>
      ) : (
        <div className="table-scroll">
          <table className="data-table">
            <thead>
              <tr>
                <th scope="col">{t.common.player}</th>
                <th scope="col" className="num">{t.common.rating}</th>
                <th scope="col">{t.common.singles}</th>
                <th scope="col" className="num wide-only">
                  {t.common.doubles}
                </th>
                <th scope="col" className="num wide-only">
                  {t.common.sets}
                </th>
              </tr>
            </thead>
            <tbody>
              {lines.map((line) => {
                const player = players.get(line.playerId);
                const rate = winRate(line.singles);
                return (
                  <tr key={line.playerId}>
                    <th scope="row">
                      <a href={href('player', pool.pool.id, line.playerId)}>{player?.name ?? t.common.unknownPlayer}</a>
                      <div className="muted small">{t.n.matches(line.matches)}</div>
                    </th>
                    <td className="num">
                      {player?.rating ?? t.common.unrated}
                      {player?.forecast && player.rating !== null && (
                        <div className="muted small" title={t.ratings.forecastTitleShort}>
                          → {player.forecast.rating} ({signed(player.forecast.rating - player.rating)})
                        </div>
                      )}
                    </td>
                    <td>
                      <span className="wl">
                        <span className="wl-text">
                          {line.singles.won}–{line.singles.lost} <span className="muted">{percent(rate)}</span>
                        </span>
                        <WinMeter rate={rate} label={t.team.singlesFor(player?.name ?? t.common.player)} />
                      </span>
                    </td>
                    <td className="num wide-only">
                      {line.doubles.won}–{line.doubles.lost}
                    </td>
                    <td className="num wide-only">
                      {line.sets.won}–{line.sets.lost}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      {forecasts && status && (
        <p className="muted small">{t.ratings.forecastNote(listNote(status))}</p>
      )}
    </section>
  );
}

function InsightList({ insights }: { insights: Insight[] }) {
  return (
    <ul className="insights">
      {insights.map((insight) => (
        <li key={insight.id}>
          <span className="insight-topic">{insight.topic}</span>
          <span>{insight.text}</span>
        </li>
      ))}
    </ul>
  );
}

function sortInsights(insights: Insight[]): Insight[] {
  const rank = (id: InsightId) => {
    const i = INSIGHT_ORDER.indexOf(id);
    return i === -1 ? INSIGHT_ORDER.length : i;
  };
  return [...insights].sort((a, b) => rank(a.id) - rank(b.id));
}
