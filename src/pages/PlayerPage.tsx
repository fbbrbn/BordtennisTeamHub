import { useMemo } from 'react';
import { RatingStrip, type StripPoint } from '../charts/RatingStrip';
import { fitScale } from '../data/forecast';
import { playerInsights } from '../data/insights';
import { loadPool, useLoaded } from '../data/load';
import type { Player, PoolData } from '../data/model';
import { playerGames, playersById, summarize, teamsById, winRate } from '../data/stats';
import { t } from '../i18n';
import { href } from '../lib/router';
import { PastSeasonTag, PlayerHistory } from '../components/PlayerHistory';
import { RatingForecastCard } from '../components/RatingForecast';
import { matchDay, NotFound, OutcomeBadge, PageState, percent, RowLink, shortDay, StatTile } from '../components/ui';

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
        {!pool.pool.past && (
          <div className="button-row">
            <a className="button" href={href('vs', pool.pool.id, player.id)}>
              {t.versus.compare}
            </a>
          </div>
        )}
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
            player.rating === null ? t.common.unrated : player.forecast ? t.ratings.forecastDetail(player.forecast.rating) : undefined
          }
        />
        <StatTile label={t.common.singles} value={`${summary.singles.won}–${summary.singles.lost}`} detail={percent(winRate(summary.singles))} />
        <StatTile label={t.common.doubles} value={`${summary.doubles.won}–${summary.doubles.lost}`} />
        <StatTile label={t.common.sets} value={`${summary.sets.won}–${summary.sets.lost}`} detail={t.n.matches(summary.matches)} />
      </div>

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
          <RatingStrip points={strip} ownRating={player.rating} />
          {unrated > 0 && <p className="muted small">{t.player.unratedNotShown(unrated)}</p>}
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
          <ul className="result-list">
            {[...records].reverse().map((r) => (
              <li key={`${r.match.id}-${r.game.label}`} className="result-row">
                {/* The whole row leads to the team match, where every player has a link. */}
                <RowLink to={href('match', pool.pool.id, r.match.id)}>
                  <span className="result-main">
                    <span className="result-when">
                      {shortDay(r.match.date)} · {teams.get(r.opponentTeamId)?.name}
                    </span>
                    <span className="result-vs">
                      {r.opponents.map((id, i) => (
                        // The portal now and then lists a player twice in a game: the place in the list keeps keys apart.
                        <span key={`${id}-${i}`}>
                          {i > 0 && t.common.andJoin}
                          {nameOf(id)} <span className="muted small">{players.get(id)?.rating ?? t.common.unrated}</span>
                        </span>
                      ))}
                    </span>
                    {r.game.kind === 'double' && (
                      <span className="result-venue">
                        {t.player.doubleGame}
                        {r.partners.length > 0 && t.player.doublesWith(r.partners.map(nameOf).join(t.common.andJoin))}
                      </span>
                    )}
                  </span>
                  <span className="result-side">
                    <span className="result-score">
                      {r.setsFor}–{r.setsAgainst}
                    </span>
                    <OutcomeBadge outcome={r.won ? 'single-won' : 'single-lost'} />
                  </span>
                </RowLink>
              </li>
            ))}
          </ul>
        )}
      </section>
      </>
      )}
    </div>
  );
}
