import { useMemo } from 'react';
import { RatingStrip, type StripPoint } from '../charts/RatingStrip';
import { fitScale } from '../data/forecast';
import { playerInsights } from '../data/insights';
import { loadPool, useLoaded } from '../data/load';
import type { Player, PoolData } from '../data/model';
import { playerGames, playersById, summarize, teamsById, winRate } from '../data/stats';
import { href } from '../lib/router';
import { RatingForecastCard } from '../components/RatingForecast';
import { matchDay, NotFound, OutcomeBadge, PageState, percent, signed, StatTile } from '../components/ui';

export function PlayerPage({ poolId, playerId }: { poolId: string; playerId: string }) {
  const loaded = useLoaded(() => loadPool(poolId), poolId);
  if (loaded.status !== 'ready') return <PageState state={loaded} what="this player" />;
  const player = loaded.data.players.find((p) => p.id === playerId);
  if (!player) return <NotFound what="this player" />;
  return <PlayerView pool={loaded.data} player={player} />;
}

function PlayerView({ pool, player }: { pool: PoolData; player: Player }) {
  const teams = teamsById(pool);
  const players = playersById(pool);
  const records = playerGames(pool, player.id);
  const summary = summarize(records);
  const team = player.teamId ? teams.get(player.teamId) : undefined;
  const nameOf = (id: string) => players.get(id)?.name ?? 'Unknown player';
  const singles = records.filter((r) => r.game.kind === 'single');

  const strip: StripPoint[] = singles.flatMap((r) => {
    const opponent = players.get(r.opponents[0]);
    if (!opponent || opponent.rating === null) return [];
    return [
      {
        key: `${r.match.id}-${r.game.label}`,
        rating: opponent.rating,
        won: r.won,
        lines: [
          `${r.won ? 'Won' : 'Lost'} ${r.setsFor}–${r.setsAgainst} against ${opponent.name}`,
          `Rating ${opponent.rating} · ${teams.get(r.opponentTeamId)?.name ?? ''}`,
          matchDay(r.match.date),
        ],
      },
    ];
  });
  const unrated = singles.length - strip.length;
  const insights = useMemo(() => playerInsights(pool, player.id, fitScale(pool)), [pool, player.id]);

  return (
    <div className="dash">
      <header className="dash-head">
        <p className="eyebrow">
          {team ? <a href={href('team', pool.pool.id, team.id)}>{team.name}</a> : 'Player'} ·{' '}
          <a href={href('pool', pool.pool.id)}>{pool.pool.name}</a>
        </p>
        <h1>{player.name}</h1>
      </header>

      <div className="tiles">
        <StatTile
          label="Rating"
          value={player.rating ?? '–'}
          detail={
            player.rating === null
              ? 'unrated'
              : player.forecast
                ? `Forecast ${player.forecast.rating} (${signed(player.forecast.rating - player.rating)})`
                : undefined
          }
        />
        <StatTile label="Singles won and lost" value={`${summary.singles.won}–${summary.singles.lost}`} detail={`${percent(winRate(summary.singles))} won`} />
        <StatTile label="Doubles won and lost" value={`${summary.doubles.won}–${summary.doubles.lost}`} />
        <StatTile label="Sets won and lost" value={`${summary.sets.won}–${summary.sets.lost}`} detail={`in ${summary.matches} ${summary.matches === 1 ? 'match' : 'matches'}`} />
      </div>

      <RatingForecastCard pool={pool} player={player} />

      {insights.length > 0 && (
        <section className="card">
          <h2>Insights</h2>
          <ul className="insights">
            {insights.map((insight) => (
              <li key={insight.topic}>
                <span className="insight-topic">{insight.topic}</span>
                <span>{insight.text}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {strip.length > 0 && (
        <section className="card">
          <h2>Singles by opponent rating</h2>
          <p className="muted">
            Wins on the top row, losses below. Dots to the right of the line are opponents rated higher than {player.name}.
            {unrated > 0 && ` ${unrated} game${unrated === 1 ? '' : 's'} against unrated opponents not shown.`}
          </p>
          <RatingStrip points={strip} ownRating={player.rating} />
        </section>
      )}

      <section className="card">
        <div className="section-head">
          <h2>Games</h2>
          <span className="muted">{records.length} played</span>
        </div>
        {records.length === 0 ? (
          <p className="muted">No games recorded in this pool.</p>
        ) : (
          <div className="table-scroll">
            <table className="data-table">
              <thead>
                <tr>
                  <th scope="col">Date</th>
                  <th scope="col">Against</th>
                  <th scope="col" className="num">Rating</th>
                  <th scope="col" className="num">Sets</th>
                  <th scope="col">Result</th>
                </tr>
              </thead>
              <tbody>
                {[...records].reverse().map((r) => (
                  <tr key={`${r.match.id}-${r.game.label}`}>
                    <td>
                      <a href={href('match', pool.pool.id, r.match.id)}>{matchDay(r.match.date)}</a>
                      <div className="muted small">{teams.get(r.opponentTeamId)?.name}</div>
                    </td>
                    <td>
                      {r.opponents.map((id, i) => (
                        <span key={id}>
                          {i > 0 && ' & '}
                          <a href={href('player', pool.pool.id, id)}>{nameOf(id)}</a>
                        </span>
                      ))}
                      {r.game.kind === 'double' && (
                        <div className="muted small">
                          Doubles{r.partners.length > 0 && <> with {r.partners.map(nameOf).join(' & ')}</>}
                        </div>
                      )}
                    </td>
                    <td className="num">
                      {r.opponents
                        .map((id) => players.get(id)?.rating)
                        .map((v) => v ?? '–')
                        .join(' / ')}
                    </td>
                    <td className="num">
                      {r.setsFor}–{r.setsAgainst}
                    </td>
                    <td>
                      <OutcomeBadge outcome={r.won ? 'single-won' : 'single-lost'} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
