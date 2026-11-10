import type { Odds } from '../data/forecast';
import { t } from '../i18n';
import { percent } from '../lib/text';

const KEYS = ['win', 'draw', 'loss'] as const;
const parts = () => KEYS.map((key) => ({ key, label: t.odds[key] }));

/** With an odd number of games a team match cannot end level. */
export function drawsPossible(odds: Odds): boolean {
  return odds.drawPossible;
}

export function oddsSummary(odds: Odds): string {
  return t.odds.summary(odds.win, odds.draw, odds.loss, drawsPossible(odds));
}

/**
 * Tall segmented bar: one whole (100%) split into win, draw and loss, shares printed where they fit.
 * `sides` names the two ends after the teams, for a bar that is not from "our" side.
 */
export function OddsBar({ odds, sides }: { odds: Odds; sides?: { win: string; loss: string } }) {
  const fits = (v: number) => v >= 0.12;
  const named = parts().map((part) => ({ ...part, label: part.key !== 'draw' && sides ? sides[part.key] : part.label }));
  return (
    <figure className="odds">
      <div className="odds-bar" role="img" aria-label={sides ? named.map(({ key, label }) => `${label} ${percent(odds[key])}`).join(', ') : oddsSummary(odds)}>
        {named.map(({ key, label }) =>
          odds[key] >= 0.005 ? (
            <span key={key} className={`odds-part odds-${key}`} style={{ flexGrow: odds[key] }} title={`${label} ${percent(odds[key])}`}>
              {fits(odds[key]) && <span className="odds-label">{percent(odds[key])}</span>}
            </span>
          ) : null,
        )}
      </div>
      <figcaption className="legend">
        {named.filter(({ key }) => key !== 'draw' || drawsPossible(odds)).map(({ key, label }) => (
          <span key={key}>
            <i className={`swatch odds-swatch-${key}`} /> {label}
            {!fits(odds[key]) && ` ${percent(odds[key])}`}
          </span>
        ))}
      </figcaption>
    </figure>
  );
}

/** Thin segmented bar for lists: the text beside it carries the numbers. */
export function ThinOdds({ odds }: { odds: Odds }) {
  return (
    <span className="odds-thin" role="img" aria-label={oddsSummary(odds)}>
      {KEYS.map((key) =>
        odds[key] >= 0.005 ? <span key={key} className={`odds-part odds-${key}`} style={{ flexGrow: odds[key] }} /> : null,
      )}
    </span>
  );
}
