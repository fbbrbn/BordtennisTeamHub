import type { Player, PoolData, RatingStatus } from '../data/model';
import { ratingTable } from '../data/ratings';
import { t } from '../i18n';
import { href } from '../lib/router';
import { OutcomeBadge, shortDay, signed } from './ui';

/** "list of 23 Oct, which includes games up to 14 Oct" */
export function listNote(status: RatingStatus): string {
  return t.ratings.listNote(shortDay(status.listDate), shortDay(status.ratedThrough));
}

/** A player's forecast rating and the singles it comes from. Nothing when there are no new games. */
export function RatingForecastCard({ pool, player }: { pool: PoolData; player: Player }) {
  const status = pool.pool.ratings;
  const forecast = player.forecast;
  if (!status || !forecast || player.rating === null) return null;
  return (
    <section className="card">
      <h2>{t.ratings.forecastTitle}</h2>
      <p className="forecast-headline">{t.ratings.forecastHeadline(forecast.rating, signed(forecast.rating - player.rating), forecast.games.length)}</p>
      <p className="muted small">{t.ratings.official(player.rating, listNote(status))}</p>
      <div className="table-scroll">
        <table className="data-table">
          <thead>
            <tr>
              <th scope="col">{t.common.date}</th>
              <th scope="col">{t.common.against}</th>
              <th scope="col">{t.common.result}</th>
              <th scope="col" className="num">{t.common.points}</th>
            </tr>
          </thead>
          <tbody>
            {forecast.games.map((g, i) => (
              <tr key={`${g.matchId}-${g.opponentId}-${i}`}>
                <td>
                  <a href={href('match', g.poolId, g.matchId)}>{shortDay(g.date)}</a>
                </td>
                <td>
                  <a href={href('player', g.poolId, g.opponentId)}>{g.opponentName || t.common.unknownPlayer}</a>
                  <div className="muted small">{t.ratings.ratedAt(g.opp)}</div>
                </td>
                <td>
                  <OutcomeBadge outcome={g.won ? 'single-won' : 'single-lost'} />
                </td>
                <td className="num strong">{signed(g.points)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <RatingRules />
    </section>
  );
}

/** How rating points work, with the points table, behind a fold. */
export function RatingRules() {
  return (
    <details className="why">
      <summary>{t.common.howWorkedOut}</summary>
      <ul className="reasons">
        {t.ratings.rules.map((rule) => (
          <li key={rule}>{rule}</li>
        ))}
      </ul>
      <div className="table-scroll">
        <table className="data-table rating-table">
          <caption>{t.ratings.tableCaption}</caption>
          <thead>
            <tr>
              <th scope="col" rowSpan={2}>
                {t.ratings.gap}
              </th>
              <th scope="colgroup" colSpan={2}>
                {t.ratings.higherRated}
              </th>
              <th scope="colgroup" colSpan={2}>
                {t.ratings.lowerRated}
              </th>
            </tr>
            <tr>
              <th scope="col" className="num">
                {t.ratings.wins}
              </th>
              <th scope="col" className="num">
                {t.ratings.loses}
              </th>
              <th scope="col" className="num">
                {t.ratings.wins}
              </th>
              <th scope="col" className="num">
                {t.ratings.loses}
              </th>
            </tr>
          </thead>
          <tbody>
            {ratingTable().map((row) => (
              <tr key={row.from}>
                <th scope="row">{row.to === null ? `${row.from}+` : `${row.from}–${row.to - 1}`}</th>
                <td className="num">{signed(row.favouriteWins)}</td>
                <td className="num">{signed(row.favouriteLoses)}</td>
                <td className="num">{signed(row.underdogWins)}</td>
                <td className="num">{signed(row.underdogLoses)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="muted small">{t.ratings.rulesNote}</p>
    </details>
  );
}
