import { listNote, RatingRules } from '../components/RatingForecast';
import { loadPool, useLoaded } from '../data/load';
import type { PoolData, TeamMatch } from '../data/model';
import { matchRatingPoints } from '../data/ratings';
import { playersById, teamsById } from '../data/stats';
import { href } from '../lib/router';
import { matchDayLong, matchTime, NotFound, PageState, portalUrl, signed } from '../components/ui';
import { MatchPreview } from './MatchPreview';

export function MatchPage({ poolId, matchId }: { poolId: string; matchId: string }) {
  const loaded = useLoaded(() => loadPool(poolId), poolId);
  if (loaded.status !== 'ready') return <PageState state={loaded} what="this match" />;
  const match = loaded.data.matches.find((m) => m.id === matchId);
  if (!match) return <NotFound what="this match" />;
  return <MatchView pool={loaded.data} match={match} />;
}

function MatchView({ pool, match }: { pool: PoolData; match: TeamMatch }) {
  const teams = teamsById(pool);
  const players = playersById(pool);
  const home = teams.get(match.homeTeamId);
  const away = teams.get(match.awayTeamId);
  const ratingLines = matchRatingPoints(pool, match);
  const names = (ids: string[]) =>
    ids.length === 0 ? (
      <span className="muted">No player</span>
    ) : (
      ids.map((id, i) => (
        <span key={id}>
          {i > 0 && ' & '}
          <a href={href('player', pool.pool.id, id)}>{players.get(id)?.name ?? 'Unknown player'}</a>
        </span>
      ))
    );

  return (
    <div className="dash">
      <header className="dash-head">
        <p className="eyebrow">
          <a href={href('pool', pool.pool.id)}>{pool.pool.name}</a> · Match {match.id}
        </p>
        <h1 className="match-title">
          <a href={href('team', pool.pool.id, match.homeTeamId)}>{home?.name ?? 'Home'}</a>
          <span className="match-score">{match.score ? match.score.join('–') : 'vs'}</span>
          <a href={href('team', pool.pool.id, match.awayTeamId)}>{away?.name ?? 'Away'}</a>
        </h1>
        <p className="muted">
          {matchDayLong(match.date)} · {matchTime(match.date)} · {match.venue}
          {match.walkover && ' · walkover'}
        </p>
        <div className="button-row">
          <a className="button" href={portalUrl(pool.pool, 5, { matchId: match.id })} target="_blank" rel="noreferrer">
            Open on bordtennisportalen.dk
          </a>
        </div>
      </header>

      {!match.score && <MatchPreview pool={pool} match={match} />}

      {match.score && (
      <section className="card">
        <h2>Games</h2>
        {match.score && !match.games && <p className="muted">The games of this match are not available yet.</p>}
        {match.games && (
          <div className="table-scroll">
            <table className="data-table games-table">
              <thead>
                <tr>
                  <th scope="col">Game</th>
                  <th scope="col">{home?.name ?? 'Home'}</th>
                  <th scope="col" className="num">Sets</th>
                  <th scope="col">{away?.name ?? 'Away'}</th>
                </tr>
              </thead>
              <tbody>
                {match.games.map((g) => (
                  <tr key={g.label}>
                    <td className="muted">
                      {g.label}
                      {g.walkover && ' (w.o.)'}
                    </td>
                    <td className={g.winner === 'home' ? 'winner' : undefined}>
                      {names(g.home)}
                      {g.winner === 'home' && <span className="sr-only"> (won)</span>}
                    </td>
                    <td className="num strong">
                      {g.sets[0]}–{g.sets[1]}
                    </td>
                    <td className={g.winner === 'away' ? 'winner' : undefined}>
                      {names(g.away)}
                      {g.winner === 'away' && <span className="sr-only"> (won)</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
      )}

      {pool.pool.ratings && ratingLines.length > 0 && (
        <section className="card">
          <h2>Rating points</h2>
          <p className="muted">
            Estimated: this match is not in the official ratings yet ({listNote(pool.pool.ratings)}). Before is the rating
            going into the match, after any earlier games the list does not include.
          </p>
          <div className="table-scroll">
            <table className="data-table">
              <thead>
                <tr>
                  <th scope="col">Player</th>
                  <th scope="col" className="num">
                    Before
                  </th>
                  <th scope="col" className="num">
                    Points
                  </th>
                </tr>
              </thead>
              <tbody>
                {ratingLines.map((line) => (
                  <tr key={line.playerId}>
                    <th scope="row">
                      <a href={href('player', pool.pool.id, line.playerId)}>{players.get(line.playerId)?.name ?? 'Unknown player'}</a>
                      <div className="muted small">{(line.side === 'home' ? home : away)?.name}</div>
                    </th>
                    <td className="num">{line.before}</td>
                    <td className="num strong">{signed(line.points)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <RatingRules />
        </section>
      )}
    </div>
  );
}
