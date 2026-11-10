import { useState, type ReactNode } from 'react';
import type { Loaded } from '../data/load';
import type { PoolInfo } from '../data/model';
import type { Outcome } from '../data/stats';
import { lang, t } from '../i18n';
import type { Thing } from '../i18n/en';
import { dayDate, longDate, shortDate, weekdayDate } from '../i18n/format';

/** "Sat 7 Nov" and "lør. 7. nov." */
export const matchDay = (date: string) => weekdayDate(date, lang);
export const matchDayLong = (date: string) => longDate(date, lang);
export const matchTime = (date: string) => date.split('T')[1] ?? '';
/** "23 Oct" and "23. okt." */
export const shortDay = (date: string) => shortDate(date, lang);
/** "23 Oct 2025" and "23. okt. 2025" */
export const dayWithYear = (date: string) => dayDate(date, lang);

export { ordinal, percent, signed } from '../lib/text';

/** Link to the same page on bordtennisportalen.dk (its URL hash: subPage,season,pool,age,region,team,match,club,player). */
export function portalUrl(pool: PoolInfo, subPage: number, ids: { teamId?: string; matchId?: string } = {}): string {
  const hash = [subPage, pool.seasonId, pool.id, pool.ageGroupId, pool.regionId, ids.teamId ?? '', ids.matchId ?? '', '', ''];
  return `https://www.bordtennisportalen.dk/DBTU/HoldTurnering/Stilling/#${hash.join(',')}`;
}

/** A list row that is one tap target: the whole row leads to `to`, and a chevron at its end says so. */
export function RowLink({ to, children }: { to: string; children: ReactNode }) {
  return (
    <a className="row-link" href={to}>
      {children}
    </a>
  );
}

/**
 * The first `limit` items of a long list, and the button that shows the rest (null when all fit).
 * Long lists start short so the page stays short on a phone.
 */
export function useShowAll<T>(items: readonly T[], limit: number): [readonly T[], ReactNode] {
  const [all, setAll] = useState(false);
  if (items.length <= limit) return [items, null];
  const button = (
    <button type="button" className="button show-all" aria-expanded={all} onClick={() => setAll((v) => !v)}>
      {all ? t.common.showFewer : t.common.showAll(items.length)}
    </button>
  );
  return [all ? items : items.slice(0, limit), button];
}

/** The same page on bordtennisportalen.dk: a quiet link at the foot of a page. */
export function PortalLink({ to }: { to: string }) {
  return (
    <p className="page-source muted small">
      <a href={to} target="_blank" rel="noreferrer">
        {t.common.onPortal}
      </a>
    </p>
  );
}

/** One key number. `hint` spells out a short label ("W–D–L": won, drawn, lost) for hover and screen readers. */
export function StatTile({ label, hint, value, detail }: { label: string; hint?: string; value: ReactNode; detail?: ReactNode }) {
  return (
    <div className="tile">
      <div className="tile-label" title={hint}>
        {hint ? <abbr title={hint}>{label}</abbr> : label}
      </div>
      <div className="tile-value">{value}</div>
      {detail !== undefined && <div className="tile-detail">{detail}</div>}
    </div>
  );
}

/** Thin meter: share of games won. The track is a lighter step of the same blue. */
export function WinMeter({ rate, label }: { rate: number | null; label: string }) {
  if (rate === null) return null;
  return (
    <span className="meter" role="img" aria-label={t.common.meterLabel(label, rate)}>
      <span className="meter-fill" style={{ width: `${rate * 100}%` }} />
    </span>
  );
}

export function OutcomeBadge({ outcome }: { outcome: Outcome | 'single-won' | 'single-lost' }) {
  const kind = outcome === 'single-won' ? 'won' : outcome === 'single-lost' ? 'lost' : outcome;
  const label = kind === 'won' ? t.common.won : kind === 'lost' ? t.common.lost : t.common.draw;
  return <span className={`badge badge-${kind}`}>{label}</span>;
}

export function PageState({ state, what }: { state: Exclude<Loaded<unknown>, { status: 'ready' }>; what: Thing }) {
  if (state.status === 'loading') return <p className="page-state">{t.states.loading(what)}</p>;
  if (state.error === 'not-found') return <NotFound what={what} />;
  return (
    <div className="page-state">
      <p>{t.states.failed(what)}</p>
      <p className="muted">{state.error}</p>
    </div>
  );
}

export function NotFound({ what }: { what: Thing }) {
  return (
    <div className="page-state">
      <h1>{t.states.notFound}</h1>
      <p className="muted">{t.states.noData(what)}</p>
      <a className="button" href="#/">
        {t.states.backToStart}
      </a>
    </div>
  );
}
