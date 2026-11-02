import type { ReactNode } from 'react';
import type { Loaded } from '../data/load';
import type { PoolInfo } from '../data/model';
import type { Outcome } from '../data/stats';
import { parseLocal } from '../lineup/format';

const dayFormat = new Intl.DateTimeFormat('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });
const longFormat = new Intl.DateTimeFormat('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

export const matchDay = (date: string) => dayFormat.format(parseLocal(date));
export const matchDayLong = (date: string) => longFormat.format(parseLocal(date));
export const matchTime = (date: string) => date.split('T')[1] ?? '';

export function percent(rate: number | null): string {
  return rate === null ? '–' : `${Math.round(rate * 100)}%`;
}

export function ordinal(n: number): string {
  const tail = n % 100 >= 11 && n % 100 <= 13 ? 'th' : (['th', 'st', 'nd', 'rd'][n % 10] ?? 'th');
  return `${n}${tail}`;
}

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
    <span className="meter" role="img" aria-label={`${label}: ${percent(rate)} won`}>
      <span className="meter-fill" style={{ width: `${rate * 100}%` }} />
    </span>
  );
}

const OUTCOME_LABEL: Record<Outcome, string> = { won: 'Won', drawn: 'Draw', lost: 'Lost' };

export function OutcomeBadge({ outcome }: { outcome: Outcome | 'single-won' | 'single-lost' }) {
  const kind = outcome === 'single-won' ? 'won' : outcome === 'single-lost' ? 'lost' : outcome;
  return <span className={`badge badge-${kind}`}>{OUTCOME_LABEL[kind]}</span>;
}

export function PageState({ state, what }: { state: Exclude<Loaded<unknown>, { status: 'ready' }>; what: string }) {
  if (state.status === 'loading') return <p className="page-state">Loading {what}…</p>;
  if (state.error === 'not-found') return <NotFound what={what} />;
  return (
    <div className="page-state">
      <p>Could not load {what}. Check your connection and try again.</p>
      <p className="muted">{state.error}</p>
    </div>
  );
}

export function NotFound({ what }: { what: string }) {
  return (
    <div className="page-state">
      <h1>Not found</h1>
      <p className="muted">There is no data for {what} yet. Only imported pools are available.</p>
      <a className="button" href="#/">
        Back to start
      </a>
    </div>
  );
}
