import type { TeamMatch } from '../data/model';
import { predictionOdds, predictionRecord } from '../data/prematch';
import { oneDecimal, percent } from '../lib/text';

/** "Predicted 5.6–4.4, 62% to win" under a result, from one team's side. */
export function PredictedLine({ match, teamId }: { match: TeamMatch; teamId: string }) {
  const odds = predictionOdds(match, teamId);
  if (!odds) return null;
  return (
    <span className="result-predicted">
      Predicted {oneDecimal(odds.expectedGames)}–{oneDecimal(odds.totalGames - odds.expectedGames)}, {percent(odds.win)} to win
    </span>
  );
}

/** "Predictions made before each match got the likeliest outcome right in 14 of 20." */
export function PredictionRecordNote({ matches }: { matches: readonly TeamMatch[] }) {
  const record = predictionRecord(matches);
  if (!record) return null;
  return (
    <details className="why">
      <summary>
        Predicted before each match: right in {record.right} of {record.matches}
      </summary>
      <p className="muted small">
        Each played match keeps the prediction made from what was known before its day: the official rating list of that day, the
        earlier results, and each player's form until then. “Right” means the likeliest outcome happened. Matches without a
        prediction were a team's first of the season.
      </p>
    </details>
  );
}
