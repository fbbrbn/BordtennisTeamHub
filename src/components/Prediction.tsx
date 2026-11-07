import type { TeamMatch } from '../data/model';
import { predictionOdds, predictionRecord } from '../data/prematch';
import { t } from '../i18n';

/** "Predicted 5.6–4.4, 62% to win" under a result, from one team's side. */
export function PredictedLine({ match, teamId }: { match: TeamMatch; teamId: string }) {
  const odds = predictionOdds(match, teamId);
  if (!odds) return null;
  return (
    <span className="result-predicted">{t.prediction.line(odds.expectedGames, odds.totalGames - odds.expectedGames, odds.win)}</span>
  );
}

/** "Predictions made before each match got the likeliest outcome right in 14 of 20." */
export function PredictionRecordNote({ matches }: { matches: readonly TeamMatch[] }) {
  const record = predictionRecord(matches);
  if (!record) return null;
  return (
    <details className="why">
      <summary>{t.prediction.record(record.right, record.matches)}</summary>
      <p className="muted small">{t.prediction.recordNote}</p>
    </details>
  );
}
