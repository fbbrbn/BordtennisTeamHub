import { useEffect, useMemo } from 'react';
import { PointsRace } from '../charts/PointsRace';
import { FollowButton } from '../components/FollowButton';
import { OddsBar, oddsSentence, ThinOdds } from '../components/Odds';
import { PastSeasonTag } from '../components/PlayerHistory';
import { PredictedLine, PredictionRecordNote } from '../components/Prediction';
import { listNote } from '../components/RatingForecast';
import { clubSlug } from '../data/clubs';
import { fitScale, forecastMatch, lineupSize, ratingSummary, type MatchForecast } from '../data/forecast';
import { teamInsights, type Insight } from '../data/insights';
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
import { rememberTeam } from '../lib/lastTeam';
import { count } from '../lib/text';
import { href } from '../lib/router';
import { matchDay, matchTime, NotFound, ordinal, OutcomeBadge, PageState, percent, portalUrl, signed, StatTile, WinMeter } from '../components/ui';
import { plannedLineup } from '../lineup/planned';
import { commonReason, formReason, HowWorkedOut, ratingReason } from './MatchPreview';

type Tab = 'overview' | 'matches' | 'players';
const TABS: { id: Tab; label: string }[] = [
  { id: 'overview', label: 'Overview' },
  { id: 'matches', label: 'Matches' },
  { id: 'players', label: 'Players' },
];
/** Insights a captain acts on come first; the rest sit behind "More insights". */
const INSIGHT_ORDER = ['Table', 'Outlook', 'Best lineup', 'Standout', 'Form', 'Close games', 'Doubles'];
const INSIGHTS_SHOWN = 4;

export function TeamPage({ poolId, teamId, tab }: { poolId: string; teamId: string; tab: string | null }) {
  const loaded = useLoaded(() => loadPool(poolId), poolId);
  if (loaded.status !== 'ready') return <PageState state={loaded} what="this team" />;
  const team = loaded.data.teams.find((t) => t.id === teamId);
  if (!team) return <NotFound what="this team" />;
  const active = TABS.find((t) => t.id === tab)?.id ?? 'overview';
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
              Plan lineup
            </a>
          </div>
        )}
      </header>

      <nav className="tabs" aria-label="Team pages">
        {TABS.map((t) => (
          <a key={t.id} href={t.id === 'overview' ? base : `${base}?tab=${t.id}`} aria-current={tab === t.id ? 'page' : undefined}>
            {t.label}
          </a>
        ))}
      </nav>

      {tab === 'overview' && <Overview pool={pool} team={team} upcoming={upcoming} forecasts={forecasts} scale={scale} />}
      {tab === 'matches' && <Matches pool={pool} team={team} matches={matches} forecasts={forecasts} />}
      {tab === 'players' && <Players pool={pool} team={team} />}

      <p className="page-source muted small">
        <a href={portalUrl(pool.pool, 3, { teamId: team.id })} target="_blank" rel="noreferrer">
          See this team on bordtennisportalen.dk
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
  const odds = nextForecast?.forecast.odds;
  const opponent = next ? (teams.get(opponentOf(next, team.id))?.name ?? 'the opponent') : '';
  // The same forecast without form and the home table, for "ratings alone".
  const nextLineup = next ? (plannedLineup(pool.pool.id, team.id, next.id, lineupSize(pool)) ?? undefined) : undefined;
  const plain = next ? ratingSummary(pool, team.id, opponentOf(next, team.id), scale, { team: nextLineup }, isHome(next, team.id), false) : null;
  const nameOf = (id: string) => teams.get(id)?.name ?? 'Team';
  const playerName = (id: string) => players.get(id)?.name ?? 'Unknown player';

  return (
    <>
      {standing && (
        <div className="tiles">
          <StatTile label="Position" value={ordinal(standing.position)} detail={`of ${pool.standings.length} teams`} />
          <StatTile label="Points" value={standing.points} detail={`after ${standing.played} matches`} />
          <StatTile label="Won, drawn, lost" value={`${standing.won}–${standing.drawn}–${standing.lost}`} />
          <StatTile label="Games won and lost" value={`${standing.gamesFor}–${standing.gamesAgainst}`} />
        </div>
      )}

      {next && (
        <section className="card next-match">
          <div className="section-head">
            <h2>Next match</h2>
            <span className="muted small">
              {matchDay(next.date)} · {matchTime(next.date)}
            </span>
          </div>
          <p className="next-when">
            vs <a href={href('team', pool.pool.id, opponentOf(next, team.id))}>{opponent}</a>{' '}
            <span className="tag">{isHome(next, team.id) ? 'Home' : 'Away'}</span>
            <span className="muted small"> · {next.venue}</span>
          </p>
          {odds && nextForecast && (
            <>
              <p className="odds-headline">
                <strong>{percent(odds.win)}</strong> {oddsSentence(odds)}
              </p>
              <OddsBar odds={odds} />
              <details className="why">
                <summary>Why these chances?</summary>
                <ul className="reasons">
                  <li>
                    <strong>Player ratings.</strong> {ratingReason(plain, team.name, opponent)}
                  </li>
                  <li>
                    <strong>Form and home table.</strong>{' '}
                    {formReason(pool, scale, next, [{ teamId: team.id, lineup: nextLineup }, { teamId: opponentOf(next, team.id) }], nextForecast.forecast.rating, plain, nameOf, playerName)}
                  </li>
                  <li>
                    <strong>Common opponents.</strong> {commonReason(nextForecast.forecast.common, team.name)}
                  </li>
                </ul>
                <p className="muted small">
                  {nextForecast.planned
                    ? `Using the lineup from your planner: ${(nextForecast.forecast.rating?.team ?? []).map((id) => players.get(id)?.name ?? '?').join(', ')}.`
                    : 'Based on the lineups both teams have used this season. Mark who can play in the planner to use your real lineup.'}
                </p>
                <HowWorkedOut />
              </details>
            </>
          )}
          <a className="button" href={href('match', pool.pool.id, next.id)}>
            Preview and try lineups
          </a>
        </section>
      )}

      {insights.length > 0 && (
        <section className="card">
          <h2>Insights</h2>
          <InsightList insights={insights.slice(0, INSIGHTS_SHOWN)} />
          {insights.length > INSIGHTS_SHOWN && (
            <details className="more">
              <summary>
                {insights.length - INSIGHTS_SHOWN} more insight{insights.length - INSIGHTS_SHOWN === 1 ? '' : 's'}
              </summary>
              <InsightList insights={insights.slice(INSIGHTS_SHOWN)} />
            </details>
          )}
        </section>
      )}

      {anyPlayed && (
        <section className="card">
          <h2>Points over the season</h2>
          <p className="muted">League points after each match, compared with the rest of the pool.</p>
          <PointsRace series={race} highlightId={team.id} />
        </section>
      )}
    </>
  );
}

