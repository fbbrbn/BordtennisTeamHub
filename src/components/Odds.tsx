import type { Odds } from '../data/forecast';
import { percent } from '../lib/text';

const PARTS = [
  { key: 'win', label: 'Win' },
  { key: 'draw', label: 'Draw' },
  { key: 'loss', label: 'Loss' },
] as const;

export function oddsSummary(odds: Odds): string {
  return `Win ${percent(odds.win)}, draw ${percent(odds.draw)}, loss ${percent(odds.loss)}`;
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
        {PARTS.map(({ key, label }) => (
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
