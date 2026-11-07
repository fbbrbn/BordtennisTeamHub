import { useMemo } from 'react';
import { RatingStrip, type StripPoint } from '../charts/RatingStrip';
import { fitScale } from '../data/forecast';
import { playerInsights } from '../data/insights';
import { loadPool, useLoaded } from '../data/load';
import type { Player, PoolData } from '../data/model';
import { playerGames, playersById, summarize, teamsById, winRate } from '../data/stats';
import { t } from '../i18n';
import { href } from '../lib/router';
import { HistoryLink, PastSeasonTag, PlayerHistory } from '../components/PlayerHistory';
import { RatingForecastCard } from '../components/RatingForecast';
import { matchDay, NotFound, OutcomeBadge, PageState, shortDay, signed, StatTile } from '../components/ui';

export function PlayerPage({ poolId, playerId, tab }: { poolId: string; playerId: string; tab: string | null }) {
  const loaded = useLoaded(() => loadPool(poolId), poolId);
  if (loaded.status !== 'ready') return <PageState state={loaded} what="player" />;
  const player = loaded.data.players.find((p) => p.id === playerId);
  if (!player) return <NotFound what="player" />;
  return <PlayerView pool={loaded.data} player={player} tab={tab === 'history' ? 'history' : 'season'} />;
}

/** Two tabs: the pool's season (results, insights, games) and the player's whole history. */
function PlayerView({ pool, player, tab }: { pool: PoolData; player: Player; tab: 'season' | 'history' }) {
  const teams = teamsById(pool);
  const players = playersById(pool);
  const records = playerGames(pool, player.id);
  const summary = summarize(records);
  const team = player.teamId ? teams.get(player.teamId) : undefined;
  const nameOf = (id: string) => players.get(id)?.name ?? t.common.unknownPlayer;
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
          (r.won ? t.player.stripWon : t.player.stripLost)(`${r.setsFor}–${r.setsAgainst}`, opponent.name),
          t.player.stripRating(opponent.rating, teams.get(r.opponentTeamId)?.name ?? ''),
          matchDay(r.match.date),
        ],
      },
    ];
  });
  const unrated = singles.length - strip.length;
  const insights = useMemo(() => playerInsights(pool, player.id, fitScale(pool)), [pool, player.id]);
  const base = href('player', pool.pool.id, player.id);

  return (
    <div className="dash">
      <header className="dash-head">
        <p className="eyebrow">
          {team ? <a href={href('team', pool.pool.id, team.id)}>{team.name}</a> : t.common.player} ·{' '}
          <a href={href('pool', pool.pool.id)}>{pool.pool.name}</a> <PastSeasonTag pool={pool.pool} />
        </p>
        <h1>{player.name}</h1>
      </header>

      <nav className="tabs" aria-label={t.player.tabsLabel}>
        <a href={base} aria-current={tab === 'season' ? 'page' : undefined}>
          {pool.pool.past ? pool.pool.season : t.player.thisSeason}
        </a>
        <a href={`${base}?tab=history`} aria-current={tab === 'history' ? 'page' : undefined}>
          {t.history.tab}
        </a>
      </nav>

      {tab === 'history' ? (
        <PlayerHistory pool={pool} player={player} />
      ) : (
      <>
      <div className="tiles">
        <StatTile
          label={t.common.rating}
          value={player.rating ?? '–'}
          detail={
            player.rating === null
              ? t.common.unrated
              : player.forecast
                ? t.ratings.forecastDetail(player.forecast.rating, signed(player.forecast.rating - player.rating))
                : undefined
          }
        />
        <StatTile label={t.player.singlesWonLost} value={`${summary.singles.won}–${summary.singles.lost}`} detail={t.common.wonShare(winRate(summary.singles))} />
        <StatTile label={t.player.doublesWonLost} value={`${summary.doubles.won}–${summary.doubles.lost}`} />
        <StatTile label={t.player.setsWonLost} value={`${summary.sets.won}–${summary.sets.lost}`} detail={t.player.inMatches(summary.matches)} />
      </div>

      <HistoryLink playerId={player.id} href={`${base}?tab=history`} />

      <RatingForecastCard pool={pool} player={player} />

      {insights.length > 0 && (
        <section className="card">
          <h2>{t.common.insights}</h2>
          <ul className="insights">
            {insights.map((insight) => (
              <li key={insight.id}>
                <span className="insight-topic">{insight.topic}</span>
                <span>{insight.text}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {strip.length > 0 && (
        <section className="card">
          <h2>{t.player.byOpponent}</h2>
          <p className="muted">
            {t.player.byOpponentNote(player.name)}
            {unrated > 0 && t.player.unratedNotShown(unrated)}
          </p>
          <RatingStrip points={strip} ownRating={player.rating} />
        </section>
      )}

      <section className="card">
        <div className="section-head">
          <h2>{t.player.games}</h2>
          <span className="muted">{t.common.played(records.length)}</span>
        </div>
        {records.length === 0 ? (
          <p className="muted">{t.player.noGames}</p>
        ) : (
          <div className="table-scroll">
            <table className="data-table">
              <thead>
                <tr>
                  <th scope="col">{t.common.date}</th>
                  <th scope="col">{t.common.against}</th>
                  <th scope="col" className="num">{t.common.rating}</th>
                  <th scope="col" className="num">{t.common.sets}</th>
                  <th scope="col">{t.common.result}</th>
                </tr>
              </thead>
              <tbody>
                {[...records].reverse().map((r) => (
                  <tr key={`${r.match.id}-${r.game.label}`}>
                    <td>
                      <a href={href('match', pool.pool.id, r.match.id)}>{shortDay(r.match.date)}</a>
                    </td>
                    <td>
                      {r.opponents.map((id, i) => (
                        <span key={id}>
                          {i > 0 && t.common.andJoin}
                          <a href={href('player', pool.pool.id, id)}>{nameOf(id)}</a>
                        </span>
                      ))}
                      <div className="muted small">{teams.get(r.opponentTeamId)?.name}</div>
                      {r.game.kind === 'double' && (
                        <div className="muted small">
                          {t.common.doubles}
                          {r.partners.length > 0 && t.player.doublesWith(r.partners.map(nameOf).join(t.common.andJoin))}
                        </div>
                      )}
                    </td>
                    <td className="num">
                      {r.opponents.map((id) => (
                        <div key={id}>{players.get(id)?.rating ?? '–'}</div>
                      ))}
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
      </>
      )}
    </div>
  );
}
