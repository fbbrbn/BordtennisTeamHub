import { useState, type KeyboardEvent, type PointerEvent } from 'react';
import { t } from '../i18n';
import { niceTicks, useWidth } from './useWidth';

export interface RatingPoint {
  /** Short label on the axis, e.g. "15/16" or "Now". */
  label: string;
  /** Tooltip title, e.g. "Start of 2015/2016". */
  title: string;
  rating: number;
  /** An estimate, drawn hollow at the end of a dashed segment. */
  estimate?: boolean;
}

const HEIGHT = 220;
const M = { top: 14, right: 18, bottom: 30, left: 44 };

/** One player's rating over the seasons: a single series, so the title names it and there is no legend box. */
export function RatingHistory({ points }: { points: RatingPoint[] }) {
  const [ref, width] = useWidth<HTMLDivElement>();
  const [hover, setHover] = useState<number | null>(null);
  const values = points.map((p) => p.rating);
  const lo = Math.min(...values);
  const hi = Math.max(...values);
  // The range snaps to whole tick steps around the data, so the outer gridlines frame the plot.
  const pad = Math.max(20, (hi - lo) * 0.1);
  const guide = niceTicks(lo - pad, hi + pad, 4);
  const step = guide.length > 1 ? guide[1] - guide[0] : 50;
  const yMin = Math.floor((lo - pad / 2) / step) * step;
  const yMax = Math.max(yMin + step, Math.ceil((hi + pad / 2) / step) * step);
  const yTicks = Array.from({ length: Math.round((yMax - yMin) / step) + 1 }, (_, i) => yMin + i * step);
  const plotW = Math.max(120, width - M.left - M.right);
  const plotH = HEIGHT - M.top - M.bottom;
  const last = Math.max(1, points.length - 1);
  const x = (i: number) => M.left + (points.length === 1 ? plotW / 2 : (i / last) * plotW);
  const y = (v: number) => M.top + plotH - ((v - yMin) / (yMax - yMin)) * plotH;
  const solid = points.filter((p) => !p.estimate);
  const path = (from: number, to: number) =>
    points
      .slice(from, to + 1)
      .map((p, k) => `${k === 0 ? 'M' : 'L'}${x(from + k).toFixed(1)},${y(p.rating).toFixed(1)}`)
      .join('');
  // Label every point when they fit, otherwise every other one (always the first and last).
  const every = plotW / points.length < 34 ? 2 : 1;
  const labelled = (i: number) => i === 0 || i === points.length - 1 || i % every === 0;

  const onMove = (e: PointerEvent<SVGRectElement>) => {
    const box = e.currentTarget.getBoundingClientRect();
    const i = Math.round(((e.clientX - box.left) / box.width) * last);
    setHover(Math.max(0, Math.min(points.length - 1, i)));
  };
  const onKey = (e: KeyboardEvent<SVGSVGElement>) => {
    if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
    e.preventDefault();
    setHover((h) => Math.max(0, Math.min(points.length - 1, (h ?? points.length - 1) + (e.key === 'ArrowRight' ? 1 : -1))));
  };
  const tip = hover === null ? null : points[hover];
  const TIP_W = 180;
  const tipLeft = hover === null ? 0 : x(hover) > width / 2 ? Math.max(0, x(hover) - 12 - TIP_W) : Math.min(x(hover) + 12, Math.max(0, width - TIP_W));

  return (
    <figure className="chart">
      <div className="chart-plot" ref={ref}>
        <svg
          width={width}
          height={HEIGHT}
          role="img"
          aria-label={t.charts.historyLabel(points[0].rating, points[points.length - 1].rating)}
          tabIndex={0}
          onKeyDown={onKey}
          onBlur={() => setHover(null)}
        >
          {yTicks.map((t) => (
            <g key={t}>
              <line className="grid" x1={M.left} x2={M.left + plotW} y1={y(t)} y2={y(t)} />
              <text className="tick" x={M.left - 8} y={y(t)} dy="0.32em" textAnchor="end">
                {t}
              </text>
            </g>
          ))}
          {points.map((p, i) =>
            labelled(i) ? (
              <text key={i} className="tick" x={x(i)} y={HEIGHT - M.bottom + 18} textAnchor="middle">
                {p.label}
              </text>
            ) : null,
          )}
          {solid.length > 1 && <path className="line line-accent" d={path(0, solid.length - 1)} />}
          {points.length > solid.length && solid.length > 0 && <path className="line line-accent line-estimate" d={path(solid.length - 1, points.length - 1)} />}
          {points.map((p, i) => (
            <circle key={i} className={p.estimate ? 'dot dot-estimate' : 'dot dot-accent'} cx={x(i)} cy={y(p.rating)} r={4.5} />
          ))}
          {hover !== null && <line className="crosshair" x1={x(hover)} x2={x(hover)} y1={M.top} y2={M.top + plotH} />}
          <rect
            className="hit"
            x={M.left - 8}
            y={M.top}
            width={plotW + 16}
            height={plotH}
            onPointerMove={onMove}
            onPointerDown={onMove}
            onPointerLeave={(e) => e.pointerType === 'mouse' && setHover(null)}
          />
        </svg>
        {tip && (
          <div className="tooltip" style={{ left: tipLeft, top: 8, width: TIP_W }} role="status">
            <div className="tooltip-title">{tip.title}</div>
            <div className="tooltip-row is-highlight">
              <span className={tip.estimate ? 'key key-estimate' : 'key key-accent'} />
              <strong>{tip.rating}</strong>
              <span>{tip.estimate ? t.charts.forecast : t.charts.rating}</span>
            </div>
          </div>
        )}
      </div>
      {points.some((p) => p.estimate) && (
        <figcaption className="legend">
          <span>
            <i className="key key-estimate" /> {t.charts.forecastLegend}
          </span>
        </figcaption>
      )}
      <details className="table-view">
        <summary>{t.common.showAsTable}</summary>
        <div className="table-scroll">
          <table className="data-table">
            <tbody>
              {points.map((p, i) => (
                <tr key={i}>
                  <th scope="row">{p.title}</th>
                  <td className="num">
                    {p.rating}
                    {p.estimate ? t.charts.forecastSuffix : ''}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </figure>
  );
}
