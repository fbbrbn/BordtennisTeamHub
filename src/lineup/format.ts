import type { Plan, PlannerState } from './types';

const dayFormat = new Intl.DateTimeFormat('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });

/** Parses `YYYY-MM-DD` or `YYYY-MM-DDTHH:mm` as a local date. */
export function parseLocal(date: string): Date {
  const [day, time = '00:00'] = date.split('T');
  const [y, m, d] = day.split('-').map(Number);
  const [hh, mm] = time.split(':').map(Number);
  return new Date(y, m - 1, d, hh, mm);
}

export function formatDay(date: string): string {
  return dayFormat.format(parseLocal(date));
}

export function formatTime(date: string): string | null {
  const time = date.split('T')[1];
  return time && time !== '00:00' ? time : null;
}

export function isPast(date: string, now = new Date()): boolean {
  const d = parseLocal(date);
  if (!date.includes('T')) d.setHours(23, 59);
  return d.getTime() < now.getTime();
}

export function formatShare(value: number | null): string {
  if (value === null) return '–';
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}

/** Plain-text summary to paste into the team chat. */
export function lineupMessage(state: PlannerState, plan: Plan, maxMatches = 5): string {
  const name = (id: string) => state.players.find((p) => p.id === id)?.name ?? '?';
  const upcoming = plan.fixtures.filter((f) => f.status === 'planned').slice(0, maxMatches);
  const lines = [`${state.teamName || 'Our team'}: lineup plan`];

  for (const f of upcoming) {
    const time = formatTime(f.fixture.date);
    const when = `${formatDay(f.fixture.date)}${time ? ` ${time}` : ''}`;
    const where = f.fixture.home ? 'home' : 'away';
    const players = f.lineup.map(name).join(', ') || 'nobody yet';
    const open = f.missing > 0 ? ` (+${f.missing} needed)` : '';
    const reserve = f.reserves.length > 0 ? `, reserve: ${name(f.reserves[0])}` : '';
    lines.push(`• ${when} vs ${f.fixture.opponent || '?'} (${where}): ${players}${open}${reserve}`);
  }
  if (upcoming.length === 0) lines.push('No upcoming matches planned.');

  const played = plan.tallies
    .filter((t) => t.played > 0)
    .map((t) => `${name(t.playerId)} ${t.played}`)
    .join(' · ');
  if (played) lines.push(`Matches played so far: ${played}`);
  lines.push('The plan updates as people answer. Tell the captain if you cannot play.');
  return lines.join('\n');
}
