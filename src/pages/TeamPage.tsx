import { useEffect } from 'react';
import { PointsRace } from '../charts/PointsRace';
import { loadPool, useLoaded } from '../data/load';
import type { PoolData, TeamRef } from '../data/model';
import {
  outcomeFor,
  playersById,
  pointsRace,
  scoreFor,
  teamMatches,
  teamPlayerLines,
  teamsById,
  isHome,
  opponentOf,
  winRate,
} from '../data/stats';
import { href } from '../lib/router';
import { matchDay, matchTime, NotFound, ordinal, OutcomeBadge, PageState, percent, portalUrl, StatTile, WinMeter } from '../components/ui';

export const LAST_TEAM_KEY = 'teamhub:last-team';

export function TeamPage({ poolId, teamId }: { poolId: string; teamId: string }) {
  const loaded = useLoaded(() => loadPool(poolId), poolId);
  if (loaded.status !== 'ready') return <PageState state={loaded} what="this team" />;
  const team = loaded.data.teams.find((t) => t.id === teamId);
  if (!team) return <NotFound what="this team" />;
  return <TeamView pool={loaded.data} team={team} />;
}

function TeamView({ pool, team }: { pool: PoolData; team: TeamRef }) {
  useEffect(() => {
    try {
      localStorage.setItem(LAST_TEAM_KEY, JSON.stringify({ poolId: pool.pool.id, teamId: team.id, name: team.name }));
    } catch {
      /* storage unavailable */
    }
  }, [pool.pool.id, team.id, team.name]);

  const teams = teamsById(pool);
  const players = playersById(pool);
  const standing = pool.standings.find((s) => s.teamId === team.id);
  const matches = teamMatches(pool, team.id);
  const played = matches.filter((m) => m.score).reverse();
  const upcoming = matches.filter((m) => !m.score);
  const race = pointsRace(pool).map((r) => ({ id: r.teamId, name: teams.get(r.teamId)?.name ?? r.teamId, points: r.points }));
  const lines = teamPlayerLines(pool, team.id);
  const teamName = (id: string) => teams.get(id)?.name ?? 'Unknown team';

  return (
    <div className="dash">
      <header className="dash-head">
        <p className="eyebrow">
          <a href={href('pool', pool.pool.id)}>{pool.pool.name}</a> · {pool.pool.league}
        </p>
        <h1>{team.name}</h1>
        <div className="button-row">
          <a className="button primary" href={href('lineup', `team-${pool.pool.id}-${team.id}`)}>
            Plan lineups
          </a>
          <a className="button" href={portalUrl(pool.pool, 3, { teamId: team.id })} target="_blank" rel="noreferrer">
            Open on bordtennisportalen.dk
          </a>
        </div>
      </header>

      {standing && (
        <div className="tiles">
          <StatTile label="Position" value={ordinal(standing.position)} detail={`of ${pool.standings.length} teams`} />
          <StatTile label="Points" value={standing.points} detail={`after ${standing.played} matches`} />
          <StatTile label="Won, drawn, lost" value={`${standing.won}–${standing.drawn}–${standing.lost}`} />
          <StatTile label="Games won and lost" value={`${standing.gamesFor}–${standing.gamesAgainst}`} />
        </div>
      )}

      {played.length > 0 && (
        <section className="card">
          <h2>Points race</h2>
          <p className="muted">League points after each match, compared with the rest of the pool.</p>
          <PointsRace series={race} highlightId={team.id} />
        </section>
      )}

      <section className="card">
        <div className="section-head">
          <h2>Results</h2>
          <span className="muted">{played.length} played</span>
        </div>
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
                    <span className="result-vs">
                      vs <a href={href('team', pool.pool.id, opponentOf(m, team.id))}>{teamName(opponentOf(m, team.id))}</a>{' '}
                      <span className="tag">{isHome(m, team.id) ? 'Home' : 'Away'}</span>
                    </span>
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

      <section className="card">
        <div className="section-head">
          <h2>Players</h2>
          <span className="muted">Everyone who played for {team.name} in this pool</span>
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
                  <th scope="col" className="num">Matches</th>
                  <th scope="col">Singles</th>
                  <th scope="col" className="num">Doubles</th>
                  <th scope="col" className="num">Sets</th>
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
                      </th>
                      <td className="num">{player?.rating ?? '–'}</td>
                      <td className="num">{line.matches}</td>
                      <td>
                        <span className="wl">
                          <span className="wl-text">
                            {line.singles.won}–{line.singles.lost} <span className="muted">{percent(rate)}</span>
                          </span>
                          <WinMeter rate={rate} label={`Singles for ${player?.name ?? 'player'}`} />
                        </span>
                      </td>
                      <td className="num">
                        {line.doubles.won}–{line.doubles.lost}
                      </td>
                      <td className="num">
                        {line.sets.won}–{line.sets.lost}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {upcoming.length > 0 && (
        <section className="card">
          <div className="section-head">
            <h2>Upcoming matches</h2>
            <span className="muted">{upcoming.length} left</span>
          </div>
          <ul className="result-list">
            {upcoming.map((m) => (
              <li key={m.id} className="result-row">
                <div className="result-main">
                  <span className="result-when">
                    {matchDay(m.date)} · {matchTime(m.date)}
                  </span>
                  <span className="result-vs">
                    vs <a href={href('team', pool.pool.id, opponentOf(m, team.id))}>{teamName(opponentOf(m, team.id))}</a>{' '}
                    <span className="tag">{isHome(m, team.id) ? 'Home' : 'Away'}</span>
                  </span>
                  <span className="result-venue">{m.venue}</span>
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
