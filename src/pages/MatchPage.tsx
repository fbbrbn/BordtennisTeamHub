import { OddsBar } from '../components/Odds';
import { PastSeasonTag } from '../components/PlayerHistory';
import { listNote, RatingRules } from '../components/RatingForecast';
import { loadPool, useLoaded } from '../data/load';
import type { PoolData, TeamMatch } from '../data/model';
import { homeOutcome, likeliest, predictionOdds } from '../data/prematch';
import { matchRatingPoints } from '../data/ratings';
import { playersById, teamsById } from '../data/stats';
import { t } from '../i18n';
import { href } from '../lib/router';
import { matchDayLong, matchTime, NotFound, PageState, percent, portalUrl, signed } from '../components/ui';
import { oneDecimal } from '../lib/text';
import { MatchPreview } from './MatchPreview';

export function MatchPage({ poolId, matchId }: { poolId: string; matchId: string }) {
  const loaded = useLoaded(() => loadPool(poolId), poolId);
  if (loaded.status !== 'ready') return <PageState state={loaded} what="match" />;
  const match = loaded.data.matches.find((m) => m.id === matchId);
  if (!match) return <NotFound what="match" />;
  return <MatchView pool={loaded.data} match={match} />;
}

function MatchView({ pool, match }: { pool: PoolData; match: TeamMatch }) {
  const teams = teamsById(pool);
  const players = playersById(pool);
  const home = teams.get(match.homeTeamId);
  const away = teams.get(match.awayTeamId);
  const ratingLines = matchRatingPoints(pool, match);
  const names = (ids: string[]) =>
    ids.length === 0 ? (
      <span className="muted">{t.match.noPlayer}</span>
    ) : (
      ids.map((id, i) => (
        <span key={id}>
          {i > 0 && t.common.andJoin}
          <a href={href('player', pool.pool.id, id)}>{players.get(id)?.name ?? t.common.unknownPlayer}</a>
        </span>
      ))
    );

  return (
    <div className="dash">
      <header className="dash-head">
        <p className="eyebrow">
          <a href={href('pool', pool.pool.id)}>{pool.pool.name}</a> · {t.match.eyebrow(match.id)} <PastSeasonTag pool={pool.pool} />
        </p>
        <h1 className="match-title">
          <a href={href('team', pool.pool.id, match.homeTeamId)}>{home?.name ?? t.common.home}</a>
          <span className="match-score">{match.score ? match.score.join('–') : t.common.vs}</span>
          <a href={href('team', pool.pool.id, match.awayTeamId)}>{away?.name ?? t.common.away}</a>
        </h1>
        <p className="muted">
          {matchDayLong(match.date)} · {matchTime(match.date)} · {match.venue}
          {match.walkover && t.match.walkover}
        </p>
        <div className="button-row">
          <a className="button" href={portalUrl(pool.pool, 5, { matchId: match.id })} target="_blank" rel="noreferrer">
            {t.common.openOnPortal}
          </a>
        </div>
      </header>

      {!match.score && <MatchPreview pool={pool} match={match} />}

      {match.score && (
      <section className="card">
        <h2>{t.match.games}</h2>
        {match.score && !match.games && <p className="muted">{t.match.gamesUnavailable}</p>}
        {match.games && (
          <div className="table-scroll">
            <table className="data-table games-table wrap-head">
              <thead>
                <tr>
                  <th scope="col">{t.match.game}</th>
                  <th scope="col">{home?.name ?? t.common.home}</th>
                  <th scope="col" className="num">{t.common.sets}</th>
                  <th scope="col">{away?.name ?? t.common.away}</th>
                </tr>
              </thead>
              <tbody>
                {match.games.map((g) => (
                  <tr key={g.label}>
                    <td className="muted">
                      {g.label}
                      {g.walkover && t.match.wo}
                    </td>
                    <td className={g.winner === 'home' ? 'winner' : undefined}>
                      {names(g.home)}
                      {g.winner === 'home' && <span className="sr-only">{t.match.wonSr}</span>}
                    </td>
                    <td className="num strong">
                      {g.sets[0]}–{g.sets[1]}
                    </td>
                    <td className={g.winner === 'away' ? 'winner' : undefined}>
                      {names(g.away)}
                      {g.winner === 'away' && <span className="sr-only">{t.match.wonSr}</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
      )}

      {match.score && match.prediction && <PredictionCard match={match} homeName={home?.name ?? t.common.home} awayName={away?.name ?? t.common.away} />}

      {pool.pool.ratings && ratingLines.length > 0 && (
        <section className="card">
          <h2>{t.match.ratingPoints}</h2>
          <p className="muted">{t.match.ratingPointsNote(listNote(pool.pool.ratings))}</p>
          <div className="table-scroll">
            <table className="data-table">
              <thead>
                <tr>
                  <th scope="col">{t.common.player}</th>
                  <th scope="col" className="num">
                    {t.match.before}
                  </th>
                  <th scope="col" className="num">
                    {t.common.points}
                  </th>
                </tr>
              </thead>
              <tbody>
                {ratingLines.map((line) => (
                  <tr key={line.playerId}>
                    <th scope="row">
                      <a href={href('player', pool.pool.id, line.playerId)}>{players.get(line.playerId)?.name ?? t.common.unknownPlayer}</a>
                      <div className="muted small">{(line.side === 'home' ? home : away)?.name}</div>
                    </th>
                    <td className="num">{line.before}</td>
                    <td className="num strong">{signed(line.points)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <RatingRules />
        </section>
      )}
    </div>
  );
}

/** What was predicted before a played match, next to how it ended. */
function PredictionCard({ match, homeName, awayName }: { match: TeamMatch; homeName: string; awayName: string }) {
  const odds = predictionOdds(match, match.homeTeamId);
  const outcome = homeOutcome(match.score, match.walkover);
  if (!odds || !match.prediction || !match.score) return null;
  const expected = `${oneDecimal(odds.expectedGames)}–${oneDecimal(odds.totalGames - odds.expectedGames)}`;
  const favourite = likeliest(match.prediction);
  const favouriteText = favourite === 'win' ? t.match.winFor(homeName) : favourite === 'loss' ? t.match.winFor(awayName) : t.match.aDraw;
  return (
    <section className="card">
      <h2>{t.match.predictionTitle}</h2>
      <p className="odds-headline">
        {t.match.predictionHeadline(<strong>{percent(odds.win)}</strong>, homeName, odds.drawPossible ? percent(odds.draw) : null)}
      </p>
      <OddsBar odds={odds} />
      <p>
        {t.match.expectedEnded(<strong>{expected}</strong>, <strong>{match.score.join('–')}</strong>)}{' '}
        {outcome === null ? '' : outcome === favourite ? t.match.likeliestHappened(favouriteText) : t.match.notLikeliest(favouriteText)}
      </p>
      <details className="why">
        <summary>{t.match.howPredicted}</summary>
        <p className="muted small">{t.match.howPredictedNote(homeName)}</p>
        {match.prediction.lineups && <p className="muted small">{t.prediction.borrowed[match.prediction.lineups]}</p>}
      </details>
    </section>
  );
}

