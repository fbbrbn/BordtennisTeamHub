import { RatingHistory, type RatingPoint } from '../charts/RatingHistory';
import { loadHistory, useLoaded } from '../data/load';
import type { CareerEntry, Player, PoolData, PoolInfo } from '../data/model';
import { t } from '../i18n';
import { href } from '../lib/router';
import { StatTile } from './ui';

/** "Past season" next to a page's heading, for pools of earlier seasons. */
export function PastSeasonTag({ pool }: { pool: PoolInfo }) {
  return pool.past ? <span className="tag">{t.common.pastSeason}</span> : null;
}

/** "2015/2016" -> "15/16" */
const shortSeason = (season: string) => season.replace(/^\d\d(\d\d)\/\d\d(\d\d)$/, '$1/$2');

/** One line on the This season tab: how much history there is, and the way to it. */
export function HistoryLink({ playerId, href: to }: { playerId: string; href: string }) {
  const loaded = useLoaded(() => loadHistory(playerId), playerId);
  if (loaded.status !== 'ready') return null;
  const seasons = [...new Set(loaded.data.map((e) => e.season))];
  if (seasons.length < 2) return null;
  return (
    <a className="card history-link" href={to}>
      <span>
        <strong>{t.history.tab}</strong> <span className="muted">{t.history.linkSummary(seasons.length, seasons[seasons.length - 1])}</span>
      </span>
      <span aria-hidden="true">→</span>
    </a>
  );
}

/** Everything the player has played: totals, rating over the seasons, and every season and team. */
export function PlayerHistory({ pool, player }: { pool: PoolData; player: Player }) {
  const loaded = useLoaded(() => loadHistory(player.id), player.id);
  if (loaded.status === 'loading') return <p className="page-state">{t.history.loading}</p>;
  const entries = loaded.status === 'ready' ? loaded.data : [];
  if (entries.length === 0) {
    return (
      <section className="card">
        <p className="muted">{t.history.empty}</p>
      </section>
    );
  }

  const seasons = [...new Set(entries.map((e) => e.season))];
  const won = entries.reduce((sum, e) => sum + e.singles[0], 0);
  const lost = entries.reduce((sum, e) => sum + e.singles[1], 0);
  const matches = entries.reduce((sum, e) => sum + e.matches, 0);
  const clubs = [...new Set(entries.map((e) => e.club ?? e.team))];

  // One point per season: the rating when its first pool started. Then today's rating, and the forecast.
  const points: RatingPoint[] = [];
  for (const season of [...seasons].reverse()) {
    const first = entries.filter((e) => e.season === season && e.rating !== null).sort((a, b) => a.from.localeCompare(b.from))[0];
    if (first?.rating != null) points.push({ label: shortSeason(season), title: t.history.startOf(season), rating: first.rating });
  }
  if (!pool.pool.past && player.rating !== null) {
    points.push({ label: t.history.now, title: t.history.nowTitle, rating: player.rating });
    if (player.forecast) points.push({ label: t.history.next, title: t.history.nextTitle, rating: player.forecast.rating, estimate: true });
  }

  return (
    <>
      <div className="tiles">
        <StatTile label={t.history.seasons} value={seasons.length} detail={t.history.since(seasons[seasons.length - 1])} />
        <StatTile label={t.history.singlesWonLost} value={`${won}–${lost}`} detail={won + lost > 0 ? t.common.wonShare(won / (won + lost)) : undefined} />
        <StatTile label={t.history.teamMatches} value={matches} />
        <StatTile label={t.history.clubs(clubs.length)} value={clubs.length} detail={clubs.slice(0, 2).join(', ') + (clubs.length > 2 ? '…' : '')} />
      </div>

      {points.length >= 2 && (
        <section className="card">
          <h2>{t.history.overSeasons}</h2>
          <p className="muted small">{t.history.overSeasonsNote(!pool.pool.past && player.rating !== null)}</p>
          <RatingHistory points={points} />
        </section>
      )}

      <section className="card">
        <div className="section-head">
          <h2>{t.history.everySeason}</h2>
          <span className="muted">{t.n.teams(entries.length)}</span>
        </div>
        <p className="muted small">{t.history.tapScore}</p>
        <ul className="result-list">
          {entries.map((e) => (
            <SeasonRow key={`${e.poolId}-${e.teamId}`} entry={e} playerId={player.id} current={e.poolId === pool.pool.id} />
          ))}
        </ul>
        <details className="why">
          <summary>{t.history.about}</summary>
          <p className="muted small">{t.history.aboutNote}</p>
        </details>
      </section>
    </>
  );
}

function SeasonRow({ entry: e, playerId, current }: { entry: CareerEntry; playerId: string; current: boolean }) {
  return (
    <li className="result-row">
      <div className="result-main">
        <span className="result-when">
          {e.season}
          {current && t.history.thisPage}
        </span>
        <span className="result-vs">
          <a href={href('team', e.poolId, e.teamId)}>{e.team}</a>
        </span>
        <span className="result-note">
          {e.pool}
          {e.rating !== null && ` · ${t.common.ratingOf(e.rating)}`}
        </span>
      </div>
      <div className="result-side">
        <a className="result-score" href={href('player', e.poolId, playerId)} aria-label={t.history.scoreLabel(e.season, e.singles[0], e.singles[1])}>
          {e.singles[0]}–{e.singles[1]}
        </a>
        <span className="muted small">{t.history.singles}</span>
      </div>
    </li>
  );
}