function Matches({ pool, team, matches, forecasts }: { pool: PoolData; team: TeamRef; matches: TeamMatch[]; forecasts: Forecasts }) {
  const teams = teamsById(pool);
  const teamName = (id: string) => teams.get(id)?.name ?? 'Unknown team';
  const upcoming = matches.filter((m) => !m.score);
  const played = matches.filter((m) => m.score).reverse();
  const opponentLink = (m: TeamMatch) => (
    <span className="result-vs">
      vs <a href={href('team', pool.pool.id, opponentOf(m, team.id))}>{teamName(opponentOf(m, team.id))}</a>{' '}
      <span className="tag">{isHome(m, team.id) ? 'Home' : 'Away'}</span>
    </span>
  );

  return (
    <>
      {upcoming.length > 0 && (
        <section className="card">
          <div className="section-head">
            <h2>Coming up</h2>
            <span className="muted">{upcoming.length} left</span>
          </div>
          <p className="muted small">Chance to win each match. Tap a match for the preview and to try lineups.</p>
          <ul className="result-list">
            {upcoming.map((m) => {
              const odds = forecasts.get(m.id)?.forecast.odds;
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
                    <a className="result-odds" href={href('match', pool.pool.id, m.id)} aria-label={`Preview: ${percent(odds.win)} chance to win`}>
                      <span className="result-odds-text">{percent(odds.win)} win</span>
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
          <h2>Results</h2>
          <span className="muted">{played.length} played</span>
        </div>
        <PredictionRecordNote matches={played} />
        {played.length === 0 ? (
          <p className="muted">No matches played yet.</p>
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
                    <a className="result-score" href={href('match', pool.pool.id, m.id)} aria-label={`Games of the match, ${score?.join(' to ')}`}>
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
        <h2>Players</h2>
        <span className="muted small">Tap a name for their games and insights</span>
      </div>
      {lines.length === 0 ? (
        <p className="muted">No games recorded yet.</p>
      ) : (
        <div className="table-scroll">
          <table className="data-table">
            <thead>
              <tr>
                <th scope="col">Player</th>
                <th scope="col" className="num">Rating</th>
                <th scope="col">Singles</th>
                <th scope="col" className="num wide-only">
                  Doubles
                </th>
                <th scope="col" className="num wide-only">
                  Sets
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
                      <a href={href('player', pool.pool.id, line.playerId)}>{player?.name ?? 'Unknown player'}</a>
                      <div className="muted small">{count(line.matches, 'match', 'matches')}</div>
                    </th>
                    <td className="num">
                      {player?.rating ?? 'unrated'}
                      {player?.forecast && player.rating !== null && (
                        <div className="muted small" title="Forecast">
                          → {player.forecast.rating} ({signed(player.forecast.rating - player.rating)})
                        </div>
                      )}
                    </td>
                    <td>
                      <span className="wl">
                        <span className="wl-text">
                          {line.singles.won}–{line.singles.lost} <span className="muted">{percent(rate)}</span>
                        </span>
                        <WinMeter rate={rate} label={`Singles for ${player?.name ?? 'player'}`} />
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
        <p className="muted small">
          → Forecast: the rating once the singles played since the official {listNote(status)} are rated.
        </p>
      )}
    </section>
  );
}

function InsightList({ insights }: { insights: Insight[] }) {
  return (
    <ul className="insights">
      {insights.map((insight) => (
        <li key={insight.topic}>
          <span className="insight-topic">{insight.topic}</span>
          <span>{insight.text}</span>
        </li>
      ))}
    </ul>
  );
}

function sortInsights(insights: Insight[]): Insight[] {
  const rank = (topic: string) => {
    const i = INSIGHT_ORDER.indexOf(topic);
    return i === -1 ? INSIGHT_ORDER.length : i;
  };
  return [...insights].sort((a, b) => rank(a.topic) - rank(b.topic));
}
