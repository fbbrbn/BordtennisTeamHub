import type { Player, PoolData, RatingStatus } from '../data/model';
import { ratingTable } from '../data/ratings';
import { count } from '../lib/text';
import { href } from '../lib/router';
import { OutcomeBadge, shortDay, signed } from './ui';

/** "list of 23 Oct, which includes games up to 14 Oct" */
export function listNote(status: RatingStatus): string {
  return `list of ${shortDay(status.listDate)}, which includes games up to ${shortDay(status.ratedThrough)}`;
}

/** A player's forecast rating and the singles it comes from. Nothing when there are no new games. */
export function RatingForecastCard({ pool, player }: { pool: PoolData; player: Player }) {
  const status = pool.pool.ratings;
  const forecast = player.forecast;
  if (!status || !forecast || player.rating === null) return null;
  return (
    <section className="card">
      <h2>Rating forecast</h2>
      <p className="forecast-headline">
        <strong>{forecast.rating}</strong> ({signed(forecast.rating - player.rating)}) once {count(forecast.games.length, 'singles game')} since
        the official list are rated.
      </p>
      <p className="muted small">
        Official rating {player.rating}, from the {listNote(status)}.
      </p>
      <div className="table-scroll">
        <table className="data-table">
          <thead>
            <tr>
              <th scope="col">Date</th>
              <th scope="col">Against</th>
              <th scope="col">Result</th>
              <th scope="col" className="num">Points</th>
            </tr>
          </thead>
          <tbody>
            {forecast.games.map((g, i) => (
              <tr key={`${g.matchId}-${g.opponentId}-${i}`}>
                <td>
                  <a href={href('match', g.poolId, g.matchId)}>{shortDay(g.date)}</a>
                </td>
                <td>
                  <a href={href('player', g.poolId, g.opponentId)}>{g.opponentName || 'Unknown player'}</a>
                  <div className="muted small">Rated {g.opp}</div>
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
      <summary>How is this worked out?</summary>
      <ul className="reasons">
        <li>
          Each singles game moves both players' ratings by a set number of points, from the rating gap and who won. Beating a
          higher-rated player earns the most.
        </li>
        <li>All games of a match day use the ratings from before that day.</li>
        <li>
          Doubles and walkovers do not count. Tournament games and games against unrated players are not included here, so the
          official rating can differ.
        </li>
      </ul>
      <div className="table-scroll">
        <table className="data-table rating-table">
          <caption>Points by rating gap</caption>
          <thead>
            <tr>
              <th scope="col" rowSpan={2}>
                Gap
              </th>
              <th scope="colgroup" colSpan={2}>
                Higher rated
              </th>
              <th scope="colgroup" colSpan={2}>
                Lower rated
              </th>
            </tr>
            <tr>
              <th scope="col" className="num">
                wins
              </th>
              <th scope="col" className="num">
                loses
              </th>
              <th scope="col" className="num">
                wins
              </th>
              <th scope="col" className="num">
                loses
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
      <p className="muted small">Read from rated games on bordtennisportalen.dk. This is an estimate, not the official calculation.</p>
    </details>
  );
}
