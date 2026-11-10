import { RatingHistory, type RatingPoint } from '../charts/RatingHistory';
import { loadHistory, useLoaded } from '../data/load';
import type { CareerEntry, Player, PoolData, PoolInfo } from '../data/model';
import { t } from '../i18n';
import { href } from '../lib/router';
import { percent, RowLink, StatTile } from './ui';

/** "Past season" next to a page's heading, for pools of earlier seasons. */
export function PastSeasonTag({ pool }: { pool: PoolInfo }) {
  return pool.past ? <span className="tag">{t.common.pastSeason}</span> : null;
}

/** "2015/2016" -> "15/16" */
const shortSeason = (season: string) => season.replace(/^\d\d(\d\d)\/\d\d(\d\d)$/, '$1/$2');

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
        <StatTile label={t.history.seasons} value={seasons.length} detail={t.history.since(shortSeason(seasons[seasons.length - 1]))} />
        <StatTile label={t.common.singles} value={`${won}–${lost}`} detail={won + lost > 0 ? percent(won / (won + lost)) : undefined} />
        <StatTile label={t.history.teamMatches} value={matches} />
        <StatTile label={t.history.clubs(clubs.length)} value={clubs.length} />
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

/** One season with one team: the whole row leads to the player's games in that pool. */
function SeasonRow({ entry: e, playerId, current }: { entry: CareerEntry; playerId: string; current: boolean }) {
  return (
    <li className="result-row">
      <RowLink to={href('player', e.poolId, playerId)}>
        <span className="result-main">
          <span className="result-when">
            {e.season}
            {current && t.history.thisPage}
          </span>
          <span className="result-vs">{e.team}</span>
          <span className="result-note">
            {e.pool}
            {e.rating !== null && ` · ${t.common.ratingOf(e.rating)}`}
          </span>
        </span>
        <span className="result-side" aria-label={t.history.scoreLabel(e.singles[0], e.singles[1])}>
          <span className="result-score">
            {e.singles[0]}–{e.singles[1]}
          </span>
          <span className="muted small">{t.history.singles}</span>
        </span>
      </RowLink>
    </li>
  );
}
