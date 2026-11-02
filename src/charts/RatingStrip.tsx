import { useState } from 'react';
import { niceTicks, useWidth } from './useWidth';

export interface StripPoint {
  key: string;
  rating: number;
  won: boolean;
  /** Tooltip lines: first one is the headline. */
  lines: string[];
}

const HEIGHT = 150;
const M = { top: 22, right: 20, bottom: 30, left: 56 };

/** Singles results placed by the opponent's rating, in a Won row and a Lost row. */
export function RatingStrip({ points, ownRating }: { points: StripPoint[]; ownRating: number | null }) {
  const [ref, width] = useWidth<HTMLDivElement>();
  const [active, setActive] = useState<StripPoint | null>(null);
  const values = points.map((p) => p.rating).concat(ownRating ?? []);
  const lo = Math.floor((Math.min(...values) - 25) / 50) * 50;
  const hi = Math.ceil((Math.max(...values) + 25) / 50) * 50;
  const plotW = Math.max(120, width - M.left - M.right);
  const x = (v: number) => M.left + ((v - lo) / (hi - lo)) * plotW;
  const rowY = { won: M.top + 22, lost: M.top + 72 };
  const ticks = niceTicks(lo, hi, Math.max(3, Math.floor(plotW / 90)));
  const TIP_W = 220;
  const tip = (() => {
    if (!active) return { left: 0, top: 0 };
    const px = x(active.rating);
    const left = px + 16 + TIP_W <= width ? px + 16 : Math.max(0, px - 16 - TIP_W);
    return { left, top: (active.won ? rowY.won : rowY.lost) - 22 };
  })();

  return (
    <figure className="chart">
      <div className="chart-plot" ref={ref}>
        <svg width={width} height={HEIGHT} role="group" aria-label="Singles results by opponent rating">
          {ticks.map((t) => (
            <g key={t}>
              <line className="grid" x1={x(t)} x2={x(t)} y1={M.top} y2={HEIGHT - M.bottom} />
              <text className="tick" x={x(t)} y={HEIGHT - M.bottom + 18} textAnchor="middle">
                {t}
              </text>
            </g>
          ))}
          <text className="row-label" x={M.left - 12} y={rowY.won} dy="0.32em" textAnchor="end">
            Won
          </text>
          <text className="row-label" x={M.left - 12} y={rowY.lost} dy="0.32em" textAnchor="end">
            Lost
          </text>
          <line className="axis" x1={M.left} x2={M.left + plotW} y1={rowY.won} y2={rowY.won} />
          <line className="axis" x1={M.left} x2={M.left + plotW} y1={rowY.lost} y2={rowY.lost} />
          {ownRating !== null && (
            <g>
              <line className="reference" x1={x(ownRating)} x2={x(ownRating)} y1={M.top - 6} y2={HEIGHT - M.bottom} />
              <text className="reference-label" x={x(ownRating)} y={M.top - 10} textAnchor="middle">
                Own rating {ownRating}
              </text>
            </g>
          )}
          {points.map((p) => {
            const cy = p.won ? rowY.won : rowY.lost;
            const label = p.lines.join(', ');
            return (
              <g
                key={p.key}
                className={active?.key === p.key ? 'strip-point is-active' : 'strip-point'}
                tabIndex={0}
                role="img"
                aria-label={label}
                onPointerEnter={() => setActive(p)}
                onPointerDown={() => setActive(p)}
                onPointerLeave={(e) => e.pointerType === 'mouse' && setActive(null)}
                onFocus={() => setActive(p)}
                onBlur={() => setActive(null)}
              >
                <circle className="hit" cx={x(p.rating)} cy={cy} r={12} />
                <circle className="dot dot-accent" cx={x(p.rating)} cy={cy} r={4} />
              </g>
            );
          })}
        </svg>
        {active && (
          <div className="tooltip" style={{ left: tip.left, top: tip.top }} role="status">
            <div className="tooltip-row">
              <strong>{active.lines[0]}</strong>
            </div>
            {active.lines.slice(1).map((line) => (
              <div key={line} className="tooltip-sub">
                {line}
              </div>
            ))}
          </div>
        )}
      </div>
      <figcaption className="legend">
        <span className="muted">Each dot is one singles game, placed by the opponent's rating. The game list below has every value.</span>
      </figcaption>
    </figure>
  );
}
