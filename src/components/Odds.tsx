import type { Odds } from '../data/forecast';
import { percent } from '../lib/text';

const PARTS = [
  { key: 'win', label: 'Win' },
  { key: 'draw', label: 'Draw' },
  { key: 'loss', label: 'Loss' },
] as const;

/** With an odd number of games a team match cannot end level. */
export function drawsPossible(odds: Odds): boolean {
  return odds.totalGames % 2 === 0;
}

export function oddsSummary(odds: Odds): string {
  return drawsPossible(odds)
    ? `Win ${percent(odds.win)}, draw ${percent(odds.draw)}, loss ${percent(odds.loss)}`
    : `Win ${percent(odds.win)}, loss ${percent(odds.loss)}`;
}

/** "45% chance to win, 22% to draw." (no draw part when a draw is impossible) */
export function oddsSentence(odds: Odds): string {
  return drawsPossible(odds) ? `chance to win, ${percent(odds.draw)} to draw.` : 'chance to win.';
}

/** Tall segmented bar: one whole (100%) split into win, draw and loss, shares printed where they fit. */
export function OddsBar({ odds }: { odds: Odds }) {
  const fits = (v: number) => v >= 0.12;
  return (
    <figure className="odds">
      <div className="odds-bar" role="img" aria-label={oddsSummary(odds)}>
        {PARTS.map(({ key, label }) =>
          odds[key] >= 0.005 ? (
            <span key={key} className={`odds-part odds-${key}`} style={{ flexGrow: odds[key] }} title={`${label} ${percent(odds[key])}`}>
              {fits(odds[key]) && <span className="odds-label">{percent(odds[key])}</span>}
            </span>
          ) : null,
        )}
      </div>
      <figcaption className="legend">
        {PARTS.filter(({ key }) => key !== 'draw' || drawsPossible(odds)).map(({ key, label }) => (
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
      {PARTS.map(({ key }) =>
        odds[key] >= 0.005 ? <span key={key} className={`odds-part odds-${key}`} style={{ flexGrow: odds[key] }} /> : null,
      )}
    </span>
  );
}
