import { useMemo, useState } from 'react';
import { fitScale, projectTable } from '../data/forecast';
import { loadPool, useLoaded } from '../data/load';
import type { PoolData, TeamMatch } from '../data/model';
import { playerGames, summarize, teamsById, winRate } from '../data/stats';
import { href } from '../lib/router';
import { PredictionRecordNote } from '../components/Prediction';
import { matchDay, matchTime, ordinal, PageState, percent, portalUrl } from '../components/ui';

export function PoolPage({ poolId }: { poolId: string }) {
  const loaded = useLoaded(() => loadPool(poolId), poolId);
  if (loaded.status !== 'ready') return <PageState state={loaded} what="this pool" />;
  return <PoolView pool={loaded.data} />;
}

function PoolView({ pool }: { pool: PoolData }) {
  const [showAll, setShowAll] = useState(false);
  const teams = teamsById(pool);
  const teamName = (id: string) => teams.get(id)?.name ?? 'Unknown team';
  const played = pool.matches.filter((m) => m.score).reverse();
  const upcoming = pool.matches.filter((m) => !m.score);
  const shownPlayed = showAll ? played : played.slice(0, 10);
  const projection = useMemo(() => new Map(projectTable(pool, fitScale(pool)).map((p) => [p.teamId, p])), [pool]);
  const rankOf = (teamId: string) => {
    const rank = projection.get(teamId)?.rank;
    return rank ? ordinal(rank) : '–';
  };
  const hasRemaining = upcoming.length > 0;

  const playerRows = pool.players
    .map((p) => ({ player: p, line: summarize(playerGames(pool, p.id)) }))
    .filter((r) => r.line.singles.won + r.line.singles.lost > 0)
    .sort(
      (a, b) =>
        b.line.singles.won - a.line.singles.won ||
        (winRate(b.line.singles) ?? 0) - (winRate(a.line.singles) ?? 0) ||
        a.player.name.localeCompare(b.player.name, 'da'),
    );

  const matchRow = (m: TeamMatch) => (
    <li key={m.id} className="result-row">
      <div className="result-main">
        <span className="result-when">
          {matchDay(m.date)}
          {!m.score && ` · ${matchTime(m.date)}`}
        </span>
        <span className="result-vs">
          <a href={href('team', pool.pool.id, m.homeTeamId)}>{teamName(m.homeTeamId)}</a> –{' '}
          <a href={href('team', pool.pool.id, m.awayTeamId)}>{teamName(m.awayTeamId)}</a>
        </span>
        {!m.score && <span className="result-venue">{m.venue}</span>}
      </div>
      {m.score && (
        <div className="result-side">
          <a className="result-score" href={href('match', pool.pool.id, m.id)}>
            {m.score.join('–')}
          </a>
        </div>
      )}
    </li>
  );

  return (
    <div className="dash">
      <header className="dash-head">
        <p className="eyebrow">{pool.pool.league}</p>
        <h1>{pool.pool.name}</h1>
        <div className="button-row">
          <a className="button" href={portalUrl(pool.pool, 2)} target="_blank" rel="noreferrer">
            Open on bordtennisportalen.dk
          </a>
        </div>
      </header>

      <section className="card">
        <h2>Standings</h2>
        <div className="table-scroll">
          <table className="data-table">
            <thead>
              <tr>
                <th scope="col" className="num">#</th>
                <th scope="col">Team</th>
                <th scope="col" className="num" title="Matches">M</th>
                <th scope="col" className="num wide-only" title="Won">
                  W
                </th>
                <th scope="col" className="num wide-only" title="Drawn">
                  D
                </th>
                <th scope="col" className="num wide-only" title="Lost">
                  L
                </th>
                <th scope="col" className="num">Games</th>
                <th scope="col" className="num">Points</th>
                {hasRemaining && (
                  <th scope="col" className="num" title="Projected final points">
                    Proj.
                  </th>
                )}
              </tr>
            </thead>
            <tbody>
              {pool.standings.map((s) => (
                <tr key={s.teamId}>
                  <td className="num">{s.position}</td>
                  <th scope="row">
                    <a href={href('team', pool.pool.id, s.teamId)}>{teamName(s.teamId)}</a>
                  </th>
                  <td className="num">{s.played}</td>
                  <td className="num wide-only">{s.won}</td>
                  <td className="num wide-only">{s.drawn}</td>
                  <td className="num wide-only">{s.lost}</td>
                  <td className="num">
                    {s.gamesFor}–{s.gamesAgainst}
                  </td>
                  <td className="num strong">{s.points}</td>
                  {hasRemaining && (
                    <td className="num">
                      {Math.round(projection.get(s.teamId)?.projected ?? s.points)}
                      <div className="muted small">{rankOf(s.teamId)}</div>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {hasRemaining && (
          <p className="muted small">
            Proj.: projected final points, with the projected position under them. It adds up the win and draw chances of
            every remaining match, assuming each team fields lineups it has used this season.
          </p>
        )}
      </section>

      <section className="card">
        <div className="section-head">
          <h2>Results</h2>
          <span className="muted">
            {played.length} of {pool.matches.length} matches played
          </span>
        </div>
        <PredictionRecordNote matches={played} />
        <ul className="result-list">{shownPlayed.map(matchRow)}</ul>
        {played.length > 10 && (
          <button type="button" className="button" onClick={() => setShowAll((v) => !v)}>
            {showAll ? 'Show fewer' : `Show all ${played.length} results`}
          </button>
        )}
      </section>

      {upcoming.length > 0 && (
        <section className="card">
          <h2>Next matches</h2>
          <ul className="result-list">{upcoming.slice(0, 8).map(matchRow)}</ul>
        </section>
      )}

      <section className="card">
        <div className="section-head">
          <h2>Players</h2>
          <span className="muted">Sorted by singles won</span>
        </div>
        <div className="table-scroll">
          <table className="data-table">
            <thead>
              <tr>
                <th scope="col">Player</th>
                <th scope="col" className="num">Rating</th>
                <th scope="col" className="num">Singles</th>
                <th scope="col" className="num">Won</th>
              </tr>
            </thead>
            <tbody>
              {playerRows.map(({ player, line }) => (
                <tr key={player.id}>
                  <th scope="row">
                    <a href={href('player', pool.pool.id, player.id)}>{player.name}</a>
                    {player.teamId && <div className="muted small">{teamName(player.teamId)}</div>}
                  </th>
                  <td className="num">{player.rating ?? '–'}</td>
                  <td className="num">
                    {line.singles.won}–{line.singles.lost}
                  </td>
                  <td className="num">{percent(winRate(line.singles))}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
