import { loadCareer, useLoaded } from '../data/load';
import type { PoolInfo } from '../data/model';
import { href } from '../lib/router';
import { count, percent } from '../lib/text';

/** "Past season" next to a page's heading, for pools of earlier seasons. */
export function PastSeasonTag({ pool }: { pool: PoolInfo }) {
  return pool.past ? <span className="tag">Past season</span> : null;
}

/** The past seasons a player played, newest first, each linking to that season's team and games. */
export function PastSeasons({ playerId, poolId }: { playerId: string; poolId: string }) {
  const loaded = useLoaded(() => loadCareer(playerId), playerId);
  if (loaded.status !== 'ready' || loaded.data.length === 0) return null;
  const entries = loaded.data;
  const seasons = new Set(entries.map((e) => e.seasonId)).size;
  const won = entries.reduce((sum, e) => sum + e.singles[0], 0);
  const lost = entries.reduce((sum, e) => sum + e.singles[1], 0);
  return (
    <section className="card">
      <div className="section-head">
        <h2>Past seasons</h2>
        <span className="muted">{count(seasons, 'season')}</span>
      </div>
      {won + lost > 0 && (
        <p className="muted small">
          Singles {won}–{lost} ({percent(won / (won + lost))} won). Tap a score for that season's games.
        </p>
      )}
      <ul className="result-list">
        {entries.map((e) => (
          <li key={`${e.poolId}-${e.teamId}`} className="result-row">
            <div className="result-main">
              <span className="result-when">
                {e.season}
                {e.poolId === poolId && ' · this page'}
              </span>
              <span className="result-vs">
                <a href={href('team', e.poolId, e.teamId)}>{e.team}</a>
              </span>
              <span className="result-note">
                {e.pool}
                {e.rating !== null && ` · rating ${e.rating}`}
              </span>
            </div>
            <div className="result-side">
              <a className="result-score" href={href('player', e.poolId, playerId)} aria-label={`Games in ${e.season}: singles ${e.singles[0]} won, ${e.singles[1]} lost`}>
                {e.singles[0]}–{e.singles[1]}
              </a>
              <span className="muted small">singles</span>
            </div>
          </li>
        ))}
      </ul>
      <details className="why">
        <summary>About these numbers</summary>
        <p className="muted small">
          Team-tournament matches only, from bordtennisportalen.dk. The rating is the official one when the pool started.
          Earlier seasons are added as the import works back in time, to 2011/2012.
        </p>
      </details>
    </section>
  );
}
