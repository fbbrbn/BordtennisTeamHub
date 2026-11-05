import { RatingHistory, type RatingPoint } from '../charts/RatingHistory';
import { loadHistory, useLoaded } from '../data/load';
import type { CareerEntry, Player, PoolData, PoolInfo } from '../data/model';
import { href } from '../lib/router';
import { count, percent } from '../lib/text';
import { StatTile } from './ui';

/** "Past season" next to a page's heading, for pools of earlier seasons. */
export function PastSeasonTag({ pool }: { pool: PoolInfo }) {
  return pool.past ? <span className="tag">Past season</span> : null;
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
        <strong>History</strong> <span className="muted">· {count(seasons.length, 'season')} since {seasons[seasons.length - 1]}</span>
      </span>
      <span aria-hidden="true">→</span>
    </a>
  );
}

/** Everything the player has played: totals, rating over the seasons, and every season and team. */
export function PlayerHistory({ pool, player }: { pool: PoolData; player: Player }) {
  const loaded = useLoaded(() => loadHistory(player.id), player.id);
  if (loaded.status === 'loading') return <p className="page-state">Loading the history…</p>;
  const entries = loaded.status === 'ready' ? loaded.data : [];
  if (entries.length === 0) {
    return (
      <section className="card">
        <p className="muted">No seasons found yet. Past seasons are added as the import works back to 2011/2012.</p>
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
    if (first?.rating != null) points.push({ label: shortSeason(season), title: `Start of ${season}`, rating: first.rating });
  }
  if (!pool.pool.past && player.rating !== null) {
    points.push({ label: 'Now', title: 'Official rating now', rating: player.rating });
    if (player.forecast) points.push({ label: 'Next', title: 'Forecast, once the games played are rated', rating: player.forecast.rating, estimate: true });
  }

  return (
    <>
      <div className="tiles">
        <StatTile label="Seasons" value={seasons.length} detail={`since ${seasons[seasons.length - 1]}`} />
        <StatTile label="Singles won and lost" value={`${won}–${lost}`} detail={won + lost > 0 ? `${percent(won / (won + lost))} won` : undefined} />
        <StatTile label="Team matches" value={matches} />
        <StatTile label={clubs.length === 1 ? 'Club' : 'Clubs'} value={clubs.length} detail={clubs.slice(0, 2).join(', ') + (clubs.length > 2 ? '…' : '')} />
      </div>

      {points.length >= 2 && (
        <section className="card">
          <h2>Rating over the seasons</h2>
          <p className="muted small">The official rating when each season started{!pool.pool.past && player.rating !== null ? ', then today' : ''}.</p>
          <RatingHistory points={points} />
        </section>
      )}

      <section className="card">
        <div className="section-head">
          <h2>Every season</h2>
          <span className="muted">{count(entries.length, 'team')}</span>
        </div>
        <p className="muted small">Tap a score for the games of that season.</p>
        <ul className="result-list">
          {entries.map((e) => (
            <SeasonRow key={`${e.poolId}-${e.teamId}`} entry={e} playerId={player.id} current={e.poolId === pool.pool.id} />
          ))}
        </ul>
        <details className="why">
          <summary>About these numbers</summary>
          <p className="muted small">
            Team-tournament matches only, from bordtennisportalen.dk; tournaments are not included. The rating is the official
            one when the pool started. Earlier seasons are added as the import works back in time, to 2011/2012.
          </p>
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
          {current && ' · this page'}
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
  );
}
