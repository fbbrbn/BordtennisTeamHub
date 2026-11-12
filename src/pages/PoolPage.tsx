import { useMemo } from 'react';
import { fitScale, projectTable } from '../data/forecast';
import { loadPool, useLoaded } from '../data/load';
import type { PoolData, TeamMatch } from '../data/model';
import { playerGames, summarize, teamsById, winRate } from '../data/stats';
import { t } from '../i18n';
import { href } from '../lib/router';
import { PastSeasonTag } from '../components/PlayerHistory';
import { PredictionRecordNote } from '../components/Prediction';
import { matchDay, matchTime, PageState, percent, PortalLink, portalUrl, RowLink, useShowAll } from '../components/ui';
import { searchLink } from './SearchPage';

export function PoolPage({ poolId }: { poolId: string }) {
  const loaded = useLoaded(() => loadPool(poolId), poolId);
  if (loaded.status !== 'ready') return <PageState state={loaded} what="pool" />;
  return <PoolView pool={loaded.data} />;
}

/** How many rows each list starts with. */
const MATCHES_SHOWN = 5;
const PLAYERS_SHOWN = 10;

function PoolView({ pool }: { pool: PoolData }) {
  const teams = teamsById(pool);
  const teamName = (id: string) => teams.get(id)?.name ?? t.common.unknownTeam;
  const played = pool.matches.filter((m) => m.score).reverse();
  const upcoming = pool.matches.filter((m) => !m.score);
  // Projected final points, best first: what the standings may look like when every match is played.
  const projection = useMemo(() => [...projectTable(pool, fitScale(pool))].sort((a, b) => a.rank - b.rank), [pool]);

  const playerRows = pool.players
    .map((p) => ({ player: p, line: summarize(playerGames(pool, p.id)) }))
    .filter((r) => r.line.singles.won + r.line.singles.lost > 0)
    .sort(
      (a, b) =>
        b.line.singles.won - a.line.singles.won ||
        (winRate(b.line.singles) ?? 0) - (winRate(a.line.singles) ?? 0) ||
        a.player.name.localeCompare(b.player.name, 'da'),
    );
  const [shownPlayed, showAllPlayed] = useShowAll(played, MATCHES_SHOWN);
  const [shownUpcoming, showAllUpcoming] = useShowAll(upcoming, MATCHES_SHOWN);
  const [shownPlayers, showAllPlayers] = useShowAll(playerRows, PLAYERS_SHOWN);

  /** One match: the whole row leads to it. The winner's name is the strong one. */
  const matchRow = (m: TeamMatch) => {
    const ahead = m.score ? Math.sign(m.score[0] - m.score[1]) : 0;
    return (
      <li key={m.id} className="result-row">
        <RowLink to={href('match', pool.pool.id, m.id)}>
          <span className="result-main">
            <span className="result-when">
              {matchDay(m.date)}
              {!m.score && ` · ${matchTime(m.date)}`}
            </span>
            <span className={m.score ? 'result-vs is-decided' : 'result-vs'}>
              <span className={ahead > 0 ? 'is-winner' : undefined}>{teamName(m.homeTeamId)}</span> –{' '}
              <span className={ahead < 0 ? 'is-winner' : undefined}>{teamName(m.awayTeamId)}</span>
            </span>
            {!m.score && <span className="result-venue">{m.venue}</span>}
          </span>
          {m.score && <span className="result-score">{m.score.join('–')}</span>}
        </RowLink>
      </li>
    );
  };

  return (
    <div className="dash">
      <header className="dash-head">
        <p className="eyebrow">
          {pool.pool.league} <PastSeasonTag pool={pool.pool} />
          {/* The other pools of the same league, on the advanced search (this season only). */}
          {pool.pool.division && !pool.pool.past && (
            <>
              {' · '}
              <a href={searchLink({ union: pool.pool.regionId, age: pool.pool.ageGroupId, league: pool.pool.division })}>
                {t.search.leaguePools(pool.pool.division)}
              </a>
            </>
          )}
        </p>
        <h1>{pool.pool.name}</h1>
      </header>

      <section className="card">
        <h2>{t.pool.standings}</h2>
        <div className="table-scroll">
          <table className="data-table">
            <thead>
              <tr>
                <th scope="col" className="num">#</th>
                <th scope="col">{t.common.team}</th>
                <th scope="col" className="num" title={t.pool.columns.matches[1]}>
                  {t.pool.columns.matches[0]}
                </th>
                <th scope="col" className="num wide-only" title={t.pool.columns.won[1]}>
                  {t.pool.columns.won[0]}
                </th>
                <th scope="col" className="num wide-only" title={t.pool.columns.drawn[1]}>
                  {t.pool.columns.drawn[0]}
                </th>
                <th scope="col" className="num wide-only" title={t.pool.columns.lost[1]}>
                  {t.pool.columns.lost[0]}
                </th>
                <th scope="col" className="num">{t.pool.columns.games}</th>
                <th scope="col" className="num">{t.pool.columns.points}</th>
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
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {upcoming.length > 0 && (
          <details className="why">
            <summary>{t.pool.projected}</summary>
            <p className="muted small">{t.pool.projectedNote}</p>
            <table className="data-table">
              <thead>
                <tr>
                  <th scope="col" className="num">#</th>
                  <th scope="col">{t.common.team}</th>
                  <th scope="col" className="num">{t.pool.columns.points}</th>
                </tr>
              </thead>
              <tbody>
                {projection.map((row) => (
                  <tr key={row.teamId}>
                    <td className="num">{row.rank}</td>
                    <th scope="row">{teamName(row.teamId)}</th>
                    <td className="num strong">{Math.round(row.projected)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </details>
        )}
      </section>

      {played.length > 0 && (
        <section className="card">
          <div className="section-head">
            <h2>{t.common.results}</h2>
            <span className="muted">{t.pool.playedOf(played.length, pool.matches.length)}</span>
          </div>
          <ul className="result-list">{shownPlayed.map(matchRow)}</ul>
          {showAllPlayed}
          <PredictionRecordNote matches={played} />
        </section>
      )}

      {upcoming.length > 0 && (
        <section className="card">
          <h2>{t.pool.nextMatches}</h2>
          <ul className="result-list">{shownUpcoming.map(matchRow)}</ul>
          {showAllUpcoming}
        </section>
      )}

      {playerRows.length > 0 && (
        <section className="card">
          <div className="section-head">
            <h2>{t.common.players}</h2>
            <span className="muted">{t.pool.sortedBySingles}</span>
          </div>
          <div className="table-scroll">
            <table className="data-table">
              <thead>
                <tr>
                  <th scope="col">{t.common.player}</th>
                  <th scope="col" className="num">{t.common.rating}</th>
                  <th scope="col" className="num">{t.common.singles}</th>
                  <th scope="col" className="num">{t.pool.wonColumn}</th>
                </tr>
              </thead>
              <tbody>
                {shownPlayers.map(({ player, line }) => (
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
          {showAllPlayers}
        </section>
      )}

      <PortalLink to={portalUrl(pool.pool, 2)} />
    </div>
  );
}
