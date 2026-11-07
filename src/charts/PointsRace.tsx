import { useState, type KeyboardEvent, type PointerEvent } from 'react';
import { t } from '../i18n';
import { niceTicks, useWidth } from './useWidth';

export interface RaceSeries {
  id: string;
  name: string;
  /** Cumulative points; index 0 is the start of the season. */
  points: number[];
}

const HEIGHT = 240;
const M = { top: 12, right: 44, bottom: 30, left: 32 };

/** Line chart, emphasis form: one team in the accent color, the rest of the pool in gray. */
export function PointsRace({ series, highlightId }: { series: RaceSeries[]; highlightId: string }) {
  const [ref, width] = useWidth<HTMLDivElement>();
  const [hover, setHover] = useState<number | null>(null);
  const highlight = series.find((s) => s.id === highlightId);
  const others = series.filter((s) => s.id !== highlightId);
  const maxX = Math.max(1, ...series.map((s) => s.points.length - 1));
  const maxY = Math.max(2, ...series.flatMap((s) => s.points));
  const yTicks = niceTicks(0, maxY, 4);
  const yMax = Math.max(maxY, yTicks[yTicks.length - 1]);
  const plotW = Math.max(120, width - M.left - M.right);
  const plotH = HEIGHT - M.top - M.bottom;
  const x = (i: number) => M.left + (i / maxX) * plotW;
  const y = (v: number) => M.top + plotH - (v / yMax) * plotH;
  const path = (pts: number[]) => pts.map((v, i) => `${i === 0 ? 'M' : 'L'}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join('');
  const xTicks = maxX <= 12 ? Array.from({ length: maxX + 1 }, (_, i) => i) : niceTicks(0, maxX, 6);

  const onMove = (e: PointerEvent<SVGRectElement>) => {
    const box = e.currentTarget.getBoundingClientRect();
    const i = Math.round(((e.clientX - box.left) / box.width) * maxX);
    setHover(Math.max(0, Math.min(maxX, i)));
  };
  const onKey = (e: KeyboardEvent<SVGSVGElement>) => {
    if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
    e.preventDefault();
    setHover((h) => Math.max(0, Math.min(maxX, (h ?? maxX) + (e.key === 'ArrowRight' ? 1 : -1))));
  };

  const rows =
    hover === null
      ? []
      : series
          .map((s) => ({ s, value: s.points[hover] }))
          .filter((r): r is { s: RaceSeries; value: number } => r.value !== undefined)
          .sort((a, b) => b.value - a.value || a.s.name.localeCompare(b.s.name, 'da'));
  const TIP_W = 230;
  const tipLeft =
    hover === null
      ? 0
      : x(hover) > width / 2
        ? Math.max(0, x(hover) - 12 - TIP_W)
        : Math.min(x(hover) + 12, Math.max(0, width - TIP_W));

  return (
    <figure className="chart">
      <div className="chart-plot" ref={ref}>
        <svg
          width={width}
          height={HEIGHT}
          role="img"
          aria-label={t.charts.raceLabel(highlight?.name ?? null, highlight ? highlight.points[highlight.points.length - 1] : null)}
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
          <line className="axis" x1={M.left} x2={M.left + plotW} y1={y(0)} y2={y(0)} />
          {xTicks.map((t) => (
            <text key={t} className="tick" x={x(t)} y={HEIGHT - M.bottom + 18} textAnchor="middle">
              {t}
            </text>
          ))}
          {others.map((s) => (
            <path key={s.id} className="line line-muted" d={path(s.points)} />
          ))}
          {highlight && (
            <>
              <path className="line line-accent" d={path(highlight.points)} />
              {highlight.points.map((v, i) => (
                <circle key={i} className="dot dot-accent" cx={x(i)} cy={y(v)} r={4} />
              ))}
              <text
                className="end-label"
                x={x(highlight.points.length - 1) + 10}
                y={y(highlight.points[highlight.points.length - 1])}
                dy="0.32em"
              >
                {t.charts.pts(highlight.points[highlight.points.length - 1])}
              </text>
            </>
          )}
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
        {hover !== null && (
          <div className="tooltip" style={{ left: tipLeft, top: 8 }} role="status">
            <div className="tooltip-title">{t.charts.afterMatch(hover)}</div>
            {rows.map(({ s, value }) => (
              <div key={s.id} className={s.id === highlightId ? 'tooltip-row is-highlight' : 'tooltip-row'}>
                <span className={s.id === highlightId ? 'key key-accent' : 'key key-muted'} />
                <strong>{value}</strong>
                <span>{s.name}</span>
              </div>
            ))}
          </div>
        )}
      </div>
      <figcaption className="legend">
        <span>
          <i className="key key-accent" /> {highlight?.name ?? t.common.team}
        </span>
        <span>
          <i className="key key-muted" /> {t.charts.otherTeams}
        </span>
        <span className="muted">{t.charts.xAxisMatches}</span>
      </figcaption>
      <details className="table-view">
        <summary>{t.common.showAsTable}</summary>
        <div className="table-scroll">
          <table className="data-table">
            <thead>
              <tr>
                <th scope="col">{t.common.team}</th>
                {Array.from({ length: maxX }, (_, i) => (
                  <th key={i} scope="col" className="num">
                    {i + 1}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {[...series]
                .sort((a, b) => (b.points[b.points.length - 1] ?? 0) - (a.points[a.points.length - 1] ?? 0))
                .map((s) => (
                  <tr key={s.id} className={s.id === highlightId ? 'is-highlight' : undefined}>
                    <th scope="row">{s.name}</th>
                    {Array.from({ length: maxX }, (_, i) => (
                      <td key={i} className="num">
                        {s.points[i + 1] ?? '–'}
                      </td>
                    ))}
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </details>
    </figure>
  );
}
