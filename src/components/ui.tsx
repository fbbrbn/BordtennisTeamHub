import type { ReactNode } from 'react';
import type { Loaded } from '../data/load';
import type { PoolInfo } from '../data/model';
import type { Outcome } from '../data/stats';
import { lang, t } from '../i18n';
import type { Thing } from '../i18n/en';
import { longDate, shortDate, weekdayDate } from '../i18n/format';

/** "Sat 7 Nov" and "lør. 7. nov." */
export const matchDay = (date: string) => weekdayDate(date, lang);
export const matchDayLong = (date: string) => longDate(date, lang);
export const matchTime = (date: string) => date.split('T')[1] ?? '';
/** "23 Oct" and "23. okt." */
export const shortDay = (date: string) => shortDate(date, lang);

export { ordinal, percent, signed } from '../lib/text';

/** Link to the same page on bordtennisportalen.dk (its URL hash: subPage,season,pool,age,region,team,match,club,player). */
export function portalUrl(pool: PoolInfo, subPage: number, ids: { teamId?: string; matchId?: string } = {}): string {
  const hash = [subPage, pool.seasonId, pool.id, pool.ageGroupId, pool.regionId, ids.teamId ?? '', ids.matchId ?? '', '', ''];
  return `https://www.bordtennisportalen.dk/DBTU/HoldTurnering/Stilling/#${hash.join(',')}`;
}

export function StatTile({ label, value, detail }: { label: string; value: ReactNode; detail?: ReactNode }) {
  return (
    <div className="tile">
      <div className="tile-label">{label}</div>
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
